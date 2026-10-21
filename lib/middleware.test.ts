import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
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
