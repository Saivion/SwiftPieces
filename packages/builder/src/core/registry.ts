import type { BuilderLimits, Props, ScreenNode, SwiftPieceDefinition, TemplateDefinition } from "./schema.js";
import { newId } from "./tree.js";

/**
 * The component registry one builder instance works with. Free creates it from the shared
 * definitions; Pro passes the same shared definitions plus its own. Nothing is duplicated.
 */
export type ComponentRegistry = {
  all: SwiftPieceDefinition[];
  get(id: string): SwiftPieceDefinition | undefined;
  /** Definitions the library lists (hidden ones such as the screen root are excluded). */
  listed(): SwiftPieceDefinition[];
  usable(def: SwiftPieceDefinition, limits: BuilderLimits): boolean;
};

export function createRegistry(...groups: SwiftPieceDefinition[][]): ComponentRegistry {
  const all: SwiftPieceDefinition[] = [];
  const byId = new Map<string, SwiftPieceDefinition>();
  for (const def of groups.flat()) {
    if (byId.has(def.id)) throw new Error(`Duplicate builder component id "${def.id}"`);
    byId.set(def.id, def);
    all.push(def);
  }
  return {
    all,
    get: (id) => byId.get(id),
    listed: () => all.filter((d) => !d.hidden),
    usable: (def, limits) => limits.availability.includes(def.availability),
  };
}

export function defaultProps(def: SwiftPieceDefinition): Props {
  const props: Props = {};
  for (const p of def.properties) props[p.id] = p.defaultValue;
  return props;
}

/** A fresh node for `def` with its defaults, optionally overridden. */
export function createNode(def: SwiftPieceDefinition, overrides: Props = {}, children?: ScreenNode[]): ScreenNode {
  const node: ScreenNode = { id: newId(), component: def.id, props: { ...defaultProps(def), ...overrides } };
  if (def.container) node.children = children ?? [];
  return node;
}

export type TemplateRegistry = { all: TemplateDefinition[]; get(id: string): TemplateDefinition | undefined };

export function createTemplateRegistry(...groups: TemplateDefinition[][]): TemplateRegistry {
  const all = groups.flat();
  const byId = new Map(all.map((t) => [t.id, t]));
  return { all, get: (id) => byId.get(id) };
}
