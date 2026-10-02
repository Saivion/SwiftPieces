"use client";
// The Map: the whole app as a tree. The app, its screens in the order a flow visits them (and how
// each is reached), and inside the screen on the device, every component. Picking a screen takes
// the device there; picking a component selects it, so the Map is also the way into deep layouts.
import { memo, useEffect, useRef, useState } from "react";
import { nodeSummary, STRUCTURAL } from "../../core/inspect.js";
import type { Screen, ScreenNode } from "../../core/schema.js";
import { KindIcon, UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { screenTitle } from "./Device.js";
import { currentScreenId, tabRoots, usePlay } from "./store.js";

const HOW: Record<string, string> = { start: "Start", push: "Push", sheet: "Sheet", tab: "Tab", replace: "Replace" };

export const BuildMap = memo(function BuildMap() {
  const { store } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const entry = usePlay(store, (s) => s.entry);
  const current = usePlay(store, (s) => currentScreenId(s.nav));
  const selected = usePlay(store, (s) => s.selected?.nodeId ?? null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!project) return null;
  const tabs = project.shell === "tabs" ? new Set(tabRoots(project).map((s) => s.id)) : null;
  const isOpen = (s: Screen) => open[s.id] ?? s.id === current;
  // Into an item. Picking the one already selected (after stepping back out) goes straight in again.
  const enter = (nodeId: string, screenId: string) => (nodeId === selected ? store.setTab("inspect") : store.select(nodeId, screenId));
  return (
    <div className="spp-map">
      <div className="spp-map-app">
        <span className="spp-map-app-tile"><UI name="phone" size={14} /></span>
        <strong>{project.name}</strong>
        <span className="spp-map-meta">{project.screens.length} screen{project.screens.length === 1 ? "" : "s"}{tabs ? " · TabView" : ""}</span>
      </div>
      <ul className="spp-tree" role="tree">
        {project.screens.map((s, i) => {
          const how = entry?.steps?.[i]?.transition ?? (i === 0 ? "start" : tabs?.has(s.id) ? "tab" : null);
          const expanded = isOpen(s);
          return (
            <li key={s.id} role="treeitem" aria-expanded={expanded} aria-selected={s.id === current}>
              {/* The whole row opens and closes the screen's layers, and takes the phone to that screen.
                  One button carries it for the keyboard; a click anywhere else on the row (the caret,
                  the transition tag, the space between) lands on the row and does the same. */}
              <div
                className={`spp-tree-row is-screen is-toggle${s.id === current ? " is-current" : ""}`}
                onClick={() => {
                  setOpen((o) => ({ ...o, [s.id]: !expanded }));
                  store.showScreen(s.id);
                  store.focusOn(s.id);
                }}
              >
                <span className="spp-tree-caret" aria-hidden>
                  <UI name={expanded ? "chevronDown" : "right"} size={12} />
                </span>
                <button type="button" className="spp-tree-name" aria-expanded={expanded}>
                  {screenTitle(s)}
                  <span className="spp-tree-type">{s.name}</span>
                </button>
                {how ? <span className="spp-tree-how">{HOW[how]}</span> : null}
              </div>
              {expanded ? (
                <ul role="group">
                  {(s.root.children ?? []).map((c) => (
                    <NodeRow key={c.id} node={c} screen={s} selected={selected} depth={1} enter={enter} />
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
});

function NodeRow({ node, screen, selected, depth, enter }: { node: ScreenNode; screen: Screen; selected: string | null; depth: number; enter: (nodeId: string, screenId: string) => void }) {
  const { store, host } = usePlayground();
  const row = useRef<HTMLButtonElement>(null);
  // Back out of an item and the map opens with it in view.
  useEffect(() => {
    if (node.id === selected) row.current?.scrollIntoView({ block: "nearest" });
  }, [node.id, selected]);
  const def = host.registry.get(node.component);
  const structural = STRUCTURAL.has(node.component) && !(node.props.style === "card" || node.props.style === "outlined");
  return (
    <li role="treeitem" aria-selected={node.id === selected}>
      <button
        ref={row}
        type="button"
        className={`spp-tree-row${node.id === selected ? " is-selected" : ""}${structural ? " is-structure" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          store.showScreen(screen.id);
          enter(node.id, screen.id);
          store.focusOn(screen.id, node.id);
        }}
        onMouseEnter={() => store.hover(node.id)}
        onMouseLeave={() => store.hover(null)}
      >
        <span className="spp-tree-icon"><KindIcon id={node.component} symbol={def?.icon} size={13} /></span>
        <span className="spp-tree-label">{def?.name ?? node.component}</span>
        <span className="spp-tree-sum">{nodeSummary(node)}</span>
      </button>
      {node.children?.length ? (
        <ul role="group">
          {node.children.map((c) => <NodeRow key={c.id} node={c} screen={screen} selected={selected} depth={depth + 1} enter={enter} />)}
        </ul>
      ) : null}
    </li>
  );
}
