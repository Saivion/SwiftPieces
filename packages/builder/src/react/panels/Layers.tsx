"use client";
import { useRef, type KeyboardEvent } from "react";
import type { ScreenNode } from "../../core/schema.js";
import { flatten, parentOf } from "../../core/tree.js";
import { useBuilder } from "../context.js";
import { UI } from "../icons.js";
import { useStore } from "../store.js";

/** A short label for a node: its text if it has any, else its component name. */
function summary(node: ScreenNode): string {
  const p = node.props;
  const t = p.text ?? p.title ?? p.label ?? p.placeholder ?? p.items ?? p.options ?? p.steps;
  return typeof t === "string" && t.trim() ? t.trim().slice(0, 32) : "";
}

/**
 * The screen as an outline: a keyboard-first tree. Arrow keys move the selection, Alt+Arrow moves
 * the component, Delete removes it. This is the accessible way to do everything the phone does.
 */
export function Layers() {
  const { store, host } = useBuilder();
  const root = useStore(store, (s) => (s.project.screens.find((x) => x.id === s.screenId) ?? s.project.screens[0]).root);
  const selectedId = useStore(store, (s) => s.selectedId);
  const rows = flatten(root);
  const list = useRef<HTMLUListElement>(null);

  const focusRow = (id: string) => requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-row="${id}"]`)?.focus());

  const onKey = (e: KeyboardEvent, node: ScreenNode, i: number) => {
    // Keys handled here must not also reach the builder's global shortcuts.
    if (["ArrowDown", "ArrowUp", "Delete", "Backspace"].includes(e.key)) e.stopPropagation();
    if (e.key === "ArrowDown" && !e.altKey) {
      e.preventDefault();
      const next = rows[i + 1]?.node;
      if (next) (store.select(next.id), focusRow(next.id));
    } else if (e.key === "ArrowUp" && !e.altKey) {
      e.preventDefault();
      const prev = rows[i - 1]?.node;
      if (prev) (store.select(prev.id === root.id ? null : prev.id), focusRow(prev.id));
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && node.id !== root.id) {
      e.preventDefault();
      store.move(node.id, e.key === "ArrowUp" ? -1 : 1);
      focusRow(node.id);
    } else if ((e.key === "Delete" || e.key === "Backspace") && node.id !== root.id) {
      e.preventDefault();
      const parent = parentOf(root, node.id);
      store.remove(node.id);
      const sel = store.getState().selectedId ?? parent?.id ?? root.id;
      focusRow(sel);
    }
  };

  return (
    <div className="spb-layers">
      <ul role="tree" aria-label="Screen layers" ref={list}>
        {rows.map(({ node, depth }, i) => {
          const def = host.registry.get(node.component);
          const isRoot = node.id === root.id;
          const selected = isRoot ? selectedId === null : selectedId === node.id;
          const parent = isRoot ? null : parentOf(root, node.id);
          const idx = parent?.children?.findIndex((c) => c.id === node.id) ?? -1;
          return (
            <li
              key={node.id}
              role="treeitem"
              aria-level={depth + 1}
              aria-selected={selected}
              aria-expanded={node.children ? true : undefined}
              data-row={node.id}
              tabIndex={selected || (selectedId === null && isRoot) ? 0 : -1}
              className={`spb-layer${selected ? " is-selected" : ""}`}
              style={{ paddingLeft: 10 + depth * 14 }}
              onClick={() => store.select(isRoot ? null : node.id)}
              onKeyDown={(e) => onKey(e, node, i)}
            >
              <span className="spb-layer-name">{isRoot ? store.screen().name : def?.name ?? node.component}</span>
              <span className="spb-layer-sum">{isRoot ? "" : summary(node)}</span>
              {!isRoot && selected ? (
                <span className="spb-layer-actions">
                  <button type="button" className="spb-icon-btn spb-icon-btn-sm" aria-label="Move up" disabled={idx <= 0} onClick={(e) => (e.stopPropagation(), store.move(node.id, -1))}><UI name="up" size={13} /></button>
                  <button type="button" className="spb-icon-btn spb-icon-btn-sm" aria-label="Move down" disabled={idx >= (parent?.children?.length ?? 0) - 1} onClick={(e) => (e.stopPropagation(), store.move(node.id, 1))}><UI name="down" size={13} /></button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="spb-hint-sm">↑↓ select · ⌥↑↓ reorder · ⌫ delete · ⌘D duplicate · ⌘Z undo</p>
    </div>
  );
}
