"use client";
// A Pro entry, seen from Free: not a blurred screenshot, but what it is and how it behaves, with
// the one way to open it. Pro code never loads here, so the device shows the entry's outline, and
// the button leads to the same entry in the Pro playground.
import { useEffect } from "react";
import { CATALOG_KINDS } from "../../core/catalog.js";
import { interactionById } from "../../core/interactions.js";
import { UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { usePlay } from "./store.js";

export function Locked() {
  const { store, host, track } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  useEffect(() => {
    if (entry) track("pro_gate_viewed", { kind: entry.kind, slug: entry.slug, from: "stage" });
  }, [entry, track]);
  if (!entry) return null;
  const kind = CATALOG_KINDS.find((k) => k.id === entry.kind)!;
  const href = entry.href ?? host.links.pro;
  return (
    <div className="spp-locked">
      <div className="spp-locked-phone" aria-hidden>
        <span className="spp-locked-bar" style={{ width: "46%" }} />
        <span className="spp-locked-bar is-title" style={{ width: "72%" }} />
        <span className="spp-locked-block" />
        <span className="spp-locked-bar" style={{ width: "88%" }} />
        <span className="spp-locked-bar" style={{ width: "64%" }} />
        <span className="spp-locked-cta" />
      </div>
      <div className="spp-locked-text">
        <p className="spp-eyebrow">
          <UI name="lock" size={12} /> Pro {kind.singular.toLowerCase()}
        </p>
        <h2>{entry.title}</h2>
        <p>{entry.description}</p>
        {entry.interactions.length ? (
          <ul className="spp-locked-tags">
            {entry.interactions.map((id) => <li key={id}>{interactionById(id)?.name ?? id}</li>)}
          </ul>
        ) : null}
        <a className="spp-btn spp-btn-primary spp-btn-lg" href={href} onClick={() => track("pro_upgrade_clicked", { from: "locked_entry", kind: entry.kind, slug: entry.slug })}>
          Open in SwiftPieces Pro
          <UI name="external" size={14} />
        </a>
        <p className="spp-hint">Everything else here stays free: every free screen, flow and component, remixing, and the SwiftUI.</p>
      </div>
    </div>
  );
}
