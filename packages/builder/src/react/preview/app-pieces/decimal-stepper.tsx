"use client";
// Decimal Stepper (definitions/app-pieces/decimal-stepper.ts): minus and plus step the boxed value
// by fractions with an increase or decrease tick, the number rolls like .numericText, holding
// repeats, the buttons dip under the finger, and dragging sideways on the value scrubs through steps.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { stepLabel } from "../../../definitions/app-pieces/decimal-stepper.js";
import { Glyph } from "../../icons.js";
import { fillStyle, n, s, useAxis, type Renderer, cr, fw, ts } from "../env.js";
import { BOUNCE, useDrag, useLive, useRuntime } from "../runtime.js";

export const DecimalStepper: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const lo = Math.min(n(p, "min"), n(p, "max"));
  const hi = Math.max(n(p, "min"), n(p, "max"));
  const step = n(p, "step") || 0.1;
  const [value, setValue] = useLive(Math.min(hi, Math.max(lo, n(p, "value"))));
  const [bump, setBump] = useState(0);
  const [pressed, setPressed] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const dragFrom = useRef(0);
  const timers = useRef<{ t?: number; i?: number }>({});
  const current = useRef(value);
  current.current = value;
  const move = (dir: number, el: Element | null) => {
    const next = Math.min(hi, Math.max(lo, Math.round((current.current + dir * step) / step) * step));
    if (Math.abs(next - current.current) < 1e-9) return;
    current.current = next;
    rt.haptic(dir > 0 ? "increase" : "decrease", el);
    setValue(next);
    setBump(dir);
  };
  const stop = () => {
    setPressed(0);
    window.clearTimeout(timers.current.t);
    window.clearInterval(timers.current.i);
    timers.current = {};
  };
  const hold = (dir: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      setPressed(dir);
      move(dir, el);
      timers.current.t = window.setTimeout(() => {
        timers.current.i = window.setInterval(() => move(dir, el), 110);
      }, 420);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  });
  const scrub = useDrag({
    axis: "x",
    onStart: () => {
      dragFrom.current = current.current;
      setScrubbing(true);
    },
    onMove: (i) => {
      const target = Math.min(hi, Math.max(lo, Math.round((dragFrom.current + Math.round(i.dx / 16) * step) / step) * step));
      const diff = target - current.current;
      if (Math.abs(diff) > 1e-9) move(diff > 0 ? 1 : -1, i.el);
    },
    onEnd: () => setScrubbing(false),
  });
  const sym = s(p, "symbol");
  const btn = (dir: number) => {
    const off = dir < 0 ? value <= lo : value >= hi;
    const Icon = dir < 0 ? Minus : Plus;
    return (
      <div role="button" aria-label={dir < 0 ? "Decrease" : "Increase"} aria-disabled={off || undefined} {...(off ? {} : hold(dir))} style={{ width: 44, height: 44, flex: "none", display: "grid", placeItems: "center", cursor: off ? "default" : "pointer", opacity: off ? 0.35 : 1, touchAction: "manipulation" }}>
        <span style={{ width: 32, height: 32, borderRadius: cr("50%"), boxShadow: "inset 0 0 0 1.5px var(--ios-label2)", background: pressed === dir ? "var(--ios-fill2)" : "transparent", display: "grid", placeItems: "center", transform: pressed === dir ? "scale(.97)" : "none", transition: "transform .12s ease-out, background .12s ease-out" }}>
          <Icon size={16} strokeWidth={2.4} />
        </span>
      </div>
    );
  };
  return (
    <div {...box} style={{ ...box.style, display: "flex", alignItems: "center", gap: 4, fontSize: ts(17), lineHeight: "22px", color: "var(--ios-label)", ...fillStyle(fill, axis), alignSelf: axis === "v" ? "stretch" : undefined }}>
      {sym && sym !== "none" ? <span style={{ width: 28, display: "grid", placeItems: "center" }}><Glyph name={sym} size={22} /></span> : null}
      <span style={{ flex: 1, minWidth: 0, paddingLeft: sym && sym !== "none" ? 8 : 0 }}>{s(p, "label")}</span>
      {btn(-1)}
      <span onPointerDown={scrub} style={{ width: 64, height: 34, borderRadius: cr(8), background: "var(--ios-fill2)", display: "grid", placeItems: "center", overflow: "hidden", cursor: "ew-resize", touchAction: "pan-y", transform: scrubbing ? "scale(1.06)" : "none", transition: `transform .3s ${BOUNCE}` }}>
        <span key={value} className="spds-roll" style={{ fontVariantNumeric: "tabular-nums", fontWeight: fw(500), animation: bump ? `spds-roll-${bump > 0 ? "up" : "down"} .3s ${BOUNCE}` : undefined }}>
          {stepLabel(value, Math.round(n(p, "decimals")), s(p, "suffix"))}
        </span>
      </span>
      {btn(1)}
      <style>{"@keyframes spds-roll-up{from{transform:translateY(40%);opacity:.3}to{transform:none;opacity:1}}@keyframes spds-roll-down{from{transform:translateY(-40%);opacity:.3}to{transform:none;opacity:1}}@media (prefers-reduced-motion: reduce){.spds-roll{animation:none!important}}"}</style>
    </div>
  );
};
