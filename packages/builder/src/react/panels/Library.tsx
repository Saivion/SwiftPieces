"use client";
import { useMemo, useState } from "react";
import type { Category, SwiftPieceDefinition } from "../../core/schema.js";
import { showsHelp, useBuilder } from "../context.js";
import { UI } from "../icons.js";

const sections: Array<{ id: Category; title: string }> = [
  { id: "layout", title: "Layout" },
  { id: "content", title: "Content" },
  { id: "controls", title: "Buttons" },
  { id: "inputs", title: "Inputs" },
  { id: "pieces", title: "SwiftPieces" },
  { id: "pro", title: "Pro" },
];

/** The component list. Every entry is a button: click (or Enter) adds it near the selection. */
export function Library({ onAdded }: { onAdded?: () => void }) {
  const { store, host, persona, track } = useBuilder();
  const [q, setQ] = useState("");
  const listed = useMemo(() => host.registry.listed(), [host.registry]);
  const query = q.trim().toLowerCase();
  const match = (d: { name: string; description: string }) => !query || d.name.toLowerCase().includes(query) || d.description.toLowerCase().includes(query);

  const add = (def: SwiftPieceDefinition) => {
    if (store.add(def.id)) onAdded?.();
  };

  return (
    <div className="spb-library">
      <label className="spb-search">
        <span className="spb-sr">Search components</span>
        <input type="search" className="spb-input" placeholder="Search components" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {showsHelp(persona) && !query ? <p className="spb-hint">Click a component to add it below the one you selected. Stacks and cards hold other components.</p> : null}
      {sections.map((sec) => {
        const items = listed.filter((d) => d.category === sec.id && match(d));
        if (!items.length) return null;
        return (
          <section key={sec.id} className="spb-lib-section" aria-labelledby={`spb-lib-${sec.id}`}>
            <h2 id={`spb-lib-${sec.id}`} className="spb-section-label">{sec.title}</h2>
            <ul>
              {items.map((d) => {
                const usable = host.registry.usable(d, host.limits);
                return (
                  <li key={d.id}>
                    <button type="button" className="spb-lib-item" onClick={() => add(d)} aria-label={`Add ${d.name}${usable ? "" : " (Pro)"}`} title={d.description}>
                      <span className="spb-lib-name">{d.name}</span>
                      {usable ? <span className="spb-lib-plus" aria-hidden><UI name="plus" size={14} /></span> : <span className="spb-badge">Pro</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {host.locked?.length && !query ? (
        <section className="spb-lib-section" aria-labelledby="spb-lib-locked">
          <h2 id="spb-lib-locked" className="spb-section-label">In SwiftPieces Pro</h2>
          <ul>
            {host.locked.map((d) => (
              <li key={d.id}>
                <a className="spb-lib-item is-locked" href={host.links.pro} title={d.description} onClick={() => track("pro_cta_clicked", { from: "library", component: d.id })}>
                  <span className="spb-lib-name">{d.name}</span>
                  <span className="spb-lock"><UI name="lock" size={12} /></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
