"use client";
// The studio's canvas: the style on eight tiles that lock together like puzzle pieces (a tall hero,
// a wide chart, squares and strips), or on one screen from each of three free apps. Six tiles are
// moments of an app built from SwiftPieces components (a card that tilts over its recent spending,
// a plan to pick, a day's curve to scrub, a spending ring, a week, a track that swells), drawn by the
// Playground's renderers a little under an iPhone's size; two are the page's own (the palette and
// the type). The tiles are neutral and two take a pastel of the look's palette (surfaces.ts), so the
// style's colour shows where the style puts it. A tile names its component and how to use it while
// the pointer is on it. Pointing at a setting in the panel
// lights up the tiles it changes and dims the rest, an edit flashes the tiles it changed, and a
// whole new style (a shuffle, a preset) settles in tile by tile. A floating bar switches the view
// and light or dark.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createRegistry, encodeStyle, freeDefinitions, inkOn, lookById, resolveTheme, type ScreenNode, type Theme } from "@swiftpieces/builder";
import { BEZEL, PHONE_H, PHONE_W, StylePreview, UI } from "@swiftpieces/builder/react";
import type { StyleScreen, StyleTileId, StyleTileInfo } from "@/lib/styles";
import { FitBox, PhoneFit } from "./fit-box";
import { FOLLOW_LABELS, reaches, spotOfEdit, type Spot, type StyleFollow } from "./follows";
import { canvasSurfaces, onTile, type Scheme, type Surfaces } from "./surfaces";

const registry = createRegistry(freeDefinitions);

export type CanvasView = "components" | "screens";
export type { Scheme };
export type CanvasTiles = Record<StyleTileId, { node: ScreenNode; info: StyleTileInfo }>;

type TileId = StyleTileId | "palette" | "type";

/**
 * The tiles in reading order. They take named areas of one grid (.studio-grid in globals.css): from
 * 768px three columns of six rows, the hero three rows tall, the chart two columns wide and two
 * tall, the week a wide strip, so the seams stagger like a puzzle's. A phone swipes through them
 * one by one (all but the two strips). The two feature tiles sit at opposite corners.
 */
const ORDER: TileId[] = ["hero", "type", "palette", "track", "pay", "chart", "goal", "days"];
const FEATURE = new Set<TileId>(["hero", "goal"]);
/** Each tile's padding around its components, in points: the track and the chat keep theirs wide. */
const PAD: Record<StyleTileId, string> = { hero: "0 22px", track: "0 30px", pay: "0 22px", chart: "0 22px", goal: "0 26px", days: "0 26px" };
/**
 * The scale components are drawn at: a little under an iPhone's, so they read as an app's, laid out
 * as wide as the tile allows at that scale (never narrower than a small iPhone).
 */
const SCALE = 0.9;

const PAGE_TILES: Record<"palette" | "type", StyleTileInfo> = {
  palette: { name: "Palette", docs: null, pieces: [], follows: ["accent"], verb: "Tap" },
  type: { name: "Type", docs: null, pieces: [], follows: ["headings", "body", "titles"], verb: "" },
};

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
  tiles: CanvasTiles;
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

export function StudioCanvas({ theme, drawn, leaving, root, scheme, onScheme, onEdit, view, onView, spot, tiles, screens }: Props) {
  // The tiles draw `drawn`, which follows `theme` (see useDrawn); the floating bar follows `theme`.
  // A style fixed to light or dark shows in it; one that follows the device shows in the canvas's mode.
  const shown: Scheme = drawn.appearance === "system" ? scheme : drawn.appearance;
  const surfaces = useMemo(() => canvasSurfaces(drawn, shown), [drawn, shown]);
  // The style as the plain tiles and the feature tiles draw it: the tile's colour behind, white (or
  // black) cards.
  const plain = useMemo(() => onTile(drawn, surfaces, surfaces.tile), [drawn, surfaces]);
  const feature = useMemo(() => onTile(drawn, surfaces, surfaces.feature), [drawn, surfaces]);
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
        <div className="studio-grid size-full">
          {ORDER.map((id, i) => {
            const info = id === "palette" || id === "type" ? PAGE_TILES[id] : tiles[id].info;
            const lifted = FEATURE.has(id);
            return (
              <Tile key={id} id={id} index={i} wave={wave} leaving={leaving} flash={flash} spot={spot} info={info} ground={lifted ? surfaces.feature : surfaces.tile} ink={ink} scheme={shown}>
                {id === "palette" ? (
                  <Palette theme={drawn} scheme={shown} surfaces={surfaces} onEdit={onEdit} />
                ) : id === "type" ? (
                  <TypeTile theme={drawn} scheme={shown} surfaces={surfaces} />
                ) : (
                  <Pieces theme={lifted ? feature : plain} scheme={shown} node={tiles[id].node} pad={PAD[id]} />
                )}
              </Tile>
            );
          })}
        </div>
      ) : (
        <div className="flex size-full snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible">
          {screens.map((s, i) => (
            <Screen key={s.slug} screen={s} index={i} wave={wave} leaving={leaving} theme={drawn} ground={surfaces.tile} ink={ink} scheme={shown} />
          ))}
        </div>
      )}
      {screensOnly ? (
        <div role="status" className="studio-dark sp-enter absolute bottom-[26px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--studio-panel)] py-1 pr-1 pl-3 text-[12px] whitespace-nowrap text-muted shadow-[0_14px_36px_-12px_rgb(0_0_0/.7)] ring-1 ring-white/10">
          <span>
            <span className="text-foreground">{screensOnly}</span> shows on whole screens
          </span>
          <button type="button" onClick={() => onView("screens")} className="h-7 rounded-[var(--radius)] bg-white/[.1] px-2.5 font-medium text-foreground transition-colors hover:bg-white/[.16] focus-visible:outline-2 focus-visible:outline-accent">
            See it
          </button>
        </div>
      ) : null}
      <FloatingBar view={view} onView={onView} scheme={theme.appearance === "system" ? scheme : theme.appearance} onScheme={onScheme} pinned={theme.appearance !== "system"} />
    </div>
  );
}

/**
 * A tile's components, centred, at a little under an iPhone's size, laid out as wide as the tile
 * allows (a wide tile lays out wide). Memoised, so pointing at settings (which only lights and dims
 * tiles) never redraws them.
 */
const Pieces = memo(function Pieces({ theme, scheme, node, pad }: { theme: Theme; scheme: Scheme; node: ScreenNode; pad: string }) {
  const style = useMemo<CSSProperties>(() => ({ flex: "1 0 auto", ["--spb-fragment-pad" as string]: pad }), [pad]);
  return (
    <FitBox fill width={1600} minScale={SCALE}>
      <StylePreview bare theme={theme} scheme={scheme} registry={registry} node={node} className="studio-fill" style={style} />
    </FitBox>
  );
});

/** The components that name themselves under the pointer: pieces, controls and inputs, not text or stacks. */
const NAMED = new Set(["pieces", "controls", "inputs"]);

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
 * One tile: a flat cell of the grid in its colour, its components centred in it. Pointed at from
 * the panel, a setting that changes it outlines it and one that doesn't dims it.
 */
function Tile({ id, index, wave, leaving, flash, spot, info, ground, ink, scheme, children }: { id: TileId; index: number; wave: number; leaving: boolean; flash: { n: number; spot: Spot | null }; spot: Spot | null; info: StyleTileInfo; ground: string; ink: string; scheme: Scheme; children: ReactNode }) {
  const settle = useSettle(wave, index, leaving);
  // What the pointed-at setting does to this tile: lights it, dims it, or (one that changes every
  // tile, or none pointed at) nothing.
  const lit = spot && spot.reach !== "all" ? reaches(spot.reach, info.follows) : null;
  const parts = lit && Array.isArray(spot!.reach) ? spot!.reach.filter((f) => info.follows.includes(f)) : [];

  // An edit that changed this tile flashes its outline once.
  const ring = useRef<HTMLSpanElement>(null);
  const { n, spot: changed } = flash;
  useEffect(() => {
    if (!n || !changed || changed.reach === "all" || !ring.current || reduced() || !reaches(changed.reach, info.follows)) return;
    ring.current.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0 }], { duration: 1100, easing: "ease-out" });
  }, [n, changed, info.follows]);

  // The component under the pointer names itself in the label (the nearest piece, control or input
  // around it, past text and stacks); the tile's lead piece otherwise.
  const [pointed, setPointed] = useState<{ name: string; docs: string | null } | null>(null);
  const onPointer = (e: PointerEvent) => {
    let el = (e.target as Element).closest<HTMLElement>("[data-component]");
    let def = el ? registry.get(el.dataset.component ?? "") : undefined;
    while (el && def && !NAMED.has(def.category)) {
      el = el.parentElement?.closest<HTMLElement>("[data-component]") ?? null;
      def = el ? registry.get(el.dataset.component ?? "") : undefined;
    }
    if (!def || !NAMED.has(def.category) || def.name === pointed?.name) return;
    setPointed({ name: def.name, docs: def.docs ?? null });
  };

  // The colour fades between light and dark (and with a new palette) instead of snapping.
  const style: CSSProperties = { backgroundColor: ground, transition: "background-color 500ms var(--ease-out), opacity 250ms var(--ease-out)", opacity: lit === false ? 0.3 : 1 };
  return (
    <section
      aria-label={info.name}
      data-tile={id}
      className="group/tile spb-phone-screen relative min-h-0 min-w-0 overflow-hidden rounded-[var(--radius-lg)]"
      data-scheme={scheme}
      style={style}
      onPointerOver={id === "palette" || id === "type" ? undefined : onPointer}
      onPointerLeave={() => setPointed(null)}
    >
      {/* The components keep clear of the label's strip along the top, so it never sits on them. */}
      <div ref={settle} className="absolute inset-x-0 top-[26px] bottom-[10px]">
        {children}
      </div>
      <TileLabel name={pointed?.name ?? info.name} docs={pointed ? pointed.docs : info.docs} verb={info.verb} parts={parts} ink={ink} pieces={info.pieces} />
      <span ref={ring} aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200" style={{ boxShadow: `inset 0 0 0 1.5px ${ink}`, opacity: lit ? 0.55 : 0 }} />
    </section>
  );
}

/**
 * A tile's label, shown while the pointer is on the tile (or a setting that changes it is pointed
 * at): the component (a link to its docs page) and how to use it, quietly, in the style's ink.
 * While a setting is pointed at, the parts it changes here take the place of the how-to.
 */
function TileLabel({ name, docs, verb, parts, ink, pieces }: { name: string; docs: string | null; verb: string; parts: StyleFollow[]; ink: string; pieces: string[] }) {
  const shown = parts.length > 0;
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[26px] items-center justify-between gap-3 px-3 pt-0.5 text-[11px] leading-none transition-opacity duration-200 group-hover/tile:opacity-100 ${shown ? "opacity-100" : "opacity-0"}`} style={{ color: ink }}>
      {docs ? (
        <a href={docs} title={pieces.length > 1 ? `In this tile: ${pieces.join(", ")}` : `${name} docs`} className="pointer-events-auto min-w-0 truncate font-semibold opacity-80 underline-offset-2 transition-opacity hover:underline hover:opacity-100">
          {name}
        </a>
      ) : (
        <span className="min-w-0 truncate font-semibold opacity-80">{name}</span>
      )}
      {shown ? (
        <span key="parts" className="flex flex-none items-center gap-1.5 font-semibold">
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: ink }} />
          {parts.map((p) => FOLLOW_LABELS[p]).join(" · ")}
        </span>
      ) : verb ? (
        <span key="verb" className="flex flex-none items-center gap-1 opacity-50">
          <UI name="hand" size={11} />
          {verb}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The style's colour as separate swatches with even seams (as the ring's slices are): the accent
 * wide and marked, three of the look's own colours beside it (tap one to make it the accent), each
 * with its hex in the ink that reads on it, over the style's greys as a row of chips from white to
 * black. Sized to the tile (container units).
 */
function Palette({ theme, scheme, surfaces, onEdit }: { theme: Theme; scheme: Scheme; surfaces: Surfaces; onEdit: (patch: Partial<Theme>) => void }) {
  const look = lookById(theme.look);
  const accent = resolveTheme(theme).accent[scheme];
  const others = look[scheme].tiles
    .map((color, i) => ({ color, i }))
    .filter((c) => c.color.toLowerCase() !== accent.toLowerCase())
    .slice(0, 3);
  const hex = (c: string) => c.replace("#", "").toUpperCase();
  const label = "text-[max(8px,2.6cqw)] font-mono leading-none tracking-wide";
  return (
    <div className="size-full [container-type:size]">
      <div className="flex size-full flex-col justify-center gap-[2.6cqw] px-[7cqw]">
        <div className="flex h-[52cqh] gap-[1.4cqw]">
          <span className="relative flex flex-[1.9] flex-col justify-between overflow-hidden rounded-[var(--radius)] p-[3cqw] transition-colors duration-500" style={{ background: accent, color: inkOn(accent) }} title={`Accent ${hex(accent)}`}>
            <span className="text-[max(9px,3cqw)] leading-none font-semibold">Accent</span>
            <span className={label}>{hex(accent)}</span>
          </span>
          {others.map((c) => (
            <button
              key={c.i}
              type="button"
              aria-label={`Make ${hex(c.color)} the accent`}
              title={`Make #${hex(c.color)} the accent`}
              onClick={() => onEdit({ accent: c.i, accentHex: undefined })}
              className="group/sw flex flex-1 flex-col justify-end overflow-hidden rounded-[var(--radius)] p-[2.2cqw] text-left transition-[flex-grow,filter] duration-300 hover:flex-[1.3] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              style={{ background: c.color, color: inkOn(c.color) }}
            >
              <span className={`${label} opacity-0 transition-opacity group-hover/sw:opacity-80`}>{hex(c.color)}</span>
            </button>
          ))}
        </div>
        <div className="flex h-[11cqh] gap-[1.1cqw]" aria-label="Greys">
          {surfaces.ramp.map((g, i) => (
            <span key={i} className="flex-1 rounded-[var(--radius-sm)] transition-colors duration-500" style={{ background: g, boxShadow: i < 2 ? `inset 0 0 0 1px color-mix(in srgb, ${surfaces.ramp[7]} 8%, transparent)` : undefined }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The style's type as a specimen card: the heading and body fonts named side by side (each in
 * itself), "Aa" large in the heading font beside a line of its glyphs and figures in the body font,
 * then the text styles a SwiftUI screen uses as separated rows, each at the style's size, title scale
 * and weight with its size in a chip. Sized to the tile (container units).
 */
function TypeTile({ theme, scheme, surfaces }: { theme: Theme; scheme: Scheme; surfaces: Surfaces }) {
  const r = useMemo(() => resolveTheme(theme), [theme]);
  const ink = r.look[scheme].text;
  const weight = (w: number) => Math.min(900, Math.max(100, w + r.weightBoost));
  const styles: Array<[label: string, pt: number, w: number, title: boolean]> = [
    ["Title", 28, 700, true],
    ["Headline", 17, 600, false],
    ["Body", 17, 400, false],
    ["Caption", 12, 400, false],
  ];
  const pts = (pt: number, title: boolean) => pt * r.textScale * (title ? r.titleScale : 1);
  const same = r.body.id === r.heading.id;
  const line = `color-mix(in srgb, ${ink} 9%, transparent)`;
  const fonts: Array<[role: string, name: string, css: string]> = same ? [["Headings and body", r.heading.name, r.heading.css]] : [["Headings", r.heading.name, r.heading.css], ["Body", r.body.name, r.body.css]];
  return (
    <div className="size-full [container-type:size]">
      <div className="flex size-full flex-col justify-center p-[5cqw]" style={{ ["--k" as string]: "min(0.27cqw, 0.285cqh)" }}>
        <div className="flex flex-col overflow-hidden rounded-[var(--radius)]" style={{ background: surfaces.card, color: ink, transition: "background-color 500ms var(--ease-out)" }}>
          <div className="flex" style={{ borderBottom: `1px solid ${line}` }}>
            {fonts.map(([role, name, css], i) => (
              <div key={role} className="flex min-w-0 flex-1 flex-col gap-[calc(var(--k)*3)] px-[calc(var(--k)*16)] py-[calc(var(--k)*9)]" style={{ borderLeft: i ? `1px solid ${line}` : undefined }}>
                <span className="text-[calc(var(--k)*9.5)] font-semibold tracking-[0.12em] uppercase opacity-45">{role}</span>
                <span className="truncate text-[calc(var(--k)*14)] leading-tight font-semibold" style={{ fontFamily: css }}>{name}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-[calc(var(--k)*16)] px-[calc(var(--k)*16)] py-[calc(var(--k)*10)]" style={{ borderBottom: `1px solid ${line}` }}>
            <span className="leading-[.8]" style={{ fontFamily: r.heading.css, fontWeight: weight(700), fontSize: "calc(var(--k) * 58)", letterSpacing: "-0.03em" }}>
              Aa
            </span>
            <span className="min-w-0 flex-1 text-[calc(var(--k)*12.5)] leading-snug opacity-55" style={{ fontFamily: r.body.css }}>
              <span className="block truncate">Rr Gg Qq Ww</span>
              <span className="block truncate tabular-nums">0123456789</span>
            </span>
          </div>
          {styles.map(([label, pt, w, title], i) => (
            <div key={label} className="flex items-center justify-between gap-3 px-[calc(var(--k)*16)] py-[calc(var(--k)*5)]" style={{ borderTop: i ? `1px solid ${line}` : undefined }}>
              <span className="truncate leading-tight" style={{ fontFamily: title ? r.heading.css : r.body.css, fontWeight: weight(w), fontSize: `calc(var(--k) * ${pts(pt, title).toFixed(2)})`, opacity: label === "Caption" ? 0.6 : 1 }}>
                {label}
              </span>
              <span className="flex-none rounded-[var(--radius-sm)] px-[calc(var(--k)*6)] py-[calc(var(--k)*2)] font-mono text-[calc(var(--k)*10)] tabular-nums" style={{ background: line }}>
                {Math.round(pts(pt, title))} pt
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
    <figure className="relative min-h-0 min-w-0 flex-none snap-start overflow-hidden rounded-[var(--radius-lg)] max-md:w-[84%]" style={{ backgroundColor: ground, color: ink, transition: "background-color 500ms var(--ease-out)" }}>
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
          className="ai-host flex h-7 flex-none items-center gap-1.5 rounded-[var(--radius)] px-2.5 text-[11.5px] font-semibold transition-colors"
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

/** Components or Screens, and light or dark: a dark bar floating over the canvas's bottom edge. */
function FloatingBar({ view, onView, scheme, onScheme, pinned }: { view: CanvasView; onView: (v: CanvasView) => void; scheme: Scheme; onScheme: (s: Scheme) => void; pinned: boolean }) {
  const next: Scheme = scheme === "dark" ? "light" : "dark";
  return (
    // Docked on the frame's bottom edge, half over the tray's padding, so it covers almost nothing.
    // Centred on the whole studio, not just the canvas: on wide screens it moves right by half the
    // settings panel plus the gap (studio-frame.tsx: 300px, 340px at xl, gap-3).
    <div className="studio-dark absolute -bottom-[31px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 lg:left-[calc(50%+156px)] xl:left-[calc(50%+176px)]">
      <div role="tablist" aria-label="Canvas" className="flex rounded-[var(--radius-lg)] bg-[var(--studio-panel)] p-1 shadow-[0_14px_36px_-12px_rgb(0_0_0/.7)] ring-1 ring-white/10">
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
            className="ai-host flex h-8 items-center gap-1.5 rounded-[var(--radius)] px-3 text-[12.5px] font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-selected:bg-white/[.12] aria-selected:text-foreground"
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
        className="ai-host grid size-10 place-items-center rounded-[var(--radius-lg)] bg-[var(--studio-panel)] text-foreground shadow-[0_14px_36px_-12px_rgb(0_0_0/.7)] ring-1 ring-white/10 transition-colors hover:bg-[var(--studio-row)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        <UI name={scheme === "dark" ? "moon" : "sun"} size={15} />
      </button>
    </div>
  );
}
