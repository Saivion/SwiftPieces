"use client";
// The stage's two views and what sits around them: a switch between the running app (one screen)
// and every screen side by side (still, each where it lives: its tab lit, a back button when it is
// pushed), and the screenshot that inspired the screen showing, pinned to the stage's corner.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft } from "lucide-react";
import type { CatalogEntry } from "../../core/catalog.js";
import { resolveTheme } from "../../core/looks.js";
import type { Project, Screen } from "../../core/schema.js";
import { findNode } from "../../core/tree.js";
import { Glyph, UI } from "../icons.js";
import { SchemeContext, ThemeContext, schemeFor, themeVars } from "../preview/env.js";
import { NodeBoundary } from "../preview/NodeView.js";
import { RuntimeContext, createChoiceBus, type Runtime } from "../preview/runtime.js";
import { usePlayground, type PlaygroundHost } from "./context.js";
import { BEZEL, DockView, PHONE_H, PHONE_W, StatusBar, screenTitle } from "./Device.js";
import { maskBars, placeHoverTag, placeOutline, revealWithin, visibleRect } from "./outline.js";
import { currentScreenId, pathFromTabs, tabRoots, usePlay } from "./store.js";
import { useStyleFonts } from "./style-fonts.js";
import { SelectionBar } from "./SelectionBar.js";

// ---------------------------------------------------------------- Where a screen came from

type Origin = { entry: CatalogEntry; step: number };

/**
 * The catalog screen a project screen answers: the one it was brought in from, else (one of the
 * open entry's own screens) its place in the entry as built.
 */
function originOf(screen: Screen, entry: CatalogEntry | null, base: Project | null, host: PlaygroundHost): Origin | null {
  if (screen.source) {
    const e = host.catalog.entries.find((x) => x.kind === screen.source!.kind && x.slug === screen.source!.slug);
    return e ? { entry: e, step: screen.source.step } : null;
  }
  const at = base?.screens.findIndex((s) => s.id === screen.id) ?? -1;
  return entry && at >= 0 ? { entry, step: at } : null;
}

/** The app a screen came from, by name, when it isn't the one open. */
function appOf(origin: Origin | null, entry: CatalogEntry | null, host: PlaygroundHost): string | null {
  if (!origin || !entry || (origin.entry.kind === entry.kind && origin.entry.slug === entry.slug)) return null;
  return host.compose?.source(origin.entry)?.title ?? origin.entry.title;
}

// ---------------------------------------------------------------- One / All

/** Top left of the stage: the running app, or every screen side by side. */
export const CanvasSwitch = memo(function CanvasSwitch() {
  const { store } = usePlayground();
  const canvas = usePlay(store, (s) => s.canvas);
  const count = usePlay(store, (s) => s.project?.screens.length ?? 0);
  if (count < 2) return null;
  return (
    <div className="spp-seg spp-canvas-switch" role="radiogroup" aria-label="View">
      <button type="button" role="radio" aria-checked={canvas === "one"} onClick={() => store.setCanvas("one")} title="The running app, one screen at a time">
        <UI name="phone" size={14} />
        One
      </button>
      <button type="button" role="radio" aria-checked={canvas === "all"} onClick={() => store.setCanvas("all")} title="Every screen side by side">
        <UI name="grid" size={14} />
        All {count}
      </button>
    </div>
  );
});

// ---------------------------------------------------------------- Inspiration

/**
 * Top right of the stage: the App Store screenshot the screen showing was inspired by, small, with
 * the app it's from. Click to see it larger. Tucked away it stays a mini of the same picture, so you
 * still see what inspired the screen, and a click opens it again. Only where the host has one for
 * this screen.
 */
export const Reference = memo(function Reference() {
  const { store, host } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const base = usePlay(store, (s) => s.base);
  const on = usePlay(store, (s) => s.reference);
  const screen = usePlay(store, (s) => {
    const id = currentScreenId(s.nav);
    return s.project?.screens.find((x) => x.id === id) ?? s.project?.screens[0] ?? null;
  });
  const [large, setLarge] = useState(false);
  // The card appears only once its picture has loaded, so the caption never shows first and the
  // picture never pushes it down. One size is loaded for both states, so enlarging doesn't reload.
  const [ready, setReady] = useState<string | null>(null);
  const origin = screen ? originOf(screen, entry, base, host) : null;
  const src = origin ? (host.compose?.art?.(origin.entry, origin.step, 520) ?? null) : null;
  if (!src || !origin) return null;
  const app = host.compose?.source(origin.entry)?.title ?? origin.entry.title;
  const shotLabel = !on ? `Open the ${app} screen that inspired this one` : large ? "Show smaller" : "Show larger";
  return (
    <figure className="spp-ref" data-mini={!on || undefined} data-large={(on && large) || undefined} data-ready={ready === src || undefined}>
      <button
        type="button"
        className="spp-ref-shot"
        onClick={() => (on ? setLarge((l) => !l) : (setLarge(false), store.setReference(true)))}
        aria-label={shotLabel}
        title={shotLabel}
      >
        <img
          key={src}
          src={src}
          alt={`The ${app} screen this one was inspired by`}
          draggable={false}
          onLoad={() => setReady(src)}
          ref={(el) => {
            if (el?.complete && el.naturalWidth && ready !== src) setReady(src);
          }}
        />
      </button>
      <figcaption>
        <span className="spp-ref-eyebrow">Inspired by</span>
        <span className="spp-ref-app">{app}</span>
      </figcaption>
      {on ? (
        <button type="button" className="spp-icon-btn spp-icon-btn-sm spp-ref-hide" aria-label="Make the inspiration smaller" title="Make smaller" onClick={() => store.setReference(false)}>
          <UI name="close" size={12} />
        </button>
      ) : null}
    </figure>
  );
});

// ---------------------------------------------------------------- Every screen

/** Phones sit this far apart, in points, on the canvas. */
const GAP = 56;
/** Room around the row when fitting it: the view switch above, the zoom controls below. */
const FIT = { top: 64, bottom: 64, x: 48 };
/** Zoom limits (1 = the phone at its real size), and the smallest a fitted row starts at. */
const Z_MIN = 0.08;
const Z_MAX = 2;
const Z_START_MIN = 0.16;
/** Labels under the phones stay this tall on screen, whatever the zoom. */
const LABEL = 34;
const DEVICE_W = PHONE_W + BEZEL * 2;
const DEVICE_H = PHONE_H + BEZEL * 2;

type View = { x: number; y: number; z: number };
const clampZ = (z: number) => Math.min(Z_MAX, Math.max(Z_MIN, z));

/**
 * Every screen side by side on a canvas you move around like a design tool's: pinch or ⌘/Ctrl-scroll
 * zooms around the pointer (the canvas, never the page), scrolling or dragging pans, and the corner
 * controls zoom in, out, to real size or back to fit. Each screen sits as it does in the app: its
 * tab lit, a back button when it is pushed. Clicking picks parts (outermost first, deeper with each
 * click, ⌘-click the innermost) without leaving the canvas; a label's Open runs the screen.
 */
export const ScreenWall = memo(function ScreenWall() {
  const { store, host } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const entry = usePlay(store, (s) => s.entry);
  const base = usePlay(store, (s) => s.base);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const previewScheme = usePlay(store, (s) => s.scheme);
  const theme = useMemo(() => (project?.theme ? resolveTheme(project.theme) : null), [project?.theme]);
  useStyleFonts(theme);
  const box = useRef<HTMLDivElement>(null);
  // The layout bar rides on the selection here too, as it does on the running screen. Every click on
  // the canvas picks a part (in Interact as well), so it shows for any selection, not only while
  // inspecting. It is pointed at the selected screen's phone on the wall and drawn in the wall's own
  // pixels (outside the zoom), so it stays crisp at any zoom and follows every pan and pinch.
  const selScreen = usePlay(store, (s) => s.selected?.screenId ?? null);
  const selPhone = useMemo(
    () => ({
      get current() {
        return selScreen ? (box.current?.querySelector<HTMLDivElement>(`.spp-wall-item[data-screen-id="${CSS.escape(selScreen)}"] .spp-wall-phone`) ?? null) : null;
      },
    }) as React.RefObject<HTMLDivElement | null>,
    [selScreen],
  );
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  viewRef.current = view;
  // Until the canvas is moved by hand, it keeps fitting the stage as the window changes.
  const auto = useRef(true);
  const count = project?.screens.length ?? 1;
  const currentAt = Math.max(0, project?.screens.findIndex((s) => s.id === current) ?? 0);
  const rowW = count * DEVICE_W + (count - 1) * GAP;

  /** The whole row in view, centred (never smaller than Z_START_MIN on open; the row then scrolls). */
  const fitView = (el: HTMLElement, start: boolean): View => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    const zh = (h - FIT.top - FIT.bottom - LABEL) / DEVICE_H;
    const zw = (w - FIT.x * 2) / rowW;
    const fit = Math.min(zh, zw, start ? 0.62 : Z_MAX);
    const z = clampZ(start ? Math.max(fit, Math.min(zh, Z_START_MIN)) : Math.min(zh, zw));
    const y = FIT.top + (h - FIT.top - FIT.bottom - LABEL - DEVICE_H * z) / 2;
    // Centred when it fits; else the current screen as near the middle as the row's ends allow.
    const centred = w / 2 - (currentAt * (DEVICE_W + GAP) + DEVICE_W / 2) * z;
    const x = rowW * z <= w - FIT.x * 2 ? (w - rowW * z) / 2 : Math.min(FIT.x, Math.max(w - FIT.x - rowW * z, centred));
    return { x, y, z };
  };

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      if (auto.current || !viewRef.current) setView(fitView(el, true));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  /** Zooms to `z` keeping the canvas point under (px, py) where it is. */
  const zoomAt = (z: number, px: number, py: number) => {
    const v = viewRef.current;
    if (!v) return;
    const next = clampZ(z);
    const k = next / v.z;
    auto.current = false;
    setView({ z: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
  };
  const panBy = (dx: number, dy: number) => {
    const v = viewRef.current;
    if (!v) return;
    auto.current = false;
    setView({ ...v, x: v.x + dx, y: v.y + dy });
  };
  const zoomCentre = (factor: number) => {
    const el = box.current;
    const v = viewRef.current;
    if (el && v) zoomAt(v.z * factor, el.clientWidth / 2, el.clientHeight / 2);
  };
  const fit = () => {
    const el = box.current;
    if (!el) return;
    auto.current = true;
    setView(fitView(el, false));
  };

  // Picked in the Map: glide the canvas so that screen, or the part picked inside it, sits in the
  // middle, at the zoom it's at. Something already fully in view stays where it is. A part on a page
  // that isn't showing (a hidden tab page) has no box, so its screen is centred instead.
  const focus = usePlay(store, (s) => s.focus);
  useEffect(() => {
    if (!focus) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const el = box.current;
        const v = viewRef.current;
        const item = el?.querySelector<HTMLElement>(`.spp-wall-item[data-screen-id="${CSS.escape(focus.screenId)}"]`);
        if (!el || !v || !item) return;
        const phone = item.querySelector<HTMLElement>(".spp-wall-device") ?? item;
        const part = focus.nodeId ? item.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(focus.nodeId)}"]`) : null;
        // A part below the fold is scrolled to inside its screen first, then what shows of it is centred.
        if (part) revealWithin(part, phone);
        const r = (part && visibleRect(part, phone)) ?? phone.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        const inView = r.left >= b.left + 8 && r.right <= b.right - 8 && r.top >= b.top + 8 && r.bottom <= b.bottom - LABEL - 8;
        if (inView) return;
        auto.current = false;
        el.setAttribute("data-glide", "");
        window.setTimeout(() => el.removeAttribute("data-glide"), 480);
        setView({ ...v, x: v.x + (b.left + b.width / 2 - (r.left + r.width / 2)), y: v.y + (b.top + b.height / 2 - (r.top + r.height / 2)) });
      });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq]);

  // Wheel and trackpad: pinch (which arrives as ctrl + wheel) and ⌘-scroll zoom, scrolling pans.
  // Listened to directly, not through React, because only a non-passive listener can stop the page
  // zooming. Safari's own gesture events are caught for the same reason.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const onWheel = (e: WheelEvent) => {
      // Scrolling the layout bar's piece menu scrolls the menu, not the canvas.
      if ((e.target as HTMLElement | null)?.closest(".spp-selbar")) return;
      e.preventDefault();
      const v = viewRef.current;
      if (!v) return;
      if (e.ctrlKey || e.metaKey) {
        const [px, py] = local(e);
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        // A trackpad pinch sends small steps; a mouse wheel notch is capped so it zooms by a step, not a leap.
        const d = Math.max(-60, Math.min(60, e.deltaY * unit));
        zoomAt(v.z * Math.exp(-d / (e.ctrlKey && !e.metaKey ? 110 : 240)), px, py);
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        panBy(-dx, -dy);
      }
    };
    let gz = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gz = viewRef.current?.z ?? 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      const [px, py] = local(g);
      zoomAt(gz * g.scale, px, py);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard, while the canvas is showing: ⌘/Ctrl + = and - zoom it (not the page), 0 fits, 1 is real size.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "=" || e.key === "+") (e.preventDefault(), zoomCentre(1.25));
      else if (e.key === "-") (e.preventDefault(), zoomCentre(0.8));
      else if (e.key === "0") (e.preventDefault(), fit());
      else if (e.key === "1") (e.preventDefault(), zoomAt(1, (box.current?.clientWidth ?? 0) / 2, (box.current?.clientHeight ?? 0) / 2));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dragging pans (with a mouse or one finger); two fingers pinch. A press that moves less than a
  // few pixels is still a click, and opens the screen under it.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<{ x: number; y: number; far: boolean; dist: number; z: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    // The layout bar and its menu are tools, not canvas: pressing them (or dragging the grip) never pans.
    if ((e.target as HTMLElement).closest(".spp-selbar")) return;
    // A new first finger or click: any pointer whose release went missing is gone, so this press
    // is never mistaken for the second finger of a pinch.
    if (e.isPrimary) pointers.current.clear();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const z = viewRef.current?.z ?? 1;
    if (pointers.current.size === 1) press.current = { x: e.clientX, y: e.clientY, far: false, dist: 0, z };
    else if (pointers.current.size === 2 && press.current) {
      const [a, b] = [...pointers.current.values()];
      Object.assign(press.current, { far: true, dist: Math.hypot(a.x - b.x, a.y - b.y), z });
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    // The part under the pointer is outlined, while nothing is being dragged.
    if (!press.current?.far) {
      const t = e.target as HTMLElement;
      store.hover(t.closest(".spp-wall-phone") ? (t.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId ?? null) : null);
    }
    const prev = pointers.current.get(e.pointerId);
    const p = press.current;
    if (!prev || !p) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const r = box.current!.getBoundingClientRect();
      if (p.dist) zoomAt(p.z * (Math.hypot(a.x - b.x, a.y - b.y) / p.dist), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if (!p.far && Math.hypot(now.x - p.x, now.y - p.y) > 4) {
      p.far = true;
      store.hover(null);
      try {
        box.current?.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone (released between events): the pan still follows moves over the canvas.
      }
      box.current?.setAttribute("data-panning", "");
    }
    if (p.far) panBy(now.x - prev.x, now.y - prev.y);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) box.current?.removeAttribute("data-panning");
  };

  const runtime = useMemo<Runtime>(() => ({ registry: host.registry, act: () => false, haptic: () => {}, scale: () => viewRef.current?.z ?? 1, onError: () => {}, overlay: () => null, choices: createChoiceBus(), still: true }), [host.registry]);
  // The phones, built once per change to the project, the screen showing, the look or the mode, so
  // moving the canvas (which re-renders on every frame of a pan or pinch) only moves the transform.
  const tabs = useMemo(() => (project?.shell === "tabs" ? tabRoots(project) : []), [project]);
  const items = useMemo(() => {
    if (!project) return null;
    const open = (id: string) => {
      store.showScreen(id);
      store.setCanvas("one");
    };
    return project.screens.map((s, i) => {
      const tabAt = tabs.findIndex((t) => t.id === s.id);
      const home = tabAt >= 0 ? null : pathFromTabs(project, s.id);
      const from = home && home.path.length > 1 ? project.screens.find((x) => x.id === home.path[home.path.length - 2]) : null;
      const lit = tabAt >= 0 ? tabAt : (home?.tab ?? -1);
      const scheme = schemeFor(String(s.root.props.appearance ?? "system"), theme, previewScheme);
      const app = appOf(originOf(s, entry, base, host), entry, host);
      return (
        <li key={s.id} className="spp-wall-item" data-screen-id={s.id} data-current={s.id === current || undefined}>
          <div
            role="button"
            tabIndex={0}
            className="spp-wall-phone"
            aria-label={`Select ${screenTitle(s)}`}
            aria-pressed={s.id === current}
            // The screens are pictures here: nothing inside reacts (pointer events stop at the phone,
            // after the canvas has seen them). A click picks the part under the pointer, or the screen
            // from its edge. Opening one running is the label's Open (or Enter).
            onPointerDownCapture={(e) => e.stopPropagation()}
            onPointerMoveCapture={(e) => e.stopPropagation()}
            onPointerUpCapture={(e) => e.stopPropagation()}
            onClickCapture={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const node = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
              store.showScreen(s.id);
              // The screen's edge (bezel, status bar, dock) picks the screen; anything on it picks a part.
              if (node && node !== s.root.id) store.pick(node, { deep: e.metaKey || e.ctrlKey, screenId: s.id });
              else store.select(s.root.id, s.id);
            }}
            // Quick clicks drill in (each click one level deeper); they never open the screen.
            onDoubleClickCapture={(e) => (e.stopPropagation(), e.preventDefault())}
            onKeyDown={(e) => {
              if (e.key === " ") (e.preventDefault(), store.showScreen(s.id), store.select(s.root.id, s.id));
              if (e.key === "Enter") (e.preventDefault(), open(s.id));
            }}
          >
            <span className="spp-device spp-wall-device">
              <span className={`spb-phone${lit >= 0 ? " has-tabs" : ""}`} data-scheme={scheme} style={themeVars(theme, scheme)}>
                <RuntimeContext.Provider value={runtime}>
                  <ThemeContext.Provider value={theme}>
                    <SchemeContext.Provider value={scheme}>
                      <span className={`spp-screen spb-phone-screen${from ? " is-pushed" : ""}`} data-role="top" data-scheme={scheme} style={themeVars(theme, scheme)}>
                        {from ? (
                          <span className="spb-navback">
                            <ChevronLeft size={24} strokeWidth={2.4} aria-hidden />
                            <span>{screenTitle(from)}</span>
                          </span>
                        ) : null}
                        <span className="spb-screen-host">
                          <NodeBoundary node={s.root} />
                        </span>
                      </span>
                      {tabs.length && lit >= 0 ? (
                        <span inert>
                          {(project.theme?.tabStyle ?? (project.tabBar === "dock" ? "dock" : "system")) !== "system" ? <DockView tabs={tabs} active={lit} glass={project.theme?.tabStyle === "glass"} /> : <StillTabBar tabs={tabs} active={lit} />}
                        </span>
                      ) : null}
                    </SchemeContext.Provider>
                  </ThemeContext.Provider>
                </RuntimeContext.Provider>
                <StatusBar />
                <span className="spb-home" aria-hidden />
              </span>
            </span>
          </div>
          <span
            className="spp-wall-label"
            onClick={(e) => {
              e.stopPropagation();
              store.showScreen(s.id);
              store.select(s.root.id, s.id);
            }}
            onDoubleClick={(e) => (e.stopPropagation(), open(s.id))}
          >
            <span className="spp-wall-n">{i + 1}</span>
            <span className="spp-wall-title">{screenTitle(s)}</span>
            {tabAt >= 0 ? <span className="spp-wall-tab" title="In the tab bar"><UI name="dock" size={12} strokeWidth={2} /></span> : null}
            {app ? <span className="spp-wall-from" title={`From ${app}`}>{app}</span> : null}
            <button
              type="button"
              className="spp-wall-open"
              onClick={(e) => (e.stopPropagation(), open(s.id))}
              onPointerDown={(e) => e.stopPropagation()}
              title="Open it running (Enter)"
              aria-label={`Open ${screenTitle(s)}`}
            >
              Open
              <UI name="expand" size={11} />
            </button>
          </span>
        </li>
      );
    });
  }, [project, tabs, current, theme, previewScheme, entry, base, host, runtime, store]);
  if (!project) return null;
  const z = view?.z ?? 1;

  return (
    <div
      ref={box}
      className="spp-wall"
      // Capture phase: the canvas sees every press before a phone stops it reaching the screen inside.
      onPointerDownCapture={onPointerDown}
      onPointerMoveCapture={onPointerMove}
      onPointerUpCapture={onPointerUp}
      onPointerCancelCapture={onPointerUp}
      onPointerLeave={() => store.hover(null)}
      onClickCapture={(e) => {
        // The end of a drag or a pinch isn't a click.
        if (press.current?.far) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      // A click on the canvas itself, away from every screen, lets go of the selection.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest(".spp-zoom")) store.select(null);
      }}
    >
      {view ? (
        <ol className="spp-wall-list" aria-label="Every screen" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${z})`, ["--z" as string]: z, ["--gap" as string]: `${GAP}px` } as CSSProperties}>
          {items}
        </ol>
      ) : null}
      <WallHighlight wall={box} tagged={Boolean(selScreen)} />
      <SelectionBar phoneRef={selPhone} slotRef={box} always />
      <div className="spp-zoom" role="group" aria-label="Zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={() => zoomCentre(0.8)} aria-label="Zoom out" title="Zoom out (⌘ −)">
          <UI name="minus" size={13} />
        </button>
        <button type="button" className="spp-zoom-pct" onClick={() => zoomCentre(1 / z)} title="Real size (⌘ 1)">
          {Math.round(z * 100)}%
        </button>
        <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={() => zoomCentre(1.25)} aria-label="Zoom in" title="Zoom in (⌘ =)">
          <UI name="plus" size={13} />
        </button>
        <span className="spp-zoom-sep" aria-hidden />
        <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={fit} aria-label="Fit every screen" title="Fit every screen (⌘ 0)">
          <UI name="expand" size={13} />
        </button>
      </div>
    </div>
  );
});

/**
 * Outlines on the canvas: the part under the pointer and the part selected, each with its name.
 * Drawn over the canvas in screen space (not inside the zoom), so they stay crisp at any zoom, and
 * placed every frame, so they follow a pan or a pinch.
 */
function WallHighlight({ wall, tagged = false }: { wall: React.RefObject<HTMLDivElement | null>; tagged?: boolean }) {
  const { store, host } = usePlayground();
  const selected = usePlay(store, (s) => s.selected?.nodeId ?? null);
  const hover = usePlay(store, (s) => s.hover);
  const project = usePlay(store, (s) => s.project);
  const layer = useRef<HTMLDivElement>(null);
  const selBox = useRef<HTMLDivElement>(null);
  const hovBox = useRef<HTMLDivElement>(null);
  const selLabel = useMemo(() => nodeLabel(project, selected, host.registry), [project, selected, host.registry]);
  const hovLabel = useMemo(() => nodeLabel(project, hover, host.registry), [project, hover, host.registry]);

  useEffect(() => {
    let raf = 0;
    const find = (id: string | null) => (id && wall.current ? wall.current.querySelector<HTMLElement>(`.spp-wall-phone [data-node-id="${CSS.escape(id)}"]`) : null);
    const tick = () => {
      // Outlines pass behind each phone's dock or tab bar.
      maskBars(layer.current, wall.current);
      const sel = placeOutline(selBox.current, find(selected), wall.current);
      const hov = placeOutline(hovBox.current, find(hover && hover !== selected ? hover : null), wall.current);
      placeHoverTag(hovBox.current, hov, sel);
      raf = requestAnimationFrame(tick);
    };
    if (selected || hover) tick();
    else {
      placeOutline(selBox.current, null, null);
      placeOutline(hovBox.current, null, null);
    }
    return () => cancelAnimationFrame(raf);
  }, [selected, hover, wall]);

  return (
    <div ref={layer} className="spp-highlights spp-wall-highlights" aria-hidden>
      <div ref={hovBox} className="spp-hl is-hover" style={{ opacity: 0 }}>
        {hovLabel ? <span className="spp-hl-label">{hovLabel}</span> : null}
      </div>
      <div ref={selBox} className="spp-hl is-selected" style={{ opacity: 0 }}>
        {/* While inspecting, the layout bar is the selection's name tag (as on the running screen). */}
        {selLabel && !tagged ? <span className="spp-hl-label">{selLabel}</span> : null}
      </div>
    </div>
  );
}

/** A node's name for its outline: the component's, or "Screen" for a screen's root. */
function nodeLabel(project: Project | null, id: string | null, registry: { get(id: string): { name: string } | undefined }): string | null {
  if (!project || !id) return null;
  for (const s of project.screens) {
    if (s.root.id === id) return screenTitle(s);
    const n = findNode(s.root, id);
    if (n) return registry.get(n.component)?.name ?? n.component;
  }
  return null;
}

/** The system tab bar, still. */
function StillTabBar({ tabs, active }: { tabs: Screen[]; active: number }) {
  return (
    <nav className="spp-tabbar" aria-hidden>
      <div className="spp-tabbar-inner">
        {tabs.map((s, i) => (
          <span key={s.id} className="spp-tabbar-item" aria-current={i === active ? "page" : undefined}>
            <Glyph name={s.tab?.icon ?? "house"} size={22} strokeWidth={i === active ? 2.2 : 1.8} />
            <span>{s.tab?.title ?? screenTitle(s)}</span>
          </span>
        ))}
      </div>
    </nav>
  );
}
