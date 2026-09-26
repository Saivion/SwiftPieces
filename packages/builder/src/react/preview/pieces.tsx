"use client";
// Web renderers for the free SwiftPieces components, painted with the pieces' own house palette
// (the values their Swift `Style` defaults use). Loaded as a separate chunk the first time a screen
// contains a piece. They draw the resting state the export starts in; motion stays in the app.
import type { CSSProperties, ReactNode } from "react";
import { house, houseBlocks } from "../../core/palette.js";
import { list } from "../../core/swift.js";
import { dockSymbol, parseSlices } from "../../definitions/pieces.js";
import { Glyph } from "../icons.js";
import { Frame, b, fillStyle, font, houseVar, n, s, useAxis, type Renderer, type RenderProps } from "./env.js";

const INK = house.ink;
const SIGNAL = house.signal;
const B = house.blocks;
const semibold: CSSProperties = { fontSize: 17, fontWeight: 600, lineHeight: "22px" };
const capsule = (h: number): CSSProperties => ({ height: h, borderRadius: h / 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 });

function Root({ r, style, children }: { r: RenderProps; style?: CSSProperties; children?: ReactNode }) {
  const axis = useAxis();
  return <div {...r.box} style={{ ...style, ...fillStyle(r.fill, axis) }}>{children}</div>;
}

const fmt = (v: number, currency: boolean, code = "USD") =>
  new Intl.NumberFormat("en-US", currency ? { style: "currency", currency: code } : { maximumFractionDigits: 2 }).format(v);

/** A formatted figure with its decimals dimmed, as LiveStat and Odometer draw them. */
function Figure({ text, dim }: { text: string; dim: string }) {
  const i = text.lastIndexOf(".");
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span style={{ color: dim }}>{text.slice(i)}</span></>;
}

// ---------------------------------------------------------------- Controls

const ElasticButton: Renderer = (r) => {
  const { p } = r;
  const style = s(p, "style");
  const fillColor = style === "signal" ? SIGNAL : style === "raised" ? houseVar("raised") : style.startsWith("block:") ? B[style.slice(6)] : "transparent";
  const ink = style === "raised" || style === "standard" ? houseVar("text") : INK;
  const ic = s(p, "icon");
  const trailing = s(p, "iconPosition") === "trailing";
  return (
    <Root r={r} style={{ ...capsule(56), padding: "0 24px", background: fillColor, color: ink, ...semibold, opacity: b(p, "disabled") ? 0.45 : 1, boxShadow: style === "signal" || style.startsWith("block:") ? "0 6px 0 -2px rgba(0,0,0,.18)" : undefined }}>
      {ic !== "none" && !trailing ? <Glyph name={ic} size={19} /> : null}
      {s(p, "title")}
      {ic !== "none" && trailing ? <Glyph name={ic} size={19} /> : null}
    </Root>
  );
};

const CommitButton: Renderer = (r) => {
  const phase = s(r.p, "phase");
  if (phase === "loading") {
    return (
      <Root r={r} style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ ...capsule(56), width: 56, background: SIGNAL }}><span className="spb-spinner" style={{ color: INK }} /></div>
      </Root>
    );
  }
  const map: Record<string, { bg: string; ink: string; label: ReactNode }> = {
    idle: { bg: SIGNAL, ink: INK, label: s(r.p, "title") },
    success: { bg: B.sage, ink: INK, label: <><Glyph name="checkmark" size={18} strokeWidth={2.4} />{s(r.p, "successTitle") || s(r.p, "title")}</> },
    error: { bg: B.butter, ink: INK, label: <><Glyph name="xmark" size={16} strokeWidth={2.4} />{s(r.p, "errorMessage")}</> },
    disabled: { bg: houseVar("raised"), ink: houseVar("muted"), label: s(r.p, "title") },
  };
  const m = map[phase] ?? map.idle;
  return <Root r={r} style={{ ...capsule(56), background: m.bg, color: m.ink, ...semibold }}>{m.label}</Root>;
};

const HoldToConfirm: Renderer = (r) => {
  const fill = s(r.p, "style") === "butter" ? B.butter : SIGNAL;
  return (
    <Root r={r} style={{ ...capsule(60), justifyContent: "flex-start", padding: 6, background: houseVar("raised"), color: houseVar("text"), position: "relative", ...semibold }}>
      <span style={{ width: 48, height: 48, borderRadius: "50%", background: fill, color: INK, display: "grid", placeItems: "center", flex: "none" }}>
        {s(r.p, "icon") !== "none" ? <Glyph name={s(r.p, "icon")} size={20} /> : null}
      </span>
      <span style={{ flex: 1, textAlign: "center", paddingRight: 48 }}>{s(r.p, "title")}</span>
      <span style={{ position: "absolute", right: 20, display: "flex", gap: 5 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: 2, background: houseVar("muted"), opacity: 0.6 }} />)}
      </span>
    </Root>
  );
};

// ---------------------------------------------------------------- Inputs

const Field = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ height: 56, borderRadius: 18, background: houseVar("field"), display: "flex", alignItems: "center", gap: 12, padding: "0 16px", color: houseVar("muted"), fontSize: 17, ...style }}>{children}</div>
);

const FormField: Renderer = (r) => (
  <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <Field>
      {s(r.p, "icon") !== "none" ? <Glyph name={s(r.p, "icon")} size={20} /> : null}
      <span>{s(r.p, "label")}</span>
    </Field>
    {s(r.p, "help").trim() ? <span style={{ ...font("footnote"), color: houseVar("muted"), paddingLeft: 16 }}>{s(r.p, "help")}</span> : null}
  </Root>
);

const SecureEntry: Renderer = (r) => (
  <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <Field>
      <span style={{ flex: 1 }}>{s(r.p, "label")}</span>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: houseVar("raised"), display: "grid", placeItems: "center", color: houseVar("text") }}><Glyph name="eye" size={18} /></span>
    </Field>
    {b(r.p, "showsStrength") ? (
      <div style={{ display: "flex", gap: 4, padding: "0 4px" }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: houseVar("empty") }} />)}</div>
    ) : null}
    {b(r.p, "showsRequirements") ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["8+ characters", "A number", "A symbol", "Mixed case"].map((t) => <span key={t} style={{ ...font("footnote", 500), padding: "4px 10px", borderRadius: 999, background: houseVar("raised"), color: houseVar("muted") }}>{t}</span>)}
      </div>
    ) : null}
  </Root>
);

const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
const AmountField: Renderer = (r) => {
  const code = s(r.p, "currency");
  const text = new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: 0 }).format(n(r.p, "amount"));
  if (s(r.p, "size") === "compact") {
    return <Root r={r}><Field style={{ justifyContent: "space-between" }}><span>{s(r.p, "label")}</span><span style={{ color: houseVar("text"), fontSize: 22, fontWeight: 300 }}>{text}</span></Field></Root>;
  }
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0" }}>
      <span style={{ ...font("subheadline", 500), color: houseVar("muted") }}>{s(r.p, "label")}</span>
      <span style={{ fontSize: 64, fontWeight: 300, letterSpacing: "-0.03em", color: houseVar("text"), lineHeight: 1.1 }}>
        {text}<span className="spb-caret" />
      </span>
      <span style={{ ...font("footnote"), color: houseVar("muted") }}>{symbols[code] ? `${code}` : ""}</span>
    </Root>
  );
};

const FilterRail: Renderer = (r) => {
  const options = list(r.p.options);
  return (
    <Root r={r} style={{ display: "flex", gap: 8, overflow: "hidden", maskImage: "linear-gradient(90deg, #000 85%, transparent)" }}>
      {(options.length ? options : ["All"]).map((o, i) => (
        <span key={o + i} style={{ height: 40, padding: "0 16px", borderRadius: 20, display: "flex", alignItems: "center", flex: "none", ...font("subheadline", 600), background: i === 0 ? (b(r.p, "multiple") ? B.tangerine : houseVar("text")) : houseVar("field"), color: i === 0 ? (b(r.p, "multiple") ? INK : houseVar("ground")) : houseVar("text") }}>
          {o}
        </span>
      ))}
    </Root>
  );
};

const ScrubStepper: Renderer = (r) => {
  const lo = Math.min(n(r.p, "min"), n(r.p, "max") - 1);
  const hi = Math.max(n(r.p, "max"), lo + 1);
  const v = Math.min(hi, Math.max(lo, n(r.p, "value")));
  const round = (label: string) => <span style={{ width: 40, height: 40, borderRadius: "50%", background: houseVar("surface"), display: "grid", placeItems: "center", color: houseVar("text"), fontSize: 22, fontWeight: 400 }}>{label}</span>;
  return (
    <Root r={r} style={{ ...capsule(52), padding: 6, gap: 10, background: houseVar("raised"), width: "fit-content" }}>
      {round("−")}
      <span style={{ minWidth: 64, height: 40, borderRadius: 14, background: B.butter, color: INK, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
      {round("+")}
    </Root>
  );
};

// ---------------------------------------------------------------- Lists

const priorities: Record<string, { bg: string; label: string }> = { high: { bg: "#FF0000", label: "High" }, medium: { bg: B.butter, label: "Medium" }, low: { bg: B.sky, label: "Low" } };
const TaskRow: Renderer = (r) => {
  const done = s(r.p, "status") === "completed";
  const pr = priorities[s(r.p, "priority")];
  return (
    <Root r={r} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 22, background: done ? B.sage : houseVar("surface"), color: done ? INK : houseVar("text") }}>
      <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", boxShadow: done ? undefined : `inset 0 0 0 2px ${houseVar("muted")}`, background: done ? INK : undefined, color: B.sage }}>
        {done ? <Glyph name="checkmark" size={16} strokeWidth={2.6} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ ...semibold, textDecoration: done ? "line-through" : undefined }}>{s(r.p, "title")}</span>
        {s(r.p, "due").trim() ? <span style={{ ...font("footnote"), color: done ? INK : houseVar("muted"), opacity: done ? 0.7 : 1 }}>{s(r.p, "status") === "snoozed" ? "Snoozed · " : ""}{s(r.p, "due")}</span> : null}
      </span>
      {pr && !done ? <span style={{ ...font("caption", 700), padding: "4px 8px", borderRadius: 8, background: pr.bg, color: INK }}>{pr.label}</span> : null}
    </Root>
  );
};

const StatusTimeline: Renderer = (r) => {
  const steps = list(r.p.steps);
  const current = n(r.p, "current");
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column" }}>
      {(steps.length ? steps : ["Step"]).map((t, i, all) => {
        const state = i < current ? "complete" : i === current ? "current" : "pending";
        return (
          <div key={t + i} style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", flex: "none", ...font("footnote", 700), background: state === "complete" ? B.sage : state === "current" ? "#FF0000" : "transparent", color: INK, boxShadow: state === "pending" ? `inset 0 0 0 2px ${houseVar("raised")}` : undefined }}>
                {state === "complete" ? <Glyph name="checkmark" size={14} strokeWidth={2.8} /> : state === "pending" ? <span style={{ color: houseVar("muted") }}>{i + 1}</span> : i + 1}
              </span>
              {i < all.length - 1 ? <span style={{ width: 2, flex: 1, minHeight: 18, background: i < current ? B.sage : houseVar("raised") }} /> : null}
            </div>
            <div style={{ paddingBottom: i < all.length - 1 ? 18 : 0, paddingTop: 3 }}>
              <div style={{ ...semibold, color: state === "pending" ? houseVar("muted") : houseVar("text") }}>{t}</div>
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

const LiveStat: Renderer = (r) => {
  const d = n(r.p, "delta");
  return (
    <Root r={r} style={{ padding: 18, borderRadius: 22, background: houseVar("surface"), color: houseVar("text"), display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ ...font("subheadline", 500), color: houseVar("muted") }}>{s(r.p, "label")}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 40, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1.1 }}><Figure text={fmt(n(r.p, "value"), s(r.p, "format") === "currency")} dim={houseVar("muted")} /></span>
        {d !== 0 ? <span style={{ ...font("footnote", 700), padding: "4px 8px", borderRadius: 8, background: d > 0 ? B.sage : B.tangerine, color: INK }}>{d > 0 ? "+" : ""}{d.toFixed(1)}%</span> : null}
      </div>
      {b(r.p, "sparkline") ? <Sparkline color={houseVar("text")} /> : null}
    </Root>
  );
};

const Odometer: Renderer = (r) => (
  <Root r={r} style={{ fontSize: n(r.p, "size"), fontWeight: 300, color: "var(--ios-label)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
    <Figure text={fmt(n(r.p, "value"), b(r.p, "currency"))} dim="var(--ios-label2)" />
  </Root>
);

const RingBreakdown: Renderer = (r) => {
  const slices = parseSlices(s(r.p, "slices"));
  const total = slices.reduce((a, x) => a + x.value, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const colors = houseBlocks.map((k) => B[k]);
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, color: houseVar("text") }}>
      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg viewBox="0 0 200 200" width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
          {slices.map((x, i) => {
            const len = (x.value / total) * C;
            const el = <circle key={i} cx="100" cy="100" r={R} fill="none" stroke={colors[i % colors.length]} strokeWidth="34" strokeDasharray={`${Math.max(0, len - 4)} ${C}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 24, fontWeight: 300 }}>{fmt(total, b(r.p, "currency")).replace(/\.\d+$/, "")}</span>
      </div>
      {b(r.p, "legend") ? (
        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}>
          {slices.map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, ...font("subheadline") }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: colors[i % colors.length] }} />
              <span style={{ flex: 1 }}>{x.label}</span>
              <span style={{ color: houseVar("muted") }}>{fmt(x.value, b(r.p, "currency")).replace(/\.\d+$/, "")}</span>
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
  const rating = n(r.p, "rating");
  const size = n(r.p, "size");
  const color = LEVELS[Math.max(0, Math.ceil(rating) - 1)] ?? LEVELS[0];
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", gap: size * 0.2 }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const f = Math.max(0, Math.min(1, rating - (i - 1)));
          return (
            <span key={i} style={{ width: size, height: size, position: "relative", color: houseVar("empty") }}>
              <svg viewBox="0 0 24 24" width={size} height={size} style={{ position: "absolute" }}><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              {f > 0 ? <svg viewBox="0 0 24 24" width={size} height={size} style={{ position: "absolute", clipPath: `inset(0 ${100 - f * 100}% 0 0)`, color }}><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg> : null}
            </span>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 300, color: houseVar("text") }}>{rating.toFixed(rating % 1 ? 1 : 0)}</span>
        {b(r.p, "labels") && rating > 0 ? <span style={{ ...font("footnote", 700), padding: "4px 8px", borderRadius: 8, background: color, color: INK }}>{WORDS[Math.ceil(rating) - 1]}</span> : null}
      </div>
    </Root>
  );
};

const ReactionToggle: Renderer = (r) => {
  const on = b(r.p, "isOn");
  const size = n(r.p, "size");
  const fill = B[s(r.p, "fill")] ?? B.tangerine;
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "fit-content" }}>
      {on && s(r.p, "confirmation").trim() ? <span style={{ ...font("footnote", 600), padding: "4px 10px", borderRadius: 999, background: houseVar("text"), color: houseVar("ground") }}>{s(r.p, "confirmation")}</span> : null}
      <span style={{ ...capsule(size * 1.9), padding: `0 ${size * 0.6}px`, background: on ? fill : houseVar("raised"), color: on ? INK : houseVar("text"), fontSize: size * 0.62, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        <Glyph name={s(r.p, "icon")} size={size} strokeWidth={2} style={on ? { fill: "currentColor" } : undefined} />
        {n(r.p, "count") > 0 ? n(r.p, "count") + (on ? 1 : 0) : null}
      </span>
    </Root>
  );
};

const outcomes: Record<string, { fill: string; mark: string }> = { success: { fill: B.sage, mark: "checkmark" }, failure: { fill: B.butter, mark: "xmark" }, empty: { fill: B.sky, mark: "tray" } };
const OutcomeScreen: Renderer = (r) => {
  const o = outcomes[s(r.p, "outcome")] ?? outcomes.success;
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, padding: "24px 0", flex: "1 1 auto", justifyContent: "center" }}>
      <span style={{ width: 96, height: 96, borderRadius: "50%", background: o.fill, color: INK, display: "grid", placeItems: "center", marginBottom: 8 }}><Glyph name={o.mark} size={42} strokeWidth={2.4} /></span>
      {s(r.p, "eyebrow").trim() ? <span style={{ ...font("footnote", 700), letterSpacing: "0.06em", textTransform: "uppercase", color: houseVar("muted") }}>{s(r.p, "eyebrow")}</span> : null}
      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: houseVar("text") }}>{s(r.p, "title")}</span>
      {s(r.p, "message").trim() ? <span style={{ ...font("body"), color: houseVar("muted"), maxWidth: 300 }}>{s(r.p, "message")}</span> : null}
      <span style={{ ...capsule(56), alignSelf: "stretch", marginTop: 12, background: SIGNAL, color: INK, ...semibold }}>{s(r.p, "primaryTitle") || "Continue"}</span>
    </Root>
  );
};

const SkeletonLoader: Renderer = (r) => {
  const shape = s(r.p, "shape");
  const bone = "var(--h-bone)";
  if (shape === "text") {
    const lines = n(r.p, "lines");
    return (
      <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: lines }, (_, i) => <span key={i} className="spb-shimmer" style={{ height: 12, borderRadius: 6, background: bone, width: i === lines - 1 && lines > 1 ? "60%" : "100%" }} />)}
      </Root>
    );
  }
  const h = n(r.p, "height");
  return <Root r={r} style={{ height: h, width: shape === "circle" ? h : undefined, borderRadius: shape === "circle" || shape === "capsule" ? 999 : 12, background: bone }}><span className="spb-shimmer" style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit" }} /></Root>;
};

const StatusMorph: Renderer = (r) => {
  const state = s(r.p, "state");
  const size = n(r.p, "size");
  const lw = Math.max(3, Math.round(size / 16));
  const captions: Record<string, string> = { loading: "Saving", success: "Saved", failure: "Failed" };
  const solid = state === "success" ? B.sage : state === "failure" ? B.tangerine : null;
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "fit-content" }}>
      <span style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: solid ?? undefined, color: INK, boxShadow: solid ? undefined : `inset 0 0 0 ${lw}px ${houseVar("empty")}`, position: "relative" }}>
        {state === "success" ? <Glyph name="checkmark" size={size * 0.5} strokeWidth={2.6} /> : state === "failure" ? <Glyph name="xmark" size={size * 0.44} strokeWidth={2.6} /> : null}
        {state === "loading" ? <span className="spb-spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${lw}px solid transparent`, borderTopColor: houseVar("text") }} /> : null}
      </span>
      {b(r.p, "captions") && captions[state] ? <span style={{ ...font("subheadline", 600), color: houseVar("text") }}>{captions[state]}</span> : null}
    </Root>
  );
};

// ---------------------------------------------------------------- AI

const PromptChips: Renderer = (r) => {
  const items = list(r.p.suggestions, 8);
  return (
    <Root r={r} style={{ display: "flex", gap: 10, overflow: "hidden", maskImage: "linear-gradient(90deg, #000 85%, transparent)" }}>
      {(items.length ? items : ["Ask anything"]).map((t, i) => (
        <span key={t + i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 10px 10px", borderRadius: 18, background: houseVar("surface"), color: houseVar("text"), flex: "none", ...font("subheadline", 500) }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: [B.butter, B.sky, B.sage, B.lilac][i % 4], color: INK, display: "grid", placeItems: "center" }}><Glyph name="sparkles" size={14} /></span>
          {t}
        </span>
      ))}
    </Root>
  );
};

const ThinkingState: Renderer = (r) => {
  const pres = s(r.p, "presentation");
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, ...font("footnote", 600), color: houseVar("muted") }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: B.lilac, color: INK, display: "grid", placeItems: "center" }}><Glyph name="sparkles" size={12} /></span>
        Assistant · 2s
      </div>
      {pres === "dots" ? <div style={{ display: "flex", gap: 6 }}>{[B.tangerine, B.butter, B.sky].map((c, i) => <span key={i} className="spb-bob" style={{ width: 10, height: 10, borderRadius: 5, background: c, animationDelay: `${i * 0.15}s` }} />)}</div> : null}
      {pres === "sheen" ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: n(r.p, "lineCount") }, (_, i) => <span key={i} className="spb-shimmer" style={{ height: 12, borderRadius: 6, background: houseVar("raised"), width: i === n(r.p, "lineCount") - 1 ? "55%" : "100%" }} />)}</div> : null}
      {pres === "text" ? <span className="spb-sheen-text" style={{ ...font("body", 500), color: houseVar("muted") }}>{s(r.p, "text")}</span> : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Text

const TextReveal: Renderer = (r) => {
  const text = s(r.p, "text");
  const hl = list(r.p.highlights, 4).filter((h) => text.includes(h));
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const hit = hl.map((h) => ({ h, i: rest.indexOf(h) })).filter((x) => x.i >= 0).sort((a, c) => a.i - c.i)[0];
    if (!hit) {
      parts.push(rest);
      break;
    }
    if (hit.i) parts.push(rest.slice(0, hit.i));
    parts.push(<mark key={key++} style={{ background: B.butter, color: INK, borderRadius: 6, padding: "0 4px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{hit.h}</mark>);
    rest = rest.slice(hit.i + hit.h.length);
  }
  return <Root r={r} style={{ fontSize: n(r.p, "size"), fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.03em", color: "var(--ios-label)", textAlign: s(r.p, "alignment") === "center" ? "center" : "left", maxWidth: "100%" }}>{parts}</Root>;
};

const ExpandableText: Renderer = (r) => (
  <Root r={r} style={{ position: "relative", ...font(s(r.p, "style")), color: "var(--ios-label)" }}>
    <div style={{ display: "-webkit-box", WebkitLineClamp: n(r.p, "lineLimit"), WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s(r.p, "text")}</div>
    <span style={{ position: "absolute", right: 0, bottom: 0, paddingLeft: 40, background: "linear-gradient(90deg, transparent, var(--spb-ground) 40px)", color: "var(--ios-accent)", fontWeight: 600 }}>more</span>
  </Root>
);

// ---------------------------------------------------------------- Navigation, cards

const FloatingDock: Renderer = (r) => {
  const items = list(r.p.items, 6);
  const safe = items.length ? items : ["Home"];
  const sel = Math.min(n(r.p, "selected"), safe.length - 1);
  return (
    <Root r={r} style={{ display: "flex", gap: 6, padding: 8, borderRadius: 999, background: houseVar("surface"), boxShadow: "0 10px 30px rgba(0,0,0,.25)", width: "fit-content", alignSelf: "center" }}>
      {safe.map((t, i) => (
        <span key={t + i} style={{ height: 48, minWidth: 48, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: i === sel ? "0 16px" : 0, background: i === sel ? "#FFD976" : undefined, color: i === sel ? INK : houseVar("muted"), ...font("subheadline", 600) }}>
          <Glyph name={dockSymbol(t)} size={20} />
          {i === sel ? t : null}
        </span>
      ))}
    </Root>
  );
};

const MotionCard: Renderer = (r) => {
  const fill = s(r.p, "fill") === "signal" ? "#FF0000" : B[s(r.p, "fill")] ?? "#FF0000";
  return (
    <Root r={r} style={{ perspective: 800 }}>
      <div
        className="spb-tilt"
        style={{
          borderRadius: n(r.p, "radius"), background: fill, minHeight: n(r.p, "height"), padding: 22,
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
          boxShadow: "0 18px 40px -18px rgba(0,0,0,.45)",
          // The card's own ink, which plain Text inside it inherits (as `foregroundStyle` does in SwiftUI).
          ["--ios-label" as string]: INK, ["--ios-label2" as string]: "rgba(20,20,20,.62)", ["--ios-label3" as string]: "rgba(20,20,20,.35)", ["--ios-accent" as string]: INK,
        }}
      >
        <Frame axis="v">{r.children}</Frame>
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
