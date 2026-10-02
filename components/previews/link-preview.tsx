"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/*
 * Link Preview: a large card and a compact card for two links.
 * At rest both are loaded. Then a new pair of links arrives: both hold their size as skeletons while a soft band
 * sweeps, the image settles in and the text fades up. The large card dips on press, lifts into its context menu,
 * Copy Link is picked, and the menu closes.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

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

type Step = { loading?: boolean; press?: boolean; menu?: boolean; pick?: boolean; ms: number };

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
  { ms: 1300 },
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

/** Loaded content fades in over its skeleton; the skeleton fades out. Both occupy the same box, so nothing moves. */
function Swap({ loading, bones, children, style }: { loading: boolean; bones: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "grid", ...style }}>
      <div data-motion style={{ gridArea: "1 / 1", opacity: loading ? 1 : 0, transition: "opacity .3s" }}>{bones}</div>
      <div data-motion style={{ gridArea: "1 / 1", opacity: loading ? 0 : 1, transition: `opacity .35s ${ease}` }}>{children}</div>
    </div>
  );
}

const meta: CSSProperties = { fontSize: u(10.5), fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: ground.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
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
  const lifted = !!step.menu;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes lp-sweep{from{background-position:120% 0}to{background-position:-120% 0}}@keyframes lp-settle{from{transform:scale(1.06);opacity:0}to{transform:none;opacity:1}}@keyframes lp-menu{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}`}</style>
      {/* The menu needs room below the lifted card, so the pair rises while it is open, as on iOS. */}
      <div data-motion style={{ position: "relative", width: u(344), display: "flex", flexDirection: "column", gap: u(12), transform: lifted ? `translateY(${u(-18)})` : "none", transition: `transform .4s ${ease}` }}>
        {/* Large card */}
        <div
          data-motion
          style={{
            position: "relative", zIndex: 2, borderRadius: u(18), overflow: "hidden", background: ground.surface,
            transform: step.press ? "scale(.97)" : lifted ? "scale(1.02)" : "none",
            boxShadow: lifted ? `0 ${u(18)} ${u(40)} rgba(0,0,0,.28)` : "none",
            transition: `transform .35s ${spring}, box-shadow .35s ${ease}`,
          }}
        >
          <div style={{ position: "relative", aspectRatio: "1.91 / 1", background: ground.field, overflow: "hidden" }}>
            {loading ? <span data-motion style={sweep} /> : <div data-motion style={{ position: "absolute", inset: 0, animation: `lp-settle .5s ${ease} both` }}><Cover /></div>}
          </div>
          <Swap
            loading={loading}
            style={{ padding: `${u(12)} ${u(16)} ${u(14)}` }}
            bones={<div style={{ display: "flex", flexDirection: "column", gap: u(8), paddingTop: u(2) }}><Bone w="30%" h={10} /><Bone w="100%" h={13} /><Bone w="72%" h={13} /></div>}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: u(4) }}>
              <span style={meta}>fieldnotes.travel</span>
              <span style={{ ...clamp2, fontSize: u(16), fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", minHeight: "2.6em" }}>Twelve stops on the old tram line through Lisbon</span>
            </div>
          </Swap>
        </div>

        {/* Compact card */}
        <div data-motion style={{ display: "flex", alignItems: "center", gap: u(12), padding: `${u(8)} ${u(14)} ${u(8)} ${u(8)}`, borderRadius: u(18), background: ground.surface, filter: lifted ? `blur(${u(3)})` : "none", opacity: lifted ? 0.5 : 1, transition: "filter .3s, opacity .3s" }}>
          <div style={{ position: "relative", width: u(56), height: u(56), flexShrink: 0, borderRadius: u(10), overflow: "hidden", background: ground.field }}>
            {loading ? (
              <span data-motion style={sweep} />
            ) : (
              <div data-motion className="flex items-center justify-center" style={{ position: "absolute", inset: 0, background: blocks.sky, color: ink, fontFamily: font.rounded, fontWeight: 800, fontSize: u(25), animation: `lp-settle .5s ${ease} both` }}>S</div>
            )}
          </div>
          <Swap
            loading={loading}
            style={{ flex: 1, minWidth: 0 }}
            bones={<div style={{ display: "flex", flexDirection: "column", gap: u(7) }}><Bone w="34%" h={9} /><Bone w="100%" h={11} /><Bone w="66%" h={11} /></div>}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: u(3) }}>
              <span style={meta}>slowdesk.co</span>
              <span style={{ ...clamp2, fontSize: u(14), fontWeight: 600, lineHeight: 1.3 }}>Quiet mornings: a note-taking routine that sticks</span>
            </div>
          </Swap>
        </div>

        {/* Context menu of the large card */}
        {lifted ? (
          <div
            data-motion
            style={{
              position: "absolute", zIndex: 3, top: `calc(100% - ${u(76)})`, left: u(4), width: u(214), borderRadius: u(14), overflow: "hidden",
              background: ground.raised, boxShadow: `0 ${u(14)} ${u(34)} rgba(0,0,0,.3)`, transformOrigin: "top left", animation: `lp-menu .35s ${spring} both`,
            }}
          >
            {MENU.map((m, k) => (
              <div
                key={m.label}
                className="flex items-center justify-between"
                style={{
                  height: u(37), paddingInline: u(14), fontSize: u(14.5), borderTop: k ? `1px solid ${ground.line}` : "none",
                  background: step.pick && m.label === "Copy Link" ? ground.control : "transparent", transition: "background-color .15s",
                }}
              >
                <span>{m.label}</span>
                <Glyph d={m.d} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
