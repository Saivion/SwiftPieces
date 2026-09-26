"use client";
import { Component, memo, Suspense, use, type ReactNode } from "react";
import { defaultProps } from "../../core/registry.js";
import type { ScreenNode } from "../../core/schema.js";
import { useBuilder } from "../context.js";
import { useStore } from "../store.js";
import { useScheme, type Renderer } from "./env.js";
import { fills } from "./fills.js";
import { primitiveRenderers } from "./primitives.js";

/** Renderer groups loaded on demand, e.g. the free pieces or a host's Pro components. */
export type RendererGroup = { ids: string[]; load: () => Promise<Record<string, Renderer>> };

const loaded = new Map<string, Renderer>(Object.entries(primitiveRenderers));
const groups: RendererGroup[] = [{ ids: [], load: () => import("./pieces.js").then((m) => m.pieceRenderers) }];
const pending = new Map<RendererGroup, Promise<void>>();

/** Hosts add their own renderer groups (Pro components) before the builder mounts. */
export function registerRenderers(group: RendererGroup) {
  if (!groups.includes(group)) groups.push(group);
}

function loadGroup(group: RendererGroup): Promise<void> {
  let p = pending.get(group);
  if (!p) {
    p = group.load().then((map) => {
      for (const [id, r] of Object.entries(map)) loaded.set(id, r);
    });
    pending.set(group, p);
    p.catch(() => pending.delete(group));
  }
  return p;
}

/** The renderer for a component, suspending while its chunk loads. */
function useRenderer(id: string): Renderer | null {
  const hit = loaded.get(id);
  if (hit) return hit;
  // The first group (free pieces) lists no ids: it is the fallback for anything not yet known.
  const group = groups.find((g) => g.ids.includes(id)) ?? groups[0];
  use(loadGroup(group));
  return loaded.get(id) ?? null;
}

/** Preloads every renderer a tree needs, so switching templates never flashes placeholders. */
export function preloadFor(root: ScreenNode) {
  const ids = new Set<string>();
  const walk = (n: ScreenNode) => {
    ids.add(n.component);
    n.children?.forEach(walk);
  };
  walk(root);
  for (const id of ids) {
    if (loaded.has(id)) continue;
    void loadGroup(groups.find((g) => g.ids.includes(id)) ?? groups[0]);
  }
}

const NodeView = memo(function NodeView({ node }: { node: ScreenNode }) {
  const { store, host } = useBuilder();
  const selected = useStore(store, (s) => s.selectedId === node.id);
  const scheme = useScheme();
  const R = useRenderer(node.component);
  const def = host.registry.get(node.component);
  const children = node.children?.map((c) => <NodeBoundary key={c.id} node={c} />) ?? null;
  const box = { "data-node-id": node.id, className: `spb-node${selected ? " is-selected" : ""}${node.component === "screen" ? " spb-screen" : ""}` };
  if (!R || !def) return <Missing box={box} label={node.component} />;
  return <R node={node} p={{ ...defaultProps(def), ...node.props }} box={box} fill={fills(node)} scheme={scheme}>{children}</R>;
});

function Missing({ box, label }: { box: { "data-node-id": string; className: string }; label: string }) {
  return <div {...box} className={`${box.className} spb-node-missing`}>{label}</div>;
}

type BoundaryState = { error: Error | null; node: ScreenNode };

/**
 * One boundary per node: a component that throws never takes the rest of the screen with it, and
 * the user's work is untouched. Editing the node (a new node object) clears the error.
 */
class Boundary extends Component<{ node: ScreenNode; children: ReactNode; onError?: (e: Error) => void }, BoundaryState> {
  state: BoundaryState = { error: null, node: this.props.node };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { node: ScreenNode }, state: BoundaryState) {
    return props.node !== state.node ? { error: null, node: props.node } : null;
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="spb-node spb-node-error" data-node-id={this.props.node.id} role="alert">
        <strong>This component couldn&apos;t render.</strong>
        <span>The rest of your screen is still safe.</span>
        <button type="button" className="spb-link" onClick={() => this.setState({ error: null })}>Retry</button>
      </div>
    );
  }
}

export function NodeBoundary({ node }: { node: ScreenNode }) {
  const { track } = useBuilder();
  return (
    <Boundary node={node} onError={() => track("builder_error", { where: "preview", component: node.component })}>
      <Suspense fallback={<div className="spb-node spb-node-loading" data-node-id={node.id} />}>
        <NodeView node={node} />
      </Suspense>
    </Boundary>
  );
}
