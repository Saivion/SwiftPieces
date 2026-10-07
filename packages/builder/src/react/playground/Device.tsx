"use client";
// The device: a small running iPhone app, not a mockup. It keeps a NavigationStack per tab, presents
// sheets over it, animates pushes and pops the way iOS does, lets you swipe back from the edge, and
// shows haptics where they happen. In Inspect mode the same screen becomes something to take apart:
// the pointer highlights components, a click selects one, and nothing underneath reacts.
import { memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft } from "lucide-react";
import { resolveTheme, type ResolvedTheme } from "../../core/looks.js";
import type { Project, Screen } from "../../core/schema.js";
import { findNode } from "../../core/tree.js";
import { Glyph } from "../icons.js";
import { SchemeContext, ThemeContext, schemeFor, themeVars, type Scheme } from "../preview/env.js";
import { NodeBoundary, preloadFor } from "../preview/NodeView.js";
import { createChoiceBus, RuntimeContext, SPRING, useDrag, type HapticKind, type Runtime } from "../preview/runtime.js";
import { usePlayground } from "./context.js";
import { findVisible, maskBars, placeHoverTag, placeOutline } from "./outline.js";
import { SelectionBar } from "./SelectionBar.js";
import { startLayoutDrag } from "./layout-drag.js";
import { currentScreenId, tabRoots, usePlay, type Nav } from "./store.js";
import { useStyleFonts } from "./style-fonts.js";
import { BEZEL, PHONE_H, PHONE_W, StatusBar, screenTitle } from "../preview/phone.js";

// The phone's size, bezel and status bar live in preview/phone.tsx (stills and style previews draw
// the same phone without the store); re-exported for everything that reads them from here.
export { BEZEL, PHONE_H, PHONE_W, StatusBar, screenTitle };

/**
 * The back button's label, as UIKit picks it: the previous screen's title when it fits beside this
 * screen's centred bar title, otherwise "Back", so the two never run into each other once the large
 * title collapses. Widths are estimated from the text at 17pt.
 */
function backTitle(back: Screen, current: Screen): string {
  const label = screenTitle(back);
  const title = String(current.root.props.title ?? "").trim();
  if (!title) return label;
  // Half the bar beside the centred title, less the chevron, its padding and a gap.
  const room = (PHONE_W - title.length * 9.4) / 2 - 46;
  return label.length * 8.6 <= room ? label : "Back";
}

type Pulse = { id: number; x: number; y: number; kind: HapticKind };

/**
 * The phone, scaled to fit its stage. `fit` is the element whose size bounds it. Everything inside
 * is laid out in points at 390 × 844 and scaled as one layer, so the app never reflows as the
 * window changes.
 */
export const Device = memo(function Device() {
  const { store, host } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const nav = usePlay(store, (s) => s.nav);
  const previewScheme = usePlay(store, (s) => s.scheme);
  const mode = usePlay(store, (s) => s.mode);
  const theme = useMemo(() => (project?.theme ? resolveTheme(project.theme) : null), [project?.theme]);
  useStyleFonts(theme);

  const fitRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const scaleRef = useRef(1);
  const slotRef = useRef<HTMLDivElement>(null);
  const [pulses, setPulses] = useState<Pulse[]>([]);

  // Fit the phone to the stage, in whole-pixel-friendly steps.
  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const s = Math.min(1, width / (PHONE_W + BEZEL * 2), height / (PHONE_H + BEZEL * 2));
      const next = Math.max(0.3, Math.floor(s * 200) / 200);
      scaleRef.current = next;
      setScale(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Preload every renderer the project needs, so pushing a screen never flashes placeholders.
  useEffect(() => {
    project?.screens.forEach((s) => preloadFor(s.root, host.registry));
  }, [project, host.registry]);

  const haptic = useCallback((kind: HapticKind, from?: Element | null) => {
    const phone = phoneRef.current;
    let x = PHONE_W / 2;
    let y = PHONE_H / 2;
    if (phone && from) {
      const a = phone.getBoundingClientRect();
      const b = from.getBoundingClientRect();
      x = (b.left + b.width / 2 - a.left) / scaleRef.current;
      y = (b.top + b.height / 2 - a.top) / scaleRef.current;
    }
    const id = performance.now();
    setPulses((p) => [...p.slice(-3), { id, x, y, kind }]);
    window.setTimeout(() => setPulses((p) => p.filter((q) => q.id !== id)), 700);
  }, []);

  const overlayRef = useRef<HTMLDivElement>(null);
  // A fresh selection bus per open entry, so option groups start from the project's own state.
  const entryId = usePlay(store, (s) => s.entry?.slug ?? "");
  const choices = useMemo(() => createChoiceBus(), [entryId, project?.id]);
  const runtime = useMemo<Runtime>(
    () => ({
      registry: host.registry,
      act: (link) => store.act(link),
      haptic,
      scale: () => scaleRef.current,
      onError: (component) => host.track?.("builder_error", { where: "preview", component }),
      overlay: () => overlayRef.current,
      choices,
    }),
    [host, store, haptic, choices],
  );

  // Inspect mode: the pointer finds components; nothing underneath reacts.
  const nodeAt = (target: EventTarget | null): string | null => {
    const el = (target as HTMLElement | null)?.closest<HTMLElement>("[data-node-id]");
    if (!el || el.classList.contains("spb-screen")) return null;
    return el.dataset.nodeId ?? null;
  };
  const inspecting = mode === "inspect";
  const capture = inspecting
    ? {
        onPointerDownCapture: (e: ReactPointerEvent) => {
          if ((e.target as HTMLElement).closest(".spp-device-chrome")) return;
          e.stopPropagation();
          e.preventDefault();
          const leaf = nodeAt(e.target);
          const deep = e.metaKey || e.ctrlKey;
          // A press inside the selection waits to see: dragged, it moves the selection; clicked, it
          // goes one level in, as it always did. Anywhere else it selects at once, and can drag that.
          const before = store.getState().selected;
          const selEl = before && phoneRef.current ? findVisible(phoneRef.current, before.nodeId) : null;
          const inside = Boolean(selEl && !selEl.classList.contains("spb-screen") && selEl.contains(e.target as Node));
          if (!inside) store.pick(leaf, { deep });
          const now = store.getState().selected;
          if (!now || !phoneRef.current || !slotRef.current) return;
          startLayoutDrag({ store, registry: host.registry, phone: phoneRef.current, slot: slotRef.current, nodeId: now.nodeId, event: e.nativeEvent, onClick: inside ? () => store.pick(leaf, { deep }) : undefined });
        },
        onClickCapture: (e: React.MouseEvent) => {
          if ((e.target as HTMLElement).closest(".spp-device-chrome")) return;
          e.stopPropagation();
          e.preventDefault();
        },
        onPointerMove: (e: ReactPointerEvent) => {
          // While a component is being dragged, the line is the only thing drawn over the phone.
          if ("sppDragging" in document.documentElement.dataset) return;
          store.hover(nodeAt(e.target));
        },
        onPointerLeave: () => store.hover(null),
      }
    : {
        // ⌥-click selects without leaving Interact.
        onPointerDownCapture: (e: ReactPointerEvent) => {
          if (!e.altKey) return;
          e.stopPropagation();
          e.preventDefault();
          store.pick(nodeAt(e.target), { deep: e.metaKey || e.ctrlKey });
        },
      };

  if (!project) return <div ref={fitRef} className="spp-fit" />;
  const current = currentScreenId(nav);
  const currentScreen = project.screens.find((s) => s.id === current) ?? project.screens[0];
  const phoneScheme = schemeFor(String(currentScreen.root.props.appearance ?? "system"), theme, previewScheme);
  // A pushed screen that hides the tab bar (its root's tabBar "hidden") shows the phone without it.
  const showing = nav.stacks[nav.tab] ?? [];
  const top = showing.length > 1 ? project.screens.find((s) => s.id === showing[showing.length - 1]) : undefined;
  const tabs = project.shell === "tabs" && top?.root.props.tabBar !== "hidden" ? tabRoots(project) : [];
  // Style → Tab bar, else the app's own bar.
  const bar = project.theme?.tabStyle ?? (project.tabBar === "dock" ? "dock" : "system");
  const size: CSSProperties = { width: (PHONE_W + BEZEL * 2) * scale, height: (PHONE_H + BEZEL * 2) * scale };

  return (
    <div ref={fitRef} className="spp-fit">
      <div ref={slotRef} className="spp-device-slot" style={size}>
        <div className="spp-device" style={{ transform: `scale(${scale})`, opacity: scale ? 1 : 0 }} data-mode={mode}>
          <div
            ref={phoneRef}
            className={`spb-phone${tabs.length ? " has-tabs" : ""}${nav.sheets.length ? " has-sheet" : ""}`}
            data-scheme={phoneScheme}
            style={themeVars(theme, phoneScheme)}
            {...capture}
          >
            <RuntimeContext.Provider value={runtime}>
              <ThemeContext.Provider value={theme}>
                <Stacks project={project} nav={nav} theme={theme} previewScheme={previewScheme} />
                {tabs.length ? bar !== "system" ? <DockBar tabs={tabs} nav={nav} glass={bar === "glass"} /> : <TabBar tabs={tabs} nav={nav} /> : null}
                <Sheets project={project} nav={nav} theme={theme} previewScheme={previewScheme} />
              </ThemeContext.Provider>
            </RuntimeContext.Provider>
            <div ref={overlayRef} className="spp-overlay" />
            <StatusBar />
            <span className="spb-home" aria-hidden />
            <div className="spp-pulses" aria-hidden>
              {pulses.map((p) => (
                <span key={p.id} className={`spp-pulse is-${p.kind}`} style={{ left: p.x, top: p.y }} />
              ))}
            </div>
            <Highlight phoneRef={phoneRef} scaleRef={scaleRef} />
          </div>
        </div>
        <SelectionBar phoneRef={phoneRef} slotRef={slotRef} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- Stacks, sheets, tabs

type LayerProps = { project: Project; nav: Nav; theme: ResolvedTheme | null; previewScheme: Scheme };

/** Every tab's stack. Hidden tabs stay mounted, so each keeps its scroll and state like a TabView. */
function Stacks({ project, nav, theme, previewScheme }: LayerProps) {
  return (
    <div className={`spp-layer-root${nav.sheets.some((s) => detentOf(project, s[0]) !== "medium") ? " is-receded" : ""}`}>
      {nav.stacks.map((stack, t) => (
        <div key={t} className="spp-tab" hidden={t !== nav.tab}>
          <Stack project={project} stack={stack} move={t === nav.tab && !nav.sheets.length ? nav.move : "reset"} seq={nav.seq} theme={theme} previewScheme={previewScheme} />
        </div>
      ))}
    </div>
  );
}

const detentOf = (project: Project, screenId: string | undefined) => String(project.screens.find((s) => s.id === screenId)?.root.props.detent ?? "large");

/**
 * One NavigationStack. Every screen in it stays mounted (going back returns to it as you left it);
 * the top one is visible, the one beneath slides aside while a push or pop animates, and a popped
 * screen lingers just long enough to slide away.
 */
function Stack({ project, stack, move, seq, theme, previewScheme, inSheet = false }: { project: Project; stack: string[]; move: Nav["move"]; seq: number; theme: ResolvedTheme | null; previewScheme: Scheme; inSheet?: boolean }) {
  const { store } = usePlayground();
  const [leaving, setLeaving] = useState<{ id: string; seq: number; fade?: boolean } | null>(null);
  const prev = useRef(stack);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = stack;
    if (move === "pop" && before.length > stack.length) {
      setLeaving({ id: before[before.length - 1], seq });
      const t = window.setTimeout(() => setLeaving((l) => (l?.seq === seq ? null : l)), 420);
      return () => window.clearTimeout(t);
    }
    // A new root cross-fades: the old screen fades out over the new one, so no empty frame shows.
    const was = before[before.length - 1];
    if (move === "replace" && was && was !== stack[stack.length - 1] && !stack.includes(was)) {
      setLeaving({ id: was, seq, fade: true });
      const t = window.setTimeout(() => setLeaving((l) => (l?.seq === seq ? null : l)), 320);
      return () => window.clearTimeout(t);
    }
    setLeaving(null);
  }, [stack, move, seq]);

  const layers = leaving ? [...stack, leaving.id] : stack;
  const top = layers.length - 1;
  return (
    <div className="spp-stack">
      {layers.map((id, i) => {
        const screen = project.screens.find((s) => s.id === id);
        if (!screen) return null;
        const isLeaving = leaving && i === top;
        const role = isLeaving ? "leaving" : i === stack.length - 1 ? "top" : i === stack.length - 2 ? "under" : "buried";
        // A screen that hides its navigation bar draws its own top bar: no system back button.
        const back = i > 0 && screen.root.props.navigationBar !== "hidden" ? project.screens.find((s) => s.id === layers[i - 1]) : null;
        return (
          <ScreenLayer
            key={`${id}:${i}`}
            screen={screen}
            role={role}
            animate={role === "top" && move === "push" ? "in" : role === "top" && move === "replace" ? (leaving?.fade ? "none" : "fade") : role === "under" && move === "push" ? "cover" : role === "under" && move === "pop" ? "uncover" : role === "leaving" ? (leaving?.fade ? "gone" : "out") : "none"}
            seq={seq}
            backLabel={back ? backTitle(back, screen) : null}
            onBack={() => store.back()}
            theme={theme}
            previewScheme={previewScheme}
            inSheet={inSheet}
          />
        );
      })}
    </div>
  );
}

type Anim = "in" | "out" | "cover" | "uncover" | "fade" | "gone" | "none";

const ScreenLayer = memo(function ScreenLayer({ screen, role, animate, seq, backLabel, onBack, theme, previewScheme, inSheet }: { screen: Screen; role: "top" | "under" | "buried" | "leaving"; animate: Anim; seq: number; backLabel: string | null; onBack: () => void; theme: ResolvedTheme | null; previewScheme: Scheme; inSheet: boolean }) {
  const scheme = schemeFor(String(screen.root.props.appearance ?? "system"), theme, previewScheme);
  const ref = useRef<HTMLDivElement>(null);
  const underRef = useRef<HTMLElement | null>(null);
  const clear = () => {
    for (const el of [ref.current, underRef.current]) {
      el?.style.removeProperty("transform");
      el?.style.removeProperty("transition");
    }
  };
  // Swipe from the leading edge to go back, following the finger like iOS.
  const edge = useDrag({
    axis: "x",
    onStart: () => {
      underRef.current = ref.current?.previousElementSibling as HTMLElement | null;
      ref.current?.style.setProperty("transition", "none");
      underRef.current?.style.setProperty("transition", "none");
    },
    onMove: ({ dx }) => {
      const x = Math.max(0, dx);
      if (ref.current) ref.current.style.transform = `translateX(${x}px)`;
      if (underRef.current) underRef.current.style.transform = `translateX(${-PHONE_W * 0.3 + x * 0.3}px)`;
    },
    onEnd: ({ dx, vx }) => {
      const done = dx > PHONE_W * 0.35 || vx > 600;
      for (const el of [ref.current, underRef.current]) {
        if (!el) continue;
        el.style.transition = `transform .32s ${SPRING}, filter .32s ${SPRING}`;
      }
      if (done) {
        if (ref.current) ref.current.style.transform = `translateX(${PHONE_W}px)`;
        if (underRef.current) underRef.current.style.transform = "translateX(0)";
        window.setTimeout(() => {
          onBack();
          clear();
        }, 280);
      } else {
        if (ref.current) ref.current.style.transform = "translateX(0)";
        if (underRef.current) underRef.current.style.transform = "";
        window.setTimeout(clear, 330);
      }
    },
  });
  return (
    <div
      ref={ref}
      className={`spp-screen spb-phone-screen${backLabel ? " is-pushed" : ""}${inSheet ? " is-in-sheet" : ""}`}
      data-role={role}
      data-anim={animate}
      data-seq={seq}
      data-scheme={scheme}
      data-screen-id={screen.id}
      style={themeVars(theme, scheme)}
      aria-hidden={role !== "top" || undefined}
      inert={role !== "top" ? true : undefined}
    >
      {backLabel ? (
        <button type="button" className="spb-navback" onClick={onBack}>
          <ChevronLeft size={24} strokeWidth={2.4} aria-hidden />
          <span>{backLabel}</span>
        </button>
      ) : null}
      {backLabel && role === "top" ? <div className="spp-edge" onPointerDown={edge} aria-hidden /> : null}
      <SchemeContext.Provider value={scheme}>
        <div className="spb-screen-host">
          <NodeBoundary node={screen.root} />
        </div>
      </SchemeContext.Provider>
    </div>
  );
});

/** The tab bar of a TabView app: one item per tab root, the current one tinted. */
function TabBar({ tabs, nav }: { tabs: Screen[]; nav: Nav }) {
  const { store } = usePlayground();
  return (
    <nav className="spp-tabbar" aria-label="Tabs">
      <div className="spp-tabbar-inner">
        {tabs.map((s, i) => (
          <button key={s.id} type="button" className="spp-tabbar-item" aria-current={i === nav.tab ? "page" : undefined} onClick={() => store.setTabIndex(i)}>
            <Glyph name={s.tab?.icon ?? "house"} size={22} strokeWidth={i === nav.tab ? 2.2 : 1.8} />
            <span>{s.tab?.title ?? screenTitle(s)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/**
 * The Floating Dock as the app's tab bar (project.tabBar "dock"), drawn like the piece: a solid
 * capsule where the current tab becomes an accent block with its title, a soft haptic on change.
 */
function DockBar({ tabs, nav, glass = false }: { tabs: Screen[]; nav: Nav; glass?: boolean }) {
  const { store } = usePlayground();
  const runtime = useContext(RuntimeContext);
  return (
    <DockView
      tabs={tabs}
      glass={glass}
      active={nav.tab}
      onPick={(i, el) => {
        if (i !== nav.tab) runtime.haptic("soft", el);
        store.setTabIndex(i);
      }}
    />
  );
}

/** The dock itself, for the running phone and for still ones (no `onPick`: nothing to press). */
export function DockView({ tabs, active, onPick, glass = false }: { tabs: Screen[]; active: number; onPick?: (i: number, el: Element) => void; glass?: boolean }) {
  return (
    <nav className="spp-dock" aria-label="Tabs" data-glass={glass || undefined}>
      <div className="spp-dock-inner" role="tablist">
        {tabs.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={on}
              className="spp-dock-item"
              tabIndex={onPick ? undefined : -1}
              onClick={(e) => onPick?.(i, e.currentTarget)}
            >
              <Glyph name={s.tab?.icon ?? "house"} size={20} strokeWidth={2} />
              {on ? <span className="spp-dock-label">{s.tab?.title ?? screenTitle(s)}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Presented sheets, frontmost last. Each rests at its detent, can be dragged down to dismiss (and
 * from half height up to full when it allows both), and holds its own NavigationStack.
 */
function Sheets({ project, nav, theme, previewScheme }: LayerProps) {
  const { store } = usePlayground();
  const [leaving, setLeaving] = useState<{ stack: string[]; seq: number } | null>(null);
  const prev = useRef(nav.sheets);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = nav.sheets;
    if (nav.move === "dismiss" && before.length > nav.sheets.length) {
      setLeaving({ stack: before[before.length - 1], seq: nav.seq });
      const t = window.setTimeout(() => setLeaving(null), 420);
      return () => window.clearTimeout(t);
    }
    if (nav.move === "reset" || nav.move === "tab") setLeaving(null);
  }, [nav]);
  const all = leaving ? [...nav.sheets.map((s) => ({ stack: s, leaving: false })), { stack: leaving.stack, leaving: true }] : nav.sheets.map((s) => ({ stack: s, leaving: false }));
  if (!all.length) return null;
  return (
    <>
      {all.map((layer, i) => (
        <Sheet
          key={`${layer.stack[0]}:${i}`}
          project={project}
          stack={layer.stack}
          leaving={layer.leaving}
          entering={!layer.leaving && i === nav.sheets.length - 1 && nav.move === "present"}
          move={i === nav.sheets.length - 1 ? nav.move : "reset"}
          seq={nav.seq}
          theme={theme}
          previewScheme={previewScheme}
          onDismiss={() => store.back()}
        />
      ))}
    </>
  );
}

function Sheet({ project, stack, leaving, entering, move, seq, theme, previewScheme, onDismiss }: { project: Project; stack: string[]; leaving: boolean; entering: boolean; move: Nav["move"]; seq: number; theme: ResolvedTheme | null; previewScheme: Scheme; onDismiss: () => void }) {
  const detent = detentOf(project, stack[0]);
  const [expanded, setExpanded] = useState(detent === "large");
  const panel = useRef<HTMLDivElement>(null);
  const restY = expanded ? 0 : PHONE_H * 0.46;
  const drag = useDrag({
    axis: "y",
    slop: 3,
    onStart: () => panel.current?.style.setProperty("transition", "none"),
    onMove: ({ dy }) => {
      const y = restY + dy;
      const resisted = y < 0 ? y * 0.2 : y;
      if (panel.current) panel.current.style.transform = `translateY(${resisted}px)`;
    },
    onEnd: ({ dy, vy }) => {
      const el = panel.current;
      if (!el) return;
      el.style.transition = "";
      el.style.transform = "";
      const y = restY + dy;
      if (detent === "both" && expanded && (dy > 120 || vy > 700) && y < PHONE_H * 0.6) return setExpanded(false);
      if (detent === "both" && !expanded && (dy < -80 || vy < -600)) return setExpanded(true);
      if (y > restY + PHONE_H * 0.22 || vy > 900) onDismiss();
    },
  });
  const scheme = schemeFor(String(project.screens.find((s) => s.id === stack[0])?.root.props.appearance ?? "system"), theme, previewScheme);
  return (
    <div className={`spp-sheet-wrap${leaving ? " is-leaving" : ""}${entering ? " is-entering" : ""}`} data-seq={seq}>
      <button type="button" className="spp-sheet-dim" aria-label="Dismiss" onClick={onDismiss} tabIndex={-1} />
      <div
        ref={panel}
        className={`spp-sheet${expanded ? " is-large" : " is-medium"}`}
        data-scheme={scheme}
        style={{ ...themeVars(theme, scheme), transform: `translateY(${restY}px)` }}
        role="dialog"
        aria-modal="true"
      >
        <div className="spp-sheet-grabber" onPointerDown={drag} aria-hidden>
          <span />
        </div>
        <Stack project={project} stack={stack} move={leaving || entering ? "reset" : move} seq={seq} theme={theme} previewScheme={previewScheme} inSheet />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Selection overlay

/**
 * Outlines for the selected and hovered components, drawn over the phone in points. Measured each
 * frame while something is selected, so the outline follows scrolling, springs and navigation
 * without any node re-rendering.
 */
function Highlight({ phoneRef, scaleRef }: { phoneRef: React.RefObject<HTMLDivElement | null>; scaleRef: React.RefObject<number> }) {
  const { store, host } = usePlayground();
  // Outlines belong to Inspect: in Interact the phone is the app, so nothing is drawn over it (the
  // selection is kept for the inspector and comes back with Inspect).
  const selected = usePlay(store, (s) => (s.mode === "inspect" ? (s.selected?.nodeId ?? null) : null));
  const hover = usePlay(store, (s) => (s.mode === "inspect" ? s.hover : null));
  const project = usePlay(store, (s) => s.project);
  const layer = useRef<HTMLDivElement>(null);
  const selBox = useRef<HTMLDivElement>(null);
  const hovBox = useRef<HTMLDivElement>(null);
  const hovLabel = useMemo(() => labelFor(project, hover, host.registry), [project, hover, host.registry]);

  useEffect(() => {
    // Nothing to outline: hide what was drawn last (it would otherwise stay where it was).
    if (!selected && !hover) {
      placeOutline(selBox.current, null, null);
      placeOutline(hovBox.current, null, null);
      return;
    }
    let raf = 0;
    const find = (id: string | null) => (id && phoneRef.current ? findVisible(phoneRef.current, id) : null);
    const tick = () => {
      const s = scaleRef.current || 1;
      // Outlines pass behind the dock or tab bar, as the content they outline does.
      maskBars(layer.current, phoneRef.current);
      const sel = placeOutline(selBox.current, find(selected), phoneRef.current, s);
      const hov = placeOutline(hovBox.current, find(hover && hover !== selected ? hover : null), phoneRef.current, s);
      placeHoverTag(hovBox.current, hov, sel);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selected, hover, phoneRef, scaleRef]);

  return (
    <div ref={layer} className="spp-highlights" aria-hidden>
      <div ref={hovBox} className="spp-hl is-hover" style={{ opacity: 0 }}>
        {hovLabel ? <span className="spp-hl-label">{hovLabel}</span> : null}
      </div>
      {/* The selection's name tag is the layout bar (SelectionBar), drawn outside the phone. */}
      <div ref={selBox} className="spp-hl is-selected" style={{ opacity: 0 }} />
    </div>
  );
}

function labelFor(project: Project | null, id: string | null, registry: { get(id: string): { name: string } | undefined }): string | null {
  if (!project || !id) return null;
  for (const s of project.screens) {
    const n = findNode(s.root, id);
    if (n) return registry.get(n.component)?.name ?? n.component;
  }
  return null;
}

