// Pure, immutable operations on a ScreenNode tree. Every edit returns a new tree that shares every
// untouched subtree with the old one, so the preview's memoized nodes only re-render along the path
// that actually changed.
import type { PropValue, ScreenNode } from "./schema.js";

let counter = 0;
/** Short, collision-safe ids. Random part guards against two tabs editing the same project. */
export function newId(prefix = "n"): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function findNode(root: ScreenNode, id: string): ScreenNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

/** Ids from the root to `id`, inclusive. Empty when absent. */
export function pathTo(root: ScreenNode, id: string): string[] {
  if (root.id === id) return [id];
  for (const child of root.children ?? []) {
    const p = pathTo(child, id);
    if (p.length) return [root.id, ...p];
  }
  return [];
}

export function parentOf(root: ScreenNode, id: string): ScreenNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const hit = parentOf(child, id);
    if (hit) return hit;
  }
  return null;
}

export function countNodes(root: ScreenNode): number {
  return 1 + (root.children ?? []).reduce((n, c) => n + countNodes(c), 0);
}

/** Depth-first list, root first. Used for keyboard order and the outline. */
export function flatten(root: ScreenNode, depth = 0, out: Array<{ node: ScreenNode; depth: number }> = []) {
  out.push({ node: root, depth });
  for (const child of root.children ?? []) flatten(child, depth + 1, out);
  return out;
}

/** Rebuilds only the path to `id`; returns the same root when nothing changed. */
function mapNode(root: ScreenNode, id: string, fn: (n: ScreenNode) => ScreenNode): ScreenNode {
  if (root.id === id) return fn(root);
  if (!root.children) return root;
  let changed = false;
  const children = root.children.map((c) => {
    const next = mapNode(c, id, fn);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export function updateProp(root: ScreenNode, id: string, prop: string, value: PropValue): ScreenNode {
  return mapNode(root, id, (n) => (n.props[prop] === value ? n : { ...n, props: { ...n.props, [prop]: value } }));
}

export function replaceProps(root: ScreenNode, id: string, props: Record<string, PropValue>): ScreenNode {
  return mapNode(root, id, (n) => ({ ...n, props: { ...n.props, ...props } }));
}

/** Inserts `node` into `parentId` at `index` (end when omitted). */
export function insertNode(root: ScreenNode, parentId: string, node: ScreenNode, index?: number): ScreenNode {
  return mapNode(root, parentId, (p) => {
    const children = [...(p.children ?? [])];
    const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
    children.splice(at, 0, node);
    return { ...p, children };
  });
}

export function removeNode(root: ScreenNode, id: string): ScreenNode {
  if (root.id === id) return root; // the screen itself is never removed
  const parent = parentOf(root, id);
  if (!parent) return root;
  return mapNode(root, parent.id, (p) => ({ ...p, children: (p.children ?? []).filter((c) => c.id !== id) }));
}

/** Moves a node one step among its siblings (-1 up, +1 down). The non-drag reorder path. */
export function moveSibling(root: ScreenNode, id: string, delta: -1 | 1): ScreenNode {
  const parent = parentOf(root, id);
  if (!parent?.children) return root;
  const from = parent.children.findIndex((c) => c.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= parent.children.length) return root;
  return mapNode(root, parent.id, (p) => {
    const children = [...(p.children ?? [])];
    const [n] = children.splice(from, 1);
    children.splice(to, 0, n);
    return { ...p, children };
  });
}

/** Moves a node into another container. Refuses to move a node into itself or its descendants. */
export function moveInto(root: ScreenNode, id: string, targetParentId: string, index?: number): ScreenNode {
  if (id === targetParentId || id === root.id) return root;
  const node = findNode(root, id);
  if (!node || findNode(node, targetParentId)) return root;
  return insertNode(removeNode(root, id), targetParentId, node, index);
}

/** Deep copy with fresh ids. */
export function cloneWithNewIds(node: ScreenNode, makeId: () => string = newId): ScreenNode {
  return { id: makeId(), component: node.component, props: { ...node.props }, ...(node.children ? { children: node.children.map((c) => cloneWithNewIds(c, makeId)) } : {}) };
}

/** Duplicates `id` right after itself. Returns the new tree and the copy's id. */
export function duplicateNode(root: ScreenNode, id: string): { root: ScreenNode; id: string | null } {
  const parent = parentOf(root, id);
  const node = findNode(root, id);
  if (!parent || !node) return { root, id: null };
  const copy = cloneWithNewIds(node);
  const index = (parent.children ?? []).findIndex((c) => c.id === id) + 1;
  return { root: insertNode(root, parent.id, copy, index), id: copy.id };
}
