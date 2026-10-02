"use client";
// Under the device: for a flow, its steps and how each one is reached (the transition is the
// SwiftUI that connects them); for anything else, one line of what to try. The preview teaches by
// being used, so this is the only instruction on screen.
import { memo, useEffect, useState } from "react";
import type { StepTransition } from "../../core/catalog.js";
import { UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { currentScreenId, usePlay } from "./store.js";

const TRANSITION: Record<StepTransition, { label: string; swift: string }> = {
  start: { label: "Start", swift: "WindowGroup" },
  push: { label: "Push", swift: "NavigationLink" },
  sheet: { label: "Sheet", swift: ".sheet(isPresented:)" },
  tab: { label: "Tab", swift: "TabView" },
  replace: { label: "Replace", swift: "if / else root" },
};

export const FlowStrip = memo(function FlowStrip() {
  const { store } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const project = usePlay(store, (s) => s.project);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  if (!entry?.steps || !project) return null;
  const index = project.screens.findIndex((s) => s.id === current);
  return (
    <div className="spp-flow">
      <ol className="spp-steps" aria-label={`${entry.title} steps`}>
        {entry.steps.map((step, i) => {
          const t = TRANSITION[step.transition];
          return (
            <li key={i} className="spp-step" data-state={i === index ? "current" : i < index ? "done" : "next"}>
              {i > 0 ? (
                <span className="spp-step-edge" title={`${t.label}: ${t.swift}`}>
                  <span className="spp-step-line" />
                  <span className="spp-step-how">{t.label}</span>
                </span>
              ) : null}
              <button type="button" className="spp-step-dot" onClick={() => store.goToStep(i)} aria-current={i === index ? "step" : undefined}>
                <span className="spp-step-n">{i + 1}</span>
                <span className="spp-step-title">{step.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="spp-flow-nav">
        <button type="button" className="spp-icon-btn" onClick={() => store.goToStep(Math.max(0, index - 1))} disabled={index <= 0} aria-label="Previous step">
          <UI name="left" size={15} />
        </button>
        <span className="spp-flow-note">{index >= 0 ? (entry.steps[index]?.note ?? `${TRANSITION[entry.steps[index]?.transition ?? "push"].swift}`) : ""}</span>
        <button type="button" className="spp-icon-btn" onClick={() => store.goToStep(Math.min(entry.steps!.length - 1, index + 1))} disabled={index >= entry.steps.length - 1} aria-label="Next step">
          <UI name="right" size={15} />
        </button>
      </div>
    </div>
  );
});

/** One suggestion at a time, cycling slowly, so the stage never carries a paragraph. */
export const TryLine = memo(function TryLine() {
  const { store } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const mode = usePlay(store, (s) => s.mode);
  const [i, setI] = useState(0);
  const tips = entry?.try ?? [];
  useEffect(() => {
    setI(0);
    if (tips.length < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % tips.length), 4200);
    return () => window.clearInterval(t);
  }, [entry, tips.length]);
  if (mode === "inspect") return <p className="spp-try"><span className="spp-try-k">Inspect</span>Click any part of the screen to see how it&apos;s built.</p>;
  if (!tips.length) return null;
  return (
    <p className="spp-try" aria-live="off">
      <span className="spp-try-k">Try</span>
      <span key={i} className="spp-try-text">{tips[i % tips.length]}</span>
    </p>
  );
});
