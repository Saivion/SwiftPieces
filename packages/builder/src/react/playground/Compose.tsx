"use client";
// Composing an app from many: the Screens tab (every entry's screens, to add, swap in or drag onto
// the strip or the phone), the Style tab (one look across every screen, whichever app it came from)
// and the Screen strip under the phone (the project's screens in order: drag to reorder, drop a
// screen on one to replace it or between two to insert, remove, add). All edits go through the
// store, so each is one undo step and the preview, the SwiftUI and Build follow at once.
import { memo, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { buildCatalogProject, type CatalogEntry, type StepTransition } from "../../core/catalog.js";
import { resolveTheme } from "../../core/looks.js";
import type { Project } from "../../core/schema.js";
import { UI } from "../icons.js";
import { NodeBoundary, preloadFor } from "../preview/NodeView.js";
import { SchemeContext, ThemeContext, schemeFor, themeVars } from "../preview/env.js";
import { RuntimeContext, createChoiceBus, type Runtime } from "../preview/runtime.js";
import { usePlayground } from "./context.js";
import { PHONE_W, screenTitle } from "./Device.js";
import { MAX_TABS, currentScreenId, usePlay } from "./store.js";

// ---------------------------------------------------------------- Drag payloads

/** A screen from the library, on its way to the strip or the phone. */
type LibraryDrag = { type: "library"; kind: string; slug: string; step: number; title: string };
/** A screen of the project, being reordered on the strip. */
type MoveDrag = { type: "move"; id: string };
type Drag = LibraryDrag | MoveDrag;

const MIME = "application/x-spp-screen";
// dataTransfer can't be read during dragover (only its types), so the payload is also kept here.
let dragging: Drag | null = null;

function startDrag(e: DragEvent, payload: Drag, label: string, detail?: string) {
  dragging = payload;
  e.dataTransfer.effectAllowed = payload.type === "move" ? "move" : "copy";
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
  e.dataTransfer.setData("text/plain", label);
  setGhost(e, label, detail, payload.type === "library");
}

/**
 * The drag image: a solid, lifted chip with the screen's name (and, from the library, a +), in
 * place of the browser's translucent snapshot of whatever was grabbed. It has to be in the page
 * when the drag starts; it is rasterized then and removed right after.
 */
function setGhost(e: DragEvent, label: string, detail: string | undefined, adding: boolean) {
  if (typeof document === "undefined" || !e.dataTransfer.setDragImage) return;
  const ghost = document.createElement("div");
  ghost.className = "spp-drag-ghost";
  const dots = document.createElement("span");
  dots.className = "spp-drag-ghost-mark";
  dots.textContent = adding ? "+" : "⠿";
  const text = document.createElement("span");
  text.className = "spp-drag-ghost-text";
  text.textContent = label;
  ghost.append(dots, text);
  if (detail) {
    const sub = document.createElement("span");
    sub.className = "spp-drag-ghost-sub";
    sub.textContent = detail;
    ghost.append(sub);
  }
  // Inherit the Playground's tokens (light or dark) by living inside it when it's there.
  (document.querySelector(".spp") ?? document.body).append(ghost);
  e.dataTransfer.setDragImage(ghost, 18, 18);
  // Removed right after the drag image is taken (a timer, not a frame: frames pause in hidden tabs).
  window.setTimeout(() => ghost.remove(), 0);
}
const endDrag = () => {
  dragging = null;
};
/** The payload of a drag over us, or null when it isn't one of ours. */
function readDrag(e: DragEvent): Drag | null {
  if (!Array.from(e.dataTransfer.types).includes(MIME)) return null;
  if (dragging) return dragging;
  try {
    return JSON.parse(e.dataTransfer.getData(MIME)) as Drag;
  } catch {
    return null;
  }
}
export const currentDrag = () => dragging;
export const isOurDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes(MIME);

// ---------------------------------------------------------------- Library

type Source = { entry: CatalogEntry; title: string; subtitle?: string; icon?: string; href?: string; rank: number; screens: string[]; tags?: string[][] };

/** An entry's screens by title: its flow steps, or the entry itself when it is one screen. */
const screensOf = (e: CatalogEntry) => (e.steps?.length ? e.steps.map((s) => s.title) : [e.title]);

/**
 * The Screens tab, the Playground's default: the host's own part on top (this screen and what
 * inspired it), the screens to swap in below, and the host's fine print last.
 */
export const ScreensTab = memo(function ScreensTab() {
  const { host } = usePlayground();
  return (
    <div className="spp-screens-tab">
      {host.sidebar?.render()}
      {/* Below the host's header, which the page paints first: fades in as one piece. Without a
          library (compose.library false) the tab is the host's sidebar and its fine print. */}
      <div className="spp-compose-library-in">
        {host.compose?.library === false ? null : <ScreensLibrary />}
        {host.sidebar?.footer?.()}
      </div>
    </div>
  );
});

/**
 * Screens to swap in, from every app the host lists. Suggested first (apps in the same category,
 * open), then every app as a row that opens to its screens (this app first). Search looks through
 * all of them. Each screen replaces the one showing, or is added after it. Apps this plan doesn't
 * open (Free's view of the Pro apps) come last, as rows that open their own page, where it says
 * what unlocks them. Nothing shows while the app on the stage is itself locked: there's nothing to
 * add screens to.
 */
export const ScreensLibrary = memo(function ScreensLibrary() {
  const { store, host } = usePlayground();
  const status = usePlay(store, (s) => s.status);
  const entry = usePlay(store, (s) => s.entry);
  const project = usePlay(store, (s) => s.project);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const sources = useMemo<Source[]>(() => {
    const compose = host.compose;
    if (!compose) return [];
    const usable = host.catalog.entries.filter((e) => !e.href && host.limits.availability.includes(e.availability));
    return usable
      .map((e): Source | null => {
        const s = compose.source(e);
        return s ? { entry: e, title: s.title, subtitle: s.subtitle, icon: s.icon, href: s.href, rank: s.rank ?? 0, screens: screensOf(e), tags: s.tags } : null;
      })
      .filter((s): s is Source => Boolean(s))
      .sort((a, b) => a.rank - b.rank);
  }, [host]);
  // The apps this plan doesn't open, each with a page of its own to link to.
  const lockedSources = useMemo<Source[]>(() => {
    const compose = host.compose;
    if (!compose) return [];
    return host.catalog.entries
      .filter((e) => !e.href && !host.limits.availability.includes(e.availability))
      .map((e): Source | null => {
        const s = compose.source(e);
        return s?.href ? { entry: e, title: s.title, subtitle: s.subtitle, icon: s.icon, href: s.href, rank: s.rank ?? 0, screens: screensOf(e), tags: s.tags } : null;
      })
      .filter((s): s is Source => Boolean(s))
      .sort((a, b) => a.rank - b.rank);
  }, [host]);

  const keyOf = (s: Source) => `${s.entry.kind}/${s.entry.slug}`;
  const isHere = (s: Source) => Boolean(entry && s.entry.kind === entry.kind && s.entry.slug === entry.slug);
  const here = sources.find(isHere) ?? null;
  const others = sources.filter((s) => !isHere(s));
  // Suggested: other apps in this one's category, else the next ones along; up to three.
  const same = others.filter((s) => entry && s.entry.category === entry.category);
  const suggested = (same.length ? same : others).slice(0, 3);
  const all = [...(here ? [here] : []), ...others.filter((s) => !suggested.includes(s))];

  const q = query.trim().toLowerCase();
  // Every word has to match the start of a word somewhere on the screen: its app (name, category),
  // its title or its tags ("timer", "calendar", "productivity"). A trailing "s" is let go, so
  // "timers" finds a timer.
  const words = q.split(/\s+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
  const matches = (s: Source) => {
    if (!words.length) return s.screens.map((_, i) => i);
    const app = [s.title, s.subtitle ?? "", s.entry.title, s.entry.category].join(" ");
    return s.screens
      .map((t, i) => {
        const hay = ` ${[app, t, ...(s.tags?.[i] ?? [])].join(" ").toLowerCase().replace(/[-/&,]/g, " ")} `;
        return words.every((w) => hay.includes(` ${w.replace(/-/g, " ")}`)) ? i : -1;
      })
      .filter((i) => i >= 0);
  };

  const currentScreen = project?.screens.find((s) => s.id === current) ?? null;
  const full = Boolean(project && project.screens.length >= host.limits.maxScreens);
  const origins = usePlay(store, (st) => st.origins);
  // Library screens already in the app: "Showing" for the one on the phone, "In app" for the rest.
  const inApp = useMemo(() => {
    const out = new Map<string, "showing" | "in">();
    for (const sc of project?.screens ?? []) {
      const o = origins[sc.id];
      if (o && out.get(o) !== "showing") out.set(o, sc.id === current ? "showing" : "in");
    }
    return out;
  }, [project, origins, current]);
  const replacing = usePlay(store, (st) => st.replacing);
  const isPicking = (s: Source, i: number) => Boolean(replacing && replacing.kind === s.entry.kind && replacing.slug === s.entry.slug && replacing.step === i);
  const run = async (key: string, fn: () => Promise<boolean>) => {
    setBusy(key);
    try {
      // On small screens the library is a sheet over the phone: close it to show the result.
      if (await fn()) store.setDrawer(null);
    } finally {
      setBusy(null);
    }
  };
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const cards = (s: Source, only: number[]) => (
    <ul className="spp-compose-grid">
      {only.map((i) => {
        const title = s.screens[i];
        const art = host.compose?.art?.(s.entry, i) ?? null;
        const key = `${keyOf(s)}/${i}`;
        const payload: LibraryDrag = { type: "library", kind: s.entry.kind, slug: s.entry.slug, step: i, title };
        return (
          <li key={key} className="spp-compose-card" draggable onDragStart={(e) => startDrag(e, payload, title, s.title)} onDragEnd={endDrag} data-busy={busy === key || undefined}>
            <ScreenThumb entry={s.entry} step={i} fallback={art} />
            {/* Its state sits beside the name, off the picture, so it never covers the screen. */}
            <span className="spp-compose-name">
              <span className="spp-compose-title" title={title}>{title}</span>
              {inApp.get(`${keyOf(s)}#${i}`) ? <span className="spp-compose-badge" data-kind={inApp.get(`${keyOf(s)}#${i}`)}>{inApp.get(`${keyOf(s)}#${i}`) === "showing" ? "Showing" : "In app"}</span> : null}
            </span>
            <span className="spp-compose-actions">
              <button
                type="button"
                className="spp-btn spp-btn-sm spp-compose-replace"
                disabled={!currentScreen || busy !== null}
                aria-pressed={isPicking(s, i)}
                title={project && project.screens.length > 1 ? "Pick the screen it replaces, in the bar under the phone" : currentScreen ? `Replace ${screenTitle(currentScreen)}` : undefined}
                onClick={() => {
                  if (!currentScreen || !project) return;
                  // One screen: nothing to choose. Otherwise the strip asks which one (again to cancel).
                  if (project.screens.length < 2) return void run(key, () => store.importScreen(s.entry, i, { replace: currentScreen.id }));
                  store.setReplacing(isPicking(s, i) ? null : { kind: s.entry.kind, slug: s.entry.slug, step: i, title });
                  store.setDrawer(null);
                }}
              >
                {isPicking(s, i) ? "Cancel" : "Replace"}
              </button>
              <button
                type="button"
                className="spp-btn spp-btn-sm spp-compose-add"
                disabled={full || busy !== null}
                aria-label={`Add ${title}`}
                title={full ? `Up to ${host.limits.maxScreens} screens` : "Add after the screen showing"}
                onClick={() => {
                  const at = project && currentScreen ? project.screens.indexOf(currentScreen) + 1 : undefined;
                  void run(key, () => store.importScreen(s.entry, i, { at }));
                }}
              >
                <UI name="plus" size={12} />
                Add
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );

  const header = (s: Source, count: number, collapsible: boolean) => {
    const k = keyOf(s);
    const expanded = !collapsible || open.has(k) || Boolean(q);
    const inner = (
      <>
        {s.icon ? <img src={s.icon} alt="" width={24} height={24} loading="lazy" className="spp-compose-icon" /> : <span className="spp-compose-icon" aria-hidden />}
        <span className="spp-compose-source-text">
          <span className="spp-compose-source-title">
            {s.title}
            {isHere(s) ? <span className="spp-compose-here">This app</span> : null}
          </span>
          <span className="spp-compose-source-sub">{s.subtitle ?? s.entry.title}</span>
        </span>
        <span className="spp-compose-source-count">{count}</span>
        {collapsible && !q ? <span className="spp-compose-chevron" data-open={expanded || undefined} aria-hidden><UI name="right" size={13} /></span> : null}
      </>
    );
    return collapsible && !q ? (
      <button type="button" className="spp-compose-source" aria-expanded={expanded} onClick={() => toggle(k)}>{inner}</button>
    ) : (
      <div className="spp-compose-source">
        {inner}
        {s.href && !isHere(s) ? (
          <a className="spp-compose-open" href={s.href} title={`Open ${s.title} in the Playground`}>
            Open
          </a>
        ) : null}
      </div>
    );
  };

  /** A locked app: its row opens its page, which shows its screens and what unlocks them. */
  const lockedRow = (s: Source, count: number) => (
    <a key={keyOf(s)} className="spp-compose-source spp-compose-locked" href={s.href} title={`${s.title} is part of Pro. Open it to see its screens`}>
      {s.icon ? <img src={s.icon} alt="" width={24} height={24} loading="lazy" className="spp-compose-icon" /> : <span className="spp-compose-icon" aria-hidden />}
      <span className="spp-compose-source-text">
        <span className="spp-compose-source-title">{s.title}</span>
        <span className="spp-compose-source-sub">{s.subtitle ?? s.entry.title}</span>
      </span>
      <span className="spp-compose-source-count">{count}</span>
      <UI name="lock" size={12} />
    </a>
  );

  if (!host.compose || status === "locked") return null;
  const searching = Boolean(q);
  const hits = searching ? sources.map((s) => ({ s, only: matches(s) })).filter((x) => x.only.length) : [];
  const lockedOthers = lockedSources.filter((s) => !isHere(s));
  const lockedHits = searching ? lockedOthers.map((s) => ({ s, only: matches(s) })).filter((x) => x.only.length) : [];
  const lockedScreens = lockedOthers.reduce((n, s) => n + s.screens.length, 0);

  return (
    <div className="spp-compose">
      <div className="spp-compose-intro">
        <div className="spp-compose-heading">
          <h2 className="spp-label">Replace with</h2>
          <span className="spp-compose-count">{project?.screens.length ?? 0} of {host.limits.maxScreens} screens</span>
        </div>
        <label className="spp-search spp-compose-search">
          <UI name="search" size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: timer, calendar, budget…" aria-label="Search apps and screens" />
        </label>
      </div>

      {searching ? (
        hits.length || lockedHits.length ? (
          <>
            {hits.map(({ s, only }) => (
              <section key={keyOf(s)} className="spp-compose-group">
                {header(s, only.length, false)}
                {cards(s, only)}
              </section>
            ))}
            {lockedHits.length ? (
              <div className="spp-compose-section spp-compose-pro">
                <h3 className="spp-compose-section-title">With Pro</h3>
                <div className="spp-compose-rows">{lockedHits.map(({ s, only }) => lockedRow(s, only.length))}</div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="spp-hint spp-compose-empty">No screens match “{query}”.</p>
        )
      ) : (
        <>
          {suggested.length ? (
            <div className="spp-compose-section">
              <h3 className="spp-compose-section-title">Suggested</h3>
              {suggested.map((s) => (
                <section key={keyOf(s)} className="spp-compose-group">
                  {header(s, s.screens.length, false)}
                  {cards(s, matches(s))}
                </section>
              ))}
            </div>
          ) : null}
          <div className="spp-compose-section">
            <h3 className="spp-compose-section-title">All apps</h3>
            <div className="spp-compose-rows">
              {all.map((s) => (
                <section key={keyOf(s)} className="spp-compose-group spp-compose-collapsible">
                  {header(s, s.screens.length, true)}
                  {open.has(keyOf(s)) ? cards(s, matches(s)) : null}
                </section>
              ))}
            </div>
          </div>
          {lockedOthers.length ? (
            <div className="spp-compose-section spp-compose-pro">
              <h3 className="spp-compose-section-title">
                With Pro <span className="spp-compose-section-note">{lockedOthers.length} apps · {lockedScreens} screens</span>
              </h3>
              <div className="spp-compose-rows">{lockedOthers.map((s) => lockedRow(s, s.screens.length))}</div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
});


// ---------------------------------------------------------------- Thumbnails

/** Each entry built once per page (its content chunk loads once), shared by every card that shows it. */
const built = new Map<string, Promise<Project | null>>();

/**
 * A screen of any entry, drawn by the same renderers as the phone, small and still: what you'd get,
 * already in your app's style. Rendered only while its card is on screen; until then (or if it
 * can't be built) the host's picture of it, if any.
 */
function ScreenThumb({ entry, step, fallback }: { entry: CatalogEntry; step: number; fallback: string | null }) {
  const { host, store } = usePlayground();
  const theme = usePlay(store, (s) => s.project?.theme);
  const previewScheme = usePlay(store, (s) => s.scheme);
  const box = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  const [width, setWidth] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  // "ready" once the screen and every renderer it uses have loaded, so the card fades in whole (the
  // way the inspiration card waits for its picture), never a picture that then swaps for the screen.
  const [phase, setPhase] = useState<"waiting" | "ready" | "failed">("waiting");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Without the observers (old browsers), draw it now at the card's current width.
    if (typeof IntersectionObserver === "undefined" || typeof ResizeObserver === "undefined") {
      setWidth(el.getBoundingClientRect().width);
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: "120px" });
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    io.observe(el);
    ro.observe(el);
    return () => (io.disconnect(), ro.disconnect());
  }, []);
  useEffect(() => {
    if (!seen || project) return;
    const key = `${entry.kind}/${entry.slug}`;
    if (!built.has(key)) {
      built.set(
        key,
        host.catalog
          .load(entry)
          .then((b) => (b ? buildCatalogProject(entry, b, host.registry, host.limits) : null))
          .catch(() => null),
      );
    }
    let live = true;
    void built.get(key)!.then(async (p) => {
      const sc = p?.screens[Math.min(step, p.screens.length - 1)];
      if (!p || !sc) return live && setPhase("failed");
      await preloadFor(sc.root, host.registry);
      if (!live) return;
      setProject(p);
      setPhase("ready");
    });
    return () => {
      live = false;
    };
  }, [seen, project, entry, step, host]);

  const resolved = useMemo(() => (theme ? resolveTheme(theme) : null), [theme]);
  const runtime = useMemo<Runtime>(() => ({ registry: host.registry, act: () => false, haptic: () => {}, scale: () => 1, onError: () => {}, overlay: () => null, choices: createChoiceBus(), still: true }), [host.registry]);
  const screen = project?.screens[Math.min(step, (project?.screens.length ?? 1) - 1)] ?? null;
  const scheme = screen ? schemeFor(String(screen.root.props.appearance ?? "system"), resolved, previewScheme) : previewScheme;
  const k = width ? width / PHONE_W : 0;

  return (
    <span ref={box} className="spp-compose-art" data-live={phase === "ready" && screen && k ? "" : undefined}>
      {phase === "ready" && screen && k ? (
        <span className="spp-thumb spp-thumb-in" aria-hidden inert>
          <span className="spb-phone spp-thumb-phone" data-scheme={scheme} style={{ ...themeVars(resolved, scheme), transform: `scale(${k})` }}>
            <RuntimeContext.Provider value={runtime}>
              <ThemeContext.Provider value={resolved}>
                <SchemeContext.Provider value={scheme}>
                  <span className="spp-screen spb-phone-screen" data-role="top" data-scheme={scheme} style={themeVars(resolved, scheme)}>
                    <span className="spb-screen-host">
                      <NodeBoundary node={screen.root} />
                    </span>
                  </span>
                </SchemeContext.Provider>
              </ThemeContext.Provider>
            </RuntimeContext.Provider>
          </span>
        </span>
      ) : phase === "failed" && fallback ? (
        <img src={fallback} alt="" loading="lazy" draggable={false} className="spp-thumb-in" />
      ) : phase === "failed" ? (
        <span className="spp-compose-art-n">{step + 1}</span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------- Style

// The Style tab lives in Style.tsx (fonts, colour, shape, feel and Shuffle).
export { StylePanel } from "./Style.js";

// ---------------------------------------------------------------- Strip

const HOW: Record<StepTransition, { label: string; swift: string }> = {
  start: { label: "Start", swift: "WindowGroup" },
  push: { label: "Push", swift: "NavigationLink" },
  sheet: { label: "Sheet", swift: ".sheet(isPresented:)" },
  tab: { label: "Tab", swift: "TabView" },
  replace: { label: "Replace", swift: "if / else root" },
};

type Drop = { id: string | "end"; where: "before" | "after" | "replace" } | null;

/**
 * The app's screens in order, under the phone. Tap to show one; drag to reorder; drop a library
 * screen on one to replace it, or at its edge to insert; remove with ×; + opens the library. While
 * the screens still match the original flow, the transitions between them are labeled.
 */
export const ScreenStrip = memo(function ScreenStrip() {
  const { store, host } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const entry = usePlay(store, (s) => s.entry);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const [drop, setDrop] = useState<Drop>(null);
  const [held, setHeld] = useState<string | null>(null);
  const replacing = usePlay(store, (s) => s.replacing);
  const list = useRef<HTMLOListElement>(null);
  // Picking a screen to replace: Escape backs out.
  useEffect(() => {
    if (!replacing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && store.setReplacing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replacing, store]);
  // When the rail scrolls (many screens, narrow window), keep the screen showing in view.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-state="current"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [current]);
  if (!project) return null;
  const composed = store.isComposed();
  const steps = !composed ? entry?.steps : undefined;
  const index = project.screens.findIndex((s) => s.id === current);
  const canRemove = project.screens.length > 1;
  const full = project.screens.length >= host.limits.maxScreens;
  // Which screens sit in the tab bar, and a toggle to move them in or out (apps of two or more screens).
  const inBar = (s: (typeof project.screens)[number]) => project.shell === "tabs" && Boolean(s.tab);
  const canTab = project.screens.length > 1;
  const tabsFull = project.shell === "tabs" && project.screens.filter((s) => s.tab).length >= MAX_TABS;

  const landing = (e: DragEvent, id: string): Drop => {
    const d = readDrag(e);
    if (!d) return null;
    if (d.type === "move" && d.id === id) return null;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    if (d.type === "library" && x > 0.25 && x < 0.75) return { id, where: "replace" };
    if (d.type === "library" && full) return { id, where: "replace" };
    return { id, where: x < 0.5 ? "before" : "after" };
  };
  const apply = async (d: Drag, target: NonNullable<Drop>) => {
    const at = target.id === "end" ? project.screens.length : project.screens.findIndex((s) => s.id === target.id) + (target.where === "after" ? 1 : 0);
    if (d.type === "move") {
      const from = project.screens.findIndex((s) => s.id === d.id);
      store.moveScreen(d.id, from < at ? at - 1 : at);
      return;
    }
    const e = host.catalog.entries.find((x) => x.kind === d.kind && x.slug === d.slug);
    if (!e) return;
    if (target.where === "replace" && target.id !== "end") await store.importScreen(e, d.step, { replace: target.id });
    else await store.importScreen(e, d.step, { at });
  };
  const onDrop = (e: DragEvent, target: Drop) => {
    const d = readDrag(e);
    setDrop(null);
    endDrag();
    if (!d || !target) return;
    e.preventDefault();
    void apply(d, target);
  };
  const replaceWith = async (id: string) => {
    const r = replacing;
    store.setReplacing(null);
    const e = r ? host.catalog.entries.find((x) => x.kind === r.kind && x.slug === r.slug) : undefined;
    if (e && r) await store.importScreen(e, r.step, { replace: id });
  };
  const openLibrary = () => {
    store.setPanel("screens");
    store.setDrawer("explore");
  };


  return (
    <div className="spp-strip" data-picking={replacing ? "" : undefined} title={host.compose && !replacing ? (host.compose.library === false ? "Drag to reorder" : "Drag to reorder · drop screens from any app") : undefined} onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null)}>
      {replacing ? (
        <p className="spp-strip-hint" role="status">
          Pick the screen <strong>{replacing.title}</strong> replaces
          <button type="button" className="spp-strip-hint-x" onClick={() => store.setReplacing(null)}>
            Cancel
          </button>
        </p>
      ) : null}
      <div className="spp-rail">
        <button type="button" className="spp-rail-arrow" onClick={() => store.goToStep(Math.max(0, index - 1))} disabled={index <= 0} aria-label="Previous screen">
          <UI name="left" size={15} />
        </button>
        <ol ref={list} className="spp-rail-list" aria-label="Your app's screens">
          {project.screens.map((s, i) => {
            const t = steps?.[i] && i > 0 ? HOW[steps[i].transition] : null;
            const mark = drop && drop.id === s.id ? drop.where : undefined;
            return (
              <li key={s.id} className="spp-rail-item" data-state={i === index ? "current" : undefined}>
                <span
                  className="spp-rail-chip"
                  data-drop={mark}
                  data-held={held === s.id || undefined}
                  draggable={!replacing}
                  onDragStart={(e) => {
                    startDrag(e, { type: "move", id: s.id }, screenTitle(s));
                    setHeld(s.id);
                  }}
                  onDragEnd={() => {
                    endDrag();
                    setDrop(null);
                    setHeld(null);
                  }}
                  onDragOver={(e) => {
                    const d = landing(e, s.id);
                    if (!d) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = readDrag(e)?.type === "move" ? "move" : "copy";
                    if (!drop || drop.id !== d.id || drop.where !== d.where) setDrop(d);
                  }}
                  onDrop={(e) => onDrop(e, landing(e, s.id))}
                >
                  <button
                    type="button"
                    className="spp-rail-pick group/n"
                    onClick={() => (replacing ? void replaceWith(s.id) : store.showScreen(s.id))}
                    aria-current={i === index ? "step" : undefined}
                    title={replacing ? `Replace ${screenTitle(s)} with ${replacing.title}` : t ? `${t.label} · ${t.swift}. Drag to reorder.` : "Drag to reorder"}
                    onKeyDown={(e) => {
                      // Alt + arrows move the screen, for people not dragging.
                      if (!e.altKey) return;
                      if (e.key === "ArrowLeft") (e.preventDefault(), store.moveScreen(s.id, i - 1));
                      if (e.key === "ArrowRight") (e.preventDefault(), store.moveScreen(s.id, i + 1));
                    }}
                  >
                    <NavDots />
                    <span className="spp-rail-title">{screenTitle(s)}</span>
                  </button>
                  {canTab ? (
                    <button
                      type="button"
                      className="spp-rail-tab"
                      aria-pressed={inBar(s)}
                      aria-label={inBar(s) ? `Take ${screenTitle(s)} out of the tab bar` : `Put ${screenTitle(s)} in the tab bar`}
                      title={inBar(s) ? "In the tab bar. Click to make it a pushed screen." : tabsFull ? `The tab bar holds up to ${MAX_TABS} screens` : "Put in the tab bar"}
                      onClick={() => store.setInTabBar(s.id, !inBar(s))}
                    >
                      <UI name="dock" size={12} strokeWidth={2} />
                    </button>
                  ) : null}
                  {canRemove ? (
                    <button type="button" className="spp-rail-x" aria-label={`Remove ${screenTitle(s)}`} title="Remove" onClick={() => store.removeScreen(s.id)}>
                      <UI name="close" size={11} />
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
        {host.compose && host.compose.library !== false ? (
          <button
            type="button"
            className="spp-rail-add"
            data-drop={drop?.id === "end" ? "after" : undefined}
            onClick={openLibrary}
            aria-label="Add a screen"
            title={full ? `Up to ${host.limits.maxScreens} screens: replace one instead` : "Add a screen from any app"}
            onDragOver={(e) => {
              const d = readDrag(e);
              if (!d || (d.type === "library" && full)) return;
              e.preventDefault();
              if (drop?.id !== "end") setDrop({ id: "end", where: "after" });
            }}
            onDrop={(e) => onDrop(e, { id: "end", where: "after" })}
          >
            <UI name="plus" size={14} />
          </button>
        ) : null}
        <button type="button" className="spp-rail-arrow" onClick={() => store.goToStep(Math.min(project.screens.length - 1, index + 1))} disabled={index >= project.screens.length - 1} aria-label="Next screen">
          <UI name="right" size={15} />
        </button>
      </div>
    </div>
  );
});

/**
 * The host site's navbar glyph (six dots; its styles and hover animation are the site's
 * `.nav-glyph`), so the strip reads like the navbar. Hosts without it simply show no glyph.
 */
function NavDots() {
  return (
    <span aria-hidden className="nav-glyph spp-rail-glyph">
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} style={{ ["--i" as string]: i }} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- Phone drop

/**
 * Wraps the stage: a library screen dragged over the phone offers to replace the screen showing,
 * and dropping it does.
 */
export function PhoneDrop({ children }: { children: ReactNode }) {
  const { store, host } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const [over, setOver] = useState<string | null>(null);
  const screen = project?.screens.find((s) => s.id === current) ?? null;
  if (!host.compose) return <>{children}</>;
  return (
    <div
      className="spp-phone-drop"
      data-over={over ? "" : undefined}
      onDragOver={(e) => {
        const d = readDrag(e);
        if (!d || d.type !== "library" || !screen) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (over !== d.title) setOver(d.title);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
      onDrop={(e) => {
        const d = readDrag(e);
        setOver(null);
        endDrag();
        if (!d || d.type !== "library" || !screen) return;
        e.preventDefault();
        const entry = host.catalog.entries.find((x) => x.kind === d.kind && x.slug === d.slug);
        if (entry) void store.importScreen(entry, d.step, { replace: screen.id });
      }}
    >
      {children}
      {over && screen ? (
        <div className="spp-phone-drop-hint" aria-hidden>
          <span>
            Replace <strong>{screenTitle(screen)}</strong> with <strong>{over}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}
