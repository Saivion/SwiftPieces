"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BlockCanvas, bu } from "./canvas";
import { blocks, font, ground, groundHex, ink, signal } from "../palette";
import { pop, pressScale, shake, t } from "../piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "../piece-liquid";

/*
 * Sign In, as the SignInBlock example draws it: Folio's mark, the welcome heading, the email FormField, the password
 * SecureEntry with its Forgot password link on the caption line, the CommitButton, and Sign in with Apple under an
 * "or" divider. The block is a little taller than the 600 pt stage, so the preview stops at the Apple button and
 * leaves out the Create account footer under it.
 *
 * The loop: the designed rest state, then the email takes focus (its label floats up) and is typed in, with the clear
 * bubble out; Return hands focus to the password, and the email, edited and left, validates with its sage check; the
 * password fills with dots; Sign in is pressed, the capsule draws in around its label as the ring bubble buds out, the
 * ring closes sage and the label becomes "Signed in". The next cycle tries a short password: the button turns butter
 * with the message and a retry bubble, the password field takes the butter tint and buds its error chip, and both shake.
 * Reduced motion holds the rest state.
 */

const W = 350;
/** Field and button height, and the round bubbles' diameter. */
const H = 56;
const EMAIL = "maya@example.com";
const MESSAGE = "Wrong email or password";
/** The password's error chip: footnote text with 7 pt above and below it. */
const CHIP_H = 32;
const COMMIT_PRESS = pressScale(W, H);
const BUTTON_PAD = 28;

type Focus = "none" | "email" | "password";
type Phase = "idle" | "press" | "loading" | "closed" | "check" | "done" | "error";
type Step = { email: string; dots: number; focus: Focus; armed: boolean; phase: Phase; ms: number };

/** One attempt, from rest: type the email, Return to the password, type it, press Sign in, and land `outcome`. */
function attempt(length: number, outcome: "done" | "error"): Step[] {
  const rest: Step = { email: "", dots: 0, focus: "none", armed: false, phase: "idle", ms: 1400 };
  const typed = { ...rest, email: EMAIL, armed: true, dots: length };
  return [
    rest,
    { ...rest, focus: "email", ms: 520 },
    ...Array.from({ length: EMAIL.length }, (_, i) => ({ ...rest, focus: "email" as const, email: EMAIL.slice(0, i + 1), ms: 70 })),
    { ...rest, focus: "email", email: EMAIL, ms: 520 },
    // Return: focus moves on, and the email, edited and left, validates.
    { ...rest, focus: "password", email: EMAIL, armed: true, ms: 480 },
    ...Array.from({ length }, (_, i) => ({ ...typed, focus: "password" as const, dots: i + 1, ms: 85 })),
    { ...typed, focus: "password", ms: 560 },
    { ...typed, focus: "password", phase: "press", ms: 150 },
    { ...typed, phase: "loading", ms: 1300 },
    ...(outcome === "done"
      ? [{ ...typed, phase: "closed" as const, ms: 300 }, { ...typed, phase: "check" as const, ms: 580 }, { ...typed, phase: "done" as const, ms: 1700 }]
      : [{ ...typed, phase: "error" as const, ms: 2600 }]),
  ];
}

const steps: readonly Step[] = [...attempt(12, "done"), ...attempt(5, "error")];

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

/** Walks the script; each step holds for its `ms`, then loops. Holds the rest state under reduced motion. */
function useSteps(list: readonly Step[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % list.length), list[i].ms);
    return () => clearTimeout(timer);
  }, [i, list, reduced]);
  return list[i];
}

const glyphs = {
  envelope: "M3.5 6.5h17v11h-17zM4 7l8 6 8-6",
  check: "M5 12.5l4.5 4.5L19 7",
  xmark: "M7 7l10 10M17 7L7 17",
  bang: "M12 6v7.5M12 17.6v.2",
  eye: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z",
  retry: "M18.6 13.2A6.8 6.8 0 1 1 16.4 7.2M17.2 3.6v3.9h-3.9",
} as const;

function Glyph({ name, size, stroke = 2.2, style }: { name: keyof typeof glyphs; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: bu(size), height: bu(size), flexShrink: 0, ...style }}>
      <path d={glyphs[name]} />
    </svg>
  );
}

/** Folio's mark, as the Swift example draws it: a cream ribbon hanging into an ink tile, 52 pt with a hairline. */
function Mark() {
  return (
    <span className="relative block overflow-hidden" style={{ width: bu(52), height: bu(52), borderRadius: bu(12), background: ink }}>
      <svg aria-hidden viewBox="0 0 156 156" className="absolute inset-0 h-full w-full">
        <path d="M54.6 0H101.4V112.3L78 93.6L54.6 112.3Z" fill={groundHex.text} />
      </svg>
      <span className="absolute inset-0" style={{ borderRadius: bu(12), boxShadow: `inset 0 0 0 ${bu(1)} ${ground.line}` }} />
    </span>
  );
}

/** The email FormField: a glass field with its icon and floating label, the clear bubble out of its end while typing,
 *  and the sage check once it has been edited and left with a valid address. */
function EmailField({ value, focused, armed }: { value: string; focused: boolean; armed: boolean }) {
  const floated = focused || value.length > 0;
  const clear = focused && value.length > 0;
  const checks = armed && value.length > 0;
  const valid = checks && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value);
  const column = clear ? H + liquid.joined : 0;
  return (
    <LiquidGroup unit={bu(1)} axis="both">
      <div className="relative" style={{ height: bu(H), zIndex: 1 }}>
        <span className="absolute right-0 top-0" style={{ width: bu(H), height: bu(H) }}>
          <Liquid bud={{ out: clear, home: [(H * (1 - liquid.homeScale)) / 2, 0] }} className="flex items-center justify-center" style={{ width: bu(H), height: bu(H), color: ground.text }}>
            <BudContent out={clear}><Glyph name="xmark" size={16} stroke={2.6} /></BudContent>
          </Liquid>
        </span>
        <Liquid radius={18} className="relative flex items-center" style={{
          height: bu(H), paddingInline: bu(16), gap: bu(10), marginRight: bu(column), transition: t("margin-right", clear ? liquid.split : liquid.home),
        }}>
          {/* Focus answers on one snap: ring, icon and label together. */}
          <span data-motion aria-hidden className="pointer-events-none absolute" style={{
            inset: bu(3), borderRadius: bu(15), boxShadow: `inset 0 0 0 ${bu(2)} ${focused ? ground.text : "transparent"}`, transition: t("box-shadow", "snap"),
          }} />
          <span data-motion className="flex justify-center" style={{ width: bu(22), color: focused ? ground.text : ground.muted, transition: t("color", "snap") }}>
            <Glyph name="envelope" size={24} stroke={1.9} />
          </span>
          <div className="relative flex min-w-0 flex-1 flex-col" style={{ paddingBlock: bu(9) }}>
            <span style={{ height: bu(16) }} />
            <span className="whitespace-nowrap" style={{ height: bu(22), fontSize: bu(17), lineHeight: bu(22), color: ground.text, marginTop: bu(1) }}>
              {value || (focused ? <span style={{ color: ground.subtle }}>you@example.com</span> : null)}
              {focused ? <span data-motion style={{ display: "inline-block", verticalAlign: "top", width: bu(2), height: bu(22), marginLeft: bu(1), background: ground.text, animation: "si-caret 1s steps(1) infinite" }} /> : null}
            </span>
            {/* At rest the label sits in the middle of the empty field; it rises and scales into the caption slot. */}
            <span data-motion className="absolute left-0 whitespace-nowrap" style={{
              top: bu(9), fontSize: bu(17), lineHeight: bu(22), color: ground.muted, transformOrigin: "left top",
              transform: floated ? "translateY(0) scale(0.727)" : `translateY(${bu(8.5)}) scale(1)`, transition: t("transform", "snap"),
            }}>Email</span>
          </div>
          {/* The check keeps its slot while the field has text once validation has started. */}
          <span className="flex shrink-0 items-center justify-center" style={{ width: checks ? bu(24) : 0, marginLeft: checks ? 0 : bu(-10), height: bu(24) }}>
            <span data-motion className="flex shrink-0 items-center justify-center rounded-full" style={{
              width: bu(24), height: bu(24), background: blocks.sage, color: ink,
              opacity: valid ? 1 : 0, filter: `blur(${valid ? 0 : 4}px)`, transform: `scale(${valid ? 1 : 0.8})`,
              transition: t(["transform", "opacity", "filter"], valid ? "snap" : "dismiss"),
            }}><Glyph name="check" size={13} stroke={3} /></span>
          </span>
        </Liquid>
      </div>
    </LiquidGroup>
  );
}

/** A bubble whose home is straight up inside the field, `rise` above its place, as SecureEntry buds its error chip. */
const budUp = (out: boolean, rise: number): CSSProperties => ({
  transform: `translateY(${bu(out ? 0 : -rise)}) scale(${out ? 1 : liquid.homeScale})`,
  visibility: out ? "visible" : "hidden",
  transition: `${t("transform", out ? liquid.split : liquid.home)}, visibility 0s linear ${out ? 0 : 520}ms, ${t("background-color", out ? "error" : "dismiss")}`,
});

/** The password SecureEntry, set up for signing in: caption, glass field and reveal bubble, and the error chip that
 *  buds out under the field. The Forgot password link sits on the caption's line. */
function PasswordField({ dots, focused, error }: { dots: number; focused: boolean; error: boolean }) {
  const row = useRef<HTMLDivElement>(null);
  // A new error shakes the field and its reveal bubble once; the chip under them holds still.
  useEffect(() => {
    if (!error || !row.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = row.current.animate(...shake(bu, 8));
    return () => a.cancel();
  }, [error]);
  const inked = error ? ink : ground.text;
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between" style={{ height: bu(16), lineHeight: bu(16) }}>
        <span style={{ fontSize: bu(12), letterSpacing: bu(0.8), color: ground.muted }}>PASSWORD</span>
        <span style={{ fontSize: bu(13), color: ground.text }}>Forgot password?</span>
      </div>
      <LiquidGroup unit={bu(1)} axis="both" style={{ marginTop: bu(10) }}>
        <div ref={row} data-motion className="relative flex" style={{ gap: bu(liquid.joined), height: bu(H), zIndex: 1 }}>
          <Liquid radius={18} tint={error ? blocks.butter : undefined} className="relative flex flex-1 items-center" style={{ paddingInline: bu(18), transition: t("background-color", error ? "error" : "dismiss") }}>
            <span className="flex items-center" style={{ gap: bu(3.6), color: inked }}>
              {dots === 0 && !focused ? <span style={{ fontSize: bu(17), color: ground.subtle }}>Password</span> : null}
              {Array.from({ length: dots }, (_, i) => <span key={i} className="rounded-full" style={{ width: bu(7), height: bu(7), background: "currentColor" }} />)}
              {focused ? <span data-motion style={{ width: bu(2), height: bu(22), marginLeft: bu(1), background: "currentColor", animation: "si-caret 1s steps(1) infinite" }} /> : null}
            </span>
            <span data-motion aria-hidden className="pointer-events-none absolute" style={{ inset: bu(3), borderRadius: bu(15), boxShadow: `inset 0 0 0 ${bu(2)} ${inked}`, opacity: focused ? 1 : 0, transition: t("opacity", "snap") }} />
          </Liquid>
          <Liquid className="flex shrink-0 items-center justify-center" style={{ width: bu(H), height: bu(H), color: ground.text }}>
            <Glyph name="eye" size={22} stroke={2} />
          </Liquid>
        </div>
        {/* The chip's room opens as it buds out of the field and closes as it melts home, on the same springs. */}
        <div data-motion className="relative" style={{ height: bu(error ? liquid.joined + CHIP_H : 0), transition: t("height", error ? liquid.split : liquid.home) }}>
          <Liquid tint={error ? blocks.butter : undefined} className="absolute left-0 inline-flex items-center whitespace-nowrap" style={{
            ...budUp(error, liquid.joined + CHIP_H / 2 + (CHIP_H * liquid.homeScale) / 2), top: bu(liquid.joined), height: bu(CHIP_H), paddingInline: bu(12),
            color: ink, fontSize: bu(13),
          }}>
            <BudContent out={error}><span className="flex items-center" style={{ gap: bu(6) }}><Glyph name="bang" size={12} stroke={3.2} />{MESSAGE}</span></BudContent>
          </Liquid>
        </div>
      </LiquidGroup>
    </div>
  );
}

/** The CommitButton: signal glass that draws in around "Sign in" as the ring bubble buds out, closes sage and becomes
 *  "Signed in", or turns butter with the message and a retry bubble. */
function SignInButton({ phase }: { phase: Phase }) {
  const shaker = useRef<HTMLDivElement>(null), popper = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null), probe = useRef<HTMLSpanElement>(null);
  // The idle label's width in points, so the capsule can draw in around it exactly.
  const [labelWidth, setLabelWidth] = useState(56);
  useLayoutEffect(() => {
    const m = measure.current, p = probe.current;
    if (m && p && p.offsetWidth > 0) setLabelWidth(m.offsetWidth / (p.offsetWidth / 100));
  }, []);
  const working = phase === "loading" || phase === "closed" || phase === "check";
  const success = phase === "closed" || phase === "check" || phase === "done";
  const failed = phase === "error", pressed = phase === "press", landed = phase === "check" || phase === "done";
  const out = working || failed;
  const tint = failed ? blocks.butter : success ? blocks.sage : signal.fill;
  const bubbleTint = !out ? undefined : failed ? blocks.butter : success ? blocks.sage : undefined;
  const slot = out ? H + liquid.joined : 0;
  const width = working ? labelWidth + BUTTON_PAD * 2 : W - slot;
  const label = phase === "done" ? "Signed in" : failed ? MESSAGE : "Sign in";

  useEffect(() => {
    if (phase !== "check" || !popper.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = popper.current.animate(...pop());
    return () => a.cancel();
  }, [phase]);
  // The capsule opens back out and the bubble turns into the retry, then the shake lands on the error's beat.
  useEffect(() => {
    if (!failed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let a: Animation | undefined;
    const id = setTimeout(() => { a = shaker.current?.animate(...shake(bu, 10)); }, 140);
    return () => { clearTimeout(id); a?.cancel(); };
  }, [failed]);

  const C = 2 * Math.PI * 10;
  return (
    <div ref={shaker} data-motion className="relative flex justify-center" style={{ width: bu(W) }}>
      <span ref={measure} aria-hidden className="pointer-events-none absolute whitespace-pre" style={{ visibility: "hidden", fontSize: bu(17) }}>Sign in</span>
      <span ref={probe} aria-hidden className="pointer-events-none absolute" style={{ visibility: "hidden", width: bu(100), height: 0 }} />
      <div data-motion style={{ transform: pressed ? `scale(${COMMIT_PRESS})` : "none", transition: t("transform", pressed ? "press" : "release") }}>
        <LiquidGroup unit={bu(1)}>
          <div className="flex items-center" style={{ height: bu(H) }}>
            <Liquid tint={tint} className="relative flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap" style={{
              zIndex: 1, width: bu(width), height: bu(H), gap: bu(8), color: ink, fontSize: bu(17), transition: t(["width", "background-color"], "morph"),
            }}>
              <span data-motion className="absolute inset-0 rounded-full" style={{ background: "#000", opacity: pressed ? 0.1 : 0, transition: t("opacity", pressed ? "press" : "release") }} />
              {phase === "done" ? <span key="check" className="pv-lq-in relative"><Glyph name="check" size={17} stroke={2.8} /></span> : null}
              <MorphText text={label} className="relative" />
            </Liquid>
            <div data-motion className="relative shrink-0" style={{ width: bu(slot), height: bu(H), transition: t("width", out ? liquid.split : liquid.home) }}>
              <Liquid tint={bubbleTint} bud={{ out, home: [0, 0] }} className="absolute right-0 top-0 grid place-items-center" style={{ width: bu(H), height: bu(H), color: ink, transition: t("background-color", "morph") }}>
                <BudContent out={out}>
                  {failed ? (
                    <span key="retry" className="pv-lq-in"><Glyph name="retry" size={18} stroke={2.6} /></span>
                  ) : (
                    <span key="ring" ref={popper} data-motion className="grid place-items-center">
                      <svg viewBox="0 0 26 26" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: bu(H * 0.46), height: bu(H * 0.46) }} aria-hidden>
                        <circle data-motion cx="13" cy="13" r="10" stroke={success ? ink : ground.text} opacity={success ? 0.22 : 0.14} style={{ transition: t("stroke", "morph") }} />
                        <g data-motion style={{ transformBox: "fill-box", transformOrigin: "center", animation: phase === "loading" ? "si-spin 1s linear infinite" : undefined }}>
                          <circle data-motion cx="13" cy="13" r="10" stroke={success ? ink : signal.fill} strokeDasharray={C} style={{
                            strokeDashoffset: success ? 0 : C * 0.72, transformBox: "fill-box", transformOrigin: "center", transform: "rotate(-90deg)",
                            transition: `${t("stroke-dashoffset", success ? "morph" : "dismiss")}, ${t("stroke", "morph")}`,
                          }} />
                        </g>
                        <path data-motion d="M8.4 13.6l3.2 3.2 6-6.6" stroke={ink} pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: landed ? 0 : 1, transition: t("stroke-dashoffset", landed ? "reveal" : "dismiss") }} />
                      </svg>
                    </span>
                  )}
                </BudContent>
              </Liquid>
            </div>
          </div>
        </LiquidGroup>
      </div>
    </div>
  );
}

/** Sign in with Apple, in the colour that reads on the ground: dark on paper, light on the dark stage. */
function AppleButton() {
  return (
    <div className="flex items-center justify-center rounded-full" style={{ height: bu(H), gap: bu(6), background: ground.text, color: ground.bg, fontSize: bu(20) }}>
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: bu(19), height: bu(19), marginTop: bu(-3) }} fill="currentColor">
        <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8ZM14.1 5.9c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3Z" />
      </svg>
      Sign in with Apple
    </div>
  );
}

export function SignInBlockPreview() {
  const s = useSteps(steps);
  return (
    <div className="absolute inset-0" style={{ background: ground.bg, fontFamily: font.stack, fontWeight: 600, color: ground.text }}>
      <style>{"@keyframes si-caret{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes si-spin{to{transform:rotate(360deg)}}"}</style>
      <BlockCanvas style={{ paddingTop: bu(30) }}>
        <Mark />
        <h3 style={{ marginTop: bu(20), fontSize: bu(32), lineHeight: bu(38), letterSpacing: bu(-0.6), fontWeight: 600 }}>Welcome back</h3>
        <p style={{ marginTop: bu(6), fontSize: bu(17), lineHeight: bu(22), color: ground.muted }}>Sign in to sync your shelves and notes.</p>
        <div className="flex flex-col" style={{ marginTop: bu(28), gap: bu(24) }}>
          <EmailField value={s.email} focused={s.focus === "email"} armed={s.armed} />
          <PasswordField dots={s.dots} focused={s.focus === "password"} error={s.phase === "error"} />
          <SignInButton phase={s.phase} />
        </div>
        <div className="flex items-center" style={{ marginTop: bu(22), gap: bu(12), height: bu(16) }}>
          <span className="flex-1" style={{ height: bu(1), background: ground.line }} />
          <span style={{ fontSize: bu(13), color: ground.muted }}>or</span>
          <span className="flex-1" style={{ height: bu(1), background: ground.line }} />
        </div>
        <div style={{ marginTop: bu(20) }}><AppleButton /></div>
      </BlockCanvas>
    </div>
  );
}
