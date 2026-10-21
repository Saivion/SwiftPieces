import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isKnownPage, knownPageSets, type KnownPages } from "@/lib/known-pages";
import knownPagesManifest from "@/registry/__registry__/known-pages.json";

/**
 * Per-IP request budgets for the API. Pages are only touched by the Server Action guard and the
 * unknown-page check below: the matcher admits `/api`, the CLI's `/r` registry paths, `/docs`, and
 * page POSTs shaped like a Server Action.
 *
 * On Cloudflare the matcher admits every page, though: OpenNext matches middleware by each matcher's
 * path regexp alone and drops `has` conditions (@opennextjs/aws core/routing/util.js,
 * getMiddlewareMatch), so the Server Action entries below match every page view, client navigation
 * and link prefetch. The budgets and the body cap therefore check the path themselves (`isApiPath`)
 * and never see a page: a page counted against the API's 60 a minute, and browsing /apps (a prefetch
 * per app link) answered the next click with a 429 (2026-10-20).
 *
 *   - A budget per minute. Search gets a larger one because the docs search box queries as you
 *     type. The view counter's write path has its own limit in its route.
 *   - A cap on request bodies, so nothing is parsed past a sensible size.
 *
 * Both checks fail open: a missing binding (plain `next dev`) or a limiter error lets the request
 * through.
 */

/** Largest body any endpoint here has a reason to accept. MCP messages are well under this. */
const MAX_BODY_BYTES = 64 * 1024;

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

function limiterFor(pathname: string): Limiter | undefined {
  try {
    const env = getCloudflareContext().env;
    return pathname.startsWith("/api/search") ? env.SEARCH_LIMITER : env.API_LIMITER;
  } catch {
    return undefined;
  }
}

async function overLimit(req: NextRequest): Promise<boolean> {
  try {
    const limiter = limiterFor(req.nextUrl.pathname);
    if (!limiter) return false;
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await limiter.limit({ key: ip });
    return !success;
  } catch {
    return false;
  }
}

function tooLarge(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return false;
  const length = Number(req.headers.get("content-length"));
  return Number.isFinite(length) && length > MAX_BODY_BYTES;
}

const noStore = { "Cache-Control": "no-store" };

/** The API and the CLI's registry: the only paths the budgets and the body cap apply to. */
function isApiPath(pathname: string): boolean {
  return /^\/(api|r)\//.test(pathname);
}

/**
 * The site has no Server Actions, so a POST that Next would treat as one only comes from scanners
 * (they probe `/`, `/api` and `/app` with a `Next-Action` header). Next 16 answers such a POST that
 * also carries `RSC: 1` by throwing "Invariant: Expected RSC response" (a 500 and an error log per
 * request), because the page's cache entry is HTML. Same test as Next's own
 * `getServerActionRequestMetadata`. Route handlers under `/api/` and `/r/` take their own POSTs.
 */
function isServerActionPost(req: NextRequest): boolean {
  if (req.method !== "POST" || isApiPath(req.nextUrl.pathname)) return false;
  const type = req.headers.get("content-type") ?? "";
  return req.headers.has("next-action") || type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data");
}

/**
 * Docs pages and registry names the prerendered routes don't have (lib/known-pages.ts). A docs URL
 * gets the not-found page from a path no route matches, a registry name a plain 404, so no render
 * of theirs is ever written to the incremental cache.
 */
const KNOWN_PAGES = knownPageSets(knownPagesManifest as KnownPages);
const NOT_FOUND_PATH = "/_unknown-page";

function unknownPage(req: NextRequest): "page" | "registry" | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const path = req.nextUrl.pathname;
  if (!/^\/(docs|r|api\/registry)(\/|$)/.test(path) || isKnownPage(path, KNOWN_PAGES)) return null;
  return path.startsWith("/docs") ? "page" : "registry";
}

export default async function middleware(req: NextRequest) {
  const unknown = unknownPage(req);
  if (unknown === "page") return NextResponse.rewrite(new URL(NOT_FOUND_PATH, req.url), { headers: noStore });
  if (unknown === "registry") return new NextResponse("Not found", { status: 404, headers: { ...noStore, "Access-Control-Allow-Origin": "*" } });
  if (isServerActionPost(req)) {
    return new NextResponse(null, { status: 405, headers: { ...noStore, Allow: "GET, HEAD" } });
  }
  // Every other page request goes straight through: pages are never budgeted (see the note at the top).
  if (!isApiPath(req.nextUrl.pathname)) return NextResponse.next();
  if (tooLarge(req)) {
    return NextResponse.json({ error: "payload_too_large", message: `Request bodies are limited to ${MAX_BODY_BYTES / 1024}KB.` }, { status: 413, headers: noStore });
  }
  if (await overLimit(req)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Wait a minute and try again." },
      { status: 429, headers: { ...noStore, "Retry-After": "60" } },
    );
  }
  return NextResponse.next();
}

// Next reads the matcher statically, so it stays literal. `/docs` is listed for the unknown-page
// check, which must run under `next start` too. The `has` entries are meant to admit only
// Server Action-shaped requests, and do under `next start`; OpenNext ignores `has`, so on Cloudflare
// every page runs middleware and leaves it at `isApiPath`.
export const config = {
  matcher: [
    "/api/:path*",
    "/r/:path*",
    "/docs/:path*",
    { source: "/((?!_next/|api/|r/).*)", has: [{ type: "header", key: "next-action" }] },
    { source: "/((?!_next/|api/|r/).*)", has: [{ type: "header", key: "content-type", value: "application/x-www-form-urlencoded.*" }] },
    { source: "/((?!_next/|api/|r/).*)", has: [{ type: "header", key: "content-type", value: "multipart/form-data.*" }] },
  ],
};
