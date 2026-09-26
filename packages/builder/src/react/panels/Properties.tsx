"use client";
import { memo, useId, useRef, useState, type ReactNode } from "react";
import { colors, icons } from "../../core/palette.js";
import type { PropValue, PropertyDefinition, ScreenNode, SwiftPieceDefinition } from "../../core/schema.js";
import { concepts } from "../../core/glossary.js";
import { defaultProps } from "../../core/registry.js";
import { findNode, parentOf } from "../../core/tree.js";
import { showsHelp, useBuilder } from "../context.js";
import { Glyph, UI } from "../icons.js";
import { untilPaint } from "../perf.js";
import { useStore } from "../store.js";

const visible = (p: PropertyDefinition, props: Record<string, PropValue>) => {
  if (!p.when) return true;
  const v = props[p.when.prop];
  if (p.when.equals && !p.when.equals.includes(v)) return false;
  if (p.when.notEquals && p.when.notEquals.includes(v)) return false;
  return true;
};

/** The property panel for the selected node, or for the screen when nothing is selected. */
export function Properties() {
  const { store, host } = useBuilder();
  const selectedId = useStore(store, (s) => s.selectedId);
  const root = useStore(store, (s) => (s.project.screens.find((x) => x.id === s.screenId) ?? s.project.screens[0]).root);
  const node = (selectedId && findNode(root, selectedId)) || root;
  const def = host.registry.get(node.component);
  if (!def) return null;
  return <Editor key={node.id} node={node} def={def} root={root} />;
}

const Editor = memo(function Editor({ node, def, root }: { node: ScreenNode; def: SwiftPieceDefinition; root: ScreenNode }) {
  const { store, host, persona, track, explain } = useBuilder();
  const [more, setMore] = useState(false);
  const customized = useRef(new Set<string>());
  const props = { ...defaultProps(def), ...node.props };
  const isRoot = node.id === root.id;
  const basic = def.properties.filter((p) => (p.level ?? "basic") === "basic" && visible(p, props));
  const advanced = def.properties.filter((p) => p.level === "advanced" && visible(p, props));
  const locked = (p: PropertyDefinition) => Boolean(p.pro && !host.limits.advancedProperties);
  const parent = isRoot ? null : parentOf(root, node.id);
  const siblings = parent?.children ?? [];
  const index = siblings.findIndex((c) => c.id === node.id);

  const change = (p: PropertyDefinition, value: PropValue) => {
    if (locked(p)) return;
    const t0 = performance.now();
    store.setProp(node.id, p.id, value);
    untilPaint("propertyUpdate", t0);
    // Once per component and property per session: enough to see what people customize, never every keystroke.
    const key = `${def.id}.${p.id}`;
    if (!customized.current.has(key)) {
      customized.current.add(key);
      track("component_customized", { component: def.id, property: p.id });
    }
  };

  return (
    <div className="spb-props" aria-label={`${def.name} properties`}>
      <div className="spb-props-head">
        <div className="spb-props-title">
          <h2>{isRoot ? "Screen" : def.name}</h2>
          {def.availability === "pro" ? <span className="spb-badge">Pro</span> : null}
          {def.source ? <span className="spb-badge spb-badge-quiet" title="A SwiftPieces component. Its source file is included in the export.">SwiftPieces</span> : null}
        </div>
        <p className="spb-muted">{def.description}</p>
        {def.docs ? <a className="spb-link" href={host.links.docs(def.docs)} target="_blank" rel="noreferrer">Docs and parameters ↗</a> : null}
        {showsHelp(persona) && def.concepts?.length ? (
          <div className="spb-concepts" aria-label="What's this?">
            <span className="spb-muted">What&apos;s this?</span>
            {def.concepts.slice(0, 3).map((c) => (
              <button key={c} type="button" className="spb-chip" onClick={() => explain(c)}>{concepts[c]?.term.replace(/\(.*$/, "") ?? c}</button>
            ))}
          </div>
        ) : null}
      </div>

      {def.variants?.length ? (
        <div className="spb-variants" role="group" aria-label="Presets">
          {def.variants.map((v) => (
            <button key={v.id} type="button" className="spb-chip" onClick={() => store.applyVariant(node.id, v.props)}>{v.label}</button>
          ))}
        </div>
      ) : null}

      <div className="spb-fields">
        {basic.map((p) => <Field key={p.id} p={p} value={props[p.id]} locked={locked(p)} onChange={(v) => change(p, v)} />)}
        {!basic.length && !advanced.length ? <p className="spb-muted">This component has no options.</p> : null}
      </div>

      {advanced.length ? (
        <div className="spb-more">
          <button type="button" className="spb-disclosure" aria-expanded={more} onClick={() => setMore((v) => !v)}>
            <span aria-hidden className="spb-caret-icon" data-open={more} />
            More options
            {advanced.some(locked) ? <span className="spb-badge">Pro</span> : null}
          </button>
          {more ? (
            <div className="spb-fields">
              {advanced.map((p) => <Field key={p.id} p={p} value={props[p.id]} locked={locked(p)} onChange={(v) => change(p, v)} />)}
              {advanced.some(locked) ? (
                <a className="spb-upsell" href={host.links.pro} onClick={() => track("pro_cta_clicked", { from: "advanced_property", component: def.id })}>
                  Motion and timing controls are part of SwiftPieces Pro →
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isRoot ? (
        <div className="spb-actions" role="group" aria-label="Arrange">
          <IconButton label="Move up" icon="up" disabled={index <= 0} onClick={() => store.move(node.id, -1)} />
          <IconButton label="Move down" icon="down" disabled={index < 0 || index >= siblings.length - 1} onClick={() => store.move(node.id, 1)} />
          <IconButton label="Duplicate" icon="copy" onClick={() => store.duplicate(node.id)} />
          <IconButton label="Group in a stack" icon="wrap" onClick={() => store.wrap(node.id)} />
          <MoveInto node={node} root={root} />
          <IconButton label="Delete" icon="trash" onClick={() => store.remove(node.id)} danger />
        </div>
      ) : showsHelp(persona) ? (
        <p className="spb-hint">Select anything on the phone, or in Layers, to change it. Every change here rewrites the SwiftUI code.</p>
      ) : null}
    </div>
  );
});

function IconButton({ label, icon, onClick, disabled, danger }: { label: string; icon: "up" | "down" | "copy" | "wrap" | "trash"; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" className={`spb-icon-btn${danger ? " is-danger" : ""}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <UI name={icon} />
    </button>
  );
}

/** The non-drag way to move a node into another container. */
function MoveInto({ node, root }: { node: ScreenNode; root: ScreenNode }) {
  const { store, host } = useBuilder();
  const id = useId();
  const containers: Array<{ id: string; label: string }> = [];
  const walk = (n: ScreenNode, depth: number) => {
    const def = host.registry.get(n.component);
    if (def?.container && n.id !== node.id) containers.push({ id: n.id, label: `${"  ".repeat(depth)}${n.id === root.id ? "Screen" : def.name}` });
    if (n.id === node.id) return;
    n.children?.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  const current = parentOf(root, node.id)?.id ?? root.id;
  if (containers.length < 2) return null;
  return (
    <label className="spb-moveinto" htmlFor={id}>
      <span className="spb-sr">Move into</span>
      <select id={id} className="spb-select spb-select-sm" value={current} onChange={(e) => store.moveInto(node.id, e.target.value)} title="Move into">
        {containers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </label>
  );
}

function Field({ p, value, onChange, locked }: { p: PropertyDefinition; value: PropValue; onChange: (v: PropValue) => void; locked: boolean }) {
  const id = useId();
  const hintId = `${id}-hint`;
  let control: ReactNode;
  const common = { id, disabled: locked, "aria-describedby": p.hint ? hintId : undefined };
  switch (p.type) {
    case "text":
      control = <TextInput {...common} value={String(value)} maxLength={p.maxLength} onChange={onChange} />;
      break;
    case "boolean":
      control = (
        <button type="button" role="switch" aria-checked={value === true} className="spb-switch" onClick={() => onChange(!(value === true))} {...common}>
          <span aria-hidden />
        </button>
      );
      break;
    case "number":
    case "spacing": {
      const step = p.step ?? 1;
      const wide = (p.max ?? 100) - (p.min ?? 0) > 1000;
      control = (
        <div className="spb-number">
          {!wide ? <input type="range" min={p.min} max={p.max} step={step} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} disabled={locked} aria-labelledby={`${id}-label`} tabIndex={-1} aria-hidden /> : null}
          <input type="number" className="spb-input spb-input-num" min={p.min} max={p.max} step={step} value={Number(value)} onChange={(e) => e.target.value !== "" && onChange(Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, Number(e.target.value))))} {...common} />
        </div>
      );
      break;
    }
    case "select":
      control = (p.options?.length ?? 0) <= 3 ? (
        <div className="spb-seg" role="radiogroup" aria-labelledby={`${id}-label`}>
          {p.options!.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={locked} onClick={() => onChange(o.value)}>{o.label}</button>
          ))}
        </div>
      ) : (
        <select className="spb-select" value={String(value)} onChange={(e) => onChange(e.target.value)} {...common}>
          {p.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case "color":
      control = (
        <div className="spb-swatches" role="radiogroup" aria-labelledby={`${id}-label`}>
          {(p.options ?? colors.map((c) => ({ value: c.id, label: c.label }))).map((o) => {
            const c = colors.find((x) => x.id === o.value);
            return (
              <button key={o.value} type="button" role="radio" aria-checked={value === o.value} aria-label={o.label} title={o.label} disabled={locked} onClick={() => onChange(o.value)} className="spb-swatch" style={{ ["--sw" as string]: c ? c.dark : "#888" }} />
            );
          })}
        </div>
      );
      break;
    case "icon":
      control = (
        <div className="spb-icon-select">
          <span className="spb-icon-preview" aria-hidden>{value !== "none" ? <Glyph name={String(value)} size={18} /> : null}</span>
          <select className="spb-select" value={String(value)} onChange={(e) => onChange(e.target.value)} {...common}>
            {icons.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </div>
      );
      break;
  }
  return (
    <div className={`spb-field${locked ? " is-locked" : ""}`} data-type={p.type}>
      <label id={`${id}-label`} htmlFor={id} className="spb-label">
        {p.label}
        {locked ? <span className="spb-lock" title="Pro"><UI name="lock" size={12} /></span> : null}
      </label>
      {control}
      {p.hint ? <p id={hintId} className="spb-hint-sm">{p.hint}</p> : null}
    </div>
  );
}

/** Keeps its own draft so typing never waits on the tree; commits on every change (coalesced in the store). */
function TextInput({ value, onChange, maxLength, ...rest }: { value: string; onChange: (v: string) => void; maxLength?: number; id: string; disabled?: boolean; "aria-describedby"?: string }) {
  const long = (maxLength ?? 0) > 120;
  return long ? (
    <textarea className="spb-input spb-textarea" rows={3} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} {...rest} />
  ) : (
    <input type="text" className="spb-input" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} {...rest} />
  );
}
