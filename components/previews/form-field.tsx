"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";

/*
 * Form Field: the label rests inside the empty field, floats up on focus, the Bio counter ticks while typing,
 * an invalid email draws the error ring and message after the field is left, then fixing it lands the sage check.
 * The component only: no card, heading or invented UI. Sizes are px at the 560 px stage, converted to cqw.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const field = "#262626";

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

/** Walks a scripted list of states; each holds for `ms`, then loops. Holds the first (resting) state under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return steps[i];
}

const glyphs = {
  envelope: "M3.5 6.5h17v11h-17zM4 7l8 6 8-6",
  check: "M5 12.5l4.5 4.5L19 7",
  bang: "M12 6v7.5M12 17.6v.2",
  xmark: "M8.5 8.5l7 7M15.5 8.5l-7 7",
} as const;

function Glyph({ name, size, stroke = 2.2, style }: { name: keyof typeof glyphs; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      <path d={glyphs[name]} />
    </svg>
  );
}

const EMAIL = "maya@studio";
const FIXED = "maya@studio.com";
const BIO = "Type designer in Lisbon. Tea, trains, kerning.";
const LIMIT = 160;

type Focus = "none" | "email" | "bio";
type Step = { email: string; bio: number; focus: Focus; armed: boolean; ms: number };

const typeRun = (from: string, to: string, base: Omit<Step, "email" | "ms">, gap = 120): Step[] =>
  Array.from({ length: to.length - from.length }, (_, i) => ({ ...base, email: to.slice(0, from.length + i + 1), ms: gap }));

const steps: readonly Step[] = [
  { email: "", bio: 0, focus: "none", armed: false, ms: 1200 },
  { email: "", bio: 0, focus: "email", armed: false, ms: 1000 },
  ...typeRun("", EMAIL, { bio: 0, focus: "email", armed: false }),
  { email: EMAIL, bio: 0, focus: "email", armed: false, ms: 700 },
  { email: EMAIL, bio: 0, focus: "bio", armed: true, ms: 900 },
  ...Array.from({ length: Math.ceil(BIO.length / 3) }, (_, i) => ({ email: EMAIL, bio: Math.min((i + 1) * 3, BIO.length), focus: "bio" as const, armed: true, ms: 110 })),
  { email: EMAIL, bio: BIO.length, focus: "bio", armed: true, ms: 1100 },
  { email: EMAIL, bio: BIO.length, focus: "email", armed: true, ms: 700 },
  ...typeRun(EMAIL, FIXED, { bio: BIO.length, focus: "email", armed: true }, 150),
  { email: FIXED, bio: BIO.length, focus: "email", armed: true, ms: 900 },
  { email: FIXED, bio: BIO.length, focus: "none", armed: true, ms: 2600 },
];

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s);

function Field({ label, value, prompt, icon, focused, invalid, valid, footer }: {
  label: string; value: string; prompt?: string; icon?: keyof typeof glyphs; focused: boolean; invalid?: boolean; valid?: boolean; footer: ReactNode;
}) {
  const floated = focused || value.length > 0;
  const clear = focused && value.length > 0;
  return (
    <div className="flex flex-col" style={{ gap: u(8) }}>
      <div className="flex items-center" style={{
        minHeight: u(58), paddingLeft: u(16), paddingRight: u(clear ? 4 : 16), gap: u(10), borderRadius: u(18), background: field,
        boxShadow: `inset 0 0 0 ${u(2)} ${invalid ? blocks.tangerine : focused ? ground.text : "transparent"}`, transition: "box-shadow .2s",
      }}>
        {icon ? <span style={{ color: focused ? ground.text : ground.muted, transition: "color .2s", display: "flex", width: u(22), justifyContent: "center" }}><Glyph name={icon} size={20} stroke={1.9} /></span> : null}
        <div className="relative flex flex-1 flex-col" style={{ paddingBlock: u(9), minWidth: 0 }}>
          <span style={{ height: u(16) }} />
          <span style={{ minHeight: u(22), fontSize: u(17), lineHeight: u(22), color: ground.text, marginTop: u(1) }}>
            {value || (focused && prompt ? <span style={{ color: ground.subtle }}>{prompt}</span> : null)}
            {focused ? <span data-motion style={{ display: "inline-block", verticalAlign: "top", width: u(2), height: u(22), marginLeft: u(1), background: ground.text, animation: "ff-caret 1s steps(1) infinite" }} /> : null}
          </span>
          <span data-motion className="absolute" style={{
            left: 0, top: floated ? u(9) : "50%", fontSize: u(17), lineHeight: u(22), color: ground.muted, whiteSpace: "nowrap", transformOrigin: "left top",
            transform: floated ? "translateY(0) scale(0.727)" : "translateY(-50%) scale(1)", transition: `top .35s ${spring}, transform .35s ${spring}`,
          }}>{label}</span>
        </div>
        <span data-motion className="flex items-center justify-center rounded-full" style={{ width: u(valid ? 24 : 0), height: u(24), background: blocks.sage, color: ink, opacity: valid ? 1 : 0, transform: `scale(${valid ? 1 : 0.4})`, transition: `transform .35s ${spring}, opacity .2s, width .3s ${ease}`, overflow: "hidden" }}><Glyph name="check" size={13} stroke={3.4} /></span>
        {clear ? <span className="flex items-center justify-center" style={{ width: u(44), height: u(44) }}>
          <span className="flex items-center justify-center rounded-full" style={{ width: u(19), height: u(19), background: ground.muted, color: field }}><Glyph name="xmark" size={14} stroke={3} /></span>
        </span> : null}
      </div>
      <div className="flex items-start" style={{ gap: u(10), paddingInline: u(4), minHeight: u(18) }}>{footer}</div>
    </div>
  );
}

function Message({ error: err, show = false, help }: { error?: string; show?: boolean; help?: string }) {
  return (
    <div className="relative flex-1 overflow-hidden" style={{ fontSize: u(13), lineHeight: u(18) }}>
      <span data-motion className="flex items-center" style={{ gap: u(6), color: ground.text, fontWeight: 600, opacity: show ? 1 : 0, transform: show ? "none" : `translateY(${u(-10)})`, transition: `opacity .3s, transform .35s ${ease}` }}>
        <span className="flex items-center justify-center rounded-full" style={{ width: u(16), height: u(16), background: blocks.tangerine, color: ink }}><Glyph name="bang" size={12} stroke={3.4} /></span>
        {err ?? " "}
      </span>
      <span data-motion className="absolute left-0 top-0" style={{ color: ground.muted, opacity: show ? 0 : 1, transition: "opacity .25s" }}>{help}</span>
    </div>
  );
}

export function FormFieldPreview() {
  const s = useSteps(steps);
  const invalid = s.armed && !isEmail(s.email);
  const valid = s.armed && isEmail(s.email);
  const bio = BIO.slice(0, s.bio);
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes ff-caret{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div className="flex flex-col" style={{ width: u(440), gap: u(16) }}>
        <Field label="Email" value={s.email} prompt="you@example.com" icon="envelope" focused={s.focus === "email"} invalid={invalid} valid={valid}
          footer={<Message error="That doesn't look like an email" show={invalid} help="We send a sign-in link here." />} />
        <Field label="Bio" value={bio} prompt="A line or two about you" focused={s.focus === "bio"}
          footer={<>
            <Message />
            <span style={{ fontSize: u(13), lineHeight: u(18), fontWeight: 600, color: ground.muted, fontVariantNumeric: "tabular-nums" }}>{bio.length}/{LIMIT}</span>
          </>} />
      </div>
    </div>
  );
}
