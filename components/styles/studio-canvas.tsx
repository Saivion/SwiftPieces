"use client";
// The studio's canvas: the style on a live bento grid of nineteen cards, each a moment of an app
// built like a SwiftPieces component and all of them moving at once (bento/), or on one screen from
// each of three free apps. Pointing at a setting in the panel lights up the cards it changes and dims
// the rest, an edit flashes the cards it changed, and a whole new style (a shuffle, a preset) dips
// the grid out and springs it back in, card by card. A floating bar switches the view and light or
// dark.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRegistry, encodeStyle, freeDefinitions, resolveTheme, type Theme } from "@swiftpieces/builder";
import { StylePreview, UI } from "@swiftpieces/builder/react";
import type { StyleScreen } from "@/lib/styles";
import { PhoneFit } from "./fit-box";
import { floating } from "./studio-frame";
import { spotOfEdit, type Spot } from "./follows";
import { BentoCanvas } from "./bento/bento";
import { canvasSurfaces, type Scheme } from "./surfaces";

const registry = createRegistry(freeDefinitions);

export type CanvasView = "components" | "screens";
export type { Scheme };

type Props = {
  theme: Theme;
  /** The style the tiles draw and whether they're dipping out of it (useDrawn, held by the studio so its frame swaps with them). */
  drawn: Theme;
  leaving: boolean;
  /** Where the tiles' dip animations live: the canvas's root. */
  root: React.RefObject<HTMLDivElement | null>;
  /** The mode the canvas shows a style that follows the device in. */
  scheme: Scheme;
  onScheme: (s: Scheme) => void;
  onEdit: (patch: Partial<Theme>) => void;
  view: CanvasView;
  onView: (v: CanvasView) => void;
  /** The setting the panel is pointing at, if any. */
  spot: Spot | null;
  screens: StyleScreen[];
};

/** The parts of a style that define it: when two or more change at once, it's a new style. */
const defining = (t: Theme) => [t.look, t.accentHex ?? t.accent, t.font, t.headingFont ?? "", t.corners, t.cards ?? "", t.buttons ?? "", t.appearance, t.density, t.weight];
const isNewStyle = (a: Theme, b: Theme) => {
  const x = defining(a);
  return defining(b).filter((p, i) => p !== x[i]).length >= 2;
};

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How long the tiles take to dip out before a new style swaps in, in milliseconds. */
const DIP = 130;
/** Where a dip ends and a rise starts: dim, soft and a touch small, so the swap between them is unseen. */
const DIPPED: Keyframe = { opacity: 0.35, filter: "blur(5px)", transform: "translateY(4px) scale(0.985)" };

/**
 * The style the tiles draw. A new style as a whole (a shuffle, a preset, a pasted code, Back) waits
 * while the tiles dip out (their "dip" animations under `root`), then swaps in at the bottom of the
 * dip and rises, so no frame jumps from one style to the next. A single edit (or reduced motion)
 * swaps at once. Styles that arrive during a dip land as the latest one.
 */
export function useDrawn(theme: Theme, root: React.RefObject<HTMLElement | null>): { drawn: Theme; leaving: boolean } {
  const [drawn, setDrawn] = useState(theme);
  const [leaving, setLeaving] = useState(false);
  const latest = useRef(theme);
  useLayoutEffect(() => {
    latest.current = theme;
    if (theme === drawn || leaving) return;
    if (!isNewStyle(drawn, theme) || reduced()) setDrawn(theme);
    else setLeaving(true);
  }, [theme, drawn, leaving]);
  // The tiles start their dips as `leaving` turns on (their layout effects run before this one).
  useLayoutEffect(() => {
    if (!leaving) return;
    let live = true;
    const dips = root.current?.getAnimations({ subtree: true }).filter((a) => a.id === "dip") ?? [];
    void Promise.all(dips.map((a) => a.finished.catch(() => undefined))).then(() => {
      if (!live) return;
      setLeaving(false);
      setDrawn(latest.current);
    });
    return () => {
      live = false;
    };
  }, [leaving, root]);
  return { drawn, leaving };
}

/**
 * How the canvas answers a change in what it draws: `wave` goes up when the style changes as a
 * whole, so every tile rises in; `flash` names what a single edit reached, so the tiles it changed
 * flash once. Worked out while rendering, so both land in the same frame as the style they answer.
 */
function useChange(theme: Theme): { wave: number; flash: { n: number; spot: Spot | null } } {
  const [seen, setSeen] = useState(theme);
  const [state, setState] = useState({ wave: 0, flash: { n: 0, spot: null as Spot | null } });
  if (seen !== theme) {
    setSeen(theme);
    if (isNewStyle(seen, theme)) setState((s) => ({ ...s, wave: s.wave + 1 }));
    else {
      const spot = spotOfEdit(seen, theme);
      if (spot) setState((s) => ({ ...s, flash: { n: s.flash.n + 1, spot } }));
    }
  }
  return state;
}

export function StudioCanvas({ theme, drawn, leaving, root, scheme, onScheme, onEdit, view, onView, spot, screens }: Props) {
  // The tiles draw `drawn`, which follows `theme` (see useDrawn); the floating bar follows `theme`.
  // A style fixed to light or dark shows in it; one that follows the device shows in the canvas's mode.
  const shown: Scheme = drawn.appearance === "system" ? scheme : drawn.appearance;
  const surfaces = useMemo(() => canvasSurfaces(drawn, shown), [drawn, shown]);
  const ink = useMemo(() => resolveTheme(drawn).look[shown].text, [drawn, shown]);
  const { wave, flash } = useChange(drawn);

  // A setting only whole screens show (the tab bar, say) says so, pointed at or just changed.
  const [told, setTold] = useState<string | null>(null);
  useEffect(() => {
    if (flash.spot?.reach !== "screens") return;
    setTold(flash.spot.label);
    const t = window.setTimeout(() => setTold(null), 2800);
    return () => window.clearTimeout(t);
  }, [flash]);
  const screensOnly = view === "components" ? (spot?.reach === "screens" ? spot.label : told) : null;

  return (
    <div ref={root} className="relative size-full min-h-0">
      {view === "components" ? (
        <BentoCanvas theme={drawn} scheme={shown} surfaces={surfaces} wave={wave} leaving={leaving} flash={flash} spot={spot} onEdit={onEdit} />
      ) : (
        <div className="flex size-full snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible">
          {screens.map((s, i) => (
            <Screen key={s.slug} screen={s} index={i} wave={wave} leaving={leaving} theme={drawn} ground={surfaces.tile} ink={ink} scheme={shown} />
          ))}
        </div>
      )}
      {screensOnly ? (
        <div role="status" className={`sp-enter absolute bottom-[26px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-[15px] py-1 pr-1 pl-3.5 text-[12.5px] whitespace-nowrap text-muted ${floating}`}>
          <span>
            <span className="text-foreground">{screensOnly}</span> shows on whole screens
          </span>
          <button type="button" onClick={() => onView("screens")} className="h-7 rounded-full bg-foreground/10 px-3 font-medium text-foreground transition-colors hover:bg-foreground/15 focus-visible:outline-2 focus-visible:outline-accent">
            See it
          </button>
        </div>
      ) : null}
      <FloatingBar view={view} onView={onView} scheme={theme.appearance === "system" ? scheme : theme.appearance} onScheme={onScheme} pinned={theme.appearance !== "system"} />
    </div>
  );
}

/**
 * A tile's part in a change of style: while the canvas is `leaving` the old style, every tile dips
 * out together (from wherever it is, even mid-rise); when the new one is drawn (`wave`), each rises
 * from the dip, one after another across the grid. Both start before the browser paints, so the
 * frame that first shows a style already shows it dipped.
 */
function useSettle(wave: number, index: number, leaving: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!leaving || !el || reduced()) return;
    const now = getComputedStyle(el);
    motion.current?.cancel();
    motion.current = el.animate([{ opacity: now.opacity, filter: now.filter === "none" ? "blur(0px)" : now.filter, transform: now.transform }, DIPPED], { id: "dip", duration: DIP, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
  }, [leaving]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!wave || !el || reduced()) return;
    motion.current?.cancel();
    motion.current = el.animate([DIPPED, { opacity: 1, filter: "blur(0px)", transform: "none" }], { duration: 460, delay: index * 28, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" });
  }, [wave, index]);
  return ref;
}

/**
 * One free app's screen in a phone, on a plain tile (the style's own ground and backdrop are the
 * phone's, inside its screen), settling in with the tiles. A header names the app and the screen
 * and opens it in the Playground wearing the style; the phone takes the tile's width under it and
 * runs off the bottom edge when the tile is shorter than the phone, like a showcase.
 */
function Screen({ screen: s, index, wave, leaving, theme, ground, ink, scheme }: { screen: StyleScreen; index: number; wave: number; leaving: boolean; theme: Theme; ground: string; ink: string; scheme: Scheme }) {
  const settle = useSettle(wave, index, leaving);
  const code = useMemo(() => encodeStyle(theme), [theme]);
  return (
    <figure className="relative min-h-0 min-w-0 flex-none snap-start overflow-hidden rounded-[22px] max-md:w-[84%]" style={{ backgroundColor: ground, color: ink, transition: "background-color 500ms var(--ease-out)" }}>
      <figcaption className="absolute inset-x-0 top-0 z-10 flex h-[60px] items-center justify-between gap-3 px-4">
        <span className="flex min-w-0 items-center gap-2.5">
          <img src={s.icon} alt="" width={30} height={30} className="size-[30px] flex-none rounded-[7px] shadow-[0_1px_2px_rgb(0_0_0/.12)]" />
          <span className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span className="truncate text-[13px] font-semibold">{s.app}</span>
            <span className="truncate text-[11.5px] opacity-55">{s.title}</span>
          </span>
        </span>
        <a
          href={`${s.href}?style=${encodeURIComponent(code)}`}
          aria-label={`Open ${s.app} in the Playground with this style`}
          className="ai-host flex h-7 flex-none items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold transition-colors"
          style={{ background: `color-mix(in srgb, ${ink} 7%, transparent)` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${ink} 13%, transparent)`)}
          onMouseLeave={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${ink} 7%, transparent)`)}
        >
          Open
          <UI name="external" size={11} />
        </a>
      </figcaption>
      {/* The phone fills the width (a ratio this wide never limits it by height): centred when it fits,
          from the top and off the bottom edge when it doesn't (safe centring). */}
      <div ref={settle} className="absolute inset-x-0 top-[60px] bottom-0 px-5 pb-4 [&>div]:[align-items:safe_center]">
        <PhoneFit ratio={100}>{(width) => <StylePreview theme={theme} scheme={scheme} registry={registry} node={s.node} frame="phone" width={Math.min(width, 380)} />}</PhoneFit>
      </div>
    </figure>
  );
}

/** Components or Screens, and light or dark: a raised bar (the site's menu surface) under the canvas. */
function FloatingBar({ view, onView, scheme, onScheme, pinned }: { view: CanvasView; onView: (v: CanvasView) => void; scheme: Scheme; onScheme: (s: Scheme) => void; pinned: boolean }) {
  const next: Scheme = scheme === "dark" ? "light" : "dark";
  return (
    // In the room the frame leaves under the canvas (studio-frame.tsx), centred on it, covering nothing.
    <div className="absolute -bottom-[50px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 lg:-bottom-[52px]">
      <div role="tablist" aria-label="Canvas" className={`flex rounded-[17px] p-1 ${floating}`}>
        {(
          [
            ["components", "grid", "Components"],
            ["screens", "phone", "Screens"],
          ] as const
        ).map(([v, icon, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => onView(v)}
            className="ai-host flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-selected:bg-foreground/10 aria-selected:text-foreground"
          >
            <UI name={icon} size={13} />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onScheme(next)}
        aria-label={pinned ? `Make this style ${next}` : `Show in ${next}`}
        title={pinned ? `Make this style ${next}` : `Show in ${next}`}
        className={`ai-host grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_7%,var(--surface-3))] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${floating}`}
      >
        <UI name={scheme === "dark" ? "moon" : "sun"} size={15} />
      </button>
    </div>
  );
}
