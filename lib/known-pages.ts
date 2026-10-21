// Which docs pages and registry names exist, decided before Next renders anything.
//
// The docs catch-all and the registry route are built once for every page and name they have
// (generateStaticParams) and served from the OpenNext incremental cache in R2. Anything else still
// renders on demand, and its result (a 404 or a redirect) is written to R2 as a cache entry of its
// own. So a client could add one R2 object per made-up URL, as many as it liked, and only the
// bucket's 7-day lifecycle rule ever cleared them. middleware.ts answers those URLs before they
// reach the route.
//
// `dynamicParams = false` would refuse them too, but with that rule in place it also turns a valid
// page whose entry has expired into a 404, and it would drop the legacy forwarding the docs route
// does (an older docs URL ending in a piece's name). This list keeps both.
//
// Pure: scripts/build-registry.ts writes the manifest (registry/__registry__/known-pages.json),
// and tests cover the matching.

export type KnownPages = {
  /** Every docs page's slug, joined with "/" ("" is /docs itself). */
  docs: string[];
  /** Segments an older two-segment docs URL ending in a piece may start with. */
  docsSections: string[];
  /** Every name /r/<name>.json and /api/registry/<name> answer: "index", piece and block names and slugs. */
  registry: string[];
  /** Piece names and slugs, for the legacy docs forward. */
  pieces: string[];
};

export type KnownPageSets = { [K in keyof KnownPages]: Set<string> };

export function knownPageSets(m: KnownPages): KnownPageSets {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, new Set(v)])) as KnownPageSets;
}

function segmentsOf(path: string): string[] | null {
  try {
    return path.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
}

/** False only for a /docs, /r or /api/registry URL that matches nothing those routes have; true for every other path. */
export function isKnownPage(path: string, k: KnownPageSets): boolean {
  const s = segmentsOf(path);
  if (!s) return false;
  if (s[0] === "docs") {
    const slug = s.slice(1);
    if (k.docs.has(slug.join("/"))) return true;
    // An older docs URL, /docs/<section>/<piece>, forwards to the piece (app/docs/[[...slug]]/page.tsx).
    return slug.length === 2 && k.docsSections.has(slug[0]) && k.pieces.has(slug[1]);
  }
  if (s[0] === "r") return s.length !== 2 || !s[1].endsWith(".json") || k.registry.has(s[1].slice(0, -".json".length));
  if (s[0] === "api" && s[1] === "registry") return s.length !== 3 || k.registry.has(s[2].replace(/\.json$/, ""));
  return true;
}
