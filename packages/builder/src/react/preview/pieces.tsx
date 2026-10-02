"use client";
// Web renderers for the free SwiftPieces components, painted with the pieces' own house palette
// (the values their Swift `Style` defaults use). Loaded as a separate chunk the first time a screen
// contains a piece. Each one behaves like its Swift source: the resting state matches what the
// export starts in, and taps, holds, scrubs and typing run the same motion and haptics the app does.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { house, houseBlocks } from "../../core/palette.js";
import { list } from "../../core/swift.js";
import { dockSymbol, parseSlices } from "../../definitions/pieces.js";
import { Glyph } from "../icons.js";
import { Frame, b, buttonLook, fillStyle, font, houseVar, n, s, useAxis, useTheme, type Renderer, type RenderProps, cr, fw, ts, ACCENT, inkOn } from "./env.js";
import { injectStyle, reducedMotion, usePress } from "./primitives.js";
import { BOUNCE, SPRING, useDrag, useLive, useRuntime, useTap, type HapticKind } from "./runtime.js";

const INK = house.ink;
const SIGNAL = ACCENT;
/** The look's accent where the Swift takes `tint: Theme.accent`; the house signal without a look. */
const ACCENT_INK = `var(--spb-accent-ink, ${house.ink})`;
const B: Record<string, string> = { ...house.blocks, tangerine: ACCENT };
const semibold: CSSProperties = { fontSize: ts(17), fontWeight: fw(600), lineHeight: "22px" };
const capsule = (h: number): CSSProperties => ({ height: h, borderRadius: cr(h / 2), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 });

injectStyle(
  "spb-pieces-css",
  `.spb-hin{flex:1;min-width:0;border:0;outline:0;padding:0;margin:0;background:transparent;font:inherit;color:var(--h-text);caret-color:${ACCENT};-webkit-appearance:none;appearance:none}
.spb-hin::placeholder{color:var(--h-muted);opacity:1}
@keyframes spb-pop{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes spb-rise{from{transform:translateY(40%);opacity:0}to{transform:none;opacity:1}}
@keyframes spb-roll-up{from{transform:translateY(55%);opacity:0}to{transform:none;opacity:1}}
@keyframes spb-roll-down{from{transform:translateY(-55%);opacity:0}to{transform:none;opacity:1}}
@keyframes spb-shake{0%,100%{transform:none}20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
@keyframes spb-burst{from{transform:translate(-50%,-50%) scale(1);opacity:1}to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.3);opacity:0}}
@keyframes spb-float{0%{transform:translate(-50%,6px) scale(.8);opacity:0}18%{transform:translate(-50%,0) scale(1);opacity:1}75%{transform:translate(-50%,-6px);opacity:1}100%{transform:translate(-50%,-16px);opacity:0}}
@keyframes spb-word-rise{from{transform:translateY(.45em);opacity:0}to{transform:none;opacity:1}}
@keyframes spb-word-blur{from{filter:blur(10px);opacity:0}to{filter:none;opacity:1}}
@keyframes spb-word-soften{from{transform:scale(.92);opacity:0}to{transform:none;opacity:1}}
.spb-pop{animation:spb-pop .38s ${BOUNCE} both}
.spb-rise{animation:spb-rise .3s ${SPRING} both}
@media (prefers-reduced-motion: reduce){.spb-pop,.spb-rise,.spb-anim{animation:none!important}.spb-anim,.spb-anim *{transition:none!important}}`,
);

function Root({ r, style, children, ...rest }: { r: RenderProps; style?: CSSProperties; children?: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">) {
  const axis = useAxis();
  return <div {...r.box} {...rest} style={{ ...r.box.style, ...style, ...fillStyle(r.fill, axis) }}>{children}</div>;
}

const fmt = (v: number, currency: boolean, code = "USD") =>
  new Intl.NumberFormat("en-US", currency ? { style: "currency", currency: code } : { maximumFractionDigits: 2 }).format(v);

/** A formatted figure with its decimals dimmed, as LiveStat and Odometer draw them. */
function Figure({ text, dim }: { text: string; dim: string }) {
  const i = text.lastIndexOf(".");
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span style={{ color: dim }}>{text.slice(i)}</span></>;
}

/** Timeouts that die with the component, so a sequence never fires into an unmounted piece. */
function useTimers() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach((id) => window.clearTimeout(id)), []);
  return useCallback((fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
}

/** The haptic function, bound to the element it happened on. */
function useHaptic() {
  const { haptic } = useRuntime();
  return useCallback((kind: HapticKind, el?: Element | null) => haptic(kind, el ?? null), [haptic]);
}

// ---------------------------------------------------------------- Controls

const ElasticButton: Renderer = (r) => {
  const { p } = r;
  const theme = useTheme();
  const disabled = b(p, "disabled");
  const style = s(p, "style");
  // Raised is the quiet secondary action: a light wash of the accent with accent text (as iOS tints a
  // bordered button), so it follows Style like the primary one.
  // Style → Buttons: the primary (signal) style as solid, tinted, outline or glass.
  const look = buttonLook(style === "signal" ? theme?.buttons : "solid");
  const fillColor = style === "signal" ? look.fill : style === "raised" ? `color-mix(in srgb, ${ACCENT} 14%, ${houseVar("surface")})` : style.startsWith("block:") ? B[style.slice(6)] : "transparent";
  const ink = style === "raised" ? ACCENT : style === "standard" ? houseVar("text") : style === "signal" ? look.ink : B[style.slice(6)] === ACCENT ? ACCENT_INK : INK;
  const ic = s(p, "icon");
  const trailing = s(p, "iconPosition") === "trailing";
  const squash = n(p, "squash") || 0.96;
  // Bounce 0…0.6 becomes the overshoot of the release curve.
  const press = usePress(disabled, squash, `cubic-bezier(.34, ${(1 + n(p, "bounce") * 2).toFixed(2)}, .64, 1)`);
  const haptic = useHaptic();
  const tap = useTap(p.link, null);
  const lift = (style === "signal" && look.lift) || style.startsWith("block:");
  return (
    <Root
      r={r}
      {...press.bind}
      role="button"
      aria-disabled={disabled || undefined}
      onPointerDown={(e) => {
        press.bind.onPointerDown?.(e);
        if (!disabled && e.button === 0) haptic("medium", e.currentTarget);
      }}
      onClick={disabled ? undefined : (e) => tap(e)}
      style={{
        ...capsule(theme?.buttonHeight ?? 56), padding: "0 24px", background: fillColor, color: ink, ...semibold, opacity: disabled ? 0.45 : 1,
        boxShadow: [style === "signal" ? look.edge : "", lift ? (press.pressed ? "0 2px 0 -2px rgba(0,0,0,.18)" : "0 6px 0 -2px rgba(0,0,0,.18)") : "", press.pressed ? "inset 0 0 0 999px rgba(0,0,0,.08)" : ""].filter(Boolean).join(", ") || undefined,
        ...(style === "signal" && look.blur ? { backdropFilter: look.blur, WebkitBackdropFilter: look.blur } : {}),
        ...press.style,
        // A squash, not a shrink: wider than it is tall while pressed.
        transform: press.pressed ? `scale(${(1 - (1 - squash) * 0.55).toFixed(3)}, ${squash})` : undefined,
      }}
    >
      {ic !== "none" && !trailing ? <Glyph name={ic} size={19} /> : null}
      {s(p, "title")}
      {ic !== "none" && trailing ? <Glyph name={ic} size={19} /> : null}
    </Root>
  );
};

const CommitButton: Renderer = (r) => {
  const theme = useTheme();
  const [phase, setPhase] = useLive(s(r.p, "phase"));
  const later = useTimers();
  const haptic = useHaptic();
  const { act } = useRuntime();
  const link = s(r.p, "link");
  const press = usePress(phase === "loading" || phase === "disabled" || phase === "success");
  const ref = useRef<HTMLDivElement>(null);
  const run = (el: Element) => {
    if (phase !== "idle" && phase !== "error") return;
    haptic("soft", el);
    setPhase("loading");
    later(() => {
      setPhase("success");
      haptic("success", el);
    }, 1100);
    // A link moves on once the success has shown (the Swift waits the same 0.6 s).
    if (link) later(() => act(link), 1700);
    later(() => setPhase("idle"), 2900);
  };
  // An error arrives with a shake.
  useEffect(() => {
    if (phase !== "error" || !ref.current || reducedMotion()) return;
    const a = ref.current.animate?.([-10, 9, -6, 5, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 360, easing: "ease-in-out" });
    return () => a?.cancel();
  }, [phase]);
  const collapsed = phase === "loading";
  const look = buttonLook(theme?.buttons);
  const map: Record<string, { bg: string; ink: string; label: ReactNode }> = {
    idle: { bg: look.fill, ink: look.ink, label: s(r.p, "title") },
    loading: { bg: look.fill, ink: look.ink, label: <span className="spb-spinner" style={{ color: look.ink }} /> },
    success: { bg: B.sage, ink: INK, label: <><Glyph name="checkmark" size={18} strokeWidth={2.4} />{s(r.p, "successTitle") || s(r.p, "title")}</> },
    error: { bg: B.butter, ink: INK, label: <><Glyph name="xmark" size={16} strokeWidth={2.4} />{s(r.p, "errorMessage")}</> },
    disabled: { bg: houseVar("raised"), ink: houseVar("muted"), label: s(r.p, "title") },
  };
  const m = map[phase] ?? map.idle;
  return (
    <Root r={r} style={{ display: "flex", justifyContent: "center" }}>
      <div
        ref={ref}
        {...press.bind}
        role="button"
        aria-busy={collapsed || undefined}
        onClick={(e) => run(e.currentTarget)}
        className="spb-anim"
        style={{
          ...capsule(theme?.buttonHeight ?? 56), width: collapsed ? (theme?.buttonHeight ?? 56) : "100%", overflow: "hidden", whiteSpace: "nowrap", background: m.bg, color: m.ink, ...semibold,
          ...(phase === "idle" || phase === "loading" ? { boxShadow: look.edge || undefined, ...(look.blur ? { backdropFilter: look.blur, WebkitBackdropFilter: look.blur } : {}) } : {}),
          ...press.style,
          transition: `width .42s ${SPRING}, background-color .3s ease, ${press.style.transition}`,
        }}
      >
        <span key={phase} className="spb-rise" style={{ display: "flex", alignItems: "center", gap: 8 }}>{m.label}</span>
      </div>
    </Root>
  );
};

const HoldToConfirm: Renderer = (r) => {
  const fill = s(r.p, "style") === "butter" ? B.butter : ACCENT;
  const duration = Math.max(0.3, n(r.p, "duration") || 1.2) * 1000;
  const [pct, setPct] = useState(0);
  const [held, setHeld] = useState(false);
  const [done, setDone] = useState(false);
  const [rewinding, setRewinding] = useState(false);
  const haptic = useHaptic();
  const later = useTimers();
  const frame = useRef(0);
  const el = useRef<Element | null>(null);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const start = (target: Element) => {
    if (done) return;
    el.current = target;
    setHeld(true);
    setRewinding(false);
    const t0 = performance.now() - pct * duration;
    let passed = Math.floor(pct * 4);
    const step = () => {
      const v = Math.min(1, (performance.now() - t0) / duration);
      setPct(v);
      // Milestone ticks at each quarter, then the commit.
      const q = Math.floor(v * 4);
      if (q > passed && q < 4) {
        passed = q;
        haptic("soft", el.current);
      }
      if (v >= 1) {
        setHeld(false);
        setDone(true);
        haptic("success", el.current);
        later(() => {
          setDone(false);
          setRewinding(true);
          setPct(0);
        }, 1800);
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };
  const stop = () => {
    if (!held) return;
    cancelAnimationFrame(frame.current);
    setHeld(false);
    if (!done) {
      setRewinding(true);
      setPct(0);
    }
  };
  const tone = done ? B.sage : fill;
  const width = done ? "100%" : pct > 0 ? `calc(60px + (100% - 60px) * ${pct.toFixed(4)})` : "0px";
  const layer = (on: boolean) => (
    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: 6, color: on ? INK : houseVar("text") }}>
      <span style={{ width: 48, height: 48, borderRadius: cr("50%"), background: on ? INK : fill, color: on ? tone : INK, display: "grid", placeItems: "center", flex: "none", transition: "background-color .3s" }}>
        {done ? <Glyph name="checkmark" size={20} strokeWidth={2.6} /> : s(r.p, "icon") !== "none" ? <Glyph name={s(r.p, "icon")} size={20} /> : null}
      </span>
      <span key={done ? "d" : "t"} className={done ? "spb-rise" : undefined} style={{ flex: 1, textAlign: "center", paddingRight: 48 }}>{done ? s(r.p, "committedTitle") || s(r.p, "title") : s(r.p, "title")}</span>
    </span>
  );
  const transition = rewinding ? `.55s ${SPRING}` : "0s";
  return (
    <Root
      r={r}
      role="button"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        start(e.currentTarget);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={`${r.box.className} spb-anim`}
      style={{ ...capsule(60), justifyContent: "flex-start", padding: 6, background: houseVar("raised"), color: houseVar("text"), position: "relative", overflow: "hidden", ...semibold, cursor: "pointer", userSelect: "none", touchAction: "none", transform: held ? "scale(.98)" : undefined, transition: `transform .3s ${SPRING}` }}
    >
      {/* The resting layout, unchanged: puck, centered title, three milestone dots. */}
      <span style={{ width: 48, height: 48, flex: "none" }} />
      <span style={{ flex: 1 }} />
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width, borderRadius: cr(999), background: tone, transition: `width ${transition}, background-color .35s ease` }} />
      {layer(false)}
      <span style={{ position: "absolute", inset: 0, clipPath: `inset(0 calc(100% - ${width}) 0 0 round 999px)`, transition: `clip-path ${transition}` }}>{layer(true)}</span>
      {!done ? (
        <span style={{ position: "absolute", right: 20, display: "flex", gap: 5, pointerEvents: "none" }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: cr(2), background: houseVar("muted"), opacity: 0.6 }} />)}
        </span>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Inputs

const Field = ({ children, style, focused }: { children: ReactNode; style?: CSSProperties; focused?: boolean }) => (
  <label style={{ height: 56, borderRadius: cr(18), background: houseVar("field"), display: "flex", alignItems: "center", gap: 12, padding: "0 16px", color: houseVar("muted"), fontSize: ts(17), boxShadow: focused ? `inset 0 0 0 2px ${houseVar("text")}` : "inset 0 0 0 0 transparent", transition: "box-shadow .2s", cursor: "text", ...style }}>{children}</label>
);

const FormField: Renderer = (r) => {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const haptic = useHaptic();
  const limit = n(r.p, "limit");
  const floated = focused || value !== "";
  const content = s(r.p, "content");
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Field focused={focused}>
        {s(r.p, "icon") !== "none" ? <Glyph name={s(r.p, "icon")} size={20} /> : null}
        <span style={{ position: "relative", flex: 1, minWidth: 0, alignSelf: "stretch", display: "flex", alignItems: "center" }}>
          {/* The label floats up and shrinks on focus, as FormField's does. */}
          <span className="spb-anim" style={{ position: "absolute", left: 0, top: "50%", transformOrigin: "left center", transform: floated ? "translateY(-21px) scale(.72)" : "translateY(-50%)", marginTop: floated ? 0 : undefined, transition: `transform .3s ${SPRING}`, pointerEvents: "none", whiteSpace: "nowrap" }}>{s(r.p, "label")}</span>
          <input
            className="spb-hin"
            type={content === "email" ? "text" : "text"}
            value={value}
            placeholder={floated ? s(r.p, "prompt") : ""}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              const next = limit > 0 ? e.target.value.slice(0, limit) : e.target.value;
              // At the limit the field bumps instead of taking more.
              if (limit > 0 && e.target.value.length > limit) haptic("light", e.currentTarget);
              setValue(next);
            }}
            autoComplete="off"
            spellCheck={false}
            aria-label={s(r.p, "label")}
            style={{ paddingTop: floated ? 16 : 0, opacity: floated ? 1 : 0, height: "100%" }}
          />
        </span>
      </Field>
      {s(r.p, "help").trim() || limit > 0 ? (
        <span style={{ display: "flex", gap: 8, ...font("footnote"), color: houseVar("muted"), padding: "0 16px" }}>
          <span style={{ flex: 1 }}>{s(r.p, "help")}</span>
          {limit > 0 ? <span style={{ fontVariantNumeric: "tabular-nums", color: value.length >= limit ? B.tangerine : undefined }}>{value.length}/{limit}</span> : null}
        </span>
      ) : null}
    </Root>
  );
};

const STRENGTH = [B.tangerine, B.butter, B.sky, B.sage];
const SecureEntry: Renderer = (r) => {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);
  const haptic = useHaptic();
  const reqs: Array<[string, boolean]> = [
    ["8+ characters", value.length >= 8],
    ["A number", /\d/.test(value)],
    ["A symbol", /[^\p{L}\p{N}\s]/u.test(value)],
    ["Mixed case", /[a-z]/.test(value) && /[A-Z]/.test(value)],
  ];
  const passed = reqs.filter(([, m]) => m).length;
  const score = value ? Math.max(1, passed) : 0;
  const last = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (passed > last.current) haptic(passed === 4 ? "success" : "selection", inputRef.current);
    last.current = passed;
  }, [passed, haptic]);
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field focused={focused}>
        <input
          ref={inputRef}
          className="spb-hin"
          type={shown ? "text" : "password"}
          value={value}
          placeholder={s(r.p, "label")}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="new-password"
          aria-label={s(r.p, "label")}
        />
        <span
          role="button"
          aria-label={shown ? "Hide password" : "Show password"}
          onClick={(e) => {
            e.preventDefault();
            setShown((v) => !v);
          }}
          style={{ width: 34, height: 34, borderRadius: cr("50%"), background: houseVar("raised"), display: "grid", placeItems: "center", color: houseVar("text"), flex: "none", cursor: "pointer" }}
        >
          <Glyph name={shown ? "eye.slash" : "eye"} size={18} />
        </span>
      </Field>
      {b(r.p, "showsStrength") ? (
        <div style={{ display: "flex", gap: 4, padding: "0 4px" }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="spb-anim" style={{ flex: 1, height: 4, borderRadius: cr(2), background: i < score ? STRENGTH[score - 1] : houseVar("empty"), transition: `background-color .3s ${SPRING} ${i * 40}ms` }} />
          ))}
        </div>
      ) : null}
      {b(r.p, "showsRequirements") ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {reqs.map(([t, met]) => (
            <span key={t} className="spb-anim" style={{ ...font("footnote", 500), padding: "4px 10px", borderRadius: cr(999), background: met ? B.sage : houseVar("raised"), color: met ? INK : houseVar("muted"), transition: "background-color .25s, color .25s" }}>{t}</span>
          ))}
        </div>
      ) : null}
    </Root>
  );
};

const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
/** The typed amount, formatted in the currency with the decimals the person typed. */
function amountText(raw: string, code: string) {
  const [whole, decimals] = raw.split(".");
  const text = new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(whole || "0"));
  return decimals !== undefined && code !== "JPY" ? `${text}.${decimals}` : text;
}
const AmountField: Renderer = (r) => {
  const code = s(r.p, "currency");
  const limit = n(r.p, "limit");
  const [raw, setRaw] = useLive(String(n(r.p, "amount") || 0));
  const [shake, setShake] = useState(0);
  const haptic = useHaptic();
  const text = amountText(raw, code);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value.replace(/[^0-9.]/g, "");
    const dot = next.indexOf(".");
    if (dot >= 0) next = next.slice(0, dot + 1) + next.slice(dot + 1).replace(/\./g, "").slice(0, 2);
    if (code === "JPY") next = next.replace(/\..*$/, "");
    next = next.replace(/^0+(?=\d)/, "") || "0";
    // Past the limit the field refuses the digit and shakes.
    if (limit > 0 && Number(next) > limit) {
      haptic("error", e.currentTarget);
      setShake((k) => k + 1);
      return;
    }
    setRaw(next === "" ? "0" : next);
  };
  const input = (
    <input
      inputMode="decimal"
      value={raw === "0" ? "" : raw}
      onChange={onChange}
      aria-label={s(r.p, "label")}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: 0, padding: 0, fontSize: ts(16), cursor: "text" }}
    />
  );
  const figureStyle: CSSProperties = { display: "inline-block", animation: shake && !reducedMotion() ? "spb-shake .36s ease-in-out" : undefined };
  if (s(r.p, "size") === "compact") {
    return (
      <Root r={r}>
        <Field style={{ justifyContent: "space-between", position: "relative" }}>
          <span>{s(r.p, "label")}</span>
          <span key={shake} style={{ ...figureStyle, color: houseVar("text"), fontSize: ts(22), fontWeight: fw(300) }}>{text}</span>
          {input}
        </Field>
      </Root>
    );
  }
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", position: "relative" }}>
      <span style={{ ...font("subheadline", 500), color: houseVar("muted") }}>{s(r.p, "label")}</span>
      <span key={shake} style={{ ...figureStyle, fontSize: ts(64), fontWeight: fw(300), letterSpacing: "-0.03em", color: houseVar("text"), lineHeight: 1.1 }}>
        {text}<span className="spb-caret" />
      </span>
      <span style={{ ...font("footnote"), color: houseVar("muted") }}>{symbols[code] ? `${code}` : ""}</span>
      {input}
    </Root>
  );
};

const FilterRail: Renderer = (r) => {
  const options = list(r.p.options);
  const safe = options.length ? options : ["All"];
  const multiple = b(r.p, "multiple");
  const [picked, setPicked] = useLive(safe[0]);
  const [set, setSet] = useLive<string>(safe[0]);
  const chosen = new Set(set.split("\u0000").filter(Boolean));
  const haptic = useHaptic();
  const railRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const selIndex = Math.max(0, safe.indexOf(picked));
  useLayoutEffect(() => {
    if (multiple) return;
    const chip = chipRefs.current[selIndex];
    if (!chip) return;
    const measure = () => {
      if (chip.offsetWidth) setPill((p) => (p && p.left === chip.offsetLeft && p.width === chip.offsetWidth ? p : { left: chip.offsetLeft, width: chip.offsetWidth }));
    };
    measure();
    // A rail on a tab or page that starts hidden measures 0 wide: measure again once it's laid out.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(chip);
    return () => ro?.disconnect();
  }, [selIndex, multiple, r.p.options]);
  const choose = (o: string, i: number, el: Element) => {
    haptic("selection", el);
    if (multiple) {
      const next = new Set(chosen);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      setSet([...next].join("\u0000"));
      return;
    }
    setPicked(o);
    const chip = chipRefs.current[i];
    const rail = railRef.current;
    if (chip && rail) rail.scrollTo?.({ left: Math.max(0, chip.offsetLeft + chip.offsetWidth / 2 - rail.clientWidth / 2), behavior: reducedMotion() ? "auto" : "smooth" });
  };
  return (
    <Root r={r} style={{ maskImage: "linear-gradient(90deg, #000 85%, transparent)", WebkitMaskImage: "linear-gradient(90deg, #000 85%, transparent)" }}>
      <div ref={railRef} style={{ position: "relative", display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x pan-y" }}>
        {!multiple && pill ? <span aria-hidden className="spb-anim" style={{ position: "absolute", top: 0, left: pill.left, width: pill.width, height: 40, borderRadius: cr(20), background: houseVar("text"), transition: `left .45s ${SPRING}, width .45s ${SPRING}` }} /> : null}
        {safe.map((o, i) => {
          const on = multiple ? chosen.has(o) : i === selIndex;
          return (
            <span
              key={o + i}
              ref={(el) => { chipRefs.current[i] = el; }}
              role="button"
              aria-pressed={on}
              onClick={(e) => choose(o, i, e.currentTarget)}
              className="spb-anim"
              style={{
                position: "relative", height: 40, padding: "0 16px", borderRadius: cr(20), display: "flex", alignItems: "center", flex: "none", cursor: "pointer", userSelect: "none", ...font("subheadline", 600),
                background: on ? (multiple ? B.tangerine : pill ? "transparent" : houseVar("text")) : houseVar("field"),
                color: on ? (multiple ? INK : houseVar("ground")) : houseVar("text"),
                transition: "background-color .25s, color .25s",
              }}
            >
              {o}
            </span>
          );
        })}
      </div>
    </Root>
  );
};

const ScrubStepper: Renderer = (r) => {
  const lo = Math.min(n(r.p, "min"), n(r.p, "max") - 1);
  const hi = Math.max(n(r.p, "max"), lo + 1);
  const [raw, setRaw] = useLive(n(r.p, "value"));
  const v = Math.min(hi, Math.max(lo, raw));
  const [dir, setDir] = useState(0);
  const [nudge, setNudge] = useState(0);
  const haptic = useHaptic();
  const later = useTimers();
  const repeat = useRef(0);
  const current = useRef(v);
  current.current = v;
  const bump = (delta: number, el: Element | null) => {
    const next = current.current + delta;
    if (next < lo || next > hi) {
      // Past a bound: the capsule nudges and a rigid tick fires instead of moving.
      haptic("rigid", el);
      setNudge(delta > 0 ? 6 : -6);
      later(() => setNudge(0), 140);
      return false;
    }
    current.current = next;
    setDir(delta);
    setRaw(next);
    haptic("selection", el);
    return true;
  };
  const stopRepeat = () => window.clearTimeout(repeat.current);
  useEffect(() => stopRepeat, []);
  const hold = (delta: number, el: Element) => {
    bump(delta, el);
    let wait = 420;
    const tick = () => {
      if (!bump(delta, el)) return;
      wait = Math.max(60, wait * 0.8);
      repeat.current = window.setTimeout(tick, wait);
    };
    repeat.current = window.setTimeout(tick, wait);
  };
  const scrub = useRef({ base: 0, steps: 0 });
  const drag = useDrag({
    axis: "x",
    onStart: () => {
      scrub.current = { base: current.current, steps: 0 };
    },
    onMove: ({ dx, el }) => {
      const steps = Math.trunc(dx / 16);
      if (steps !== scrub.current.steps) {
        bump(steps > scrub.current.steps ? 1 : -1, el);
        scrub.current.steps = steps;
      }
    },
  });
  const round = (label: string, delta: number) => (
    <RoundButton label={label} disabled={delta < 0 ? v <= lo : v >= hi} onDown={(el) => hold(delta, el)} onUp={stopRepeat} />
  );
  return (
    <Root r={r} className={`${r.box.className} spb-anim`} style={{ ...capsule(52), padding: 6, gap: 10, background: houseVar("raised"), width: "fit-content", transform: nudge ? `translateX(${nudge}px)` : undefined, transition: `transform .14s ${SPRING}` }}>
      {round("−", -1)}
      <span onPointerDown={drag} style={{ minWidth: 64, height: 40, borderRadius: cr(14), background: B.butter, color: INK, display: "grid", placeItems: "center", fontSize: ts(22), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", overflow: "hidden", cursor: "ew-resize", touchAction: "pan-y", userSelect: "none" }}>
        <span key={v} style={{ animation: dir && !reducedMotion() ? `${dir > 0 ? "spb-roll-up" : "spb-roll-down"} .28s ${SPRING} both` : undefined }}>{v}</span>
      </span>
      {round("+", 1)}
    </Root>
  );
};

function RoundButton({ label, disabled, onDown, onUp }: { label: string; disabled: boolean; onDown: (el: Element) => void; onUp: () => void }) {
  const press = usePress(false, 0.88);
  return (
    <span
      {...press.bind}
      role="button"
      aria-label={label === "+" ? "Increment" : "Decrement"}
      onPointerDown={(e) => {
        press.bind.onPointerDown?.(e);
        if (e.button === 0) onDown(e.currentTarget);
      }}
      onPointerUp={() => {
        press.bind.onPointerUp?.();
        onUp();
      }}
      onPointerLeave={() => {
        press.bind.onPointerLeave?.();
        onUp();
      }}
      onPointerCancel={onUp}
      style={{ width: 40, height: 40, borderRadius: cr("50%"), background: houseVar("surface"), display: "grid", placeItems: "center", color: houseVar("text"), fontSize: ts(22), fontWeight: fw(400), opacity: disabled ? 0.4 : 1, transition: "opacity .2s", ...press.style }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------- Lists

const priorities: Record<string, { bg: string; label: string }> = { high: { bg: "#FF0000", label: "High" }, medium: { bg: B.butter, label: "Medium" }, low: { bg: B.sky, label: "Low" } };
const TaskRow: Renderer = (r) => {
  const [status, setStatus] = useLive(s(r.p, "status"));
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const haptic = useHaptic();
  const armed = useRef(false);
  const done = status === "completed";
  const pr = priorities[s(r.p, "priority")];
  const complete = (el: Element | null) => {
    if (done) {
      setStatus("open");
      return;
    }
    setStatus("completed");
    haptic("success", el);
  };
  // Swipe right completes, the way TaskRow's leading swipe does; anything short springs home.
  const drag = useDrag({
    axis: "x",
    onStart: () => setDragging(true),
    onMove: ({ dx: d, el }) => {
      const x = d > 0 ? Math.min(140, d * 0.8) : Math.max(-24, d * 0.2);
      setDx(x);
      if (x > 90 !== armed.current) {
        armed.current = x > 90;
        if (armed.current) haptic("rigid", el);
      }
    },
    onEnd: ({ el }) => {
      setDragging(false);
      setDx(0);
      if (armed.current && !done) complete(el);
      armed.current = false;
    },
  });
  // In a styled list (Style → Lists) the card goes clear and the list draws the surface.
  const listed = r.p.listed === true;
  const radius = cr(listed ? 12 : 22);
  return (
    <Root r={r} style={{ position: "relative", borderRadius: radius, background: dx > 0 ? B.sage : undefined, touchAction: "pan-y" }}>
      <div
        onPointerDown={drag}
        className="spb-anim"
        style={{
          display: "flex", alignItems: "center", gap: 14, padding: listed ? "14px 16px 14px 12px" : 16, borderRadius: radius, background: done ? B.sage : listed ? "transparent" : houseVar("surface"), color: done ? INK : houseVar("text"),
          transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? "background-color .3s" : `transform .45s ${BOUNCE}, background-color .3s`,
        }}
      >
        <span
          role="checkbox"
          aria-checked={done}
          onClick={(e) => complete(e.currentTarget)}
          className="spb-anim"
          style={{ width: 28, height: 28, borderRadius: cr("50%"), flex: "none", display: "grid", placeItems: "center", boxShadow: done ? undefined : `inset 0 0 0 2px ${houseVar("muted")}`, background: done ? INK : undefined, color: B.sage, cursor: "pointer", transition: `background-color .25s, transform .35s ${BOUNCE}` }}
        >
          {done ? <span key="c" className="spb-pop" style={{ display: "grid" }}><Glyph name="checkmark" size={16} strokeWidth={2.6} /></span> : null}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* The strike-through draws across, rather than appearing. */}
          <span className="spb-anim" style={{ ...semibold, alignSelf: "flex-start", backgroundImage: "linear-gradient(currentColor, currentColor)", backgroundRepeat: "no-repeat", backgroundPosition: "0 55%", backgroundSize: `${done ? 100 : 0}% 1.5px`, transition: `background-size .35s ${SPRING}` }}>{s(r.p, "title")}</span>
          {s(r.p, "due").trim() ? <span style={{ ...font("footnote"), color: done ? INK : houseVar("muted"), opacity: done ? 0.7 : 1 }}>{status === "snoozed" ? "Snoozed · " : ""}{s(r.p, "due")}</span> : null}
        </span>
        {pr && !done ? <span style={{ ...font("caption", 700), padding: "4px 8px", borderRadius: cr(8), background: pr.bg, color: INK }}>{pr.label}</span> : null}
      </div>
    </Root>
  );
};

const StatusTimeline: Renderer = (r) => {
  const steps = list(r.p.steps);
  const safe = steps.length ? steps : ["Step"];
  const [current, setCurrent] = useLive(n(r.p, "current"));
  const haptic = useHaptic();
  // A tap moves the order along; past the end it starts over.
  const advance = (el: Element) => {
    if (current >= safe.length) {
      setCurrent(0);
      return;
    }
    setCurrent(current + 1);
    haptic("success", el);
  };
  return (
    <Root r={r} role="button" onClick={(e) => advance(e.currentTarget)} style={{ display: "flex", flexDirection: "column", cursor: "pointer", userSelect: "none" }}>
      {safe.map((t, i, all) => {
        const state = i < current ? "complete" : i === current ? "current" : "pending";
        return (
          <div key={t + i} style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span className="spb-anim" style={{ width: 28, height: 28, borderRadius: cr("50%"), display: "grid", placeItems: "center", flex: "none", ...font("footnote", 700), background: state === "complete" ? B.sage : state === "current" ? "var(--spb-accent, #FF0000)" : "transparent", color: state === "current" ? ACCENT_INK : INK, boxShadow: state === "pending" ? `inset 0 0 0 2px ${houseVar("raised")}` : undefined, transition: "background-color .3s, box-shadow .3s" }}>
                {state === "complete" ? <span key="c" className="spb-pop" style={{ display: "grid" }}><Glyph name="checkmark" size={14} strokeWidth={2.8} /></span> : state === "pending" ? <span style={{ color: houseVar("muted") }}>{i + 1}</span> : i + 1}
              </span>
              {i < all.length - 1 ? (
                <span style={{ width: 2, flex: 1, minHeight: 18, background: houseVar("raised"), position: "relative", overflow: "hidden" }}>
                  <span className="spb-anim" style={{ position: "absolute", inset: 0, background: B.sage, transformOrigin: "top", transform: `scaleY(${i < current ? 1 : 0})`, transition: `transform .45s ${SPRING}` }} />
                </span>
              ) : null}
            </div>
            <div style={{ paddingBottom: i < all.length - 1 ? 18 : 0, paddingTop: 3 }}>
              <div style={{ ...semibold, color: state === "pending" ? houseVar("muted") : houseVar("text"), transition: "color .3s" }}>{t}</div>
            </div>
          </div>
        );
      })}
    </Root>
  );
};

// ---------------------------------------------------------------- Data

const SERIES = [31.2, 34.8, 33.1, 38.4, 41.0, 39.7, 43.5, 46.9, 45.2, 48.25];
function Sparkline({ color }: { color: string }) {
  const min = Math.min(...SERIES);
  const max = Math.max(...SERIES);
  const pts = SERIES.map((v, i) => `${(i / (SERIES.length - 1)) * 100},${28 - ((v - min) / (max - min)) * 26}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: 36, display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

/** A number that eases to each new value over a short roll, as `.contentTransition(.numericText())` reads. */
function useTween(target: number, ms = 650) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let id = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = start + (target - start) * e;
      from.current = v;
      setShown(v);
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, ms]);
  return shown;
}

const LiveStat: Renderer = (r) => {
  const d = n(r.p, "delta");
  const base = n(r.p, "value");
  const [value, setValue] = useLive(base);
  // Live: the figure ticks with small moves around its value, the way a feed would update it.
  useEffect(() => {
    if (reducedMotion()) return;
    const id = window.setInterval(() => setValue(base * (1 + (Math.random() - 0.4) * 0.006)), 2600);
    return () => window.clearInterval(id);
  }, [base, setValue]);
  const shown = useTween(value);
  const currency = s(r.p, "format") === "currency";
  return (
    <Root r={r} style={{ padding: 18, borderRadius: cr(22), background: houseVar("surface"), boxShadow: "var(--spb-card-edge, none)", color: houseVar("text"), display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ ...font("subheadline", 500), color: houseVar("muted") }}>{s(r.p, "label")}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: ts(40), fontWeight: fw(300), letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}><Figure text={fmt(currency ? shown : Math.round(shown * 100) / 100, currency, s(r.p, "code") || "USD")} dim={houseVar("muted")} /></span>
        {d !== 0 ? <span style={{ ...font("footnote", 700), padding: "4px 8px", borderRadius: cr(8), background: d > 0 ? B.sage : B.tangerine, color: d > 0 ? INK : ACCENT_INK }}>{d > 0 ? "+" : ""}{d.toFixed(1)}%</span> : null}
      </div>
      {b(r.p, "sparkline") ? <Sparkline color={houseVar("text")} /> : null}
    </Root>
  );
};

/** One digit wheel: 0…9 stacked, rolled to its digit with a spring. */
function DigitWheel({ digit, order, color }: { digit: number; order: number; color?: string }) {
  return (
    <span style={{ display: "inline-block", height: "1.15em", overflow: "hidden", verticalAlign: "top", color }}>
      <span className="spb-anim" style={{ display: "flex", flexDirection: "column", transform: `translateY(${-digit * 1.15}em)`, transition: `transform ${(0.7 + order * 0.06).toFixed(2)}s ${SPRING}` }}>
        {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ height: "1.15em", lineHeight: "1.15em" }}>{i}</span>)}
      </span>
    </span>
  );
}

const Odometer: Renderer = (r) => {
  const text = fmt(n(r.p, "value"), b(r.p, "currency"), s(r.p, "code") || "USD");
  // Rolls on mount: the wheels start at zero and turn to the value on the next frame.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const dot = text.lastIndexOf(".");
  const chars = text.split("");
  return (
    <Root r={r} aria-label={text} style={{ fontSize: ts(n(r.p, "size")), fontWeight: fw(300), color: "var(--ios-label)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1.15, whiteSpace: "nowrap" }}>
      {chars.map((c, i) => {
        const fromRight = chars.length - i;
        const dim = dot >= 0 && i >= dot ? "var(--ios-label2)" : undefined;
        if (/\d/.test(c)) return <DigitWheel key={`d${fromRight}`} digit={armed || reducedMotion() ? Number(c) : 0} order={i} color={dim} />;
        return <span key={`c${fromRight}`} style={{ display: "inline-block", height: "1.15em", verticalAlign: "top", color: dim }}>{c}</span>;
      })}
    </Root>
  );
};

const RingBreakdown: Renderer = (r) => {
  const slices = parseSlices(s(r.p, "slices"));
  const total = slices.reduce((a, x) => a + x.value, 0) || 1;
  const currency = b(r.p, "currency");
  const [selected, setSelected] = useState<number | null>(null);
  const haptic = useHaptic();
  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const colors = houseBlocks.map((k) => B[k]);
  const pick = (i: number | null, el: Element | null) => {
    if (i !== selected && i !== null) haptic("selection", el);
    setSelected(i);
  };
  // Where a point on the ring falls: the slice under that angle, or none inside the hole.
  const sliceAt = (x: number, y: number): number | null => {
    const dx = x - 100;
    const dy = y - 100;
    const dist = Math.hypot(dx, dy);
    if (dist < 44) return null;
    const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const at = (a / (Math.PI * 2)) * total;
    let sum = 0;
    for (let i = 0; i < slices.length; i++) {
      sum += slices[i].value;
      if (at <= sum) return i;
    }
    return slices.length - 1;
  };
  const scrubbed = useRef(false);
  const drag = useDrag({
    slop: 0,
    onStart: ({ x, y, el }) => {
      scrubbed.current = false;
      const i = sliceAt(x, y);
      // A tap on the selected slice, or in the hole, clears the selection.
      pick(i === selected ? null : i, el);
    },
    onMove: ({ x, y, el, dx, dy }) => {
      if (Math.hypot(dx, dy) < 4) return;
      scrubbed.current = true;
      const i = sliceAt(x, y);
      if (i !== null) pick(i, el);
    },
  });
  const sel = selected !== null && selected < slices.length ? slices[selected] : null;
  const money = (v: number) => fmt(v, currency).replace(/\.\d+$/, "");
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, color: houseVar("text") }}>
      <div onPointerDown={drag} style={{ position: "relative", width: 200, height: 200, cursor: "pointer", touchAction: "none", userSelect: "none" }}>
        <svg viewBox="0 0 200 200" width="200" height="200" style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
          {slices.map((x, i) => {
            const len = (x.value / total) * C;
            const on = selected === i;
            const el = (
              <circle
                key={i} cx="100" cy="100" r={R} fill="none" stroke={colors[i % colors.length]} strokeWidth={on ? 42 : 34}
                strokeDasharray={`${Math.max(0, len - 4)} ${C}`} strokeDashoffset={-acc}
                className="spb-anim"
                style={{ opacity: selected === null || on ? 1 : 0.35, transition: `stroke-width .35s ${BOUNCE}, opacity .25s` }}
              />
            );
            acc += len;
            return el;
          })}
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          {sel ? <span key={`l${selected}`} className="spb-rise" style={{ ...font("footnote", 600), color: houseVar("muted") }}>{sel.label}</span> : null}
          <span key={`v${selected}`} className={sel ? "spb-rise" : undefined} style={{ fontSize: ts(24), fontWeight: fw(300) }}>{money(sel ? sel.value : total)}</span>
        </span>
      </div>
      {b(r.p, "legend") ? (
        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
          {slices.map((x, i) => (
            <div key={i} onClick={(e) => pick(selected === i ? null : i, e.currentTarget)} style={{ display: "flex", alignItems: "center", gap: 10, ...font("subheadline"), cursor: "pointer", opacity: selected === null || selected === i ? 1 : 0.5, transition: "opacity .25s" }}>
              <span style={{ width: 12, height: 12, borderRadius: cr(3), background: colors[i % colors.length] }} />
              <span style={{ flex: 1, fontWeight: fw(selected === i ? 600 : undefined) }}>{x.label}</span>
              <span style={{ color: houseVar("muted") }}>{money(x.value)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Feedback

const LEVELS = [B.tangerine, B.sand, B.butter, B.sage, B.sky];
const WORDS = ["Poor", "Fair", "Good", "Very good", "Great"];
const RatingScrub: Renderer = (r) => {
  const start = n(r.p, "rating");
  const [rating, setRating] = useLive(start);
  const [active, setActive] = useState<number | null>(null);
  const size = n(r.p, "size");
  const gap = size * 0.2;
  const half = start % 1 !== 0;
  const readOnly = b(r.p, "readOnly");
  const haptic = useHaptic();
  const color = LEVELS[Math.max(0, Math.ceil(rating) - 1)] ?? LEVELS[0];
  const last = useRef(rating);
  const valueAt = (x: number) => {
    const raw = Math.max(0, Math.min(5, (x + gap / 2) / (size + gap)));
    return half ? Math.max(0.5, Math.ceil(raw * 2) / 2) : Math.max(1, Math.ceil(raw));
  };
  const set = (x: number, el: Element) => {
    const v = valueAt(x);
    setActive(Math.ceil(v) - 1);
    if (v !== last.current) {
      last.current = v;
      haptic(v === 5 ? "rigid" : "selection", el);
      setRating(v);
    }
  };
  const drag = useDrag({
    slop: 0,
    onStart: ({ x, el }) => set(x, el),
    onMove: ({ x, el }) => set(x, el),
    onEnd: () => setActive(null),
  });
  useEffect(() => {
    last.current = rating;
  }, [rating]);
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div
        onPointerDown={readOnly ? undefined : drag}
        onPointerUp={() => setActive(null)}
        style={{ display: "flex", gap, cursor: readOnly ? undefined : "pointer", touchAction: readOnly ? undefined : "pan-y", userSelect: "none" }}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const f = Math.max(0, Math.min(1, rating - (i - 1)));
          const lifted = active === i - 1;
          return (
            <span key={i} className="spb-anim" style={{ width: size, height: size, position: "relative", color: houseVar("empty"), transform: lifted ? `translateY(${-size * 0.18}px) scale(1.2)` : undefined, transition: lifted ? "transform .16s ease-out" : `transform .42s ${BOUNCE}` }}>
              <Glyph name="star" size={size} strokeWidth={1.6} style={{ position: "absolute", fill: "currentColor" }} />
              {f > 0 ? <span className="spb-anim" style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - f * 100}% 0 0)`, color, transition: "clip-path .18s ease-out, color .25s" }}><Glyph name="star" size={size} strokeWidth={1.6} style={{ fill: "currentColor" }} /></span> : null}
            </span>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: ts(28), fontWeight: fw(300), color: houseVar("text"), fontVariantNumeric: "tabular-nums" }}>{rating.toFixed(rating % 1 ? 1 : 0)}</span>
        {b(r.p, "labels") && rating > 0 ? <span key={WORDS[Math.ceil(rating) - 1]} className="spb-pop" style={{ ...font("footnote", 700), padding: "4px 8px", borderRadius: cr(8), background: color, color: INK, transition: "background-color .25s" }}>{WORDS[Math.ceil(rating) - 1]}</span> : null}
      </div>
    </Root>
  );
};

const BURST = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  return { dx: Math.cos(a), dy: Math.sin(a) };
});
const ReactionToggle: Renderer = (r) => {
  const [on, setOn] = useLive(b(r.p, "isOn"));
  const [burst, setBurst] = useState(0);
  const size = n(r.p, "size");
  const fill = B[s(r.p, "fill")] ?? B.tangerine;
  const press = usePress(false, 0.9);
  const haptic = useHaptic();
  const confirmation = s(r.p, "confirmation").trim();
  const flip = (el: Element) => {
    const next = !on;
    setOn(next);
    if (next) {
      haptic("soft", el);
      setBurst((k) => k + 1);
    }
  };
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "fit-content", position: "relative" }}>
      {/* The confirmation floats up and away when it turns on. */}
      {on && burst > 0 && confirmation ? (
        <span key={`p${burst}`} className="spb-anim" style={{ position: "absolute", left: "50%", bottom: "calc(100% + 6px)", ...font("footnote", 600), padding: "4px 10px", borderRadius: cr(999), background: houseVar("text"), color: houseVar("ground"), whiteSpace: "nowrap", pointerEvents: "none", animation: "spb-float 1.5s ease both", opacity: 0 }}>{confirmation}</span>
      ) : null}
      <span
        {...press.bind}
        role="switch"
        aria-checked={on}
        onClick={(e) => flip(e.currentTarget)}
        className="spb-anim"
        style={{ ...capsule(size * 1.9), padding: `0 ${size * 0.6}px`, background: on ? fill : houseVar("raised"), color: on ? inkOn(fill, INK) : houseVar("text"), fontSize: ts(size * 0.62), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", position: "relative", ...press.style, transition: `${press.style.transition}, background-color .25s` }}
      >
        <span key={on ? `on${burst}` : "off"} className={on && burst ? "spb-pop" : undefined} style={{ display: "grid", position: "relative" }}>
          <Glyph name={s(r.p, "icon")} size={size} strokeWidth={2} style={on ? { fill: "currentColor" } : undefined} />
          {on && burst ? BURST.map((p, i) => (
            <span key={i} aria-hidden className="spb-anim" style={{ position: "absolute", left: "50%", top: "50%", width: size * 0.18, height: size * 0.18, borderRadius: cr("50%"), background: i % 2 ? fill : INK, pointerEvents: "none", animation: "spb-burst .55s cubic-bezier(.2, .8, .3, 1) both", ["--dx" as string]: `${p.dx * size * 0.95}px`, ["--dy" as string]: `${p.dy * size * 0.95}px` }} />
          )) : null}
        </span>
        {n(r.p, "count") > 0 ? <span key={on ? "c1" : "c0"} className={burst ? "spb-rise" : undefined}>{n(r.p, "count") + (on ? 1 : 0)}</span> : null}
      </span>
    </Root>
  );
};

const outcomes: Record<string, { fill: string; mark: string; haptic: HapticKind }> = {
  success: { fill: B.sage, mark: "checkmark", haptic: "success" },
  failure: { fill: B.butter, mark: "xmark", haptic: "error" },
  empty: { fill: B.sky, mark: "tray", haptic: "light" },
};
const OutcomeScreen: Renderer = (r) => {
  const o = outcomes[s(r.p, "outcome")] ?? outcomes.success;
  const press = usePress();
  const tap = useTap(r.p.link, null);
  const haptic = useHaptic();
  const markRef = useRef<HTMLSpanElement>(null);
  // The mark lands with its haptic, as the screen does when it appears.
  useEffect(() => {
    const id = window.setTimeout(() => haptic(o.haptic, markRef.current), 320);
    return () => window.clearTimeout(id);
  }, [o.haptic, haptic]);
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, padding: "24px 0", flex: "1 1 auto", justifyContent: "center" }}>
      <span ref={markRef} key={s(r.p, "outcome")} className="spb-pop" style={{ width: 96, height: 96, borderRadius: cr("50%"), background: o.fill, color: INK, display: "grid", placeItems: "center", marginBottom: 8 }}><Glyph name={o.mark} size={42} strokeWidth={2.4} /></span>
      {s(r.p, "eyebrow").trim() ? <span style={{ ...font("footnote", 700), letterSpacing: "0.06em", textTransform: "uppercase", color: houseVar("muted") }}>{s(r.p, "eyebrow")}</span> : null}
      <span style={{ fontSize: ts(30), fontWeight: fw(800), letterSpacing: "-0.03em", lineHeight: 1.1, color: houseVar("text") }}>{s(r.p, "title")}</span>
      {s(r.p, "message").trim() ? <span style={{ ...font("body"), color: houseVar("muted"), maxWidth: 300 }}>{s(r.p, "message")}</span> : null}
      <span {...press.bind} role="button" onClick={(e) => tap(e)} style={{ ...capsule(56), alignSelf: "stretch", marginTop: 12, background: SIGNAL, color: ACCENT_INK, ...semibold, ...press.style }}>{s(r.p, "primaryTitle") || "Continue"}</span>
    </Root>
  );
};

const SkeletonLoader: Renderer = (r) => {
  const shape = s(r.p, "shape");
  const bone = "var(--h-bone)";
  const failed = b(r.p, "failed");
  // The sweep runs until the load fails; then the bone dims and holds still.
  const sweep = failed ? undefined : "spb-shimmer";
  const dim: CSSProperties = { opacity: failed ? 0.5 : 1, transition: "opacity .4s ease" };
  if (shape === "text") {
    const lines = n(r.p, "lines");
    return (
      <Root r={r} aria-label={failed ? "Failed to load" : "Loading"} style={{ display: "flex", flexDirection: "column", gap: 8, ...dim }}>
        {Array.from({ length: lines }, (_, i) => <span key={i} className={sweep} style={{ height: 12, borderRadius: cr(6), background: bone, width: i === lines - 1 && lines > 1 ? "60%" : "100%" }} />)}
      </Root>
    );
  }
  const h = n(r.p, "height");
  return (
    <Root r={r} aria-label={failed ? "Failed to load" : "Loading"} style={{ height: h, width: shape === "circle" ? h : undefined, borderRadius: cr(shape === "circle" || shape === "capsule" ? 999 : 12), background: bone, ...dim }}>
      <span className={sweep} style={{ display: "block", width: "100%", height: "100%", borderRadius: cr("inherit") }} />
    </Root>
  );
};

const StatusMorph: Renderer = (r) => {
  const target = s(r.p, "state");
  const [state, setState] = useLive(target);
  const [drawn, setDrawn] = useState(true);
  const size = n(r.p, "size");
  const lw = Math.max(3, Math.round(size / 16));
  const haptic = useHaptic();
  const later = useTimers();
  const captions: Record<string, string> = { loading: "Saving", success: "Saved", failure: "Failed" };
  // Tap runs it: the stroke spins, closes and draws the result the property names.
  const run = (el: Element) => {
    if (state === "loading") return;
    const result = target === "failure" ? "failure" : "success";
    setState("loading");
    setDrawn(false);
    later(() => {
      setState(result);
      haptic(result === "success" ? "success" : "error", el);
      requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    }, 1200);
    if (target === "idle" || target === "loading") later(() => setState(target), 3000);
  };
  const solid = state === "success" ? B.sage : state === "failure" ? B.tangerine : null;
  const path = state === "success" ? "M7 12.5l3.4 3.4L17 9" : "M8.5 8.5l7 7M15.5 8.5l-7 7";
  return (
    <Root r={r} role="button" onClick={(e) => run(e.currentTarget)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "fit-content", cursor: "pointer", userSelect: "none" }}>
      <span className="spb-anim" style={{ width: size, height: size, borderRadius: cr("50%"), display: "grid", placeItems: "center", background: solid ?? "transparent", color: INK, boxShadow: solid ? undefined : `inset 0 0 0 ${lw}px ${houseVar("empty")}`, position: "relative", transform: solid && !drawn ? "scale(.9)" : undefined, transition: `background-color .3s ease, transform .45s ${BOUNCE}` }}>
        {solid ? (
          <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={path} pathLength={1} strokeDasharray={1} strokeDashoffset={drawn ? 0 : 1} className="spb-anim" style={{ transition: `stroke-dashoffset .4s ${SPRING}` }} />
          </svg>
        ) : null}
        {state === "loading" ? <span className="spb-spin" style={{ position: "absolute", inset: 0, borderRadius: cr("50%"), border: `${lw}px solid transparent`, borderTopColor: houseVar("text") }} /> : null}
      </span>
      {b(r.p, "captions") && captions[state] ? <span key={state} className="spb-rise" style={{ ...font("subheadline", 600), color: houseVar("text") }}>{captions[state]}</span> : null}
    </Root>
  );
};

// ---------------------------------------------------------------- AI

const CHIP_BLOCKS = [B.butter, B.sky, B.sage, B.lilac];
function PromptChip({ text, index }: { text: string; index: number }) {
  const press = usePress(false, 0.95);
  const haptic = useHaptic();
  const [fired, setFired] = useState(false);
  const later = useTimers();
  return (
    <span
      {...press.bind}
      role="button"
      onPointerDown={(e) => {
        press.bind.onPointerDown?.(e);
        if (e.button === 0) haptic("soft", e.currentTarget);
      }}
      onClick={(e) => {
        haptic("selection", e.currentTarget);
        setFired(true);
        later(() => setFired(false), 650);
      }}
      className="spb-anim"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 10px 10px", borderRadius: cr(18), background: fired ? CHIP_BLOCKS[index % 4] : houseVar("surface"), color: fired ? INK : houseVar("text"), flex: "none", ...font("subheadline", 500), ...press.style, transition: `${press.style.transition}, background-color .3s, color .3s` }}
    >
      <span style={{ width: 26, height: 26, borderRadius: cr(8), background: CHIP_BLOCKS[index % 4], color: INK, display: "grid", placeItems: "center" }}><Glyph name={fired ? "paperplane" : "sparkles"} size={14} /></span>
      {text}
    </span>
  );
}

const PromptChips: Renderer = (r) => {
  const items = list(r.p.suggestions, 8);
  return (
    <Root r={r} style={{ maskImage: "linear-gradient(90deg, #000 85%, transparent)", WebkitMaskImage: "linear-gradient(90deg, #000 85%, transparent)" }}>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x pan-y" }}>
        {(items.length ? items : ["Ask anything"]).map((t, i) => <PromptChip key={t + i} text={t} index={i} />)}
      </div>
    </Root>
  );
};

const ThinkingState: Renderer = (r) => {
  const pres = s(r.p, "presentation");
  return (
    <Root r={r} aria-label="Assistant is thinking" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, ...font("footnote", 600), color: houseVar("muted") }}>
        <span style={{ width: 22, height: 22, borderRadius: cr("50%"), background: B.lilac, color: INK, display: "grid", placeItems: "center" }}><Glyph name="sparkles" size={12} /></span>
        Assistant · 2s
      </div>
      {pres === "dots" ? <div style={{ display: "flex", gap: 6 }}>{[B.tangerine, B.butter, B.sky].map((c, i) => <span key={i} className="spb-bob" style={{ width: 10, height: 10, borderRadius: cr(5), background: c, animationDelay: `${i * 0.15}s` }} />)}</div> : null}
      {pres === "sheen" ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: n(r.p, "lineCount") }, (_, i) => <span key={i} className="spb-shimmer" style={{ height: 12, borderRadius: cr(6), background: houseVar("raised"), width: i === n(r.p, "lineCount") - 1 ? "55%" : "100%", animationDelay: `${i * 0.12}s` }} />)}</div> : null}
      {pres === "text" ? <span className="spb-sheen-text" style={{ ...font("body", 500), color: houseVar("muted") }}>{s(r.p, "text")}</span> : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Text

const TextReveal: Renderer = (r) => {
  const text = s(r.p, "text");
  const [run, setRun] = useState(0);
  const hl = list(r.p.highlights, 4).filter((h) => text.includes(h));
  const unit = s(r.p, "unit");
  const preset = s(r.p, "preset");
  const anim = preset === "blur" ? "spb-word-blur" : preset === "soften" ? "spb-word-soften" : "spb-word-rise";
  const step = unit === "characters" ? 0.025 : unit === "lines" ? 0 : 0.07;
  let order = 0;
  // Each word (or character) rises in on its own delay; a highlight arrives as one piece.
  const piece = (content: ReactNode, key: string, inline = false) => (
    // A highlight stays inline so it can wrap across lines; it fades in rather than rising.
    <span key={key} className="spb-anim" style={{ display: inline ? "inline" : "inline-block", animation: `${inline ? "spb-word-blur" : anim} .6s ${SPRING} both`, animationDelay: `${(order++ * step).toFixed(3)}s` }}>{content}</span>
  );
  const split = (chunk: string, prefix: string) => {
    if (unit === "lines") return [piece(chunk, prefix)];
    const tokens = unit === "characters" ? chunk.split("") : chunk.split(/(\s+)/);
    return tokens.map((t, i) => (/^\s+$/.test(t) || t === "" ? t : piece(t, `${prefix}-${i}`)));
  };
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const hit = hl.map((h) => ({ h, i: rest.indexOf(h) })).filter((x) => x.i >= 0).sort((a, c) => a.i - c.i)[0];
    if (!hit) {
      parts.push(...split(rest, `t${key++}`));
      break;
    }
    if (hit.i) parts.push(...split(rest.slice(0, hit.i), `t${key++}`));
    parts.push(piece(<mark style={{ background: B.butter, color: INK, borderRadius: cr(6), padding: "0 4px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{hit.h}</mark>, `m${key++}`, true));
    rest = rest.slice(hit.i + hit.h.length);
  }
  return (
    <Root r={r} role="button" onClick={() => setRun((k) => k + 1)} style={{ fontSize: ts(n(r.p, "size")), fontWeight: fw(700), lineHeight: 1.12, letterSpacing: "-0.03em", color: "var(--ios-label)", textAlign: s(r.p, "alignment") === "center" ? "center" : "left", maxWidth: "100%", cursor: "pointer" }}>
      <span key={run}>{parts}</span>
    </Root>
  );
};

const ExpandableText: Renderer = (r) => {
  const [expanded, setExpanded] = useLive(b(r.p, "expanded"));
  const [overflows, setOverflows] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const before = useRef<number | null>(null);
  const lines = n(r.p, "lineLimit");
  // "more" only shows when the text is longer than its line limit.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [expanded, lines, r.p.text, r.p.style]);
  // The height animates between the clamped and the full paragraph.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || before.current === null) return;
    const from = before.current;
    before.current = null;
    const to = el.offsetHeight;
    if (reducedMotion() || from === to) return;
    const clip = el.style.overflow;
    el.style.overflow = "hidden";
    const a = el.animate?.([{ height: `${from}px` }, { height: `${to}px` }], { duration: 380, easing: SPRING });
    if (a) a.onfinish = a.oncancel = () => { el.style.overflow = clip; };
    else el.style.overflow = clip;
  }, [expanded]);
  const toggle = () => {
    if (!overflows && !expanded) return;
    before.current = bodyRef.current?.offsetHeight ?? null;
    setExpanded((v) => !v);
  };
  const link: CSSProperties = { color: "var(--ios-accent)", fontWeight: fw(600), cursor: "pointer" };
  return (
    <Root r={r} role="button" aria-expanded={expanded} onClick={toggle} style={{ position: "relative", ...font(s(r.p, "style")), color: "var(--ios-label)" }}>
      <div ref={bodyRef} style={expanded ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {s(r.p, "text")}
        {expanded ? <span className="spb-rise" style={{ ...link, display: "inline-block", marginLeft: 4 }}>less</span> : null}
      </div>
      {!expanded && overflows ? <span style={{ position: "absolute", right: 0, bottom: 0, paddingLeft: 40, background: "linear-gradient(90deg, transparent, var(--spb-ground) 40px)", ...link }}>more</span> : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Navigation, cards

const FloatingDock: Renderer = (r) => {
  const items = list(r.p.items, 6);
  const safe = items.length ? items : ["Home"];
  const [picked, setPicked] = useLive(n(r.p, "selected"));
  const [lifted, setLifted] = useState<number | null>(null);
  const sel = Math.min(Math.max(0, picked), safe.length - 1);
  const haptic = useHaptic();
  const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const liftedRef = useRef<number | null>(null);
  const select = (i: number, el: Element | null) => {
    if (i !== sel) haptic("soft", el);
    setPicked(i);
  };
  // Drag across the dock: the item under the finger lifts, and letting go selects it.
  const lift = (x: number, el: Element) => {
    let best = -1;
    let dist = Infinity;
    itemRefs.current.forEach((item, i) => {
      if (!item) return;
      const d = Math.abs(x - (item.offsetLeft + item.offsetWidth / 2));
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    if (best >= 0 && best !== liftedRef.current) {
      liftedRef.current = best;
      haptic("selection", el);
      setLifted(best);
    }
  };
  const drag = useDrag({
    axis: "x",
    onStart: ({ x, el }) => lift(x, el),
    onMove: ({ x, el }) => lift(x, el),
    onEnd: ({ el }) => {
      if (liftedRef.current !== null) select(liftedRef.current, el);
      liftedRef.current = null;
      setLifted(null);
    },
  });
  return (
    <Root
      r={r}
      role="tablist"
      onPointerDown={drag}
      style={{ display: "flex", gap: 6, padding: 8, borderRadius: cr(999), background: houseVar("surface"), boxShadow: "0 10px 30px rgba(0,0,0,.25)", width: "fit-content", alignSelf: "center", touchAction: "pan-y", userSelect: "none" }}
    >
      {safe.map((t, i) => {
        const on = i === sel;
        const up = lifted === i;
        return (
          <span
            key={t + i}
            ref={(el) => { itemRefs.current[i] = el; }}
            role="tab"
            aria-selected={on}
            onClick={(e) => select(i, e.currentTarget)}
            className="spb-anim"
            style={{
              position: "relative", height: 48, minWidth: 48, borderRadius: cr(24), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: on ? "0 16px" : 0,
              background: on ? "#FFD976" : "transparent", color: on ? INK : houseVar("muted"), ...font("subheadline", 600), cursor: "pointer",
              transform: up ? `translateY(-5px) scale(${on ? 1 : 1.14})` : undefined,
              transition: `padding .45s ${SPRING}, background-color .35s ease, color .25s, transform .28s ${SPRING}`,
            }}
          >
            <Glyph name={dockSymbol(t)} size={20} />
            {on ? <span key={`l${i}`} className="spb-rise" style={{ whiteSpace: "nowrap" }}>{t}</span> : null}
            {up ? <span className="spb-pop" style={{ position: "absolute", bottom: "calc(100% + 12px)", left: "50%", marginLeft: -40, width: 80, textAlign: "center", pointerEvents: "none" }}><span style={{ padding: "5px 10px", borderRadius: cr(999), background: houseVar("text"), color: houseVar("ground"), ...font("caption", 700), whiteSpace: "nowrap" }}>{t}</span></span> : null}
          </span>
        );
      })}
    </Root>
  );
};

const MotionCard: Renderer = (r) => {
  const fill = s(r.p, "fill") === "signal" ? ACCENT : B[s(r.p, "fill")] ?? ACCENT;
  const max = n(r.p, "maxAngle");
  const cardRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const [pressed, setPressed] = useState(false);
  const haptic = useHaptic();
  // Resting tilt, as if the phone is held at a slight angle; the pointer stands in for the device.
  const rest = max > 0 ? `rotateX(${(max * 0.4).toFixed(2)}deg) rotateY(${(-max * 0.6).toFixed(2)}deg)` : "none";
  const tilt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el || reducedMotion() || pressed) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    el.style.transition = "transform .12s linear";
    el.style.transform = `rotateX(${(-y * 2 * max).toFixed(2)}deg) rotateY(${(x * 2 * max).toFixed(2)}deg)`;
    if (sheenRef.current) {
      sheenRef.current.style.opacity = "1";
      sheenRef.current.style.background = `radial-gradient(circle at ${((x + 0.5) * 100).toFixed(1)}% ${((y + 0.5) * 100).toFixed(1)}%, rgba(255,255,255,.28), transparent 55%)`;
    }
  };
  const settle = () => {
    const el = cardRef.current;
    if (el) {
      el.style.transition = `transform .6s ${BOUNCE}`;
      el.style.transform = reducedMotion() ? "none" : rest;
    }
    if (sheenRef.current) sheenRef.current.style.opacity = "0";
  };
  return (
    <Root r={r} style={{ perspective: 800 }}>
      <div
        onPointerMove={tilt}
        onPointerLeave={() => {
          setPressed(false);
          settle();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // Press settles it flat and scales it down, with a light impact.
          setPressed(true);
          haptic("light", e.currentTarget);
          const el = cardRef.current;
          if (el) {
            el.style.transition = `transform .2s ${SPRING}`;
            el.style.transform = "scale(.97)";
          }
        }}
        onPointerUp={(e) => {
          setPressed(false);
          const el = cardRef.current;
          if (el) el.style.transition = `transform .5s ${BOUNCE}`;
          tilt(e);
        }}
        style={{ touchAction: "pan-y" }}
      >
        <div
          ref={cardRef}
          className="spb-anim"
          style={{
            position: "relative", borderRadius: cr(n(r.p, "radius")), background: fill, minHeight: n(r.p, "height"), padding: 22,
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
            boxShadow: "0 18px 40px -18px rgba(0,0,0,.45)", transform: reducedMotion() ? "none" : rest, transition: `transform .6s ${BOUNCE}`,
            // The card's own ink, which plain Text inside it inherits (as `foregroundStyle` does in SwiftUI).
            ["--ios-label" as string]: INK, ["--ios-label2" as string]: "rgba(20,20,20,.62)", ["--ios-label3" as string]: "rgba(20,20,20,.35)", ["--ios-accent" as string]: INK,
          }}
        >
          <span ref={sheenRef} aria-hidden style={{ position: "absolute", inset: 0, borderRadius: cr("inherit"), pointerEvents: "none", opacity: 0, transition: "opacity .3s" }} />
          <Frame axis="v">{r.children}</Frame>
        </div>
      </div>
    </Root>
  );
};

export const pieceRenderers: Record<string, Renderer> = {
  "elastic-button": ElasticButton, "commit-button": CommitButton, "hold-to-confirm": HoldToConfirm,
  "form-field": FormField, "secure-entry": SecureEntry, "amount-field": AmountField, "filter-rail": FilterRail, "scrub-stepper": ScrubStepper,
  "task-row": TaskRow, "status-timeline": StatusTimeline,
  "live-stat": LiveStat, odometer: Odometer, "ring-breakdown": RingBreakdown,
  "rating-scrub": RatingScrub, "reaction-toggle": ReactionToggle, "outcome-screen": OutcomeScreen, "skeleton-loader": SkeletonLoader, "status-morph": StatusMorph,
  "prompt-chips": PromptChips, "thinking-state": ThinkingState,
  "text-reveal": TextReveal, "expandable-text": ExpandableText,
  "floating-dock": FloatingDock, "motion-card": MotionCard,
};
