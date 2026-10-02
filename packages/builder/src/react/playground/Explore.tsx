"use client";
// Explore: the catalog by kind and category, one search across all of it, and what this browser
// remembers (recently viewed, favorites, saved remixes). Entries are links to their real pages, so
// they open in a new tab, can be copied, and are crawlable; a plain click switches in place.
import { memo, useDeferredValue, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { CATALOG_KINDS, catalogPath, entryKey, type CatalogEntry, type CatalogKind } from "../../core/catalog.js";
import { KindIcon, UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { usePlay } from "./store.js";

export const Explore = memo(function Explore() {
  const { store, host, track } = usePlayground();
  const explore = usePlay(store, (s) => s.explore);
  const current = usePlay(store, (s) => (s.entry ? entryKey(s.entry) : ""));
  const favorites = usePlay(store, (s) => s.favorites);
  const recent = usePlay(store, (s) => s.recent);
  const saved = usePlay(store, (s) => s.saved);
  const query = useDeferredValue(explore.query.trim());
  const catalog = host.catalog;

  const results = useMemo(() => (query ? catalog.search(query) : null), [catalog, query]);
  const lastLogged = useRef("");
  useEffect(() => {
    if (!results || query.length < 3 || lastLogged.current === query) return;
    const t = window.setTimeout(() => {
      lastLogged.current = query;
      track("search_used", { results: results.length });
    }, 900);
    return () => window.clearTimeout(t);
  }, [results, query, track]);

  const kind = explore.kind;
  const byKey = useMemo(() => new Map(catalog.entries.map((e) => [entryKey(e), e])), [catalog]);
  const favEntries = favorites.map((k) => byKey.get(k)).filter((e): e is CatalogEntry => Boolean(e));
  const recentEntries = recent.map((k) => byKey.get(k)).filter((e): e is CatalogEntry => Boolean(e) && entryKey(e!) !== current).slice(0, 6);

  return (
    <div className="spp-explore">
      <div className="spp-panel-head spp-explore-head">
        <label className="spp-search">
          <UI name="search" size={15} />
          <input
            type="search"
            placeholder="Search screens, flows, elements"
            value={explore.query}
            onChange={(e) => store.setExplore({ query: e.target.value })}
            aria-label="Search the Playground"
          />
          <kbd aria-hidden>/</kbd>
        </label>
      </div>
      {!results ? (
        <div className="spp-kinds" role="tablist" aria-label="Browse">
          {CATALOG_KINDS.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} onClick={() => store.setExplore({ kind: k.id })}>
              <UI name={KIND_ICON[k.id]} size={15} />
              <span>{k.label.replace("UI ", "")}</span>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={kind === "saved"} onClick={() => store.setExplore({ kind: "saved" })} title="Saved and favorites">
            <UI name="bookmark" size={15} />
            <span>Saved</span>
          </button>
        </div>
      ) : null}
      <div className="spp-explore-body">
        {results ? (
          <SearchResults results={results} current={current} />
        ) : kind === "saved" ? (
          <SavedList favorites={favEntries} current={current} />
        ) : (
          <KindList kind={kind} current={current} />
        )}
        {!results && kind !== "saved" && recentEntries.length ? (
          <section className="spp-section">
            <h3 className="spp-label">Recently viewed</h3>
            <ul className="spp-list">
              {recentEntries.map((e) => (
                <Item key={entryKey(e)} entry={e} current={current} compact />
              ))}
            </ul>
          </section>
        ) : null}
        {!results && kind !== "saved" && saved.length ? (
          <p className="spp-explore-note">
            <button type="button" className="spp-link" onClick={() => store.setExplore({ kind: "saved" })}>
              {saved.length} saved remix{saved.length === 1 ? "" : "es"}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
});

const KIND_ICON: Record<CatalogKind, "phone" | "flow" | "blocks" | "hand"> = { screens: "phone", flows: "flow", elements: "blocks", interactions: "hand" };

function KindList({ kind, current }: { kind: CatalogKind; current: string }) {
  const { host } = usePlayground();
  const meta = CATALOG_KINDS.find((k) => k.id === kind)!;
  const groups = useMemo(() => {
    const map = new Map<string, CatalogEntry[]>();
    for (const e of host.catalog.list(kind)) map.set(e.category, [...(map.get(e.category) ?? []), e]);
    return [...map.entries()];
  }, [host.catalog, kind]);
  return (
    <>
      <p className="spp-explore-blurb">{meta.blurb}</p>
      {groups.map(([category, entries]) => (
        <section key={category} className="spp-section">
          <h3 className="spp-label">{category}</h3>
          <ul className="spp-list">
            {entries.map((e) => (
              <Item key={entryKey(e)} entry={e} current={current} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function SearchResults({ results, current }: { results: CatalogEntry[]; current: string }) {
  if (!results.length) return <p className="spp-explore-blurb">Nothing matches. Try “paywall”, “swipe” or “sheet”.</p>;
  return (
    <>
      {CATALOG_KINDS.map((k) => {
        const hits = results.filter((e) => e.kind === k.id);
        if (!hits.length) return null;
        return (
          <section key={k.id} className="spp-section">
            <h3 className="spp-label">{k.label}</h3>
            <ul className="spp-list">
              {hits.map((e) => (
                <Item key={entryKey(e)} entry={e} current={current} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function SavedList({ favorites, current }: { favorites: CatalogEntry[]; current: string }) {
  const { store, host } = usePlayground();
  const saved = usePlay(store, (s) => s.saved);
  return (
    <>
      <section className="spp-section">
        <h3 className="spp-label">Saved remixes</h3>
        {saved.length ? (
          <ul className="spp-list">
            {saved.map((r) => {
              const [kind, slug] = r.entry.split("/");
              const entry = host.catalog.get(kind as CatalogKind, slug);
              if (!entry) return null;
              const href = `${catalogPath(entry, host.basePath)}#saved=${r.id}`;
              return (
                <li key={r.id} className="spp-item-row">
                  <a
                    className="spp-item"
                    href={href}
                    onClick={(e) => {
                      if (plainClick(e)) {
                        e.preventDefault();
                        window.history.pushState({ sp: 1 }, "", catalogPath(entry, host.basePath));
                        void store.openSaved(entry, r.id);
                        store.setDrawer(null);
                      }
                    }}
                  >
                    <span className="spp-item-tile"><UI name="edit" size={15} /></span>
                    <span className="spp-item-text">
                      <span className="spp-item-title">{r.title}</span>
                      <span className="spp-item-sub">Remix of {entry.title} · {new Date(r.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </span>
                  </a>
                  <button type="button" className="spp-icon-btn spp-icon-btn-sm" aria-label={`Delete ${r.title}`} onClick={() => store.removeSaved(r.id)}>
                    <UI name="trash" size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="spp-explore-blurb">Remix anything, then Save. Your remixes stay in this browser.</p>
        )}
      </section>
      <section className="spp-section">
        <h3 className="spp-label">Favorites</h3>
        {favorites.length ? (
          <ul className="spp-list">
            {favorites.map((e) => (
              <Item key={entryKey(e)} entry={e} current={current} />
            ))}
          </ul>
        ) : (
          <p className="spp-explore-blurb">Star an entry to keep it here.</p>
        )}
      </section>
    </>
  );
}

const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const Item = memo(function Item({ entry, current, compact }: { entry: CatalogEntry; current: string; compact?: boolean }) {
  const { store, host, navigate } = usePlayground();
  const key = entryKey(entry);
  const fav = usePlay(store, (s) => s.favorites.includes(key));
  const locked = Boolean(entry.href) || !host.limits.availability.includes(entry.availability);
  const href = entry.href ?? catalogPath(entry, host.basePath);
  return (
    <li className="spp-item-row">
      <a
        className="spp-item"
        href={href}
        aria-current={key === current ? "page" : undefined}
        data-locked={locked || undefined}
        onClick={(e) => {
          if (!plainClick(e)) return;
          e.preventDefault();
          navigate(entry.kind, entry.slug);
        }}
      >
        <span className="spp-item-tile">{entry.components?.[0] && entry.kind !== "screens" && entry.kind !== "flows" ? <KindIcon id={entry.components[0]} symbol={host.registry.get(entry.components[0])?.icon} /> : <UI name={KIND_ICON[entry.kind]} size={15} />}</span>
        <span className="spp-item-text">
          <span className="spp-item-title">
            {entry.title}
            {entry.availability === "pro" ? <span className="spp-pro-tag">Pro</span> : null}
          </span>
          {compact ? null : <span className="spp-item-sub">{entry.summary}</span>}
        </span>
      </a>
      {compact ? null : (
        <button type="button" className="spp-fav" aria-pressed={fav} aria-label={fav ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`} onClick={() => store.toggleFavorite(key)}>
          <UI name="star" size={13} />
        </button>
      )}
    </li>
  );
});
