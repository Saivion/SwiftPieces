"use client";
import { Component, createContext, memo, Suspense, use, useContext, type CSSProperties, type ReactNode } from "react";
import { bareProps, LIST_GAP, LIST_INSET, LIST_RADIUS, planList, rowInset, rowPad, type ListMode } from "../../core/lists.js";
import { defaultProps } from "../../core/registry.js";
import type { ScreenNode } from "../../core/schema.js";
import { Frame, useScheme, useTheme, type Renderer } from "./env.js";
import { useRuntime } from "./runtime.js";
import { fills } from "./fills.js";
import { primitiveRenderers } from "./primitives.js";

/** Renderer groups loaded on demand, e.g. a host's Pro components. */
export type RendererGroup = { ids: string[]; load: () => Promise<Record<string, Renderer>> };

const loaded = new Map<string, Renderer>(Object.entries(primitiveRenderers));

/** The package's own renderer chunks, by `SwiftPieceDefinition.preview.chunk`. */
const chunks: Record<string, RendererGroup> = {
  pieces: { ids: [], load: () => import("./pieces.js").then((m) => m.pieceRenderers) },
  native: { ids: [], load: () => import("./native.js").then((m) => m.nativeRenderers) },
  "pieces-motion": { ids: [], load: () => import("./pieces-motion.js").then((m) => m.motionPieceRenderers) },
  "pieces-surfaces": { ids: [], load: () => import("./pieces-surfaces.js").then((m) => m.surfacePieceRenderers) },
  "pieces-media": { ids: [], load: () => import("./pieces-media.js").then((m) => m.mediaPieceRenderers) },
  "pieces-utility": { ids: [], load: () => import("./pieces-utility.js").then((m) => m.utilityPieceRenderers) },
  "app-pieces": { ids: [], load: () => import("./app-pieces/index.js").then((m) => m.appPieceRenderers) },
};
const hostGroups: RendererGroup[] = [];
const pending = new Map<RendererGroup, Promise<void>>();

/** Hosts add their own renderer groups (Pro components) before the Playground mounts. */
export function registerRenderers(group: RendererGroup) {
  if (!hostGroups.includes(group)) hostGroups.push(group);
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

function groupFor(id: string, chunk: string | undefined): RendererGroup {
  return hostGroups.find((g) => g.ids.includes(id)) ?? chunks[chunk ?? "pieces"] ?? chunks.pieces;
}

/** The renderer for a component, suspending while its chunk loads. */
function useRenderer(id: string, chunk: string | undefined): Renderer | null {
  const hit = loaded.get(id);
  if (hit) return hit;
  use(loadGroup(groupFor(id, chunk)));
  return loaded.get(id) ?? null;
}

/**
 * Preloads every renderer a tree needs, so pushing a screen never flashes placeholders. Resolves
 * when they have all arrived (a failed chunk resolves too: its nodes fall back as usual).
 */
export function preloadFor(root: ScreenNode, registry: { get(id: string): { preview: { chunk?: string } } | undefined }): Promise<void> {
  const ids = new Set<string>();
  const walk = (n: ScreenNode) => {
    ids.add(n.component);
    n.children?.forEach(walk);
  };
  walk(root);
  const waits: Promise<void>[] = [];
  for (const id of ids) {
    if (loaded.has(id)) continue;
    waits.push(loadGroup(groupFor(id, registry.get(id)?.preview.chunk)).catch(() => {}));
  }
  return Promise.all(waits).then(() => {});
}

/**
 * One node. Memoized on the node object: an edit rebuilds only the path to the edited node, so a
 * remix re-renders that component and its ancestors, never the whole screen. Selection is drawn
 * by the device as an overlay, so selecting never re-renders a node at all.
 */
const NodeView = memo(function NodeView({ node }: { node: ScreenNode }) {
  const { registry } = useRuntime();
  const scheme = useScheme();
  const theme = useTheme();
  // Read before useRenderer, which can suspend: hooks keep one order.
  const inList = useContext(ListRowContext) === node.id;
  const def = registry.get(node.component);
  const R = useRenderer(node.component, def?.preview.chunk);
  // Style → Lists (core/lists.ts, as the Swift does): runs of rows in this column draw as one list,
  // a row inside one goes bare, and a column that is the list drops its own card.
  const plan = theme ? planList(node, registry, theme.lists) : null;
  const children = plan
    ? plan.parts.map((part) => ("node" in part ? <NodeBoundary key={part.node.id} node={part.node} /> : <ListRun key={part.rows[0].id} rows={part.rows} mode={theme!.lists!} />))
    : (node.children?.map((c) => <NodeBoundary key={c.id} node={c} />) ?? null);
  let props = def ? { ...defaultProps(def), ...node.props } : node.props;
  if (inList) props = bareProps(def, props);
  if (plan?.whole) props = { ...props, style: "plain" };
  // A component that is a list of its own (several items) takes the style through its props.
  const own = theme?.lists && def?.listStyle ? def.listStyle(theme.lists, props) : null;
  if (own) props = { ...props, ...own };
  // A card-shaped component takes Style's card edge (builder.css .spb-card-piece) whenever Cards isn't flat.
  // Its radius goes on the root too, so the edge follows the card's corners even when the root is a wrapper.
  const cardRadius = theme && theme.cards !== "flat" && def?.card && !inList ? def.card(props) : null;
  const box = {
    "data-node-id": node.id,
    "data-component": node.component,
    className: `spb-node${node.component === "screen" ? " spb-screen" : ""}${cardRadius != null ? " spb-card-piece" : ""}`,
    ...(cardRadius != null ? { style: { borderRadius: `calc(${cardRadius}px * var(--spb-corner, 1))` } } : {}),
  };
  if (!R || !def) return <Missing box={box} label={node.component} />;
  return <R node={node} p={props} box={box} fill={fills(node, registry.get)} scheme={scheme}>{children}</R>;
});

/** The row a list is drawing bare (its node id), for NodeView. */
const ListRowContext = createContext<string | null>(null);

/** Style's card surface, as a plain card Group draws it (primitives.tsx). */
const LIST_CARD: CSSProperties = {
  backgroundColor: "var(--spb-card, var(--ios-fill))",
  boxShadow: "var(--spb-card-edge, none)",
  backdropFilter: "var(--spb-card-blur, none)",
  WebkitBackdropFilter: "var(--spb-card-blur, none)",
  borderRadius: `calc(${LIST_RADIUS}px * var(--spb-corner, 1))`,
};
const px = (v: number) => `calc(${v}px * var(--spb-space, 1))`;

/** A run of rows as a list: separate cards, one grouped card with hairlines, or plain rows with hairlines (as generate.ts emits it). */
function ListRun({ rows, mode }: { rows: ScreenNode[]; mode: ListMode }) {
  const { registry } = useRuntime();
  const carded = mode !== "plain";
  const items = rows.flatMap((row, i) => {
    const def = registry.get(row.component);
    const item = (
      <div key={row.id} className="spb-list-row" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", minWidth: 0, padding: `${px(rowPad(def))} ${carded ? px(rowInset(def)) : "0"}`, ...(mode === "cards" ? LIST_CARD : {}) }}>
        <ListRowContext.Provider value={row.id}>
          <NodeBoundary node={row} />
        </ListRowContext.Provider>
      </div>
    );
    const line = <div key={`${row.id}-line`} aria-hidden style={{ height: 1, flex: "none", background: "var(--ios-sep)", marginLeft: mode === "grouped" ? px(LIST_INSET) : 0 }} />;
    return i && mode !== "cards" ? [line, item] : [item];
  });
  return (
    <div className="spb-list" data-list={mode} style={{ display: "flex", flexDirection: "column", alignSelf: "stretch", minWidth: 0, gap: mode === "cards" ? px(LIST_GAP) : 0, ...(mode === "grouped" ? LIST_CARD : {}) }}>
      <Frame axis="v">{items}</Frame>
    </div>
  );
}

function Missing({ box, label }: { box: { "data-node-id": string; "data-component": string; className: string }; label: string }) {
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
  const { onError } = useRuntime();
  return (
    <Boundary node={node} onError={() => onError(node.component)}>
      <Suspense fallback={<div className="spb-node spb-node-loading" data-node-id={node.id} />}>
        <NodeView node={node} />
      </Suspense>
    </Boundary>
  );
}
