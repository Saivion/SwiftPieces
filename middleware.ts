import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Per-IP request budgets for the API. Pages are only touched by the Server Action guard below: the
 * matcher admits `/api`, the CLI's `/r` registry paths, and page POSTs shaped like a Server Action.
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

/**
 * The site has no Server Actions, so a POST that Next would treat as one only comes from scanners
 * (they probe `/`, `/api` and `/app` with a `Next-Action` header). Next 16 answers such a POST that
 * also carries `RSC: 1` by throwing "Invariant: Expected RSC response" (a 500 and an error log per
 * request), because the page's cache entry is HTML. Same test as Next's own
 * `getServerActionRequestMetadata`. Route handlers under `/api/` and `/r/` take their own POSTs.
 */
function isServerActionPost(req: NextRequest): boolean {
  if (req.method !== "POST" || /^\/(api|r)\//.test(req.nextUrl.pathname)) return false;
  const type = req.headers.get("content-type") ?? "";
  return req.headers.has("next-action") || type.startsWith("application/x-www-form-urlencoded") || type.startsWith("multipart/form-data");
}

export default async function middleware(req: NextRequest) {
  if (isServerActionPost(req)) {
    return new NextResponse(null, { status: 405, headers: { ...noStore, Allow: "GET, HEAD" } });
  }
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

// Next reads the matcher statically, so it stays literal. The `has` entries only admit Server
// Action-shaped requests, so ordinary page views still skip middleware.
export const config = {
  matcher: [
    "/api/:path*",
    "/r/:path*",
    { source: "/((?!_next/|api/|r/).*)", has: [{ type: "header", key: "next-action" }] },
    { source: "/((?!_next/|api/|r/).*)", has: [{ type: "header", key: "content-type", value: "application/x-www-form-urlencoded.*" }] },
    { source: "/((?!_next/|api/|r/).*)", has: [{ type: "header", key: "content-type", value: "multipart/form-data.*" }] },
  ],
};
