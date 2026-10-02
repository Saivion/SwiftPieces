"use client";
// The Pro apps' screens, for a Pro account's Playground: a catalog source whose builds come from the
// Pro API (one request for every Pro app, the first time any of them is needed), never from this
// site's code, which is open source. The Playground asks only once the visitor's plan opens Pro
// entries (the store and the screen library check), and the Pro server checks Pro again on the
// request (app/api/builder/apps in SwiftPiecesPro).
import type { CatalogBuild, CatalogEntry, CatalogSource } from "@swiftpieces/builder";
import { proFetch } from "./pro-bridge";

let builds: Promise<Record<string, CatalogBuild>> | null = null;

function proBuilds(): Promise<Record<string, CatalogBuild>> {
  builds ??= proFetch("/api/builder/apps")
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { builds?: unknown };
      if (!body.builds || typeof body.builds !== "object" || Array.isArray(body.builds)) throw new Error("Unexpected reply");
      return body.builds as Record<string, CatalogBuild>;
    })
    .catch((err: unknown) => {
      // Not kept: the next open asks again (an expired token, a dropped connection).
      builds = null;
      throw err;
    });
  return builds;
}

/**
 * Starts loading the Pro apps' screens now, for a visitor the last check here found to be Pro, so
 * they arrive with this page's check rather than after it. Refused (no longer Pro), nothing is kept.
 */
export function prefetchProBuilds(): void {
  void proBuilds().catch(() => {});
}

/**
 * The Pro apps as a catalog source: their entries (the builder's, public) and their builds from the
 * Pro API. A build arrives built, its ids numbered the way the Playground numbers an entry's own, so
 * it's handed back as is; the Playground validates it against the plan like any other input.
 */
export function proAppsSource(entries: CatalogEntry[]): CatalogSource {
  return {
    entries,
    async load(entry) {
      const build = (await proBuilds())[entry.slug];
      return build ? () => structuredClone(build) : null;
    },
  };
}
