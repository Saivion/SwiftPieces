"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";
import { curve, ms, t } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Form Field, as the liquid glass piece: the field is a glass shape and everything that appears because of it buds out
 * of it. Typing in the Email field buds the clear bubble out of the field's end; Return on an invalid email is refused,
 * so the field shakes once as the error ring draws and a butter warning bubble buds down out of it with the message a
 * beat behind; the Bio field's counter buds out as it takes focus and rolls while typing; fixing the email melts the
 * warning home, the help text returns, and the sage check blurs in. The component only: no card, heading or invented
 * UI. Sizes are px at the 560 px stage, converted to cqw, and one px there is one iOS point.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** Field height at rest, and the clear bubble's diameter. */
const H = 56;
/** The counter's and the warning bubble's height. */
const PIP = 24;
const gap = liquid.joined;
/** A bubble under the field goes home two points inside the field's bottom edge, clear of its rounded corner. */
const FOOTER_HOME = gap + PIP / 2 + (PIP * liquid.homeScale) / 2 + 2;

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
    const timer = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(timer);
  }, [i, steps, reduced]);
  return steps[i];
}

const glyphs = {
  envelope: "M3.5 6.5h17v11h-17zM4 7l8 6 8-6",
  check: "M5 12.5l4.5 4.5L19 7",
  bang: "M12 6v7.5M12 17.6v.2",
  xmark: "M7 7l10 10M17 7L7 17",
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
/** `submit` is Return in the Email field: it moves focus on, arms validation and is refused if the email is invalid. */
type Step = { email: string; bio: number; focus: Focus; armed: boolean; submit?: boolean; ms: number };

const typeRun = (from: string, to: string, base: Omit<Step, "email" | "ms">, gap = 120): Step[] =>
  Array.from({ length: to.length - from.length }, (_, i) => ({ ...base, email: to.slice(0, from.length + i + 1), ms: gap }));

const steps: readonly Step[] = [
  { email: "", bio: 0, focus: "none", armed: false, ms: 1200 },
  { email: "", bio: 0, focus: "email", armed: false, ms: 1000 },
  ...typeRun("", EMAIL, { bio: 0, focus: "email", armed: false }),
  { email: EMAIL, bio: 0, focus: "email", armed: false, ms: 700 },
  { email: EMAIL, bio: 0, focus: "bio", armed: true, submit: true, ms: 1100 },
  ...Array.from({ length: Math.ceil(BIO.length / 3) }, (_, i) => ({ email: EMAIL, bio: Math.min((i + 1) * 3, BIO.length), focus: "bio" as const, armed: true, ms: 110 })),
  { email: EMAIL, bio: BIO.length, focus: "bio", armed: true, ms: 1100 },
  { email: EMAIL, bio: BIO.length, focus: "email", armed: true, ms: 700 },
  ...typeRun(EMAIL, FIXED, { bio: BIO.length, focus: "email", armed: true }, 150),
  { email: FIXED, bio: BIO.length, focus: "email", armed: true, ms: 1100 },
  { email: FIXED, bio: BIO.length, focus: "none", armed: true, ms: 2600 },
];

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s);

/** A bud's spring: out on `split`, home on the bounceless `home`. */
const budSpring = (out: boolean) => (out ? liquid.split : liquid.home);

/** Help text: blurs away as the warning bubble starts out, and returns only once the bubble is home in the field. */
const helpStyle = (hidden: boolean): CSSProperties => ({
  opacity: hidden ? 0 : 1, filter: `blur(${hidden ? 6 : 0}px)`,
  transition: hidden ? t(["opacity", "filter"], "dismiss") : t(["opacity", "filter"], "reveal", ms(liquid.home) + 40),
});

/**
 * One field and its bubbles, inside its own liquid group: the clear bubble beside the field's end, the warning bubble
 * and the counter under it. State lives in the preview above; this only draws it, so both passes match.
 */
function Field({ label, value, prompt, icon, focused, multiline, invalid, valid, checks, refused, help, error, limit }: {
  label: string; value: string; prompt?: string; icon?: keyof typeof glyphs; focused: boolean; multiline?: boolean;
  invalid?: boolean; valid?: boolean; checks?: boolean; refused?: boolean; help?: string; error?: string; limit?: number;
}) {
  const floated = focused || value.length > 0;
  const clear = focused && value.length > 0;
  const counted = limit !== undefined && floated;
  const warned = !!invalid;
  // While the clear bubble is out the field gives it its end, on the bud's own spring.
  const column = clear ? H + gap : 0;
  const columnMove = t("margin-right", budSpring(clear));
  // The check's slot outlives the check by its exit, so the check blurs out in place before the slot is given back.
  const slotStep = `0ms linear ${checks ? 0 : ms("dismiss")}ms`;
  const atLimit = limit !== undefined && value.length >= limit;
  return (
    <LiquidGroup unit={u(1)} axis="both">
      <div className="flex flex-col" style={{ gap: u(gap) }}>
        {/* A refused submit shakes the field and its clear bubble once; the bubbles under it hold still. */}
        <div data-motion className="relative" style={{ zIndex: 1, animation: refused ? "ff-shake 380ms ease-out" : undefined }}>
          <span className="absolute right-0" style={{ top: multiline ? 0 : `calc(50% - ${u(H / 2)})`, width: u(H), height: u(H) }}>
            <Liquid bud={{ out: clear, home: [(H * (1 - liquid.homeScale)) / 2, 0] }} className="flex items-center justify-center" style={{ width: u(H), height: u(H), color: ground.text }}>
              <BudContent out={clear}><Glyph name="xmark" size={16} stroke={2.6} /></BudContent>
            </Liquid>
          </span>
          <Liquid radius={18} className="relative flex" style={{
            alignItems: multiline ? "flex-start" : "center", minHeight: u(H), paddingInline: u(16), gap: u(10),
            marginRight: u(column), transition: columnMove,
          }}>
            {/* Focus answers on one snap: ring, icon and label together. An error ring lands firm, in butter. It sits a
                few points in from the edge, as in Swift, so the necks to the clear bubble and the counter never cut it. */}
            <span data-motion aria-hidden className="pointer-events-none absolute" style={{
              inset: u(3), borderRadius: u(15), boxShadow: `inset 0 0 0 ${u(2)} ${invalid ? blocks.butter : focused ? ground.text : "transparent"}`,
              transition: t("box-shadow", invalid ? "error" : "snap"),
            }} />
            {icon ? <span style={{ color: focused ? ground.text : ground.muted, transition: t("color", "snap"), display: "flex", width: u(22), justifyContent: "center" }}><Glyph name={icon} size={20} stroke={2.2} /></span> : null}
            <div className="relative flex flex-1 flex-col" style={{ paddingBlock: u(9), minWidth: 0 }}>
              <span style={{ height: u(16) }} />
              <span style={{ minHeight: u(22), fontSize: u(17), lineHeight: u(22), color: ground.text, marginTop: u(1) }}>
                {value || (focused && prompt ? <span style={{ color: ground.subtle }}>{prompt}</span> : null)}
                {focused ? <span data-motion style={{ display: "inline-block", verticalAlign: "top", width: u(2), height: u(22), marginLeft: u(1), background: ground.text, animation: "ff-caret 1s steps(1) infinite" }} /> : null}
              </span>
              {/* At rest the label sits 8.5 below the caption slot, the centre of the empty field; it rises and scales on transform only. */}
              <span data-motion className="absolute" style={{
                left: 0, top: u(9), fontSize: u(17), lineHeight: u(22), color: ground.muted, whiteSpace: "nowrap", transformOrigin: "left top",
                transform: floated ? "translateY(0) scale(0.727)" : `translateY(${u(8.5)}) scale(1)`, transition: t("transform", "snap"),
              }}>{label}</span>
            </div>
            {/* Once validation starts the check keeps its slot while there is text, so nothing reflows as it turns valid.
                A status mark inside the glass, not a control: it blurs in and out like a glyph swap. */}
            <span data-motion className="flex shrink-0 items-center justify-center" style={{
              width: checks ? u(24) : 0, marginLeft: checks ? 0 : u(-10), height: u(24), transition: `width ${slotStep}, margin-left ${slotStep}`,
            }}>
              <span className="flex shrink-0 items-center justify-center rounded-full" style={{
                width: u(24), height: u(24), background: blocks.sage, color: ink,
                opacity: valid ? 1 : 0, filter: `blur(${valid ? 0 : 4}px)`, transform: `scale(${valid ? 1 : 0.8})`,
                transition: t(["transform", "opacity", "filter"], valid ? "snap" : "dismiss"),
              }}><Glyph name="check" size={13} stroke={3} /></span>
            </span>
          </Liquid>
        </div>
        {/* The footer: warning bubble and message or help on the leading side, the counter under the field's end. */}
        <div data-motion className="flex items-start" style={{ gap: u(10), paddingLeft: u(4), paddingRight: `calc(${u(4)} + ${u(limit !== undefined ? column : 0)})`, transition: t("padding-right", budSpring(clear)), minHeight: u(PIP) }}>
          <div className="relative flex-1" style={{ minHeight: u(PIP), fontSize: u(13), lineHeight: u(18) }}>
            {error ? (
              <div className="flex items-center" style={{ gap: u(8), minHeight: u(PIP) }}>
                <span className="relative shrink-0" style={{ width: u(PIP), height: u(PIP) }}>
                  {/* Its tint drains as it melts, so it dissolves into the field rather than sitting on it. */}
                  <Liquid tint={warned ? blocks.butter : undefined} bud={{ out: warned, home: [0, -FOOTER_HOME] }} className="flex items-center justify-center" style={{ width: u(PIP), height: u(PIP), color: ink }}>
                    <BudContent out={warned}><Glyph name="bang" size={13} stroke={3.2} /></BudContent>
                  </Liquid>
                </span>
                <BudContent out={warned}><span style={{ color: ground.text }}>{error}</span></BudContent>
              </div>
            ) : null}
            {help ? <span data-motion className="absolute left-0" style={{ top: u(3), color: ground.muted, ...helpStyle(warned) }}>{help}</span> : null}
          </div>
          {limit !== undefined ? (
            <Liquid tint={atLimit && counted ? blocks.butter : undefined} bud={{ out: counted, home: [0, -FOOTER_HOME] }} className="flex shrink-0 items-center tabular-nums" style={{
              height: u(PIP), paddingInline: u(9), fontSize: u(13), lineHeight: u(18), whiteSpace: "nowrap", color: atLimit ? ink : ground.muted,
            }}>
              <BudContent out={counted}><Count value={Math.min(value.length, limit)} />/{limit}</BudContent>
            </Liquid>
          ) : null}
        </div>
      </div>
    </LiquidGroup>
  );
}

/** A count people read: changed digits roll into place without overshoot, so it never shows a number that isn't true.
 *  Like `.numericText(value:)` the roll takes its direction from the value: a rise comes up from below, a fall drops
 *  in from above, and nothing rolls on first appearance. */
function Count({ value }: { value: number }) {
  const prev = useRef<number | null>(null);
  useEffect(() => { prev.current = value; }, [value]);
  const last = prev.current;
  const roll = curve("value");
  const animation = last === null || last === value ? undefined : `${value > last ? "ff-roll-up" : "ff-roll-down"} ${roll.ms}ms ${roll.easing} both`;
  const digits = String(value).split("");
  return (
    <>
      {digits.map((d, i) => <Digit key={`${digits.length - i}:${d}`} d={d} animation={animation} />)}
    </>
  );
}

/** The roll is fixed when the digit mounts, so a digit that stays put never replays when the direction flips. */
function Digit({ d, animation }: { d: string; animation?: string }) {
  const [roll] = useState(animation);
  return <span data-motion style={{ display: "inline-block", animation: roll }}>{d}</span>;
}

/** The decaying knock of `pieceShake`: one firm push and three smaller returns, no wobble after. */
const shakeKeyframes = `@keyframes ff-shake{0%{transform:none}20%{transform:translateX(${u(-8)})}40%{transform:translateX(${u(6)})}60%{transform:translateX(${u(-4)})}80%{transform:translateX(${u(2)})}100%{transform:none}}`;

export function FormFieldPreview() {
  const s = useSteps(steps);
  const invalid = s.armed && !isEmail(s.email);
  const valid = s.armed && isEmail(s.email);
  const bio = BIO.slice(0, s.bio);
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      <style>{`${shakeKeyframes}@keyframes ff-caret{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes ff-roll-up{from{transform:translateY(40%) scale(.8);opacity:.35;filter:blur(${u(1)})}to{transform:none;opacity:1;filter:none}}@keyframes ff-roll-down{from{transform:translateY(-40%) scale(.8);opacity:.35;filter:blur(${u(1)})}to{transform:none;opacity:1;filter:none}}`}</style>
      <div className="flex flex-col" style={{ width: u(440), gap: u(16) }}>
        <Field label="Email" value={s.email} prompt="you@example.com" icon="envelope" focused={s.focus === "email"} invalid={invalid} valid={valid}
          checks={s.armed && s.email.length > 0} refused={!!s.submit && invalid}
          error="That doesn't look like an email" help="We send a sign-in link here." />
        <Field label="Bio" value={bio} prompt="A line or two about you" focused={s.focus === "bio"} multiline limit={LIMIT} />
      </div>
    </div>
  );
}
