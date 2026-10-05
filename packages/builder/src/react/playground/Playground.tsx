"use client";
// The Playground: Explore → Interact → Inspect → Remix → Build, in one full-screen workspace.
// Left, the catalog. Center, a running iPhone. Right, what you're looking at: the screen, then any
// component you pick, its parts, its properties and its SwiftUI. Switching entries rewrites the URL
// in place (no server round trip); every URL is also a real page the server renders on its own.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOG_KINDS, catalogPath, entryKey, isCatalogKind, type CatalogEntry } from "../../core/catalog.js";
import { firstNodeOf } from "../../core/inspect.js";
import type { Project } from "../../core/schema.js";
import { decodeProject } from "../../core/share.js";
import { parentOf } from "../../core/tree.js";
import { UI } from "../icons.js";
import { PlaygroundContext, usePlayground, type PlaygroundContextValue, type PlaygroundHost } from "./context.js";
import { Device } from "./Device.js";
import { Explore } from "./Explore.js";
import { FlowStrip, TryLine } from "./FlowStrip.js";
import { Inspector, type PanelTab } from "./Inspector.js";
import { CanvasSwitch, Reference, ScreenWall } from "./Canvas.js";
import { PhoneDrop, ScreenStrip, ScreensTab, StylePanel } from "./Compose.js";

/**
 * The docked panel's inspector: one Map tab. Pick anything in the map (or on the phone) and the tab
 * goes into it, its properties and SwiftUI, with a way straight back out to the map.
 */
const DOCKED_TOOLS = [{ id: "map" as const, label: "Map" }];
import { createPersistence } from "./persist.js";
import { createPlayStore, usePlay } from "./store.js";
import { slideInto } from "./layout-drag.js";
import { SaveButton } from "./Save.js";

// Heavier, rarely first: the Build sheet (code, zip, Xcode) and the Pro gate load on demand.
const BuildDialog = lazy(() => import("./BuildDialog.js").then((m) => ({ default: m.BuildDialog })));
const Locked = lazy(() => import("./Locked.js").then((m) => ({ default: m.Locked })));

export type PlaygroundInitial = {
  /** The entry the page is for. */
  kind?: string | null;
  slug?: string | null;
  /** That entry, already built on the server, so the first paint is the running screen. */
  project?: Project | null;
  /** A component to select on open (`?component=`). */
  component?: string | null;
  /** A flow step to open at (`?step=`), so a link can land on one screen of a flow. */
  step?: number | null;
  /**
   * A remix to open instead of the entry as built: one saved to an account, or handed over from
   * another Playground. Untrusted: it is validated before it is shown. Its `entry` names where it opens.
   */
  remix?: unknown;
};

const titleFor = (e: CatalogEntry, host: PlaygroundHost) => {
  if (host.links.entryTitle) return host.links.entryTitle(e);
  const kind = CATALOG_KINDS.find((k) => k.id === e.kind)!;
  return `${e.title}: SwiftUI ${kind.singular} · ${host.product} Playground`;
};

/** An entry's page: the host's own (`links.entryPath`), else basePath/<kind>/<slug>. */
const pathOf = (e: CatalogEntry, host: PlaygroundHost) => host.links.entryPath?.(e) ?? catalogPath(e, host.basePath);

export function Playground({ host, initial = {} }: { host: PlaygroundHost; initial?: PlaygroundInitial }) {
  const persist = useMemo(() => createPersistence(host.storageKey), [host.storageKey]);
  const track = useCallback<PlaygroundContextValue["track"]>((event, props) => host.track?.(event, props), [host]);
  const [store] = useState(() => {
    const named = initial.kind && initial.slug && isCatalogKind(initial.kind) ? host.catalog.get(initial.kind, initial.slug) ?? null : null;
    // No entry named: the host's featured entry it can open (Pro's own first, when it has any).
    const usable = (e: CatalogEntry) => !e.href && host.limits.availability.includes(e.availability);
    const entry = named ?? host.catalog.entries.filter((e) => e.featured && usable(e)).sort((a, b) => (b.availability === host.limits.tier ? 1 : 0) - (a.availability === host.limits.tier ? 1 : 0))[0] ?? host.catalog.entries.find(usable) ?? null;
    const s = createPlayStore({ entry, status: entry ? "loading" : "empty", explore: { kind: entry ? entry.kind : "screens", query: "" }, ...(host.layout === "docked" && host.compose ? { panel: "screens" as const } : {}) }, { registry: host.registry, limits: host.limits, catalog: host.catalog, persist, track });
    // Server-built: show it now, without touching storage (this also runs on the server).
    if (entry && initial.project) s.show(entry, initial.project, { restore: false });
    return s;
  });
  // The plan can change after mount (a Pro session answers late): the store follows the host.
  useEffect(() => store.setLimits(host.limits), [store, host.limits]);
  const [building, setBuilding] = useState(false);

  const navigate = useCallback<PlaygroundContextValue["navigate"]>(
    (kind, slug, opts = {}) => {
      if (!isCatalogKind(kind)) return;
      const entry = host.catalog.get(kind, slug);
      if (!entry) return;
      const path = pathOf(entry, host);
      if (window.location.pathname !== path) {
        if (opts.replace) window.history.replaceState({ sp: 1 }, "", path);
        else window.history.pushState({ sp: 1 }, "", path);
      }
      document.title = titleFor(entry, host);
      store.setDrawer(null);
      void store.open(entry).then(() => {
        if (opts.select) {
          const p = store.getState().project;
          const hit = p ? firstNodeOf(p, opts.select) : null;
          if (hit) store.select(hit.nodeId, hit.screenId);
        }
      });
    },
    [host, store],
  );

  // After mount: this browser's lists, then whatever the URL asks for beyond the page itself.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    store.hydrateLocal();
    const state = store.getState();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const shared = hash.get("r");
    const savedId = hash.get("saved");
    const entry = state.entry;
    const remixKey = initial.remix && typeof (initial.remix as { entry?: unknown }).entry === "string" ? String((initial.remix as { entry: string }).entry) : null;
    const [rk, rs] = remixKey?.split("/") ?? [];
    const remixEntry = (rk && rs && isCatalogKind(rk) ? host.catalog.get(rk, rs) : undefined) ?? entry ?? host.catalog.entries.find((e) => !e.href);
    if (initial.remix && remixEntry) {
      // The host's own page for the entry when it has one (Free: /playground/<app>), so a reload works.
      const path = pathOf(remixEntry, host);
      if (window.location.pathname !== path) window.history.replaceState({ sp: 1 }, "", path);
      document.title = titleFor(remixEntry, host);
      void store.open(remixEntry, { project: initial.remix, origin: { kind: "shared" } });
    } else if (entry && shared) {
      void decodeProject(shared)
        .then((raw) => store.open(entry, { project: raw, origin: { kind: "shared" } }))
        .catch(() => store.notify("That link couldn't be opened. Showing the original."));
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    } else if (entry && savedId) {
      void store.openSaved(entry, savedId);
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    } else if (entry && state.project) {
      // Bring back this browser's remix of the entry, if there is one.
      store.show(entry, state.project, { base: state.base ?? state.project });
    } else if (entry) {
      void store.open(entry);
    }
    // A link to one screen (an App Store screenshot's "Remix"): open the running app on it, once
    // the entry is ready (it may still be loading), whatever view was last used.
    if (initial.step != null) {
      const step = initial.step;
      if (store.getState().status === "ready") store.openAtStep(step);
      else {
        const off = store.subscribe(() => {
          if (store.getState().status !== "ready") return;
          off();
          store.openAtStep(step);
        });
      }
    }
    if (initial.component) {
      // A component page's "Try it" link: once the entry is ready (it may still be loading), bring the
      // screen that holds the component to the front and select it; or open the entry that shows it best.
      const component = initial.component;
      const reveal = () => {
        const p = store.getState().project;
        const hit = p ? firstNodeOf(p, component) : null;
        if (hit) {
          store.showScreen(hit.screenId);
          store.select(hit.nodeId, hit.screenId);
        } else if (!host.sidebar) {
          const other = host.catalog.forComponent(component);
          if (other) navigate(other.kind, other.slug, { replace: true, select: component });
        }
      };
      if (store.getState().status === "ready") reveal();
      else {
        const off = store.subscribe(() => {
          if (store.getState().status !== "ready") return;
          off();
          reveal();
        });
      }
    }
    track("playground_opened", { kind: entry?.kind ?? "none", slug: entry?.slug ?? "", tier: host.limits.tier, via: shared ? "share" : savedId ? "saved" : "url" });
  }, [store, persist, track, host, initial.component, initial.remix, initial.step, navigate]);

  // Back and forward move between entries, like pages: the entry whose page is the address.
  useEffect(() => {
    const onPop = () => {
      const here = window.location.pathname;
      const entry = host.catalog.entries.find((e) => pathOf(e, host) === here);
      if (entry && entryKey(entry) !== (store.getState().entry && entryKey(store.getState().entry!))) {
        document.title = titleFor(entry, host);
        void store.open(entry);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [host, store]);

  // The host follows the open entry (its sidebar, breadcrumb and fine print).
  const onEntry = host.onEntry;
  useEffect(() => {
    if (!onEntry) return;
    let last = store.getState().entry;
    onEntry(last);
    const off = store.subscribe(() => {
      const now = store.getState().entry;
      if (now === last) return;
      last = now;
      onEntry(now);
    });
    return () => void off();
  }, [store, onEntry]);

  // Keyboard: I inspects, Esc steps back out, ⌘Z / ⇧⌘Z undo and redo a remix, / searches.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      // Layout, on the selected component in Inspect: delete, duplicate, move.
      const sel = store.getState().mode === "inspect" ? store.getState().selected : null;
      if (sel) {
        if ((e.key === "Backspace" || e.key === "Delete") && !mod && !e.altKey) return (e.preventDefault(), store.removeNode(sel.nodeId));
        if (mod && e.key.toLowerCase() === "d") return (e.preventDefault(), store.duplicateNode(sel.nodeId));
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          const root = store.getState().project?.screens.find((x) => x.id === sel.screenId)?.root;
          const ids = (root ? parentOf(root, sel.nodeId)?.children ?? [] : []).map((c) => c.id);
          return slideInto(document.querySelector<HTMLElement>(".spb-phone"), ids, () => store.moveNode(sel.nodeId, e.key === "ArrowUp" ? -1 : 1));
        }
      }
      if (mod || e.altKey) return;
      const s = store.getState();
      if (e.key === "i" || e.key === "I") {
        if (onCanvasNow(s)) interact(store);
        else store.setMode(s.mode === "inspect" ? "interact" : "inspect");
      }
      else if (e.key === "Escape") {
        // Out one level at a time (the way a click goes in), then let go at the screen.
        if (s.selected) {
          const root = s.project?.screens.find((x) => x.id === s.selected!.screenId)?.root;
          const up = root ? parentOf(root, s.selected.nodeId) : null;
          store.select(up && up.id !== root!.id ? up.id : null);
        }
        else if (s.mode === "inspect") store.setMode("interact");
      } else if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".spp-search input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const flush = () => persist.flush();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", flush);
    };
  }, [store, persist]);

  // The page owns the viewport while the Playground is open.
  useEffect(() => {
    document.documentElement.classList.add("spb-app");
    return () => document.documentElement.classList.remove("spb-app");
  }, []);

  const ctx = useMemo<PlaygroundContextValue>(() => ({ store, host, track, navigate }), [store, host, track, navigate]);
  return (
    <PlaygroundContext.Provider value={ctx}>
      <Shell onBuild={() => setBuilding(true)} />
      {building ? (
        <Suspense fallback={null}>
          <BuildDialog onClose={() => setBuilding(false)} />
        </Suspense>
      ) : null}
    </PlaygroundContext.Provider>
  );
}

function Shell({ onBuild }: { onBuild: () => void }) {
  const { store, host } = usePlayground();
  const drawer = usePlay(store, (s) => s.drawer);
  const status = usePlay(store, (s) => s.status);
  const docked = host.layout === "docked";
  // Panels only animate once the Playground has painted, so taking over from the server-rendered
  // shell never slides a drawer shut in front of the visitor.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  // A locked entry has nothing to restyle, so once the visitor's plan is known (`host.session` is
  // null while the host is still asking, so nothing folds and comes back for a plan that opens it)
  // the Style tab folds away, and opens back out with the next entry that runs.
  const styleHidden = status === "locked" && host.session !== null;
  const home = host.compose ? ("screens" as const) : ("host" as const);
  useEffect(() => {
    if (styleHidden && store.getState().panel === "style") store.setPanel(home);
  }, [styleHidden, store, home]);
  // Docked, tabs like a design tool's sidebar: Screens (the default: this screen and the screens to
  // swap in), Style, then the inspector's Map (Inspect and SwiftUI live inside Map). Without a
  // screen library, the host's sidebar (or Explore) takes Screens' place.
  const panels = useMemo<PanelTab[]>(
    () => [
      host.compose
        ? { id: "screens" as const, label: host.compose.library === false ? (host.sidebar?.label ?? "Screens") : "Screens", render: () => <ScreensTab /> }
        : { id: "host" as const, label: host.sidebar?.label ?? "Explore", render: host.sidebar?.render ?? (() => <Explore />) },
      { id: "style", label: "Style", render: () => <StylePanel />, hidden: styleHidden },
    ],
    [host, styleHidden],
  );
  return (
    <div className="spp" data-layout={docked ? "docked" : undefined} data-drawer={drawer ?? undefined} data-status={status} data-settled={settled ? "" : undefined}>
      {docked ? <DockBar onBuild={onBuild} /> : <TopBar onBuild={onBuild} />}
      {docked ? (
        // One panel: the host's sidebar and the inspector as tabs, beside the stage.
        <aside className="spp-panel spp-left" aria-label={host.sidebar?.label ?? "Inspect"}>
          <Inspector onBuild={onBuild} panels={panels} tools={DOCKED_TOOLS} />
        </aside>
      ) : (
        <aside className="spp-panel spp-left" aria-label={host.sidebar?.label ?? "Explore"}>
          {host.sidebar ? host.sidebar.render() : <Explore />}
        </aside>
      )}
      <main className="spp-center">
        <Stage bar={!docked} />
      </main>
      {docked ? null : (
        <aside className="spp-panel spp-right" aria-label="Inspect">
          <Inspector onBuild={onBuild} />
        </aside>
      )}
      <MobileBar />
      <button type="button" className="spp-scrim" aria-label="Close" tabIndex={-1} onClick={() => store.setDrawer(null)} />
      <Notice />
    </div>
  );
}

/**
 * The docked layout's top bar, a panel like the host's docs navbar: back to where you came from,
 * the site mark and the breadcrumb on the left; Interact / Inspect in the middle; restart,
 * appearance, undo, redo and Build on the right.
 */
type Store = ReturnType<typeof usePlayground>["store"];

/** Whether the stage shows every screen at once (the All canvas), where parts are picked directly. */
const onCanvasNow = (s: ReturnType<Store["getState"]>) => s.canvas === "all" && (s.project?.screens.length ?? 0) > 1;

/** Interact: on the canvas, open the selected screen running; otherwise just switch mode. */
function interact(store: Store) {
  if (onCanvasNow(store.getState())) store.setCanvas("one");
  store.setMode("interact");
}

function DockBar({ onBuild }: { onBuild: () => void }) {
  const { store, host } = usePlayground();
  const mode = usePlay(store, (s) => s.mode);
  // On the All canvas every part can be picked, so the switch reads Inspect there.
  const onCanvas = usePlay(store, onCanvasNow);
  const shownMode = onCanvas ? "inspect" : mode;
  const scheme = usePlay(store, (s) => s.scheme);
  const remixed = usePlay(store, (s) => s.remixed);
  const status = usePlay(store, (s) => s.status);
  const entry = usePlay(store, (s) => s.entry);
  const crumbs = host.crumbs ?? (entry ? [{ label: "Playground", href: host.basePath }, { label: entry.title }] : []);
  return (
    <header className="spp-top spp-dockbar">
      <div className="spp-top-lead">
        {host.back ? (
          <a className="spp-back" href={host.back.href} aria-label={`Back to ${host.back.label}`} title={`Back to ${host.back.label}`}>
            <UI name="back" size={16} />
          </a>
        ) : null}
        {host.brand ? (
          <a className="spp-exit" href={host.brand.href} aria-label={`${host.brand.name} home`}>
            {host.brand.mark ?? <UI name="back" />}
          </a>
        ) : null}
        <nav className="spp-crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i ? <span aria-hidden>/</span> : null}
              {c.href && i < crumbs.length - 1 ? <a href={c.href}>{c.label}</a> : <strong>{c.label}</strong>}
            </span>
          ))}
        </nav>
        {/* One quiet control: what changed, and saving it. Build stays the one accent button. */}
        <div className="spp-save-group">
          {remixed && status === "ready" ? <span className="spp-remix-tag">Remixed</span> : null}
          <SaveButton />
        </div>
      </div>
      <div className="spp-seg spp-mode spp-dock-mode" role="radiogroup" aria-label="Mode">
        <button type="button" role="radio" aria-checked={shownMode === "interact"} onClick={() => interact(store)} title={onCanvas ? "Open the selected screen to use it (I)" : "Use the app (I toggles)"}>
          <UI name="phone" size={14} />
          <span>Interact</span>
        </button>
        <button type="button" role="radio" aria-checked={shownMode === "inspect"} onClick={() => store.setMode("inspect")} title={onCanvas ? "On the canvas, click any part to pick it" : "Take it apart (I toggles)"}>
          <UI name="inspect" size={14} />
          <span>Inspect</span>
        </button>
      </div>
      <div className="spp-top-actions">
        <button type="button" className="spp-icon-btn spp-dock-extra" onClick={() => store.restart()} aria-label="Restart the app" title="Restart">
          <UI name="restart" size={15} />
        </button>
        <button type="button" className="spp-icon-btn spp-dock-extra" onClick={() => store.setScheme(scheme === "dark" ? "light" : "dark")} aria-label={scheme === "dark" ? "Preview in light mode" : "Preview in dark mode"} title="Appearance">
          <UI name={scheme === "dark" ? "sun" : "moon"} size={15} />
        </button>
        <span className="spp-top-sep spp-dock-extra" aria-hidden />
        <Actions onBuild={onBuild} />
      </div>
    </header>
  );
}

/** Undo, redo and Build, in the top bar. */
function Actions({ onBuild }: { onBuild: () => void }) {
  const { store } = usePlayground();
  const status = usePlay(store, (s) => s.status);
  usePlay(store, (s) => s.project);
  return (
    <>
      <button type="button" className="spp-icon-btn" onClick={() => store.undo()} disabled={!store.canUndo()} aria-label="Undo" title="Undo (⌘Z)">
        <UI name="undo" />
      </button>
      <button type="button" className="spp-icon-btn" onClick={() => store.redo()} disabled={!store.canRedo()} aria-label="Redo" title="Redo (⇧⌘Z)">
        <UI name="redo" />
      </button>
      <span className="spp-top-sep" aria-hidden />
      <button type="button" className="spp-btn spp-btn-primary" onClick={onBuild} disabled={status !== "ready"}>
        <UI name="hammer" size={14} />
        Build
      </button>
    </>
  );
}

function TopBar({ onBuild }: { onBuild: () => void }) {
  const { store, host } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const remixed = usePlay(store, (s) => s.remixed);
  const status = usePlay(store, (s) => s.status);
  usePlay(store, (s) => s.project);
  const kind = entry ? CATALOG_KINDS.find((k) => k.id === entry.kind) : null;
  return (
    <header className="spp-top">
      <div className="spp-top-lead">
        {host.brand ? (
          <a className="spp-exit" href={host.brand.href} aria-label={`Back to ${host.brand.name}`}>
            {host.brand.mark ?? <UI name="back" />}
          </a>
        ) : null}
        <nav className="spp-crumbs" aria-label="Breadcrumb">
          {host.crumbs ? (
            host.crumbs.map((c, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i ? <span aria-hidden>/</span> : null}
                {c.href && i < host.crumbs!.length - 1 ? <a href={c.href}>{c.label}</a> : <strong>{c.label}</strong>}
              </span>
            ))
          ) : (
            <>
          <a href={host.basePath}>Playground</a>
          {kind ? (
            <>
              <span aria-hidden>/</span>
              <button type="button" onClick={() => store.setExplore({ kind: kind.id })}>{kind.label}</button>
              <span aria-hidden>/</span>
              <strong>{entry!.title}</strong>
            </>
          ) : null}
            </>
          )}
        </nav>
        {remixed && status === "ready" ? <span className="spp-remix-tag">Remixed</span> : null}
      </div>
      <div className="spp-top-actions">
        <Actions onBuild={onBuild} />
      </div>
    </header>
  );
}

/** The center: the device on its stage, the Interact / Inspect switch, and flow steps or hints. */
function Stage({ bar = true }: { bar?: boolean }) {
  const { store, host } = usePlayground();
  const status = usePlay(store, (s) => s.status);
  const mode = usePlay(store, (s) => s.mode);
  // On the All canvas every part can be picked, so the switch reads Inspect there.
  const onCanvas = usePlay(store, onCanvasNow);
  const shownMode = onCanvas ? "inspect" : mode;
  const scheme = usePlay(store, (s) => s.scheme);
  const entry = usePlay(store, (s) => s.entry);
  const canvas = usePlay(store, (s) => s.canvas);
  const many = usePlay(store, (s) => (s.project?.screens.length ?? 0) > 1);
  const badge = entry && host.stageBadge ? host.stageBadge(entry) : null;
  return (
    <div className="spp-stage" data-mode={mode}>
      {bar ? (
        <div className="spp-stage-bar">
          <div className="spp-seg spp-mode" role="radiogroup" aria-label="Mode">
            <button type="button" role="radio" aria-checked={shownMode === "interact"} onClick={() => interact(store)} title={onCanvas ? "Open the selected screen to use it (I)" : "Use the app (I toggles)"}>
              <UI name="phone" size={14} />
              Interact
            </button>
            <button type="button" role="radio" aria-checked={shownMode === "inspect"} onClick={() => store.setMode("inspect")} title={onCanvas ? "On the canvas, click any part to pick it" : "Take it apart (I toggles)"}>
              <UI name="inspect" size={14} />
              Inspect
            </button>
          </div>
          <div className="spp-stage-tools">
            <button type="button" className="spp-icon-btn" onClick={() => store.restart()} aria-label="Restart the app" title="Restart">
              <UI name="restart" size={15} />
            </button>
            <button type="button" className="spp-icon-btn" onClick={() => store.setScheme(scheme === "dark" ? "light" : "dark")} aria-label={scheme === "dark" ? "Preview in light mode" : "Preview in dark mode"} title="Appearance">
              <UI name={scheme === "dark" ? "sun" : "moon"} size={15} />
            </button>
          </div>
        </div>
      ) : null}
      <div className="spp-stage-body" data-canvas={status === "ready" && canvas === "all" && many ? "all" : "one"} data-badge={badge ? "" : undefined}>
        {badge ? <div className="spp-stage-badge">{badge}</div> : null}
        {status === "ready" ? (
          <>
            <CanvasSwitch />
            {canvas === "all" && many ? (
              <ScreenWall />
            ) : (
              <>
                <PhoneDrop>
                  <Device />
                </PhoneDrop>
                <Reference />
              </>
            )}
          </>
        ) : null}
        {status === "loading" ? <DeviceSkeleton /> : null}
        {status === "locked" && entry ? (
          host.lockedStage ? (
            host.lockedStage(entry)
          ) : (
            <Suspense fallback={<DeviceSkeleton />}>
              <Locked />
            </Suspense>
          )
        ) : null}
        {status === "missing" ? <p className="spp-empty">This one isn&apos;t available. Pick another from Explore.</p> : null}
        {status === "empty" ? <p className="spp-empty">Pick a screen, a flow or an interaction to start.</p> : null}
      </div>
      <div className="spp-stage-foot">{status !== "ready" ? null : host.compose ? <ScreenStrip /> : entry?.kind === "flows" ? <FlowStrip /> : <TryLine />}</div>
    </div>
  );
}

function DeviceSkeleton() {
  return (
    <div className="spp-fit">
      <div className="spp-device-skeleton" aria-busy="true" aria-label="Loading" />
    </div>
  );
}

/** Small screens: the device leads; Explore and Inspect open as sheets from this bar. */
function MobileBar() {
  const { store, host } = usePlayground();
  const drawer = usePlay(store, (s) => s.drawer);
  const panel = usePlay(store, (s) => s.panel);
  const selected = usePlay(store, (s) => Boolean(s.selected));
  const docked = host.layout === "docked";
  const home = host.compose ? ("screens" as const) : ("host" as const);
  // Docked, both buttons open the one panel, each at its own tab.
  const open = (which: "explore" | "inspect") => {
    if (docked) {
      const on = drawer === "explore" && (which === "explore" ? panel !== "tools" : panel === "tools");
      if (!on) store.setPanel(which === "explore" ? home : "tools");
      store.setDrawer(on ? null : "explore");
    } else store.setDrawer(drawer === which ? null : which);
  };
  const pressed = (which: "explore" | "inspect") => (docked ? drawer === "explore" && (which === "explore" ? panel !== "tools" : panel === "tools") : drawer === which);
  return (
    <nav className="spp-mobilebar" aria-label="Playground">
      <button type="button" aria-pressed={pressed("explore")} onClick={() => open("explore")}>
        <UI name="grid" size={18} />
        {docked && host.compose ? (host.compose.library === false ? (host.sidebar?.label ?? "Screens") : "Screens") : (host.sidebar?.label ?? "Explore")}
      </button>
      <button type="button" aria-pressed={pressed("inspect")} onClick={() => open("inspect")}>
        <UI name={docked ? "tree" : selected ? "sliders" : "inspect"} size={18} />
        {docked ? "Map" : selected ? "Remix" : "Inspect"}
      </button>
    </nav>
  );
}

function Notice() {
  const { store } = usePlayground();
  const notice = usePlay(store, (s) => s.notice);
  const [shown, setShown] = useState<typeof notice>(null);
  useEffect(() => {
    if (!notice) return;
    setShown(notice);
    const t = window.setTimeout(() => setShown(null), 2600);
    return () => window.clearTimeout(t);
  }, [notice]);
  return shown ? (
    <div className="spp-notice" role="status" key={shown.seq}>
      {shown.text}
    </div>
  ) : null;
}
