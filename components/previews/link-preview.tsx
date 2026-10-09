"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { curve, follow, ms, pressScale, t, tiers } from "./piece-motion";
import { Liquid, LiquidGroup } from "./piece-liquid";

/*
 * Link Preview: a large card and a compact card for two links. The cards are content; the host sits on a small
 * liquid glass chip, over the picture on the large card and above the title on the compact one.
 * At rest both are loaded. Then a new pair of links arrives: both switch to skeletons at once and hold their size
 * while a soft band sweeps, the host chips staying put (the host is known before the page is). The picture develops
 * under its chip, fading in from just above full size; the title rises a few points into place on the same beat, a
 * touch softer so it settles just after. The large card sinks on press, springs up into its context menu, Copy Link
 * is picked, and the menu closes.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; one iOS point is one px there.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** The caption follows the picture on calm's timing without its give, so text never wobbles. */
const caption = follow({ duration: tiers.calm.duration, bounce: 0 }, 1);
/** The menu opens a beat behind the card lifting into it. */
const opening = follow("reveal", 1);
/** About 2.5 px per edge on the 344 x 265 card. */
const sink = pressScale(344, 265);

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

type Step = { loading?: boolean; reveal?: boolean; press?: boolean; menu?: boolean; pick?: boolean; ms: number };

/** Walks the scripted steps; each holds for `ms`, then loops. Holds the first (resting) step under reduced motion. */
function useSteps(steps: readonly Step[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return { step: steps[i] };
}

const steps: readonly Step[] = [
  { ms: 1700 },
  { loading: true, ms: 1900 },
  // Only this step animates the content in; a card that starts loaded (the cache) appears at once.
  { reveal: true, ms: 1300 },
  { press: true, ms: 260 },
  { menu: true, ms: 1000 },
  { menu: true, pick: true, ms: 420 },
  { ms: 900 },
];

/** Sample cover art, the same shapes as the Swift example: a red tram under its wire, in front of Lisbon rooftops. */
function Cover() {
  return (
    <svg aria-hidden viewBox="0 0 573 300" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <rect width="573" height="300" fill={blocks.butter} />
      <g fill={blocks.lilac}>
        <path d="M0 140 L35 112 L70 140 V300 H0 Z" />
        <rect x="78" y="116" width="64" height="184" />
        <path d="M384 128 L419 100 L454 128 V300 H384 Z" />
        <rect x="462" y="104" width="60" height="196" />
        <path d="M530 146 L551 128 L573 146 V300 H530 Z" />
      </g>
      <path d="M0 46 L573 36" stroke={ink} strokeWidth="3" />
      <path d="M262 118 L292 80 L270 44 M322 118 L292 80 M254 42 H288" stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="170" y="114" width="230" height="22" rx="8" fill={signal.fill} />
      <rect x="150" y="130" width="270" height="116" rx="20" fill={signal.fill} />
      <path d="M150 222 H420 V226 A20 20 0 0 1 400 246 H170 A20 20 0 0 1 150 226 Z" fill={ink} opacity="0.16" />
      <g fill={blocks.butter}>
        <rect x="168" y="148" width="40" height="42" rx="7" />
        <rect x="218" y="148" width="40" height="42" rx="7" />
        <rect x="268" y="148" width="40" height="42" rx="7" />
        <rect x="318" y="148" width="40" height="42" rx="7" />
        <rect x="370" y="148" width="34" height="84" rx="7" />
      </g>
      <rect x="0" y="256" width="573" height="44" fill={ink} />
      <path d="M0 272 H573" stroke={blocks.butter} strokeWidth="3" opacity="0.5" />
      <g fill={ink}>
        <circle cx="200" cy="248" r="13" />
        <circle cx="244" cy="248" r="13" />
        <circle cx="326" cy="248" r="13" />
        <circle cx="370" cy="248" r="13" />
      </g>
    </svg>
  );
}

const sweep: CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none",
  background: `linear-gradient(106deg, transparent 30%, ${ground.control} 50%, transparent 70%)`,
  backgroundSize: "250% 100%", animation: "lp-sweep 1.6s linear infinite",
};

/** A skeleton bone with the shared sweep running across it. */
function Bone({ w, h, r = 4, style }: { w: string; h: number; r?: number; style?: CSSProperties }) {
  return (
    <span style={{ position: "relative", display: "block", width: w, height: u(h), borderRadius: u(r), background: ground.field, overflow: "hidden", ...style }}>
      <span data-motion style={sweep} />
    </span>
  );
}

/** Loading shows at once; `reveal` is the one step that animates the content in; `rest` is plain loaded. */
type Phase = "loading" | "reveal" | "rest";

/** The sweep over a picture's placeholder. It fades with the reveal, so the band still crosses the picture as it develops. */
function Veil({ phase }: { phase: Phase }) {
  if (phase === "rest") return null;
  return <span data-motion style={{ ...sweep, opacity: phase === "loading" ? 1 : 0, transition: phase === "loading" ? "none" : t("opacity", "reveal") }} />;
}

/** The lead: the picture surfaces from just above full size and settles flat on the placeholder, like a print developing. */
function Develop({ phase, children, style }: { phase: Phase; children: ReactNode; style?: CSSProperties }) {
  if (phase === "loading") return null;
  const { easing, ms: dur } = curve("reveal");
  return <div data-motion style={{ position: "absolute", inset: 0, animation: phase === "reveal" ? `lp-settle ${dur}ms ${easing} both` : "none", ...style }}>{children}</div>;
}

/**
 * The caption over its skeleton, both in the same box so the reserved height never moves. On the reveal the bones fade
 * as the host and title rise a few px into their place, together, on the caption spring. A new link resets at once.
 */
function Swap({ phase, bones, children, style }: { phase: Phase; bones: ReactNode; children: ReactNode; style?: CSSProperties }) {
  const loading = phase === "loading";
  const motion = loading ? "none" : t(["opacity", "transform"], caption);
  return (
    <div style={{ display: "grid", ...style }}>
      {phase === "rest" ? null : <div data-motion style={{ gridArea: "1 / 1", opacity: loading ? 1 : 0, transition: motion }}>{bones}</div>}
      <div data-motion style={{ gridArea: "1 / 1", opacity: loading ? 0 : 1, transform: loading ? `translateY(${u(4)})` : "none", transition: motion }}>{children}</div>
    </div>
  );
}

const meta: CSSProperties = { fontSize: u(10.5), fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: ground.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 };

/** The host on a small liquid glass chip: the card's one piece of chrome. */
function HostChip({ host }: { host: string }) {
  return (
    <LiquidGroup unit={u(1)} style={{ display: "inline-block", maxWidth: "100%" }}>
      <Liquid style={{ display: "inline-flex", maxWidth: "100%", padding: `${u(4)} ${u(8)}` }}>
        <span style={meta}>{host}</span>
      </Liquid>
    </LiquidGroup>
  );
}
const clamp2: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

function Glyph({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(17), height: u(17), flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

const MENU = [
  { label: "Open Link", d: "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z" },
  { label: "Copy Link", d: "M9 9h10v11H9zM5 15V4h10" },
  { label: "Share", d: "M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" },
];

export function LinkPreviewPreview() {
  const { step } = useSteps(steps);
  const loading = !!step.loading;
  const phase: Phase = loading ? "loading" : step.reveal ? "reveal" : "rest";
  const lifted = !!step.menu;
  // The press arrives firm; the lift springs up through rest out of it; closing lets the card settle home with some give.
  const cardMotion = step.press ? "press" : lifted ? "release" : "settle";
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes lp-sweep{from{background-position:120% 0}to{background-position:-120% 0}}@keyframes lp-settle{from{transform:scale(1.06);opacity:0}to{transform:none;opacity:1}}`}</style>
      {/* The menu needs room below the lifted card, so the pair rises while it is open, as on iOS. */}
      <div data-motion style={{ position: "relative", width: u(344), display: "flex", flexDirection: "column", gap: u(12), transform: lifted ? `translateY(${u(-18)})` : "none", transition: t("transform", lifted ? "reveal" : "settle") }}>
        {/* Large card: sinks about 2.5 px an edge from its center and stays opaque. */}
        <div
          data-motion
          style={{
            position: "relative", zIndex: 2, borderRadius: u(18), overflow: "hidden", background: ground.surface,
            transform: step.press ? `scale(${sink.toFixed(4)})` : lifted ? "scale(1.02)" : "none",
            boxShadow: lifted ? `0 ${u(18)} ${u(40)} rgba(0,0,0,.28)` : "none",
            transition: `${t("transform", cardMotion)}, ${t("box-shadow", lifted ? "reveal" : "dismiss")}`,
          }}
        >
          <div style={{ position: "relative", aspectRatio: "1.91 / 1", background: ground.field, overflow: "hidden" }}>
            <Develop phase={phase}><Cover /></Develop>
            <Veil phase={phase} />
            {/* The host rides over the picture on glass, from the first frame, so the picture develops under it. */}
            <div style={{ position: "absolute", left: u(10), top: u(10), right: u(10) }}>
              <HostChip host="fieldnotes.travel" />
            </div>
          </div>
          <Swap
            phase={phase}
            style={{ padding: `${u(12)} ${u(16)} ${u(14)}` }}
            bones={<div style={{ display: "flex", flexDirection: "column", gap: u(8), paddingTop: u(3) }}><Bone w="100%" h={13} /><Bone w="72%" h={13} /></div>}
          >
            <span style={{ ...clamp2, fontSize: u(16), fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", minHeight: "2.6em" }}>Twelve stops on the old tram line through Lisbon</span>
          </Swap>
        </div>

        {/* Compact card */}
        <div data-motion style={{ display: "flex", alignItems: "center", gap: u(12), padding: `${u(8)} ${u(14)} ${u(8)} ${u(8)}`, borderRadius: u(18), background: ground.surface, filter: lifted ? `blur(${u(3)})` : "none", opacity: lifted ? 0.5 : 1, transition: t(["filter", "opacity"], lifted ? "reveal" : "dismiss") }}>
          <div style={{ position: "relative", width: u(56), height: u(56), flexShrink: 0, borderRadius: u(10), overflow: "hidden", background: ground.field }}>
            <Develop phase={phase} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: blocks.sky, color: ink, fontFamily: font.rounded, fontWeight: 600, fontSize: u(25) }}>S</Develop>
            <Veil phase={phase} />
          </div>
          {/* The chip holds its place through every phase; only the title below it swaps with its bones. */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: u(4) }}>
            <HostChip host="slowdesk.co" />
            <Swap
              phase={phase}
              style={{ alignSelf: "stretch" }}
              bones={<div style={{ display: "flex", flexDirection: "column", gap: u(7), paddingTop: u(2) }}><Bone w="100%" h={11} /><Bone w="66%" h={11} /></div>}
            >
              <span style={{ ...clamp2, fontSize: u(14), fontWeight: 600, lineHeight: 1.3 }}>Quiet mornings: a note-taking routine that sticks</span>
            </Swap>
          </div>
        </div>

        {/* Context menu of the large card. Opens a beat behind the lift; closes quick and firm, then hides from the tree. */}
        <div
          data-motion
          style={{
            position: "absolute", zIndex: 3, top: `calc(100% - ${u(76)})`, left: u(4), width: u(214), borderRadius: u(14), overflow: "hidden",
            background: ground.raised, boxShadow: `0 ${u(14)} ${u(34)} rgba(0,0,0,.3)`, transformOrigin: "top left", pointerEvents: "none",
            opacity: lifted ? 1 : 0, transform: lifted ? "none" : "scale(.6)", visibility: lifted ? "visible" : "hidden",
            transition: lifted ? `${t(["opacity", "transform"], opening)}, visibility 0s` : `${t(["opacity", "transform"], "dismiss")}, visibility 0s linear ${ms("dismiss")}ms`,
          }}
        >
          {MENU.map((m, k) => {
            const picked = !!step.pick && m.label === "Copy Link";
            return (
              <div
                key={m.label}
                className="flex items-center justify-between"
                style={{
                  height: u(37), paddingInline: u(14), fontSize: u(14.5), fontWeight: 600, borderTop: k ? `1px solid ${ground.line}` : "none",
                  // The picked row stays lit while the menu closes, then clears out of sight.
                  background: picked ? ground.control : "transparent", transition: picked ? t("background-color", "press") : `background-color 0s ${ms("dismiss")}ms`,
                }}
              >
                <span>{m.label}</span>
                <Glyph d={m.d} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
