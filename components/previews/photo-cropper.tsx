"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, groundHex, ink, signal } from "./palette";

/*
 * Photo Cropper: the photo in its dark well under a square frame, then the interaction. Two fingers land on the
 * tram and pinch in past 1x (the photo resists and the frame flashes red), then out to 2x about the fingers; one
 * finger drags past the photo's edge, rubber-bands and springs back; the 4:5 chip morphs the frame; rotate turns
 * the photo a quarter left; Choose dips, spins and checks; then back to rest.
 * Sizes are authored in px against the 560 x 420 docs stage and converted to `cqw`.
 */

type AspectId = "circle" | "square" | "portrait" | "landscape" | "original";
type Framing = { aspect: AspectId; zoom: number; cx: number; cy: number; turns: number };
type Point = [x: number, y: number];
type Step = {
  /** What happens, for people (and the launch video). */
  label: string;
  /** How long the step holds before the next one. */
  ms: number;
  /** The framing shown: zoom relative to filling the frame, the photo point at its centre, quarter turns left. Rubber-banded where it overshoots. */
  framing: Framing;
  /** How the photo gets there: following fingers, springing back, the frame morphing, a quarter turn, or a jump while hidden. */
  move?: "drag" | "spring" | "morph" | "turn" | "snap";
  /** Fingers on the stage, in px of the 560 x 420 stage. */
  fingers?: Point[];
  grid?: boolean;
  /** The zoom level above the frame. */
  readout?: boolean;
  /** The frame's red flash at a zoom limit. */
  flash?: boolean;
  press?: "portrait" | "rotate" | "choose";
  choose?: "busy" | "done";
  /** Photo and frame faded out, for the jump back to rest. */
  fade?: boolean;
};

const REST: Framing = { aspect: "square", zoom: 1, cx: 0.5, cy: 0.5, turns: 0 };
const PINCHED_IN: Framing = { aspect: "square", zoom: 0.83, cx: 0.5024, cy: 0.4683, turns: 0 };
const ZOOMED: Framing = { aspect: "square", zoom: 1.9944, cx: 0.4942, cy: 0.6438, turns: 0 };
const DRAGGED: Framing = { aspect: "square", zoom: 1.9944, cx: 0.4856, cy: 0.8182, turns: 0 };
const SETTLED: Framing = { aspect: "square", zoom: 1.9944, cx: 0.4856, cy: 0.7493, turns: 0 };
const PORTRAIT: Framing = { aspect: "portrait", zoom: 1.9944, cx: 0.4856, cy: 0.7493, turns: 0 };
const TURNED: Framing = { aspect: "portrait", zoom: 1.9944, cx: 0.4856, cy: 0.7493, turns: 1 };

/** The storyboard, about 9.8 s. Framings come from the piece's own maths (pinch about the fingers, rubber band, clamping). */
const SCRIPT: readonly Step[] = [
  { label: "Rest: the square frame over the photo", ms: 1200, framing: REST },
  { label: "Two fingers land on the tram; the grid fades in", ms: 300, framing: REST, fingers: [[250, 224], [302, 238]], grid: true },
  { label: "Pinch in past 1x: the photo resists and the frame flashes red", ms: 500, move: "drag", framing: PINCHED_IN, fingers: [[262, 227], [290, 235]], grid: true, readout: true, flash: true },
  { label: "Pinch out to 2x about the fingers", ms: 750, move: "drag", framing: ZOOMED, fingers: [[224, 217], [328, 245]], grid: true, readout: true },
  { label: "The fingers lift", ms: 350, framing: ZOOMED, grid: true, readout: true },
  { label: "One finger lands on the tram", ms: 250, framing: ZOOMED, fingers: [[296, 236]], grid: true, readout: true },
  { label: "Drag up past the photo's bottom edge: it rubber-bands", ms: 700, move: "drag", framing: DRAGGED, fingers: [[302, 106]], grid: true, readout: true },
  { label: "Release: it springs back to the edge", ms: 650, move: "spring", framing: SETTLED, grid: true, readout: true },
  { label: "The grid and the zoom level fade", ms: 450, framing: SETTLED },
  { label: "Tap the 4:5 chip", ms: 160, framing: SETTLED, press: "portrait" },
  { label: "The frame morphs to 4:5, the tram stays in frame", ms: 1000, move: "morph", framing: PORTRAIT },
  { label: "Tap rotate", ms: 160, framing: PORTRAIT, press: "rotate" },
  { label: "A quarter turn left; the photo grows just enough mid-turn to keep the frame covered", ms: 1200, move: "turn", framing: TURNED },
  { label: "Tap Choose", ms: 160, framing: TURNED, press: "choose" },
  { label: "Choose spins while the crop renders", ms: 900, framing: TURNED, choose: "busy" },
  { label: "Done: a check", ms: 700, framing: TURNED, choose: "done" },
  { label: "Fade out", ms: 300, framing: TURNED, fade: true },
  { label: "Back to rest", ms: 60, move: "snap", framing: REST, fade: true },
];

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const follow = "cubic-bezier(0.3, 0.1, 0.3, 1)";
const turnEase = "cubic-bezier(0.45, 0, 0.25, 1)";
/** How much the photo grows during the turn, at each tenth of it: the turn's own coverage curve plus 2%, so the frame's corners never leave the photo. */
const BOOST = [1, 1.081, 1.172, 1.232, 1.232, 1.192, 1.13, 1.079, 1.044, 1.026, 1].map((v, k) => `${k * 10}%{transform:scale(${v})}`).join("");
const spring = "cubic-bezier(0.34, 1.3, 0.64, 1)";
const PAPER = groundHex.text;
const WELL_INK = groundHex.bg;

// Geometry, as the Swift piece lays it out: a 116 px toolbar, the well inset 8, the frame inset 18 inside it.
const STAGE = { w: 560, h: 420 };
const TOOLBAR = 116;
const WELL = { x: 8, y: 8, w: STAGE.w - 16, h: STAGE.h - TOOLBAR - 8 };
const PHOTO = { w: 1600, h: 1200 };
/** The photo element's laid-out size before its transform (px per photo unit). */
const BASE = 0.2;
const RATIO: Record<AspectId, number | null> = { circle: 1, square: 1, portrait: 0.8, landscape: 16 / 9, original: null };

/** The frame in well coordinates, and the photo's transform, for a framing. */
function place(f: Framing) {
  const turned = f.turns % 2 ? { w: PHOTO.h, h: PHOTO.w } : PHOTO;
  const ratio = RATIO[f.aspect] ?? turned.w / turned.h;
  const room = { w: WELL.w - 36, h: WELL.h - 36 };
  let fw = room.w;
  let fh = fw / ratio;
  if (fh > room.h) {
    fh = room.h;
    fw = fh * ratio;
  }
  const frame = { x: (WELL.w - fw) / 2, y: (WELL.h - fh) / 2, w: fw, h: fh, r: f.aspect === "circle" ? fw / 2 : 0 };
  const scale = f.zoom * Math.max(fw / turned.w, fh / turned.h);
  const tx = -scale * (f.cx - 0.5) * PHOTO.w;
  const ty = -scale * (f.cy - 0.5) * PHOTO.h;
  // rotate, then translate and scale in the photo's own (unturned) axes: the framing's point stays at the frame centre through a turn.
  return { frame, transform: `rotate(${-90 * f.turns}deg) translate(${u(tx)}, ${u(ty)}) scale(${(scale / BASE).toFixed(4)})` };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Walks the script; each step holds for `ms`, then loops. Holds the first (resting) step under reduced motion. */
function useSteps(steps: readonly Step[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) {
      setI(0);
      return;
    }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return { step: steps[i], prev: steps[(i + steps.length - 1) % steps.length], reduced };
}

/** The photo the Swift example draws: sky, sun, clouds, layered hills, cypresses and a red tram under its wire. */
function Scene() {
  return (
    <svg aria-hidden viewBox="0 0 1600 1200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
      <rect width="1600" height="1200" fill={blocks.sky} />
      <circle cx="1215" cy="285" r="105" fill={blocks.butter} />
      <g fill={PAPER}>
        <rect x="262" y="300" width="268" height="56" rx="28" />
        <circle cx="352" cy="300" r="50" />
        <circle cx="436" cy="286" r="62" />
        <rect x="930" y="212" width="176" height="38" rx="19" />
        <circle cx="990" cy="212" r="32" />
        <circle cx="1046" cy="204" r="40" />
      </g>
      <path d="M0 690 C180 560 380 560 560 650 C720 730 860 560 1060 590 C1260 620 1380 540 1600 600 L1600 1200 L0 1200 Z" fill={blocks.lilac} />
      <path d="M0 840 C260 720 520 760 760 820 C1000 880 1260 760 1600 790 L1600 1200 L0 1200 Z" fill={blocks.sage} />
      <g fill={ink}>
        <ellipse cx="196" cy="770" rx="16" ry="48" />
        <ellipse cx="236" cy="784" rx="12" ry="36" />
        <ellipse cx="1372" cy="752" rx="15" ry="46" />
        <ellipse cx="1408" cy="766" rx="11" ry="32" />
      </g>
      <path d="M0 980 C400 900 1000 930 1600 960 L1600 1200 L0 1200 Z" fill={blocks.sand} />
      <rect y="1048" width="1600" height="7" fill={ink} />
      <rect y="1070" width="1600" height="7" fill={ink} />
      <path d="M0 790 C540 812 1060 812 1600 786" fill="none" stroke={ink} strokeWidth="5" />
      <path d="M748 838 L790 806 L832 838" fill="none" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
      <rect x="560" y="858" width="440" height="170" rx="34" fill={signal.fill} />
      <rect x="588" y="838" width="384" height="30" rx="15" fill={PAPER} />
      <g fill={ink}>
        {[592, 680, 768, 856].map((x) => <rect key={x} x={x} y="888" width="70" height="58" rx="12" />)}
        <rect x="944" y="888" width="40" height="58" rx="12" />
        <circle cx="640" cy="1030" r="24" />
        <circle cx="920" cy="1030" r="24" />
      </g>
      <rect x="560" y="964" width="440" height="12" fill={PAPER} />
      <circle cx="986" cy="996" r="9" fill={blocks.butter} />
    </svg>
  );
}

/** A chip's small picture of its frame: outlined, or solid red when selected. */
function AspectGlyph({ aspect, selected, turns }: { aspect: AspectId; selected: boolean; turns: number }) {
  // The photo's own shape follows its turns, as in the Swift piece.
  const ratio = RATIO[aspect] ?? (turns % 2 ? 3 / 4 : 4 / 3);
  const side = 18;
  const long = side * (ratio === 1 ? 0.86 : 1);
  const w = ratio >= 1 ? long : long * ratio;
  const h = ratio >= 1 ? long / ratio : long;
  const color = selected ? signal.fill : ground.muted;
  return (
    <span className="grid place-items-center" style={{ width: u(side), height: u(side) }}>
      <span
        style={{
          width: u(w), height: u(h), boxSizing: "border-box", borderRadius: aspect === "circle" ? "50%" : u(2.5),
          border: `${u(1.6)} solid ${color}`, background: selected ? color : "transparent", transition: "background-color .2s, border-color .2s",
        }}
      />
    </span>
  );
}

function Spinner() {
  return (
    <span data-motion className="block" style={{ width: u(18), height: u(18), animation: "pc-spin .9s steps(8) infinite" }}>
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: "100%", height: "100%" }}>
        {Array.from({ length: 8 }, (_, k) => (
          <line key={k} x1="12" y1="3" x2="12" y2="7.5" stroke={signal.on} strokeWidth={2.6} strokeLinecap="round" opacity={0.25 + (k / 7) * 0.75} transform={`rotate(${k * 45} 12 12)`} />
        ))}
      </svg>
    </span>
  );
}

function Icon({ children, size, width = 2 }: { children: ReactNode; size: number; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), display: "block" }}>
      {children}
    </svg>
  );
}

const TILES: Array<[AspectId, string]> = [["circle", "Circle"], ["square", "Square"], ["portrait", "4:5"], ["landscape", "16:9"], ["original", "Original"]];

export function PhotoCropperPreview() {
  const { step: s, prev, reduced } = useSteps(SCRIPT);
  const { frame, transform } = place(s.framing);
  const move = reduced ? "snap" : s.move;
  const photoMotion = move === "snap" || !move ? "none"
    : move === "drag" ? `transform ${s.ms * 0.9}ms ${follow}`
    : move === "turn" ? `transform 520ms ${turnEase}`
    : move === "morph" ? `transform 460ms ${ease}`
    : `transform 450ms ${ease}`;
  const frameMotion = move === "snap" ? "none" : move === "drag" ? `all ${s.ms * 0.9}ms ${follow}` : `all 460ms ${ease}`;
  const clip = `inset(${u(frame.y)} ${u(WELL.w - frame.x - frame.w)} ${u(WELL.h - frame.y - frame.h)} ${u(frame.x)} round ${u(frame.r)})`;
  const changed = s.framing !== REST;
  const shown = s.fade ? 0 : 1;
  const edge = s.flash ? signal.fill : PAPER;
  const zoomText = `${Number(s.framing.zoom.toFixed(1)).toLocaleString("en-US")}×`;

  // The photo element sits centred on the frame; its transform does the rest. The boost wrapper grows it mid-turn so
  // the frame's corners never leave the photo (the Swift piece computes the same per frame).
  const layer = (dimmed: boolean) => (
    <div data-motion style={{ position: "absolute", inset: 0, transformOrigin: `${u(WELL.w / 2)} ${u(WELL.h / 2)}`, animation: move === "turn" ? "pc-boost 520ms linear" : undefined }}>
      <div
        data-motion
        style={{
          position: "absolute", left: u(WELL.w / 2 - (PHOTO.w * BASE) / 2), top: u(WELL.h / 2 - (PHOTO.h * BASE) / 2),
          width: u(PHOTO.w * BASE), height: u(PHOTO.h * BASE), transform, transition: photoMotion,
        }}
      >
        <Scene />
        {dimmed ? <div style={{ position: "absolute", inset: 0, background: WELL_INK, opacity: 0.62 }} /> : null}
      </div>
    </div>
  );

  const mark = (corner: 0 | 1 | 2 | 3): CSSProperties => {
    const right = corner === 1 || corner === 2;
    const bottom = corner === 2 || corner === 3;
    const t = u(3);
    return {
      position: "absolute", width: u(20), height: u(20), boxSizing: "border-box", borderColor: edge, borderStyle: "solid",
      left: right ? undefined : u(-3), right: right ? u(-3) : undefined, top: bottom ? undefined : u(-3), bottom: bottom ? u(-3) : undefined,
      borderTopWidth: bottom ? 0 : t, borderBottomWidth: bottom ? t : 0, borderLeftWidth: right ? 0 : t, borderRightWidth: right ? t : 0,
      transition: s.flash ? "none" : "border-color .4s ease-out",
    };
  };

  const fingersShown = s.fingers ?? [];
  const lastFingers = s.fingers ?? prev.fingers ?? [];
  const dotsJump = !prev.fingers || (prev.fingers.length !== fingersShown.length && fingersShown.length > 0);

  return (
    <div className="absolute inset-0" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes pc-spin{to{transform:rotate(360deg)}}@keyframes pc-boost{${BOOST}}@keyframes pc-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}`}</style>

      {/* The well: dark in both appearances, like the Swift piece's canvas. */}
      <div style={{ position: "absolute", left: u(WELL.x), top: u(WELL.y), width: u(WELL.w), height: u(WELL.h), borderRadius: u(26), overflow: "hidden", background: WELL_INK }}>
        <div data-motion style={{ position: "absolute", inset: 0, opacity: shown, transition: s.fade ? "opacity .25s" : "opacity .3s" }}>
          {layer(true)}
          <div data-motion style={{ position: "absolute", inset: 0, clipPath: clip, transition: move === "snap" ? "none" : `clip-path ${move === "drag" ? `${s.ms * 0.9}ms ${follow}` : `460ms ${ease}`}` }}>
            {layer(false)}
          </div>
          <div style={{ position: "absolute", left: u(frame.x), top: u(frame.y), width: u(frame.w), height: u(frame.h), transition: frameMotion }}>
            {/* Thirds grid, clipped to the frame. */}
            <div data-motion style={{ position: "absolute", inset: 0, borderRadius: u(frame.r), overflow: "hidden", opacity: s.grid ? 1 : 0, transition: `opacity ${s.grid ? ".15s" : ".3s"} ease-out` }}>
              {[1, 2].map((k) => (
                <span key={`v${k}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${(k * 100) / 3}%`, width: u(0.75), background: PAPER, opacity: 0.6 }} />
              ))}
              {[1, 2].map((k) => (
                <span key={`h${k}`} style={{ position: "absolute", left: 0, right: 0, top: `${(k * 100) / 3}%`, height: u(0.75), background: PAPER, opacity: 0.6 }} />
              ))}
            </div>
            <div style={{ position: "absolute", inset: 0, borderRadius: u(frame.r), boxShadow: `0 0 0 ${u(1)} ${edge}`, transition: `border-radius 460ms ${ease}, box-shadow ${s.flash ? "0s" : ".4s ease-out"}` }} />
            <div data-motion style={{ position: "absolute", inset: 0, opacity: frame.r > 0 ? 0 : 1, transition: "opacity .3s" }}>
              {([0, 1, 2, 3] as const).map((c) => <span key={c} style={mark(c)} />)}
            </div>
          </div>
          {/* The zoom level, inside the frame's top edge (no room above it on this stage). */}
          <span
            data-motion
            style={{
              position: "absolute", left: u(WELL.w / 2), top: u(frame.y + 21), transform: "translate(-50%, -50%)", padding: `${u(4)} ${u(10)}`, borderRadius: u(999),
              background: "rgba(20,20,20,.72)", color: PAPER, fontSize: u(13), fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
              opacity: s.readout ? 1 : 0, transition: `opacity ${s.readout ? ".15s" : ".3s"} ease-out, top 460ms ${ease}`,
            }}
          >
            {zoomText}
          </span>
        </div>
      </div>

      {/* Fingers. */}
      {[0, 1].map((k) => {
        const at = fingersShown[k] ?? lastFingers[k];
        const on = Boolean(fingersShown[k]);
        if (!at) return null;
        return (
          <span
            key={k}
            data-motion
            style={{
              position: "absolute", left: u(at[0]), top: u(at[1]), width: u(34), height: u(34), marginLeft: u(-17), marginTop: u(-17), borderRadius: "50%",
              background: "rgba(244,243,239,.42)", boxShadow: `0 0 0 ${u(2)} rgba(244,243,239,.9), 0 ${u(3)} ${u(10)} rgba(0,0,0,.28)`,
              opacity: on ? 1 : 0, transform: on || reduced ? "none" : "scale(.7)",
              transition: dotsJump ? "opacity .15s, transform .2s" : `left ${s.ms * 0.9}ms ${follow}, top ${s.ms * 0.9}ms ${follow}, opacity .2s, transform .2s`,
            }}
          />
        );
      })}

      {/* Toolbar: aspect chips, then Cancel, rotate, Reset and Choose. */}
      <div className="absolute flex flex-col items-stretch" style={{ left: 0, right: 0, bottom: 0, height: u(TOOLBAR), paddingTop: u(6), boxSizing: "border-box", gap: u(6) }}>
        <div className="flex justify-center" style={{ gap: u(4) }}>
          {TILES.map(([id, title]) => {
            const selected = s.framing.aspect === id;
            const pressed = s.press === id;
            return (
              <span
                key={id}
                data-motion
                className="flex flex-col items-center"
                style={{
                  minWidth: u(58), padding: `${u(7)} ${u(10)}`, boxSizing: "border-box", gap: u(4), borderRadius: u(12),
                  background: selected ? ground.raised : "transparent", color: selected ? ground.text : ground.muted,
                  transform: pressed ? "scale(.94)" : "none", transition: `transform .25s ${spring}, background-color .2s, color .2s`,
                }}
              >
                <AspectGlyph aspect={id} selected={selected} turns={s.framing.turns} />
                <span style={{ fontSize: u(12), fontWeight: 600, lineHeight: 1.25 }}>{title}</span>
              </span>
            );
          })}
        </div>
        <div className="flex items-center" style={{ paddingInline: u(12), height: u(44) }}>
          <span style={{ fontSize: u(17), paddingInline: u(8) }}>Cancel</span>
          <span className="flex-1" />
          <span
            data-motion
            className="grid place-items-center rounded-full"
            style={{ width: u(44), height: u(44), background: ground.field, color: ground.text, transform: s.press === "rotate" ? "scale(.94)" : "none", transition: `transform .25s ${spring}` }}
          >
            <Icon size={20} width={2}>
              <rect x="4.5" y="10" width="10" height="10" rx="2" />
              <path d="M10 5.5h3.5a5 5 0 0 1 5 5v1.5" />
              <path d="M12 3l-2.5 2.5L12 8" />
            </Icon>
          </span>
          <span style={{ fontSize: u(17), paddingInline: u(10), marginInlineStart: u(4), color: changed ? ground.text : ground.muted, opacity: changed ? 1 : 0.55, transition: "color .2s, opacity .2s" }}>Reset</span>
          <span className="flex-1" />
          <span
            data-motion
            className="grid place-items-center"
            style={{
              height: u(44), padding: `0 ${u(22)}`, borderRadius: u(999), background: signal.fill, color: signal.on, fontSize: u(17), fontWeight: 600,
              transform: s.press === "choose" ? "scale(.94)" : "none", transition: `transform .25s ${spring}`,
            }}
          >
            <span style={{ gridArea: "1 / 1", opacity: s.choose ? 0 : 1, transition: "opacity .2s" }}>Choose</span>
            <span style={{ gridArea: "1 / 1", opacity: s.choose === "busy" ? 1 : 0, transition: "opacity .2s" }}>{s.choose === "busy" ? <Spinner /> : null}</span>
            <span style={{ gridArea: "1 / 1", display: "grid", placeItems: "center" }}>
              {s.choose === "done" ? (
                <span data-motion style={{ display: "block", animation: `pc-pop .35s ${spring} both` }}>
                  <Icon size={18} width={3}>
                    <path d="M5.5 12.5l4.2 4.2 8.8-9.4" />
                  </Icon>
                </span>
              ) : null}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
