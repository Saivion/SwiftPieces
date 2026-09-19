"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, radius, signal } from "./palette";

/*
 * Feedback previews. Each one shows the component and nothing else (FREE-V2.1): no cards, no
 * headings, no fake screens. The component rests first, then loops its signature interaction.
 * Sizes are designed against the 560 px docs stage and scale with the size container (`u`).
 */

const u = (n: number) => `${(n / 5.6).toFixed(3)}cqw`;
const SPRING = "cubic-bezier(0.34, 1.45, 0.64, 1)";
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const KEYFRAMES = `
@keyframes fb-bounce{0%{transform:scale(1) rotate(0)}14%{transform:scale(.78) rotate(-6deg)}40%{transform:scale(1.24) rotate(-12deg)}70%{transform:scale(.96) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
@keyframes fb-halo{from{outline-offset:0;opacity:1}to{outline-offset:${u(20)};opacity:0}}
@keyframes fb-ring{from{transform:scale(.7);opacity:1}to{transform:scale(1.8);opacity:0}}
@keyframes fb-spin{to{transform:rotate(360deg)}}
@keyframes fb-sweep{from{transform:translateX(-160%) rotate(18deg)}to{transform:translateX(360%) rotate(18deg)}}
@keyframes fb-pop{0%{transform:scale(1)}35%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes fb-nudge{0%,100%{transform:translateX(0)}20%{transform:translateX(-6%)}45%{transform:translateX(6%)}70%{transform:translateX(-3%)}}
@keyframes fb-pulse{from{transform:scale(1);opacity:1}to{transform:scale(1.45);opacity:0}}
`;

/** The house ground, with the component centred on it and nothing else. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{KEYFRAMES}</style>
      {children}
    </div>
  );
}

/** Walks through `durations`, returning the current step; loops forever and clears its timer. */
function useSteps(durations: number[]) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setI((v) => (v + 1) % durations.length), durations[i]);
    return () => clearTimeout(t);
  }, [i, durations]);
  return i;
}

const display = (size: number): CSSProperties => ({ fontSize: u(size), fontWeight: font.displayWeight, letterSpacing: "-0.03em", lineHeight: 1.12 });

// MARK: - Reaction Toggle

const HEART = "M12 20.5s-7.6-4.6-9.4-9C1.2 7.8 3.4 4 7.2 4c2.1 0 3.7 1.1 4.8 2.7C13.1 5.1 14.7 4 16.8 4c3.8 0 6 3.8 4.6 7.5-1.8 4.4-9.4 9-9.4 9z";
const BOOKMARK = "M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.6l-6.5 3.9V5A1.5 1.5 0 0 1 7 3.5z";
const STAR = "M12 2.8l2.8 5.8 6.4.8-4.7 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z";

function Glyph24({ d, filled, color, size }: { d: string; filled: boolean; color: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size), display: "block" }} fill={filled ? color : "none"} stroke={color} strokeWidth={2.2} strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** A capsule that floods with a block from the symbol outward, bounces the symbol, sends one halo, and rolls a count. */
function Reaction({ on, pressed, d, fill, count, pill, k }: { on: boolean; pressed: boolean; d: string; fill: string; count?: number; pill?: string; k: number }) {
  const [burst, setBurst] = useState(0);
  const [pillUp, setPillUp] = useState(false);
  useEffect(() => {
    if (!on) { setPillUp(false); return; }
    setBurst((b) => b + 1);
    setPillUp(true);
    const t = window.setTimeout(() => setPillUp(false), 1300);
    return () => clearTimeout(t);
  }, [on]);
  const H = 48 * k, box = 31 * k, lead = (H - box) / 2 + 2 * k, color = on ? ink : ground.text;
  return (
    <div data-motion className="relative" style={{ transform: `scale(${pressed ? 0.92 : 1})`, transition: pressed ? "transform .12s ease-out" : `transform .45s ${SPRING}` }}>
      {pill && (
        <span data-motion className="pointer-events-none absolute left-1/2 flex items-center whitespace-nowrap rounded-full" style={{ bottom: `calc(100% + ${u(10 * k)})`, gap: u(5 * k), padding: `${u(6 * k)} ${u(12 * k)}`, fontSize: u(13 * k), fontWeight: 600, background: ground.text, color: ink, boxShadow: `0 ${u(5 * k)} ${u(10 * k)} rgba(0,0,0,.25)`, transformOrigin: "bottom center", transform: `translate(-50%, ${pillUp ? 0 : u(8 * k)}) scale(${pillUp ? 1 : 0.6})`, opacity: pillUp ? 1 : 0, transition: pillUp ? `transform .4s ${SPRING}, opacity .2s` : "transform .25s ease-out, opacity .25s ease-out" }}>
          <svg viewBox="0 0 24 24" style={{ width: u(11 * k), height: u(11 * k) }} fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          {pill}
        </span>
      )}
      <div className="relative flex items-center overflow-hidden rounded-full" style={{ height: u(H), paddingLeft: u(lead), paddingRight: u(count === undefined ? lead : H * 0.42), gap: u(7 * k), background: ground.raised }}>
        <span data-motion className="absolute rounded-full" style={{ width: u(320 * k), height: u(320 * k), left: u(lead + box / 2 - 160 * k), top: `calc(50% - ${u(160 * k)})`, background: fill, transform: `scale(${on ? 1 : 0})`, transition: on ? `transform .55s ${EASE}` : "transform .28s ease-out" }} />
        <span key={burst} data-motion className="relative grid place-items-center" style={{ width: u(box), height: u(box), animation: burst ? `fb-bounce .6s ${EASE}` : "none" }}>
          <Glyph24 d={d} filled={on} color={color} size={24 * k} />
        </span>
        {count !== undefined && (
          <span className="relative overflow-hidden tabular-nums" style={{ height: u(20 * k), lineHeight: u(20 * k), fontSize: u(17 * k), fontWeight: 600, fontFamily: font.rounded, color, transition: "color .2s" }}>
            <span data-motion className="block" style={{ transform: `translateY(${on ? `-${u(20 * k)}` : 0})`, transition: `transform .4s ${SPRING}` }}>
              <span className="block">{count}</span>
              <span className="block">{count + 1}</span>
            </span>
          </span>
        )}
      </div>
      {burst > 0 && on && <span key={`h${burst}`} data-motion className="pointer-events-none absolute inset-0 rounded-full" style={{ outline: `${u(3 * k)} solid ${fill}`, animation: "fb-halo .6s ease-out forwards" }} />}
    </div>
  );
}

/** Bare variant: a butter star that sits under an ink outline, like a sticker. */
function Sticker({ on, pressed, k }: { on: boolean; pressed: boolean; k: number }) {
  return (
    <div data-motion className="relative grid place-items-center" style={{ width: u(48 * k), height: u(48 * k), transform: `scale(${pressed ? 0.92 : 1})`, transition: pressed ? "transform .12s ease-out" : `transform .45s ${SPRING}` }}>
      {on && <span data-motion className="absolute rounded-full" style={{ inset: u(8 * k), border: `${u(2.5 * k)} solid ${blocks.butter}`, animation: "fb-ring .6s ease-out forwards" }} />}
      <span key={on ? "on" : "off"} data-motion className="relative grid place-items-center" style={{ width: u(31 * k), height: u(31 * k), animation: on ? `fb-bounce .6s ${EASE}` : "none" }}>
        <span data-motion className="absolute" style={{ transform: `scale(${on ? 1 : 0})`, opacity: on ? 1 : 0, transition: `transform .45s ${SPRING}, opacity .2s` }}><Glyph24 d={STAR} filled color={blocks.butter} size={24 * k} /></span>
        <span className="absolute"><Glyph24 d={STAR} filled={false} color={ground.text} size={24 * k} /></span>
      </span>
    </div>
  );
}

// Rest, like, save (pill), star, rest again, then everything off.
const REACT_STEPS = [1400, 130, 1100, 130, 1500, 130, 1700, 130, 900];
export function ReactionTogglePreview() {
  const i = useSteps(REACT_STEPS);
  const liked = i >= 2 && i < 8, saved = i >= 4 && i < 8, starred = i >= 6 && i < 8;
  const press = i === 1 ? "like" : i === 3 ? "save" : i === 5 ? "star" : i === 7 ? "all" : null;
  const k = 1.85;
  return (
    <Stage>
      <div className="flex items-center" style={{ gap: u(26) }}>
        <Reaction k={k} on={liked} pressed={press === "like" || press === "all"} d={HEART} fill={blocks.tangerine} count={128} />
        <Reaction k={k} on={saved} pressed={press === "save" || press === "all"} d={BOOKMARK} fill={blocks.sky} pill="Saved" />
        <Sticker k={k} on={starred} pressed={press === "star" || press === "all"} />
      </div>
    </Stage>
  );
}

// MARK: - Rating Scrub

/** The Swift `SoftStar`: five points with rounded tips and valleys, in a 24 box. */
const SOFT_STAR = (() => {
  const cx = 12, cy = 12.96, outer = 12.48, inner = 6.24;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? inner : outer;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const lerp = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  let d = "";
  pts.forEach((c, i) => {
    const prev = pts[(i + 9) % 10], next = pts[(i + 1) % 10], t = i % 2 ? 0.08 : 0.26;
    const a = lerp(c, prev, t), b = lerp(c, next, t);
    d += `${i ? "L" : "M"}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${c[0].toFixed(2)} ${c[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  });
  return `${d}Z`;
})();

const LEVELS = [blocks.tangerine, blocks.sand, blocks.butter, blocks.sage, blocks.sky];
const LABELS = ["Poor", "Fair", "Good", "Very good", "Great"];
const EMPTY = "#2e2e2e";
const levelFor = (v: number) => (v > 0 ? LEVELS[Math.ceil(v) - 1] : LEVELS[4]);

function Stars({ value, size, active = null }: { value: number; size: number; active?: number | null }) {
  const cell = size * 1.2, gap = size * 0.16, color = levelFor(value), last = useRef(0);
  if (active !== null) last.current = active;
  return (
    <div className="flex" style={{ gap: u(gap) }}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(Math.max(value - i, 0), 1), lifted = active === i;
        return (
          <span key={i} data-motion className="relative grid place-items-center" style={{ width: u(cell), height: u(cell), transform: lifted ? `translateY(-${u(size * 0.28)}) scale(1.3)` : "none", transition: active !== null ? "transform .18s ease-out" : `transform .42s ${SPRING} ${0.03 * Math.abs(i - last.current)}s` }}>
            <svg viewBox="0 0 24 24" className="absolute" style={{ width: u(size), height: u(size) }} aria-hidden><path d={SOFT_STAR} fill={EMPTY} /></svg>
            <svg viewBox="0 0 24 24" className="absolute" style={{ width: u(size), height: u(size), clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)`, transition: "clip-path .18s ease-out" }} aria-hidden><path d={SOFT_STAR} fill={color} style={{ transition: "fill .25s" }} /></svg>
          </span>
        );
      })}
    </div>
  );
}

/** [rating, finger down, hold ms]: rest, scrub up to five, settle back on four, tap two, clear. */
const SCRUB: [number, boolean, number][] = [[4, false, 1600], [1, true, 260], [2, true, 200], [3, true, 200], [4, true, 200], [5, true, 380], [5, false, 1300], [4, true, 240], [4, false, 1500], [2, true, 240], [2, false, 1500], [4, true, 240]];
const SCRUB_MS = SCRUB.map((s) => s[2]);

export function RatingScrubPreview() {
  const i = useSteps(SCRUB_MS);
  const [rating, down] = SCRUB[i];
  const size = 62, cell = size * 1.2, gap = size * 0.16, width = 5 * cell + 4 * gap;
  const f = size / 38;
  const label = rating > 0 ? LABELS[Math.ceil(rating) - 1] : null;
  return (
    <Stage>
      <div className="relative" style={{ width: u(width) }}>
        <Stars value={rating} size={size} active={down ? Math.ceil(rating) - 1 : null} />
        <span data-motion aria-hidden className="pointer-events-none absolute rounded-full" style={{ width: u(40 * f), height: u(40 * f), top: u(cell / 2 - 20 * f + 26 * f), left: u((Math.ceil(rating) - 1) * (cell + gap) + cell / 2 - 20 * f), background: "rgba(255,255,255,.28)", opacity: down ? 1 : 0, transition: `left .2s ${EASE}, opacity .2s` }} />
        <div className="flex items-center justify-between" style={{ marginTop: u(22 * f), paddingInline: u(size * 0.1) }}>
          <span className="tabular-nums" style={{ fontSize: u(46 * f), fontWeight: font.numeralWeight, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {Math.floor(rating)}<span style={{ color: ground.subtle }}>.{rating % 1 ? 5 : 0}</span><span style={{ fontSize: u(19 * f), fontWeight: 500, color: ground.subtle }}> / 5</span>
          </span>
          {label && <span key={label} data-motion className="grid place-items-center rounded-full" style={{ height: u(34 * f), paddingInline: u(13 * f), background: levelFor(rating), color: ink, fontSize: u(15 * f), fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", animation: `fb-pop .35s ${SPRING}`, transition: "background .25s" }}>{label}</span>}
        </div>
      </div>
    </Stage>
  );
}

// MARK: - Status Morph

type Status = "idle" | "loading" | "success" | "failure";

/** Track, spinning arc, the block that floods out of the closed ring, and the ink mark. */
function Morph({ state, size, lw }: { state: Status; size: number; lw: number }) {
  const settled = state === "success" || state === "failure";
  const block = state === "failure" ? blocks.tangerine : blocks.sage;
  const c = size / 2, r = (size - lw) / 2, p = size * (state === "failure" ? 0.33 : 0.29), q = size - p, w = q - p;
  const mark = state === "failure" ? `M${p} ${p}L${q} ${q}M${q} ${p}L${p} ${q}` : `M${p} ${p + w * 0.54}L${p + w * 0.36} ${p + w * 0.9}L${q} ${p + w * 0.12}`;
  const mw = Math.max(lw, size * 0.07);
  return (
    <span key={settled ? state : "live"} data-motion className="block" style={{ width: u(size), height: u(size), animation: state === "success" ? `fb-pop .5s ${SPRING} .5s` : state === "failure" ? "fb-nudge .3s ease-in-out .52s" : "none" }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: "100%", overflow: "visible" }} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx={c} cy={c} r={r} stroke="#2e2e2e" strokeWidth={lw} style={{ opacity: settled ? 0 : 1, transition: "opacity .3s" }} />
        <circle data-motion cx={c} cy={c} r={c} fill={block} style={{ transformOrigin: "center", transform: `scale(${settled ? 1 : 0})`, transition: settled ? `transform .4s ${SPRING} .18s` : "transform .2s ease-out" }} />
        <g data-motion style={{ transformOrigin: "center", animation: state === "loading" ? "fb-spin .9s linear infinite" : "none" }}>
          <circle cx={c} cy={c} r={r} pathLength={1} stroke={settled ? block : ground.text} strokeWidth={lw} strokeDasharray={`${state === "loading" ? 0.72 : settled ? 1 : 0} 1`} transform={`rotate(-90 ${c} ${c})`} style={{ transition: "stroke-dasharray .3s ease-out" }} />
        </g>
        <path data-motion d={mark} pathLength={1} stroke={ink} strokeWidth={mw} strokeDasharray="1 1" strokeDashoffset={settled ? 0 : 1} style={{ transition: settled ? "stroke-dashoffset .28s ease-out .32s" : "none" }} />
      </svg>
    </span>
  );
}

const CAPTIONS: Record<Status, string | null> = { idle: null, loading: "Saving", success: "Saved", failure: "Failed" };
const STATUS_SEQ: [Status, number][] = [["idle", 1100], ["loading", 1800], ["success", 2400], ["loading", 1500], ["failure", 2400]];
const STATUS_MS = STATUS_SEQ.map((s) => s[1]);

export function StatusMorphPreview() {
  const state = STATUS_SEQ[useSteps(STATUS_MS)][0];
  const caption = CAPTIONS[state], quiet = state === "idle" || state === "loading";
  return (
    <Stage>
      <div className="flex flex-col items-center" style={{ gap: u(26) }}>
        <Morph state={state} size={196} lw={10} />
        <span className="grid" style={{ height: u(36) }}>
          {caption && <span key={caption} data-motion style={{ fontSize: u(28), fontWeight: quiet ? 500 : 700, letterSpacing: "-0.01em", color: quiet ? ground.muted : ground.text, animation: `fb-pop .3s ${EASE}` }}>{caption}</span>}
        </span>
      </div>
    </Stage>
  );
}

// MARK: - Skeleton Loader

const BONE = "#2f2f2f";
const AGENDA = [
  { time: "9:30", title: "Design review", sub: "Studio B · 45 min", block: blocks.butter },
  { time: "11:00", title: "Lunch with Priya", sub: "Ferro Kitchen · 1 h", block: blocks.sage },
  { time: "16:15", title: "Ship build 4.2", sub: "Release room · 30 min", block: blocks.sky },
];

/** A solid bone with the shared soft diagonal sweep; the sweep stops and the bone dims when failed. */
function Bone({ w, h, r, failed }: { w: string; h: number; r: number; failed: boolean }) {
  return (
    <span className="relative block shrink-0 overflow-hidden" style={{ width: w, height: u(h), borderRadius: u(r), background: BONE }}>
      {!failed && <span data-motion aria-hidden className="absolute inset-y-[-60%]" style={{ left: 0, width: "45%", minWidth: u(72), background: "linear-gradient(90deg, rgba(61,61,61,0), #3d3d3d, rgba(61,61,61,0))", animation: "fb-sweep 1.6s linear infinite" }} />}
    </span>
  );
}

/** One redacted row: the placeholder fades while the real row unblurs and rises, 60 ms later per index. */
function Redacted({ index, loading, failed, bones, children }: { index: number; loading: boolean; failed: boolean; bones: ReactNode; children: ReactNode }) {
  const delay = `${0.06 * index}s`;
  return (
    <div className="relative">
      <div data-motion style={{ opacity: loading ? 0 : 1, filter: loading ? `blur(${u(8)})` : "blur(0)", transform: `translateY(${loading ? u(6) : 0})`, transition: `opacity .5s ${SPRING} ${delay}, filter .5s ease ${delay}, transform .5s ${SPRING} ${delay}` }}>{children}</div>
      <div data-motion aria-hidden className="absolute inset-0" style={{ opacity: loading ? (failed ? 0.5 : 1) : 0, transition: loading ? "opacity .4s" : `opacity .25s ease-out ${delay}` }}>{bones}</div>
    </div>
  );
}

const SKELETON_SEQ: [boolean, boolean, number][] = [[true, false, 2200], [false, false, 2800], [true, false, 1800], [true, true, 1900]];
const SKELETON_MS = SKELETON_SEQ.map((s) => s[2]);

export function SkeletonLoaderPreview() {
  const [loading, failed] = SKELETON_SEQ[useSteps(SKELETON_MS)];
  const S = 1.5;
  return (
    <Stage>
      <div className="flex flex-col" style={{ gap: u(22 * S), width: u(430) }}>
        {AGENDA.map((row, i) => (
          <Redacted key={row.title} index={i} loading={loading} failed={failed} bones={
            <div className="flex items-center" style={{ gap: u(14 * S) }}>
              <Bone w={u(64 * S)} h={52 * S} r={radius.md * S} failed={failed} />
              <div className="flex flex-col" style={{ gap: u(9 * S) }}>
                <Bone w={u((128 + i * 16) * S)} h={15 * S} r={5 * S} failed={failed} />
                <Bone w={u((150 + i * 12) * S)} h={13 * S} r={5 * S} failed={failed} />
              </div>
            </div>
          }>
            <div className="flex items-center" style={{ gap: u(14 * S) }}>
              <span className="grid shrink-0 place-items-center tabular-nums" style={{ width: u(64 * S), height: u(52 * S), borderRadius: u(radius.md * S), background: row.block, color: ink, fontFamily: font.rounded, fontSize: u(15 * S), fontWeight: 700 }}>{row.time}</span>
              <div>
                <p style={{ fontSize: u(16 * S), fontWeight: 600 }}>{row.title}</p>
                <p style={{ fontSize: u(14 * S), color: ground.muted, marginTop: u(3 * S) }}>{row.sub}</p>
              </div>
            </div>
          </Redacted>
        ))}
      </div>
    </Stage>
  );
}

// MARK: - Outcome Screen

type Outcome = "success" | "failure" | "empty";
const OUTCOMES: { kind: Outcome; eyebrow?: string; title: string; message: string; primary: string; secondary?: string; details?: boolean; block: string }[] = [
  { kind: "success", eyebrow: "Synced 10:42", title: "Backup complete", message: "2,418 photos and 36 videos are safe in your library.", primary: "Done", block: blocks.sage },
  { kind: "failure", title: "Couldn't sync", message: "Check your connection and try again.", primary: "Try again", secondary: "Not now", details: true, block: blocks.butter },
  { kind: "empty", eyebrow: "Invoices", title: "No invoices yet", message: "Invoices you send to clients show up here.", primary: "New invoice", block: blocks.sky },
];

/** Glyph paths in a unit box, matching the Swift `Glyph` shape. */
function glyph(kind: Outcome, x: number, y: number, w: number) {
  const P = (a: number, b: number) => `${(x + a * w).toFixed(2)} ${(y + b * w).toFixed(2)}`;
  if (kind === "failure") return `M${P(0, 0)}L${P(1, 1)}M${P(1, 0)}L${P(0, 1)}`;
  if (kind === "success") return `M${P(0, 0.54)}L${P(0.36, 0.88)}L${P(1, 0.14)}`;
  return `M${P(0, 0.56)}L${P(0.3, 0.56)}L${P(0.38, 0.74)}L${P(0.62, 0.74)}L${P(0.7, 0.56)}L${P(1, 0.56)}L${P(1, 1)}L${P(0, 1)}ZM${P(0.18, 0.3)}L${P(0.82, 0.3)}M${P(0.3, 0.06)}L${P(0.7, 0.06)}`;
}

export function OutcomeScreenPreview() {
  const [n, setN] = useState(0);
  const [stage, setStage] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const o = OUTCOMES[n % OUTCOMES.length];
  useEffect(() => {
    setStage(0); setRetrying(false);
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const ts = [at(80, () => setStage(1)), at(480, () => setStage(2)), at(640, () => setStage(3)), at(900, () => setStage(4)), at(1020, () => setStage(5))];
    if (o.kind === "failure") ts.push(at(2400, () => setRetrying(true)), at(3900, () => setRetrying(false)));
    ts.push(at(o.kind === "failure" ? 5400 : 3800, () => setN((v) => v + 1)));
    return () => ts.forEach(clearTimeout);
  }, [n, o.kind]);
  const S = 92, lw = 3.5, c = S / 2, pad = S * (o.kind === "failure" ? 0.34 : 0.3);
  return (
    <Stage>
      <div className="flex w-full flex-col items-center text-center" style={{ paddingInline: u(76) }}>
        <div className="relative" style={{ width: u(S), height: u(S) }}>
          {stage >= 4 && <span data-motion className="absolute inset-0 rounded-full" style={{ border: `${u(3)} solid ${o.block}`, animation: "fb-pulse .75s ease-out forwards" }} />}
          <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle data-motion cx={c} cy={c} r={c - lw / 2} pathLength={1} stroke={ground.text} strokeWidth={lw} strokeDasharray="1 1" strokeDashoffset={stage >= 1 ? 0 : 1} transform={`rotate(-90 ${c} ${c})`} style={{ opacity: stage >= 3 ? 0 : 1, transition: stage >= 1 ? "stroke-dashoffset .5s ease-in-out, opacity .2s .1s" : "none" }} />
            <circle data-motion cx={c} cy={c} r={c} fill={o.block} style={{ transformOrigin: "center", transform: `scale(${stage >= 2 ? 1 : 0})`, transition: stage >= 2 ? `transform .45s ${SPRING}` : "none" }} />
            <path data-motion d={glyph(o.kind, pad, pad, S - pad * 2)} pathLength={1} stroke={ink} strokeWidth={S * 0.075} strokeDasharray="1 1" strokeDashoffset={stage >= 3 ? 0 : 1} style={{ transition: stage >= 3 ? "stroke-dashoffset .32s ease-out" : "none" }} />
          </svg>
        </div>
        <div data-motion style={{ marginTop: u(20), opacity: stage >= 4 ? 1 : 0, transform: `translateY(${stage >= 4 ? 0 : u(14)})`, transition: stage >= 4 ? `opacity .5s ${EASE}, transform .55s ${SPRING}` : "none" }}>
          {o.eyebrow && <p style={{ fontSize: u(12), fontWeight: 700, letterSpacing: "0.1em", color: ground.muted, textTransform: "uppercase" }}>{o.eyebrow}</p>}
          <p style={{ ...display(34), letterSpacing: "-0.04em", marginTop: o.eyebrow ? u(8) : 0 }}>{o.title}</p>
          <p style={{ fontSize: u(17), lineHeight: 1.35, color: ground.muted, marginTop: u(8) }}>{o.message}</p>
        </div>
        <div data-motion className="flex w-full flex-col items-center" style={{ marginTop: u(24), opacity: stage >= 5 ? 1 : 0, transform: `translateY(${stage >= 5 ? 0 : u(10)})`, transition: stage >= 5 ? `opacity .5s ${EASE}, transform .55s ${SPRING}` : "none" }}>
          <span data-motion className="relative grid w-full place-items-center rounded-full" style={{ height: u(54), background: signal.fill, color: signal.on, fontSize: u(18), fontWeight: 600, transform: `scale(${retrying ? 0.98 : 1})`, transition: `transform .3s ${SPRING}` }}>
            <span style={{ opacity: retrying ? 0 : 1, transition: "opacity .2s" }}>{o.primary}</span>
            <span data-motion className="absolute rounded-full" style={{ width: u(24), height: u(24), border: `${u(3)} solid rgba(20,20,20,.25)`, borderTopColor: ink, opacity: retrying ? 1 : 0, transition: "opacity .2s", animation: "fb-spin .8s linear infinite" }} />
          </span>
          {o.secondary && <span className="grid place-items-center" style={{ height: u(42), fontSize: u(17), fontWeight: 600, color: ground.muted }}>{o.secondary}</span>}
          {o.details && (
            <span className="flex w-full items-center justify-between" style={{ height: u(44), paddingInline: u(16), borderRadius: u(radius.md), background: ground.raised, fontSize: u(15), fontWeight: 600 }}>
              Details
              <svg viewBox="0 0 24 24" style={{ width: u(15), height: u(15) }} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </span>
          )}
        </div>
      </div>
    </Stage>
  );
}
