"use client";
// One control per property type. Only what a property means: a switch for a Bool, swatches for a
// color, a segmented control for a short choice, a slider with its value for a number. Edits apply
// locally on every change; the store coalesces a drag or a typed word into one undo step.
import { useId, type ReactNode } from "react";
import { colors, icons } from "../../core/palette.js";
import type { PropValue, PropertyDefinition, Screen } from "../../core/schema.js";
import { Glyph, UI } from "../icons.js";

export function Field({ p, value, onChange, locked, onLocked, screens, ownScreenId }: {
  p: PropertyDefinition;
  value: PropValue;
  onChange: (v: PropValue) => void;
  locked: boolean;
  onLocked?: () => void;
  /** For link properties: the screens a tap can open. */
  screens?: Screen[];
  ownScreenId?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const common = { id, disabled: locked, "aria-describedby": p.hint ? hintId : undefined };
  let control: ReactNode;
  switch (p.type) {
    case "text": {
      const long = (p.maxLength ?? 0) > 120;
      control = long ? (
        <textarea className="spp-input spp-textarea" rows={3} value={String(value)} maxLength={p.maxLength} onChange={(e) => onChange(e.target.value)} {...common} />
      ) : (
        <input type="text" className="spp-input" value={String(value)} maxLength={p.maxLength} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} {...common} />
      );
      break;
    }
    case "boolean":
      control = (
        <button type="button" role="switch" aria-checked={value === true} className="spp-switch" onClick={() => onChange(!(value === true))} {...common}>
          <span aria-hidden />
        </button>
      );
      break;
    case "number":
    case "spacing": {
      const step = p.step ?? 1;
      const wide = (p.max ?? 100) - (p.min ?? 0) > 1000;
      control = (
        <div className="spp-number">
          {!wide ? <input type="range" min={p.min} max={p.max} step={step} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} disabled={locked} tabIndex={-1} aria-hidden /> : null}
          <input type="number" className="spp-input spp-input-num" min={p.min} max={p.max} step={step} value={Number(value)} onChange={(e) => e.target.value !== "" && onChange(Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, Number(e.target.value))))} {...common} />
        </div>
      );
      break;
    }
    case "select":
      control = (p.options?.length ?? 0) <= 3 && p.options!.every((o) => o.label.length <= 12) ? (
        <div className="spp-seg spp-seg-fill" role="radiogroup" aria-labelledby={`${id}-label`}>
          {p.options!.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={locked} onClick={() => onChange(o.value)}>{o.label}</button>
          ))}
        </div>
      ) : (
        <select className="spp-select" value={String(value)} onChange={(e) => onChange(e.target.value)} {...common}>
          {p.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case "color":
      control = (
        <div className="spp-swatches" role="radiogroup" aria-labelledby={`${id}-label`}>
          {(p.options ?? colors.map((c) => ({ value: c.id, label: c.label }))).map((o) => {
            const c = colors.find((x) => x.id === o.value);
            return <button key={o.value} type="button" role="radio" aria-checked={value === o.value} aria-label={o.label} title={o.label} disabled={locked} onClick={() => onChange(o.value)} className="spp-swatch" style={{ ["--sw" as string]: c ? c.dark : "#888" }} />;
          })}
        </div>
      );
      break;
    case "icon":
      control = (
        <div className="spp-icon-select">
          <span className="spp-icon-preview" aria-hidden>{value !== "none" ? <Glyph name={String(value)} size={17} /> : null}</span>
          <select className="spp-select" value={String(value)} onChange={(e) => onChange(e.target.value)} {...common}>
            {icons.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </div>
      );
      break;
    case "link": {
      const others = (screens ?? []).filter((s) => s.id !== ownScreenId);
      const v = String(value);
      const known = v === "" || v === "back" || others.some((s) => s.id === v || `sheet:${s.id}` === v || `root:${s.id}` === v);
      control = (
        <select className="spp-select" value={known ? v : ""} onChange={(e) => onChange(e.target.value)} {...common}>
          <option value="">Does nothing</option>
          {others.length ? (
            <optgroup label="Push">
              {others.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
            </optgroup>
          ) : null}
          {others.length ? (
            <optgroup label="Present as a sheet">
              {others.map((s) => <option key={`sheet:${s.id}`} value={`sheet:${s.id}`}>{label(s)}</option>)}
            </optgroup>
          ) : null}
          {others.length ? (
            <optgroup label="Finish and make it the root">
              {others.map((s) => <option key={`root:${s.id}`} value={`root:${s.id}`}>{label(s)}</option>)}
            </optgroup>
          ) : null}
          <option value="back">Go back or dismiss</option>
        </select>
      );
      break;
    }
  }
  return (
    <div className={`spp-field${locked ? " is-locked" : ""}`} data-type={p.type} onClickCapture={locked && onLocked ? (e) => { e.preventDefault(); onLocked(); } : undefined}>
      <label id={`${id}-label`} htmlFor={id} className="spp-field-label">
        {p.label}
        {locked ? <span className="spp-pro-tag" title="SwiftPieces Pro">Pro</span> : null}
      </label>
      {control}
      {p.hint ? <p id={hintId} className="spp-field-hint">{p.hint}</p> : null}
    </div>
  );
}

const label = (s: Screen) => String(s.root.props.title ?? "").trim() || s.name.replace(/View$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");

/** A copy button that confirms in place. */
export function CopyButton({ text, onCopied, label: text2 = "Copy", className = "spp-btn spp-btn-sm" }: { text: string | (() => string); onCopied?: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async (e) => {
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
          btn.dataset.copied = "1";
          onCopied?.();
          window.setTimeout(() => delete btn.dataset.copied, 1400);
        } catch {}
      }}
    >
      <UI name="copy" size={13} />
      <span className="spp-copy-idle">{text2}</span>
      <span className="spp-copy-done">Copied</span>
    </button>
  );
}
