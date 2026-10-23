import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest, type NextFetchEvent } from "next/server";
import middleware from "../middleware";

/**
 * On Cloudflare the middleware runs for every page: OpenNext matches it by each matcher's path regexp
 * and drops the `has` conditions that were meant to keep page views out (middleware.ts). On
 * 2026-10-20 that put every page view, client navigation and link prefetch on the API's 60-a-minute
 * budget, and browsing /apps answered the next click with a 429. These run the middleware itself with
 * a limiter that refuses everything: pages must still go through, the API must not.
 */

const CONTEXT = Symbol.for("__cloudflare-context__");
const refuseAll = { limit: async () => ({ success: false }) };
const g = globalThis as Record<symbol, unknown>;
let saved: unknown;

before(() => {
  saved = g[CONTEXT];
  g[CONTEXT] = { env: { API_LIMITER: refuseAll, SEARCH_LIMITER: refuseAll }, ctx: {}, cf: {} };
});
after(() => {
  g[CONTEXT] = saved;
});

const request = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(`https://swiftpieces.com${path}`, { method: init.method ?? "GET", headers: { "cf-connecting-ip": "203.0.113.7", ...init.headers } });

describe("middleware budgets", () => {
  it("never rate-limits a page, its client navigation or a link prefetch", async () => {
    for (const req of [
      request("/apps"),
      request("/playground/daylio"),
      request("/playground/daylio?_rsc=abc", { headers: { rsc: "1" } }),
      request("/blocks?_rsc=abc", { headers: { rsc: "1", "next-router-prefetch": "1" } }),
      request("/"),
    ]) {
      const res = await middleware(req);
      assert.notEqual(res.status, 429, `${req.nextUrl.pathname}${req.nextUrl.search} was rate-limited`);
      assert.equal(res.headers.get("x-middleware-next"), "1", `${req.nextUrl.pathname} did not pass through`);
    }
  });

  it("still rate-limits the API and the CLI registry", async () => {
    for (const path of ["/api/stars", "/api/search?q=glass", "/api/mcp", "/r/GlassSurface.json"]) {
      const res = await middleware(request(path));
      assert.equal(res.status, 429, `${path} was not rate-limited`);
      assert.equal(res.headers.get("retry-after"), "60");
    }
  });

  it("answers a Server Action probe on a page with 405, not a budget", async () => {
    const res = await middleware(request("/", { method: "POST", headers: { "next-action": "x", rsc: "1" } }));
    assert.equal(res.status, 405);
  });

  it("caps request bodies on the API only", async () => {
    const big = { method: "POST", headers: { "content-type": "application/json", "content-length": String(65 * 1024) } };
    assert.equal((await middleware(request("/api/mcp", big))).status, 413);
    assert.notEqual((await middleware(request("/playground/daylio", big))).status, 413);
  });
});

describe("middleware unknown pages", () => {
  it("answers a made-up registry name itself, without the route", async () => {
    const res = await middleware(request("/r/NoSuchPiece-zz.json"));
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  it("sends a made-up docs page to the not-found page", async () => {
    const res = await middleware(request("/docs/no-such-page-zz"));
    assert.match(res.headers.get("x-middleware-rewrite") ?? "", /\/_unknown-page$/);
  });

  it("lets a real docs page through", async () => {
    const res = await middleware(request("/docs/introduction"));
    assert.equal(res.headers.get("x-middleware-rewrite"), null);
    assert.equal(res.headers.get("x-middleware-next"), "1");
  });

});

describe("middleware AI agent reports", () => {
  const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";
  const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const realFetch = globalThis.fetch;
  let sent: { url: string; body: Record<string, unknown> }[] = [];

  before(() => {
    process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID = "test-website";
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(null, { status: 200 });
    }) as typeof fetch;
  });
  after(() => {
    delete process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID;
    globalThis.fetch = realFetch;
  });

  /** Runs the middleware with an event, then waits for what it handed to waitUntil. */
  async function run(req: NextRequest) {
    sent = [];
    const pending: Promise<unknown>[] = [];
    const res = await middleware(req, { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as NextFetchEvent);
    await Promise.all(pending);
    return res;
  }

  it("reports a crawler's read of a page and of llms.txt, after passing the request through", async () => {
    const page = await run(request("/docs/introduction", { headers: { "user-agent": GPTBOT } }));
    assert.equal(page.headers.get("x-middleware-next"), "1");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, "https://basket.databuddy.cc/ai-traffic");
    assert.equal(sent[0].body.websiteId, "test-website");
    assert.equal(sent[0].body.path, "/docs/introduction");

    await run(request("/llms.txt", { headers: { "user-agent": GPTBOT } }));
    assert.equal(sent[0].body.format, "llms");
  });

  it("sends nothing for a browser, or from a host other than swiftpieces.com", async () => {
    await run(request("/apps", { headers: { "user-agent": SAFARI } }));
    assert.equal(sent.length, 0);
    await run(new NextRequest("https://swiftpieces-preview.workers.dev/apps", { headers: { "user-agent": GPTBOT } }));
    assert.equal(sent.length, 0);
  });
});
