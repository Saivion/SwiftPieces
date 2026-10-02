"use client";
// Web renderers for the presenting, menu and switching pieces (definitions/pieces-surfaces.ts).
// Presented pieces draw their trigger in place and present the real piece into the phone-wide
// overlay, so a toast or a sheet covers the whole screen the way it does on iPhone. Colors are the
// pieces' own house palette (the values their Swift `Style` defaults use); motion is transforms and
// opacity with the runtime's spring curves, and haptics fire where the Swift pieces fire them.
import { Children, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { house } from "../../core/palette.js";
import { list } from "../../core/swift.js";
import { ITEM_BLOCKS, PERMISSIONS, TOAST_STYLE_SYMBOL, itemSymbol, parseCounts } from "../../definitions/pieces-surfaces.js";
import { Glyph } from "../icons.js";
import { Frame, b, fillStyle, font, houseVar, n, s, useAxis, type Renderer, type RenderProps, type Scheme, cr, ff, fw, ts, ACCENT } from "./env.js";
import { BOUNCE, SPRING, resolveEasing, useDrag, useLive, useRuntime, type HapticKind } from "./runtime.js";

const INK = house.ink;
const B: Record<string, string> = { ...house.blocks, tangerine: ACCENT };
/** The look's accent where the Swift takes the app tint; the house signal without a look. */
const ACCENT_INK = `var(--spb-accent-ink, ${house.ink})`;
const headline: CSSProperties = { fontSize: ts(17), fontWeight: fw(600), lineHeight: "22px" };
const reset: CSSProperties = { border: 0, margin: 0, padding: 0, font: "inherit", color: "inherit", background: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Root({ r, style, children }: { r: RenderProps; style?: CSSProperties; children?: ReactNode }) {
  const axis = useAxis();
  return <div {...r.box} style={{ ...style, ...r.box.style, ...fillStyle(r.fill, axis) }}>{children}</div>;
}

// ---------------------------------------------------------------- Shared behaviour

/** The phone-wide overlay, once the device has mounted it. */
function useOverlay() {
  const rt = useRuntime();
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(rt.overlay()), [rt]);
  return el;
}

/** Mounts on open, then flips `shown` a frame later so the entrance transitions; unmounts after the exit. */
function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: mounted || open, shown: shown && open };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Timeouts that are cleared together (a choreography) and on unmount. */
function useTimers() {
  const ids = useRef<number[]>([]);
  const clear = useCallback(() => {
    ids.current.forEach((id) => window.clearTimeout(id));
    ids.current = [];
  }, []);
  const after = useCallback((ms: number, fn: () => void) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => clear, [clear]);
  return { after, clear };
}

/** A ButtonStyle's `isPressed`: dips while the finger is down, springs back on release. */
function usePress(scale = 0.97) {
  const [pressed, setPressed] = useState(false);
  const bind = {
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
  };
  const style: CSSProperties = { transform: `scale(${pressed ? scale : 1})`, transition: pressed ? "transform .1s ease-out" : `transform .35s ${BOUNCE}` };
  return { pressed, bind, style };
}

/** `.symbolEffect(.bounce.down)` when a presented piece arrives. */
function bounce(el: Element | null, delay = 150) {
  if (!el || typeof (el as HTMLElement).animate !== "function") return;
  // A flourish, never a failure: if the browser refuses the keyframes the glyph just skips the bounce.
  try {
    (el as HTMLElement).animate(
      [{ transform: "none" }, { transform: "translateY(4px) scale(1.08)", offset: 0.35 }, { transform: "none" }],
      { duration: 500, delay, easing: resolveEasing(el, BOUNCE) },
    );
  } catch {}
}

/** Two glyphs that swap with a crossfade and a scale, like `.contentTransition(.symbolEffect(.replace))`. */
function Swap({ first, second, showSecond }: { first: ReactNode; second: ReactNode; showSecond: boolean }) {
  const layer = (on: boolean): CSSProperties => ({ gridArea: "1 / 1", display: "grid", placeItems: "center", opacity: on ? 1 : 0, transform: on ? "none" : "scale(.5)", transition: `opacity .2s, transform .4s ${BOUNCE}` });
  return (
    <span style={{ display: "grid", placeItems: "center" }}>
      <span style={layer(!showSecond)}>{first}</span>
      <span style={layer(showSecond)}>{second}</span>
    </span>
  );
}

const Spinner = ({ shown, color }: { shown: boolean; color: string }) => (
  <span className="spb-spinner" style={{ position: "absolute", color, opacity: shown ? 1 : 0, transition: "opacity .2s" }} />
);

/** A full-phone layer in the overlay that lets taps through except where its children take them. */
const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" };

// ---------------------------------------------------------------- Trigger

/** The button a presented piece hangs off, drawn like the emitted `Button` with its style. */
function Trigger({ p, onPress }: { p: RenderProps["p"]; onPress: (el: HTMLElement) => void }) {
  const style = s(p, "triggerStyle");
  const full = b(p, "fullWidth") && style !== "text";
  const press = usePress(0.96);
  const look: CSSProperties =
    style === "prominent" ? { background: ACCENT, color: ACCENT_INK, height: 50, padding: "0 20px" }
    : style === "raised" ? { background: "color-mix(in srgb, var(--ios-label) 11%, transparent)", color: "var(--ios-label)", height: 50, padding: "0 20px" }
    : { color: ACCENT, minHeight: 44, padding: "0 4px" };
  return (
    <button
      type="button"
      {...press.bind}
      onClick={(e) => onPress(e.currentTarget)}
      style={{ ...reset, ...look, ...headline, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: cr(999), width: full ? "100%" : undefined, boxSizing: "border-box", whiteSpace: "nowrap", ...press.style }}
    >
      {s(p, "trigger")}
    </button>
  );
}

// ---------------------------------------------------------------- Toast

const TOAST_TILE: Record<string, string> = { info: B.sky, success: B.sage, warning: B.butter, error: B.tangerine };
const TOAST_HAPTIC: Record<string, HapticKind> = { info: "soft", success: "success", warning: "warning", error: "error" };

const Toast: Renderer = (r) => {
  const overlay = useOverlay();
  const [open, setOpen] = useLive(b(r.p, "presented"));
  const [run, setRun] = useState(0);
  const present = () => {
    setOpen(true);
    setRun((x) => x + 1);
  };
  return (
    <Root r={r}>
      <Trigger p={r.p} onPress={present} />
      {overlay ? createPortal(<ToastLayer p={r.p} scheme={r.scheme} open={open} run={run} onDismiss={() => setOpen(false)} />, overlay) : null}
    </Root>
  );
};

function ToastLayer({ p, scheme, open, run, onDismiss }: { p: RenderProps["p"]; scheme: Scheme; open: boolean; run: number; onDismiss: () => void }) {
  const { mounted, shown } = usePresence(open, 520);
  if (!mounted) return null;
  return <ToastCard p={p} scheme={scheme} shown={shown} run={run} onDismiss={onDismiss} />;
}

function ToastCard({ p, scheme, shown, run, onDismiss }: { p: RenderProps["p"]; scheme: Scheme; shown: boolean; run: number; onDismiss: () => void }) {
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const top = s(p, "position") !== "bottom";
  const kind = TOAST_TILE[s(p, "style")] ? s(p, "style") : "info";
  const duration = Math.max(1, n(p, "duration")) * 1000;
  const action = s(p, "actionTitle").trim();
  const detail = s(p, "detail").trim();
  const ic = s(p, "icon");
  const [phase, setPhase] = useState<"idle" | "touched" | "actioned">("idle");
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const clock = useRef({ used: 0, since: 0, paused: false, done: false });
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    if (clock.current.done) return;
    clock.current.done = true;
    dismissRef.current();
  }, []);
  const pause = () => {
    const c = clock.current;
    if (c.paused) return;
    c.used += performance.now() - c.since;
    c.paused = true;
  };
  const resume = () => {
    clock.current.since = performance.now();
    clock.current.paused = false;
  };

  // Each presentation (and presenting again while visible) restarts the countdown and arrives with its haptic.
  useEffect(() => {
    if (!shown) return;
    clock.current = { used: 0, since: performance.now(), paused: false, done: false };
    setPhase("idle");
    setOffset(0);
    rt.haptic(TOAST_HAPTIC[kind], card.current);
    bounce(tile.current, 120);
  }, [shown, run, kind, rt]);

  // The timer line drains left to right and holds while touched.
  useEffect(() => {
    if (!shown) return;
    let raf = 0;
    const tick = () => {
      const c = clock.current;
      const used = c.paused ? c.used : c.used + (performance.now() - c.since);
      const left = clamp(1 - used / duration, 0, 1);
      if (bar.current) bar.current.style.transform = `scaleX(${left})`;
      if (left <= 0) return dismiss();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, run, duration, dismiss]);

  // Any touch pauses; movement toward the edge is free, away is rubber-banded; a flick toward the edge dismisses.
  const drag = useDrag({
    slop: 0,
    onStart() {
      if (clock.current.done) return;
      pause();
      setPhase((ph) => (ph === "actioned" ? ph : "touched"));
      setDragging(true);
    },
    onMove({ dy }) {
      setOffset(top ? Math.min(dy, 0) + Math.max(dy, 0) * 0.15 : Math.max(dy, 0) + Math.min(dy, 0) * 0.15);
    },
    onEnd({ dy, vy }) {
      setDragging(false);
      if (clock.current.done) return;
      const predicted = dy + vy * 0.2;
      const away = top ? -predicted : predicted;
      if (away > 40) {
        rt.haptic("soft", card.current);
        dismiss();
        return;
      }
      setOffset(0);
      setPhase((ph) => (ph === "actioned" ? ph : "idle"));
      if (phase !== "actioned") resume();
    },
  });

  const onAction = () => {
    if (phase === "actioned" || clock.current.done) return;
    pause();
    setPhase("actioned");
    window.setTimeout(dismiss, 420);
  };

  const dark = scheme === "dark";
  const surface = dark ? "#2A2A2A" : house.ink;
  const label = house.dark.text;
  const secondary = house.dark.muted;
  const hidden = `translateY(${top ? "calc(-100% - 90px)" : "calc(100% + 60px)"}) scale(.92)`;
  const transform = shown ? `translateY(${offset}px) scale(${phase === "touched" && !reduced ? 0.97 : 1})` : reduced ? "none" : hidden;
  return (
    <div style={layer}>
      <div
        ref={card}
        onPointerDown={drag}
        style={{
          position: "absolute", left: 16, right: 16, margin: "0 auto", maxWidth: 520,
          ...(top ? { top: 67 } : { bottom: 42 }),
          pointerEvents: "auto", touchAction: "none",
          display: "flex", alignItems: "center", gap: 12,
          padding: `10px ${action ? 10 : 16}px 10px 10px`,
          borderRadius: cr(22), background: surface, color: label,
          boxShadow: "0 10px 24px rgba(0,0,0,.22)",
          transformOrigin: top ? "top center" : "bottom center",
          transform, opacity: shown ? 1 : 0,
          transition: dragging ? "opacity .3s" : `transform ${shown ? ".5s" : ".42s"} ${shown ? BOUNCE : SPRING}, opacity .3s`,
        }}
      >
        <span ref={tile} style={{ width: 40, height: 40, borderRadius: cr(12), flex: "none", display: "grid", placeItems: "center", background: TOAST_TILE[kind], color: INK }}>
          <Glyph name={ic !== "none" ? ic : TOAST_STYLE_SYMBOL[kind]} size={19} strokeWidth={2.6} />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ ...font("subheadline", 600), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s(p, "message")}</span>
          {detail ? <span style={{ ...font("footnote"), color: secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</span> : null}
        </span>
        {action ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onAction}
            style={{ ...reset, ...font("subheadline", 700), minWidth: 64, height: 40, padding: "0 16px", boxSizing: "border-box", borderRadius: cr(20), background: ACCENT, color: ACCENT_INK, flex: "none", display: "grid", placeItems: "center" }}
          >
            <Swap first={action} second={<Glyph name="checkmark" size={16} strokeWidth={3.2} />} showSecond={phase === "actioned"} />
          </button>
        ) : null}
        <span aria-hidden style={{ position: "absolute", left: 22, right: 22, bottom: 5, height: 2, borderRadius: cr(1), overflow: "hidden" }}>
          <span ref={bar} style={{ display: "block", height: "100%", borderRadius: cr(1), background: "rgba(244,243,239,.28)", transformOrigin: "left center" }} />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Confirm Sheet

const ConfirmSheet: Renderer = (r) => {
  const overlay = useOverlay();
  const [open, setOpen] = useLive(b(r.p, "presented"));
  const [session, setSession] = useState(0);
  const present = () => {
    if (open) return;
    setSession((x) => x + 1);
    setOpen(true);
  };
  return (
    <Root r={r}>
      <Trigger p={r.p} onPress={present} />
      {overlay ? createPortal(<ConfirmLayer key={session} p={r.p} open={open} onDismiss={() => setOpen(false)} />, overlay) : null}
    </Root>
  );
};

function ConfirmLayer({ p, open, onDismiss }: { p: RenderProps["p"]; open: boolean; onDismiss: () => void }) {
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const { mounted, shown } = usePresence(open, 520);
  const [phase, setPhase] = useState<"idle" | "confirming" | "done">("idle");
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLSpanElement>(null);
  const timers = useTimers();
  const confirmPress = usePress(0.97);
  const cancelPress = usePress(0.97);
  const destructive = b(p, "destructive");
  const inline = s(p, "presentation") === "inline";
  const busy = phase !== "idle";

  useEffect(() => {
    if (!shown) return;
    setPhase("idle");
    setOffset(0);
    bounce(tile.current, 200);
    if (destructive) rt.haptic("warning", tile.current);
  }, [shown, destructive, rt]);

  const dismiss = () => {
    timers.clear();
    onDismiss();
  };
  const confirm = () => {
    if (busy) return;
    setPhase("confirming");
    timers.after(1000, () => {
      setPhase("done");
      rt.haptic("success", tile.current);
      timers.after(reduced ? 250 : 550, onDismiss);
    });
  };

  // Downward drag is free, upward is rubber-banded; a flick or a long pull dismisses.
  const drag = useDrag({
    axis: "y",
    onStart: () => setDragging(true),
    onMove: ({ dy }) => setOffset(Math.max(dy, 0) + Math.min(dy, 0) * 0.12),
    onEnd: ({ dy, vy }) => {
      setDragging(false);
      const h = card.current?.offsetHeight ?? 320;
      if (dy + vy * 0.25 > 90 || dy > h * 0.4) dismiss();
      else setOffset(0);
    },
  });

  if (!mounted) return null;
  const primaryFill = destructive ? B.tangerine : houseVar("text");
  const primaryInk = destructive ? INK : houseVar("ground");
  return (
    <div style={layer}>
      <div onClick={() => !busy && dismiss()} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", opacity: shown ? 1 : 0, transition: "opacity .35s", pointerEvents: shown ? "auto" : "none" }} />
      <div
        ref={card}
        onPointerDown={drag}
        style={{
          position: "absolute", left: inline ? 10 : 8, right: inline ? 10 : 8, bottom: inline ? 10 : 8, pointerEvents: "auto", touchAction: "none",
          display: "flex", flexDirection: "column", padding: "10px 20px 24px",
          borderRadius: cr(34), background: houseVar("surface"), color: houseVar("text"),
          boxShadow: inline ? "0 14px 34px rgba(0,0,0,.22)" : "none",
          transform: shown ? `translateY(${offset}px)` : "translateY(calc(100% + 16px))",
          transition: dragging ? "none" : `transform ${shown ? ".45s" : ".4s"} ${SPRING}`,
        }}
      >
        <span aria-hidden style={{ alignSelf: "center", width: 36, height: 5, borderRadius: cr(3), background: houseVar("raised"), marginBottom: 18 }} />
        <span ref={tile} style={{ width: 60, height: 60, borderRadius: cr(18), display: "grid", placeItems: "center", color: phase !== "done" && destructive ? ACCENT_INK : INK, background: phase === "done" ? B.sage : destructive ? B.tangerine : B.sky, transition: `background-color .3s` }}>
          <Swap first={<Glyph name={s(p, "icon") === "none" ? "questionmark.circle" : s(p, "icon")} size={26} strokeWidth={2.4} />} second={<Glyph name="checkmark" size={26} strokeWidth={3} />} showSecond={phase === "done"} />
        </span>
        <span style={{ fontSize: "calc(26px * var(--spb-text, 1))", fontWeight: fw(700), letterSpacing: "-0.6px", lineHeight: 1.15, marginTop: 20 }}>{s(p, "title")}</span>
        <span style={{ ...font("body"), color: houseVar("muted"), marginTop: 6 }}>{s(p, "message")}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <button type="button" {...confirmPress.bind} onClick={confirm} style={{ ...reset, ...headline, position: "relative", height: 56, borderRadius: cr(18), background: primaryFill, color: primaryInk, display: "grid", placeItems: "center", ...confirmPress.style }}>
            <span style={{ opacity: busy ? 0 : 1, transition: "opacity .2s" }}>{s(p, "confirmTitle")}</span>
            <Spinner shown={phase === "confirming"} color={primaryInk} />
            <span style={{ position: "absolute", display: "grid", opacity: phase === "done" ? 1 : 0, transform: phase === "done" ? "none" : "scale(.5)", transition: `opacity .2s, transform .35s ${BOUNCE}` }}><Glyph name="checkmark" size={20} strokeWidth={3.2} /></span>
          </button>
          <button type="button" {...cancelPress.bind} onClick={() => !busy && dismiss()} style={{ ...reset, ...headline, height: 56, borderRadius: cr(18), background: houseVar("raised"), color: houseVar("text"), opacity: busy ? 0.5 : 1, ...cancelPress.style, transition: `${cancelPress.style.transition}, opacity .2s` }}>
            {s(p, "cancelTitle")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Permission Sheet

const ALERT_COPY: Record<string, string> = {
  notifications: "Notifications may include alerts, sounds and icon badges. You can change this in Settings.",
  camera: "Used to scan codes and documents, and to record clips.",
  photos: "Used to pick, edit and share the photos you choose.",
  microphone: "Used to record voice notes and replies.",
};

const PermissionSheet: Renderer = (r) => {
  const overlay = useOverlay();
  const [open, setOpen] = useLive(b(r.p, "presented"));
  const [session, setSession] = useState(0);
  const present = () => {
    if (open) return;
    setSession((x) => x + 1);
    setOpen(true);
  };
  return (
    <Root r={r}>
      <Trigger p={r.p} onPress={present} />
      {overlay ? createPortal(<PermissionLayer key={session} p={r.p} scheme={r.scheme} open={open} onDismiss={() => setOpen(false)} />, overlay) : null}
    </Root>
  );
};

type PermissionPhase = "idle" | "requesting" | "asking" | "granted" | "denied";

function PermissionLayer({ p, scheme, open, onDismiss }: { p: RenderProps["p"]; scheme: Scheme; open: boolean; onDismiss: () => void }) {
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const { mounted, shown } = usePresence(open, 560);
  const [phase, setPhase] = useState<PermissionPhase>("idle");
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const tile = useRef<HTMLSpanElement>(null);
  const timers = useTimers();
  const primaryPress = usePress(0.97);
  const perm = PERMISSIONS[s(p, "permission")] ?? PERMISSIONS.notifications;
  const benefits = list(p.benefits, 3);
  const ic = s(p, "icon");

  useEffect(() => {
    if (!shown) return;
    setPhase("idle");
    setOffset(0);
    bounce(tile.current, 250);
  }, [shown]);

  const dismiss = () => {
    timers.clear();
    onDismiss();
  };
  const primary = (el: HTMLElement) => {
    if (phase === "denied") {
      rt.haptic("light", el);
      return dismiss();
    }
    if (phase !== "idle") return;
    setPhase("requesting");
    // The system asks while the button spins; the preview shows iOS's own alert and lets you answer.
    timers.after(350, () => setPhase("asking"));
  };
  const answer = (granted: boolean) => {
    setPhase(granted ? "granted" : "denied");
    rt.haptic(granted ? "success" : "warning", tile.current);
    if (granted) timers.after(900, onDismiss);
  };

  const drag = useDrag({
    axis: "y",
    onStart: () => setDragging(true),
    onMove: ({ dy }) => setOffset(Math.max(dy, 0) + Math.min(dy, 0) * 0.1),
    onEnd: ({ dy, vy }) => {
      setDragging(false);
      if (phase !== "requesting" && phase !== "asking" && (dy + vy * 0.25 > 120 || dy > 260)) dismiss();
      else setOffset(0);
    },
  });

  if (!mounted) return null;
  const granted = phase === "granted";
  const denied = phase === "denied";
  const busy = phase === "requesting" || phase === "asking";
  const tileFill = granted ? B.sage : denied ? B.sand : B.sky;
  const buttonFill = granted ? B.sage : denied ? houseVar("text") : ACCENT;
  const buttonInk = denied ? houseVar("surface") : INK;
  const copy = (on: boolean): CSSProperties => ({ gridArea: "1 / 1", display: "flex", flexDirection: "column", gap: 8, opacity: on ? 1 : 0, filter: on || reduced ? "none" : "blur(6px)", transition: "opacity .35s, filter .35s", pointerEvents: on ? "auto" : "none" });
  const title = (t: string) => <span style={{ fontSize: "calc(30px * var(--spb-text, 1))", fontWeight: fw(700), letterSpacing: "-0.8px", lineHeight: 1.1 }}>{t}</span>;
  const message = (t: string) => <span style={{ ...font("body"), color: houseVar("muted") }}>{t}</span>;
  const tiles = [B.butter, B.lilac, B.sage];
  return (
    <div style={layer}>
      <div onClick={() => !busy && dismiss()} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", opacity: shown ? 1 : 0, transition: "opacity .35s", pointerEvents: shown ? "auto" : "none" }} />
      <div
        onPointerDown={drag}
        style={{
          position: "absolute", left: 0, right: 0, top: 64, bottom: 0, pointerEvents: "auto", touchAction: "none",
          display: "flex", flexDirection: "column", padding: "24px 24px 58px", boxSizing: "border-box",
          borderRadius: cr("34px 34px 0 0"), background: houseVar("surface"), boxShadow: "var(--spb-card-edge, none)", color: houseVar("text"),
          transform: shown ? `translateY(${offset}px)` : "translateY(105%)",
          transition: dragging ? "none" : `transform ${shown ? ".5s" : ".42s"} ${SPRING}`,
        }}
      >
        <span ref={tile} style={{ width: 76, height: 76, borderRadius: cr(26), flex: "none", display: "grid", placeItems: "center", color: INK, background: tileFill, transform: granted && !reduced ? "scale(1.06)" : "none", transition: `background-color .3s, transform .45s ${BOUNCE}` }}>
          <Swap
            first={<Glyph name={ic === "none" ? perm.icon : ic} size={32} strokeWidth={2.3} />}
            second={<Glyph name={granted ? "checkmark" : "gearshape"} size={32} strokeWidth={granted ? 3 : 2.3} />}
            showSecond={granted || denied}
          />
        </span>
        <div style={{ display: "grid", marginTop: 22 }}>
          <div style={copy(!denied)}>{title(s(p, "title"))}{message(s(p, "message"))}</div>
          <div style={copy(denied)}>{title(s(p, "deniedTitle"))}{message(s(p, "deniedMessage"))}</div>
        </div>
        {benefits.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22, opacity: denied ? 0 : 1, transition: "opacity .3s" }}>
            {benefits.map((t, i) => (
              <div key={t + i} style={{ display: "flex", alignItems: "center", gap: 14, opacity: shown ? 1 : 0, transform: shown || reduced ? "none" : "translateY(14px)", transition: `opacity .4s ${150 + i * 80}ms, transform .5s ${BOUNCE} ${150 + i * 80}ms` }}>
                <span style={{ width: 44, height: 44, borderRadius: cr(12), flex: "none", display: "grid", placeItems: "center", background: tiles[i % tiles.length], color: INK }}>
                  <Glyph name={perm.benefits[i]?.[0] ?? "checkmark"} size={20} strokeWidth={2.2} />
                </span>
                <span style={{ ...font("body", 500) }}>{t}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ flex: "1 1 24px", minHeight: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            {...primaryPress.bind}
            onClick={(e) => primary(e.currentTarget)}
            style={{ ...reset, ...headline, position: "relative", height: 56, borderRadius: cr(18), background: buttonFill, color: buttonInk, display: "grid", placeItems: "center", ...primaryPress.style, transition: `${primaryPress.style.transition}, background-color .3s, color .3s` }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, opacity: busy ? 0 : 1, transition: "opacity .2s" }}>
              {granted ? <Glyph name="checkmark" size={17} strokeWidth={3.2} /> : null}
              {granted ? "Allowed" : denied ? "Open Settings" : s(p, "allowTitle")}
            </span>
            <Spinner shown={busy} color={INK} />
          </button>
          {b(p, "skippable") && !granted ? (
            <button type="button" onClick={() => !busy && dismiss()} style={{ ...reset, ...font("body", 600), height: 44, color: houseVar("muted") }}>Not now</button>
          ) : null}
        </div>
      </div>
      {phase === "asking" ? <SystemAlert scheme={scheme} title={`“Your App” ${perm.alert}`} message={ALERT_COPY[s(p, "permission")] ?? ""} onAnswer={answer} /> : null}
    </div>
  );
}

/** iOS's own permission alert, so the request feels like the real one. */
function SystemAlert({ scheme, title, message, onAnswer }: { scheme: Scheme; title: string; message: string; onAnswer: (granted: boolean) => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const hair = scheme === "dark" ? "rgba(84,84,88,.65)" : "rgba(60,60,67,.29)";
  const option = (label: string, granted: boolean) => (
    <button type="button" onClick={() => onAnswer(granted)} style={{ ...reset, flex: 1, height: 44, fontSize: ts(17), lineHeight: "22px", fontWeight: fw(granted ? 600 : 400), color: "var(--ios-accent)" }}>{label}</button>
  );
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.2)", pointerEvents: "auto", opacity: shown ? 1 : 0, transition: "opacity .2s" }}>
      <div style={{ width: 270, borderRadius: cr(14), overflow: "hidden", textAlign: "center", color: "var(--ios-label)", background: scheme === "dark" ? "rgba(37,37,37,.86)" : "rgba(242,242,242,.86)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)", transform: shown ? "none" : "scale(1.12)", transition: `transform .3s ${SPRING}` }}>
        <div style={{ padding: "19px 16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: ts(17), fontWeight: fw(600), lineHeight: "22px" }}>{title}</span>
          {message ? <span style={{ fontSize: ts(13), lineHeight: "18px" }}>{message}</span> : null}
        </div>
        <div style={{ display: "flex", borderTop: `0.5px solid ${hair}` }}>
          {option("Don’t Allow", false)}
          <span style={{ width: 0.5, background: hair }} />
          {option("Allow", true)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Glass Action Menu

const TRIGGER = 60;
const ITEM = 52;
const GAP = 12;
/** Liquid Glass stand-in: a blurred, saturated backdrop with a bright top rim. */
const glass: CSSProperties = {
  background: "color-mix(in srgb, var(--h-surface) 45%, transparent)",
  backdropFilter: "blur(12px) saturate(1.6)",
  WebkitBackdropFilter: "blur(12px) saturate(1.6)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), inset 0 0 0 .5px rgba(255,255,255,.2)",
};

function menuTarget(i: number, count: number, arc: boolean) {
  const reach = TRIGGER / 2 + GAP + ITEM / 2;
  if (!arc) return { x: 0, y: -(reach + i * (ITEM + GAP)) };
  const steps = Math.max(count - 1, 1);
  const halfStep = Math.PI / 2 / steps / 2;
  const radius = Math.max(reach + 28, (ITEM + GAP) / 2 / Math.sin(halfStep));
  const angle = Math.PI / 2 + (Math.PI / 2) * (i / steps);
  return { x: Math.cos(angle) * radius, y: -Math.sin(angle) * radius };
}

const GlassActionMenu: Renderer = (r) => {
  const { p, scheme } = r;
  const rt = useRuntime();
  const overlay = useOverlay();
  const timers = useTimers();
  const slot = useRef<HTMLDivElement>(null);
  const labels = list(p.items, 5);
  const items = labels.length ? labels : ["Action"];
  const arc = s(p, "arrangement") !== "linear";
  const tinted = b(p, "tinted");
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [labelsOn, setLabelsOn] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [firing, setFiring] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const state = useRef({ open: false, hovered: null as number | null, firing: false });
  state.current = { open, hovered, firing };

  const expand = useCallback(() => {
    const host = rt.overlay();
    const el = slot.current;
    if (!host || !el) return;
    const scale = rt.scale() || 1;
    const a = host.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    setOrigin({ x: (t.left - a.left) / scale, y: (t.top - a.top) / scale });
    timers.clear();
    setActive(true);
    setOpen(true);
    items.forEach((_, i) => timers.after(20 + i * 45, () => setCount(i + 1)));
    timers.after(20 + items.length * 45 + 200, () => setLabelsOn(true));
  }, [rt, timers, items]);

  const collapse = useCallback(() => {
    timers.clear();
    setOpen(false);
    setHovered(null);
    setLabelsOn(false);
    items.forEach((_, k) => timers.after(k * 35, () => setCount(items.length - 1 - k)));
    timers.after(items.length * 35 + 420, () => setActive(false));
  }, [timers, items]);

  const fire = (i: number, el: Element | null) => {
    if (state.current.firing) return;
    setHovered(i);
    setFiring(true);
    rt.haptic("rigid", el);
    window.setTimeout(() => {
      setFiring(false);
      collapse();
      if (b(p, "confirmsAction")) {
        setConfirming(true);
        window.setTimeout(() => setConfirming(false), 900);
      }
    }, 140);
  };

  // Tap toggles. Holding 350 ms opens, and the same touch can slide across the actions; releasing on one fires it.
  const onTriggerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const scale = rt.scale() || 1;
    let longPressed = false;
    setPressed(true);
    const hold = state.current.open ? 0 : window.setTimeout(() => {
      longPressed = true;
      rt.haptic("soft", el);
      expand();
    }, 350);
    const move = (ev: PointerEvent) => {
      if (!state.current.open || state.current.firing) return;
      const x = (ev.clientX - cx) / scale;
      const y = (ev.clientY - cy) / scale;
      const hit = items.findIndex((_, i) => {
        const t = menuTarget(i, items.length, arc);
        return Math.hypot(x - t.x, y - t.y) <= ITEM / 2 + 8;
      });
      const next = hit < 0 ? null : hit;
      if (next !== state.current.hovered) {
        state.current.hovered = next;
        setHovered(next);
        if (next !== null) rt.haptic("selection", el);
      }
    };
    const up = () => {
      window.clearTimeout(hold);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setPressed(false);
      const { open: isOpen, hovered: over } = state.current;
      if (over !== null && isOpen) fire(over, el);
      else if (!longPressed) (isOpen ? collapse() : expand());
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const alignment = s(p, "alignment");
  const labelFill = scheme === "dark" ? house.dark.raised : house.light.surface;
  const trigger = (inOverlay: boolean) => (
    <span
      onPointerDown={onTriggerDown}
      role="button"
      aria-label={open ? "Close menu" : "Open menu"}
      style={{
        position: inOverlay ? "absolute" : "relative", left: inOverlay ? origin.x : undefined, top: inOverlay ? origin.y : undefined,
        width: TRIGGER, height: TRIGGER, borderRadius: cr("50%"), display: "grid", placeItems: "center", cursor: "pointer",
        background: `var(--spb-accent, #FF0000)`, color: INK, zIndex: 3, pointerEvents: "auto", touchAction: "none",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 8px 14px rgba(0,0,0,.18)",
        visibility: !inOverlay && active ? "hidden" : "visible",
        transform: `scale(${pressed ? 0.92 : 1})`, transition: `transform .3s ${BOUNCE}`,
      }}
    >
      <span style={{ display: "grid", transform: `rotate(${open && !confirming ? 45 : 0}deg)`, transition: `transform .4s ${BOUNCE}` }}>
        <Swap first={<Glyph name={s(p, "triggerIcon") === "none" ? "plus" : s(p, "triggerIcon")} size={26} strokeWidth={2.6} />} second={<Glyph name="checkmark" size={26} strokeWidth={3} />} showSecond={confirming} />
      </span>
    </span>
  );

  const menu = active ? (
    <div style={layer}>
      <div onClick={() => collapse()} style={{ position: "absolute", inset: 0, background: "#000", opacity: open ? 0.28 : 0, transition: "opacity .3s", pointerEvents: open ? "auto" : "none" }} />
      {items.map((label, i) => {
        const t = menuTarget(i, items.length, arc);
        const out = i < count;
        const lifted = hovered === i;
        const lift = firing && lifted ? 1.2 : lifted ? 1.12 : 1;
        const above = arc && i === 0 && items.length > 2;
        const fill = tinted ? B[ITEM_BLOCKS[i % ITEM_BLOCKS.length]] : undefined;
        return (
          <div
            key={label + i}
            style={{
              position: "absolute", left: origin.x + (TRIGGER - ITEM) / 2, top: origin.y + (TRIGGER - ITEM) / 2, width: ITEM, height: ITEM, zIndex: lifted ? 2 : 1,
              transform: out ? `translate(${t.x}px, ${t.y}px)` : "scale(.5)", opacity: out ? 1 : 0,
              transition: out ? `transform .5s ${BOUNCE}, opacity .3s` : `transform .4s ${SPRING}, opacity .25s`,
            }}
          >
            <button
              type="button"
              aria-label={label}
              onClick={(e) => fire(i, e.currentTarget)}
              style={{
                ...reset, width: ITEM, height: ITEM, borderRadius: cr("50%"), display: "grid", placeItems: "center", pointerEvents: open ? "auto" : "none",
                ...(fill ? { background: fill, color: INK, boxShadow: `inset 0 1px 0 rgba(255,255,255,.5), 0 ${lifted ? 8 : 3}px ${lifted ? 12 : 6}px rgba(0,0,0,${lifted ? 0.22 : 0.1})` } : { ...glass, color: "var(--ios-label)" }),
                transform: `scale(${lift})`, transition: `transform .28s ${BOUNCE}, box-shadow .28s`,
              }}
            >
              <Glyph name={itemSymbol(label, i)} size={22} strokeWidth={2.2} />
            </button>
            <span
              aria-hidden
              style={{
                position: "absolute", whiteSpace: "nowrap", ...font("subheadline", 600), padding: "7px 12px", borderRadius: cr(999),
                background: labelFill, color: houseVar("text"), boxShadow: "0 3px 8px rgba(0,0,0,.12)", pointerEvents: "none",
                ...(above ? { left: "50%", bottom: "calc(100% + 8px)", transform: `translate(-50%, ${labelsOn ? 0 : 6}px)` } : { right: "calc(100% + 10px)", top: "50%", transform: `translate(${labelsOn ? 0 : 6}px, -50%)` }),
                opacity: labelsOn ? 1 : 0, transition: "opacity .25s, transform .25s",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
      {trigger(true)}
    </div>
  ) : null;

  return (
    <Root r={r} style={{ display: "flex", justifyContent: alignment === "leading" ? "flex-start" : alignment === "trailing" ? "flex-end" : "center" }}>
      <div ref={slot} style={{ width: TRIGGER, height: TRIGGER, flex: "none" }}>{trigger(false)}</div>
      {overlay && menu ? createPortal(menu, overlay) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Tracking Tabs

const TrackingTabs: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const parsed = list(p.titles, 5);
  const titles = parsed.length ? parsed : ["Tab"];
  const counts = parseCounts(p.counts);
  const N = titles.length;
  const [sel, setSel] = useLive(clamp(Math.round(n(p, "selected")), 0, N - 1));
  const [dragP, setDragP] = useState<number | null>(null);
  const pager = useRef<HTMLDivElement>(null);
  const base = useRef(0);
  const current = clamp(sel, 0, N - 1);
  const progress = dragP ?? current;
  const moving = dragP !== null;
  const indicator = B[s(p, "indicator")] ?? B.butter;
  const pages = Children.toArray(r.children);
  // Each page's height, so the pager takes the selected page's height (as the Swift measures it).
  const pageEls = useRef<Array<HTMLDivElement | null>>([]);
  const [heights, setHeights] = useState<number[]>([]);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const measure = () => setHeights((prev) => {
      const next = pageEls.current.map((el) => el?.offsetHeight ?? 0);
      return next.length === prev.length && next.every((h, i) => h === prev[i]) ? prev : next;
    });
    const ro = new ResizeObserver(measure);
    pageEls.current.forEach((el) => el && ro.observe(el));
    measure();
    return () => ro.disconnect();
  }, [N]);
  const pagerHeight = heights[Math.round(Math.min(Math.max(progress, 0), N - 1))] || undefined;

  const settle = (i: number, el?: Element | null) => {
    const next = clamp(i, 0, N - 1);
    if (next !== current) rt.haptic("selection", el);
    setSel(next);
  };

  // The pages follow the finger; release pages by distance and speed, one page at a time.
  const drag = useDrag({
    axis: "x",
    onStart: () => {
      base.current = current;
    },
    onMove: ({ dx }) => {
      const w = pager.current?.offsetWidth || 1;
      const raw = base.current - dx / w;
      const banded = raw < 0 ? raw * 0.3 : raw > N - 1 ? N - 1 + (raw - (N - 1)) * 0.3 : raw;
      setDragP(banded);
    },
    onEnd: ({ dx, vx, el }) => {
      const w = pager.current?.offsetWidth || 1;
      const projected = base.current - (dx + vx * 0.18) / w;
      const target = clamp(Math.round(projected), base.current - 1, base.current + 1);
      setDragP(null);
      settle(target, el);
    },
  });

  const ease = moving ? "none" : `transform .42s ${SPRING}`;
  const fade = moving ? "none" : "opacity .3s";
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ position: "relative", display: "flex", padding: 5, borderRadius: cr(999), background: houseVar("surface"), boxShadow: "0 4px 10px rgba(0,0,0,.06)" }}>
        <span aria-hidden style={{ position: "absolute", top: 5, bottom: 5, left: 5, width: `calc((100% - 10px) / ${N})`, borderRadius: cr(999), background: indicator, boxShadow: "0 2px 6px rgba(0,0,0,.12)", transform: `translateX(${progress * 100}%)`, transition: ease }} />
        {titles.map((t, i) => {
          const on = Math.max(0, 1 - Math.abs(progress - i));
          const row = (color: string, countAlpha: number, opacity: number) => (
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 14px", color, opacity, transition: fade }}>
              <span style={{ ...font("subheadline", 600), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
              {i < counts.length ? <span style={{ ...font("caption", 600), fontFamily: ff('ui-monospace, "SF Mono", Menlo, monospace'), opacity: countAlpha }}>{counts[i]}</span> : null}
            </span>
          );
          return <TabTitle key={t + i} onTap={(el) => settle(i, el)}>{row(houseVar("muted"), 0.7, 1 - on)}{row(indicator === ACCENT ? ACCENT_INK : INK, 0.62, on)}</TabTitle>;
        })}
      </div>
      <div ref={pager} onPointerDown={drag} style={{ overflow: "hidden", touchAction: "pan-y", minWidth: 0, height: pagerHeight, transition: moving ? "none" : `height .42s ${SPRING}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", transform: `translateX(${-progress * 100}%)`, transition: ease }}>
          {titles.map((t, i) => (
            <div key={t + i} ref={(el) => { pageEls.current[i] = el; }} style={{ flex: "0 0 100%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              {pages[i] ? <Frame axis="v">{pages[i]}</Frame> : [0, 1, 2].map((k) => <span key={k} style={{ alignSelf: "stretch", height: 60, borderRadius: cr(18), background: houseVar("surface") }} />)}
            </div>
          ))}
        </div>
      </div>
    </Root>
  );
};

function TabTitle({ onTap, children }: { onTap: (el: HTMLElement) => void; children: ReactNode }) {
  const press = usePress(0.94);
  return (
    <button type="button" {...press.bind} onClick={(e) => onTap(e.currentTarget)} style={{ ...reset, position: "relative", flex: "1 1 0", minWidth: 0, minHeight: 44, ...press.style }}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Glass Segments

const GlassSegments: Renderer = (r) => {
  const { p, scheme } = r;
  const rt = useRuntime();
  const reduced = useReducedMotion();
  const parsed = list(p.options, 5);
  const options = parsed.length ? parsed : ["One", "Two"];
  const N = options.length;
  const [sel, setSel] = useLive(clamp(Math.round(n(p, "selected")), 0, N - 1));
  const index = clamp(sel, 0, N - 1);
  // While dragging: the indicator's center in points, its velocity stretch, and whether it is lifted.
  const [drag, setDrag] = useState<{ center: number; stretch: number } | null>(null);
  const [settle, setSettle] = useState<"snappy" | "bouncy">("snappy");
  const row = useRef<HTMLDivElement>(null);
  const disabled = b(p, "disabled");
  const height = n(p, "height") || 40;
  const block = s(p, "indicator") !== "glass" ? B[s(p, "indicator")] : null;

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0 || !row.current) return;
    const el = row.current;
    const scale = rt.scale() || 1;
    const rect = el.getBoundingClientRect();
    const width = el.offsetWidth || 1;
    const seg = width / N;
    const x0 = (e.clientX - rect.left) / scale;
    const y0 = e.clientY;
    const resting = (index + 0.5) * seg;
    const grabbing = Math.abs(x0 - resting) <= seg / 2;
    const grab = x0 - resting;
    let hover = index;
    let lastX = x0;
    let lastT = performance.now();
    let vx = 0;
    let raw = resting;
    let dragged = false;
    const band = (d: number) => (1 - 1 / ((d * 0.55) / seg + 1)) * seg;
    const rubber = (v: number) => (v < seg / 2 ? seg / 2 - band(seg / 2 - v) : v > width - seg / 2 ? width - seg / 2 + band(v - (width - seg / 2)) : v);
    const move = (ev: PointerEvent) => {
      const x = (ev.clientX - rect.left) / scale;
      const now = performance.now();
      vx = ((x - lastX) / Math.max(1, now - lastT)) * 1000;
      lastX = x;
      lastT = now;
      if (!grabbing) return;
      if (!dragged && Math.abs(x - x0) < 3) return;
      dragged = true;
      raw = x - grab;
      const center = rubber(raw);
      setDrag({ center, stretch: reduced ? 0 : Math.min(Math.abs(vx) / 4000, 0.12) });
      const nearest = clamp(Math.floor(center / seg), 0, N - 1);
      if (nearest !== hover) {
        hover = nearest;
        rt.haptic("selection", el);
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (performance.now() - lastT > 80) vx = 0;
      if (grabbing && dragged) {
        // Commit to where the flick would land, not just where the finger let go.
        const target = clamp(Math.floor((raw + vx * 0.2) / seg), 0, N - 1);
        if (target !== hover) rt.haptic("selection", el);
        setSettle("bouncy");
        setDrag(null);
        setSel(target);
        return;
      }
      setDrag(null);
      const x = (ev.clientX - rect.left) / scale;
      if (Math.abs(x - x0) < 10 && Math.abs((ev.clientY - y0) / scale) < 10) {
        const target = clamp(Math.floor(x / seg), 0, N - 1);
        if (target !== index) {
          rt.haptic("selection", el);
          setSettle("snappy");
          setSel(target);
        }
      }
    };
    if (grabbing) setDrag({ center: resting, stretch: 0 });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Everything in percent of the row, so it lays out before it is measured.
  const segPct = 100 / N;
  const width = row.current?.offsetWidth || 1;
  const centerPct = drag ? (drag.center / width) * 100 : (index + 0.5) * segPct;
  const lift = drag && !reduced ? 1.04 : 1;
  const stretch = drag?.stretch ?? 0;
  const w = segPct * (1 + stretch) * lift;
  const left = centerPct - w / 2;
  const motion = drag ? "transform .15s ease-out, clip-path .15s ease-out, box-shadow .25s" : settle === "bouncy" ? `transform .45s ${BOUNCE}, clip-path .45s ${BOUNCE}, box-shadow .25s` : `transform .32s ${SPRING}, clip-path .32s ${SPRING}, box-shadow .25s`;
  const surface = scheme === "dark" ? "#3A3A3A" : "#FFFFFF";
  const labels = (color: string) =>
    options.map((o, i) => (
      <span key={o + i} style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", color, ...font("subheadline", 600), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o}</span>
    ));
  return (
    <Root r={r} style={{ padding: 3, borderRadius: cr(999), background: houseVar("raised"), opacity: disabled ? 0.45 : 1, transition: "opacity .25s", touchAction: "pan-y", minWidth: 0 }}>
      <div ref={row} onPointerDown={onDown} role="radiogroup" style={{ position: "relative", height: `calc(${height}px * min(var(--spb-text, 1), 1.5))`, cursor: disabled ? "default" : "pointer" }}>
        <span
          aria-hidden
          style={{
            position: "absolute", top: 0, bottom: 0, left: 0, width: `${segPct}%`, borderRadius: cr(999),
            background: block ?? surface,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,${block ? 0.45 : 0.35}), 0 ${drag ? 5 : 1}px ${drag ? 10 : 3}px rgba(0,0,0,${drag ? 0.2 : 0.08})`,
            transform: `translateX(${(centerPct / segPct - 0.5) * 100}%) scale(${lift}) scaleX(${1 + stretch}) scaleY(${1 - stretch * 0.35})`,
            transition: motion,
          }}
        />
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>{labels(houseVar("muted"))}</div>
        <div aria-hidden style={{ position: "absolute", inset: 0, display: "flex", clipPath: `inset(0 ${clamp(100 - left - w, 0, 100)}% 0 ${clamp(left, 0, 100)}% round 999px)`, transition: motion }}>{labels(block ? INK : houseVar("text"))}</div>
      </div>
    </Root>
  );
};

export const surfacePieceRenderers: Record<string, Renderer> = {
  toast: Toast,
  "confirm-sheet": ConfirmSheet,
  "permission-sheet": PermissionSheet,
  "glass-action-menu": GlassActionMenu,
  "tracking-tabs": TrackingTabs,
  "glass-segments": GlassSegments,
};
