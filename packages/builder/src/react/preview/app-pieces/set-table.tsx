"use client";
import { useEffect, useState } from "react";
import { tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { parseSets, restClock, weightText, type WorkSet } from "../../../definitions/app-pieces/set-table.js";
import { Glyph } from "../../icons.js";
import { n, s, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { useLive } from "../runtime.js";
import { FILL, LABEL, LABEL2, WideRoot, useHaptic } from "./data-kit.js";

// Set Table (definitions/app-pieces/set-table.ts): checking a set tints its row and starts the
// rest chip counting down; Add Set copies the last row in with a short rise.
export const SetTable: Renderer = (r) => {
  const seed = String(r.p.sets ?? "");
  const [sets, setSets] = useState<WorkSet[]>(() => parseSets(seed));
  const [from] = useLive(seed);
  useEffect(() => setSets(parseSets(from)), [from]);
  const [restLeft, setRestLeft] = useState(0);
  const [added, setAdded] = useState(-1);
  const haptic = useHaptic();
  const rest = Math.max(0, Math.round(n(r.p, "rest")));
  const done = accentize(tintHex(s(r.p, "tint"), "green"));
  const ink = accentize(tintHex(s(r.p, "titleTint"), "azure"));
  const unit = s(r.p, "unit") || "kg";
  const title = s(r.p, "title").trim();
  const note = s(r.p, "note").trim();
  const still = reducedMotion();

  useEffect(() => {
    if (restLeft <= 0) return;
    const t = setTimeout(() => setRestLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [restLeft]);

  const cell = { height: 32, borderRadius: cr(8), background: FILL, display: "grid", placeItems: "center", fontSize: ts(15), fontWeight: fw(600), fontVariantNumeric: "tabular-nums" as const, flex: "none" };
  const head = { fontSize: ts(12), fontWeight: fw(600), color: LABEL2, flex: "none" };
  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", gap: 8, color: LABEL }}>
      {title ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 30 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: ts(17), fontWeight: fw(600), color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          {restLeft > 0 ? (
            <span className="spa-pop" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: `color-mix(in srgb, ${ink} 14%, transparent)`, color: ink, fontSize: ts(15), fontWeight: fw(600), fontVariantNumeric: "tabular-nums" }}>
              <Glyph name="timer" size={15} />
              {restClock(restLeft)}
            </span>
          ) : null}
        </div>
      ) : null}
      {note ? <span style={{ fontSize: ts(15), color: LABEL2 }}>{note}</span> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px" }}>
        <span style={{ ...head, width: 30 }}>SET</span>
        <span style={{ ...head, flex: 1, minWidth: 0 }}>PREVIOUS</span>
        <span style={{ ...head, width: 56, textAlign: "center" }}>{unit.toUpperCase()}</span>
        <span style={{ ...head, width: 44, textAlign: "center" }}>REPS</span>
        <span style={{ ...head, width: 32, display: "grid", placeItems: "center" }}><Glyph name="checkmark" size={13} strokeWidth={2.6} /></span>
      </div>
      {sets.map((set, i) => (
        <div
          key={i}
          className={i === added ? "spa-rise" : undefined}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: cr(10), background: set.done ? `color-mix(in srgb, ${done} 16%, transparent)` : "transparent", transition: still ? undefined : "background .25s" }}
        >
          <span style={{ width: 30, flex: "none", fontSize: ts(15), fontWeight: fw(700), color: set.label === "W" ? "#F47A3A" : LABEL }}>{set.label}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: ts(15), color: LABEL2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{set.previous}</span>
          <span style={{ ...cell, width: 56 }}>{weightText(set.weight)}</span>
          <span style={{ ...cell, width: 44 }}>{set.reps}</span>
          <span
            role="button"
            aria-pressed={set.done}
            aria-label={set.done ? "Completed" : "Complete set"}
            onClick={(e) => {
              const next = !set.done;
              setSets((all) => all.map((x, k) => (k === i ? { ...x, done: next } : x)));
              if (next) {
                setRestLeft(rest);
                haptic("success", e.currentTarget);
              }
            }}
            style={{ ...cell, width: 32, cursor: "pointer", background: set.done ? done : "color-mix(in srgb, var(--ios-label2) 18%, transparent)", color: set.done ? "#fff" : LABEL2, transition: still ? undefined : "background .2s, color .2s" }}
          >
            <Glyph name="checkmark" size={15} strokeWidth={3} />
          </span>
        </div>
      ))}
      {r.p.addsSets !== false ? (
        <span
          role="button"
          onClick={(e) => {
            haptic("light", e.currentTarget);
            setSets((all) => {
              const last = all[all.length - 1];
              const number = all.filter((x) => x.label !== "W").length + 1;
              setAdded(all.length);
              return [...all, { label: String(number), previous: "–", weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false }];
            });
          }}
          style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 999, background: FILL, fontSize: ts(15), fontWeight: fw(600), cursor: "pointer" }}
        >
          <Glyph name="plus" size={15} strokeWidth={2.4} />
          Add Set
        </span>
      ) : null}
    </WideRoot>
  );
};
