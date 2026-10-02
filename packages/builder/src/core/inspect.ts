// What the inspector says about a node, computed from the same definitions the preview and the
// generator use: which group each property belongs to, how a component is put together, a one-line
// summary for the structure tree, and the exact SwiftUI a node produced.
import type { GeneratedScreen } from "./generate.js";
import type { ComponentRegistry } from "./registry.js";
import type { Project, PropertyDefinition, PropertyGroup, Props, ScreenNode, SwiftPieceDefinition } from "./schema.js";

export const GROUP_LABELS: Record<PropertyGroup, string> = {
  content: "Content",
  typography: "Typography",
  layout: "Spacing and layout",
  shape: "Shape",
  color: "Color",
  material: "Material",
  motion: "Motion",
  state: "State",
  interaction: "Interaction",
};
export const GROUP_ORDER: PropertyGroup[] = ["content", "state", "typography", "color", "material", "shape", "layout", "motion", "interaction"];

const BY_ID: Array<[RegExp, PropertyGroup]> = [
  [/^(link|action|haptic|haptics|feedback|onTap)$/i, "interaction"],
  [/^(loading|disabled|isOn|phase|state|status|selected|current|rating|value|progress|completed|expanded|outcome)$/i, "state"],
  [/(tint|color|fill|ink|palette|background)$/i, "color"],
  [/^(material|glass|surface|blur)$/i, "material"],
  [/(radius|corner|shape|badge)/i, "shape"],
  [/(spacing|padding|alignment|height|width|fullWidth|position|lineLimit|columns|axis|scrolls|size$)/i, "layout"],
  [/(animation|spring|duration|speed|bounce|stagger|delay|tilt|angle|motion|reveal)/i, "motion"],
  [/^(style|design|weight|font|textStyle)$/i, "typography"],
];

/** The group a property shows under: its own, else inferred from its id and type. */
export function propertyGroup(p: PropertyDefinition, def?: SwiftPieceDefinition): PropertyGroup {
  if (p.group) return p.group;
  if (p.type === "link") return "interaction";
  // A text component's "style" is its type style; elsewhere "style" is the component's look.
  if (p.id === "style" && def && !["text", "text-reveal"].includes(def.id)) return "color";
  for (const [re, g] of BY_ID) if (re.test(p.id)) return g;
  if (p.type === "color") return "color";
  if (p.type === "spacing") return "layout";
  return "content";
}

/** Whether a property's `when` condition holds for these props. */
export function propertyVisible(p: PropertyDefinition, props: Props): boolean {
  if (!p.when) return true;
  const v = props[p.when.prop];
  if (p.when.equals && !p.when.equals.includes(v)) return false;
  if (p.when.notEquals && p.when.notEquals.includes(v)) return false;
  return true;
}

/**
 * A component's parts. Definitions that declare `anatomy` use it; others get one derived from
 * their property groups, so every component can be taken apart the same way.
 */
export function anatomyOf(def: SwiftPieceDefinition): Array<{ part: string; props: string[] }> {
  if (def.anatomy?.length) return def.anatomy;
  const groups = new Map<PropertyGroup, string[]>();
  for (const p of def.properties) {
    const g = propertyGroup(p, def);
    groups.set(g, [...(groups.get(g) ?? []), p.id]);
  }
  return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ part: GROUP_LABELS[g], props: groups.get(g)! }));
}

/** The words a node shows in the structure tree: its label or title, when it has one. */
export function nodeSummary(node: ScreenNode): string {
  const p = node.props;
  for (const k of ["title", "text", "label", "placeholder", "headline", "name", "message"]) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim().replace(/\s+/g, " ").slice(0, 48);
  }
  return "";
}

/** The SwiftUI one node produced, cut from its screen's file and dedented. Null when absent. */
export function nodeSnippet(generated: GeneratedScreen, nodeId: string): string | null {
  const range = generated.ranges[nodeId];
  if (!range) return null;
  const lines = generated.code.split("\n").slice(range[0] - 1, range[1]);
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(pad)).join("\n");
}

/**
 * Every distinct component a project uses, in first-seen order. Layout (the screen, stacks, spacers,
 * dividers) is structure rather than a part you'd pick, so it is left out.
 */
export function componentsIn(project: Pick<Project, "screens">, registry: ComponentRegistry): SwiftPieceDefinition[] {
  const seen = new Map<string, SwiftPieceDefinition>();
  const walk = (n: ScreenNode) => {
    const def = registry.get(n.component);
    if (def && !def.hidden && def.category !== "layout" && !seen.has(def.id)) seen.set(def.id, def);
    n.children?.forEach(walk);
  };
  for (const s of project.screens) walk(s.root);
  return [...seen.values()];
}

/** The first node on any screen made from a component, for "show me where this is used". */
export function firstNodeOf(project: Pick<Project, "screens">, componentId: string): { screenId: string; nodeId: string } | null {
  for (const s of project.screens) {
    const stack = [s.root];
    while (stack.length) {
      const n = stack.shift()!;
      if (n.component === componentId) return { screenId: s.id, nodeId: n.id };
      stack.push(...(n.children ?? []));
    }
  }
  return null;
}

/** Layout helpers read as structure, not components; the tree labels them by role. */
export const STRUCTURAL = new Set(["screen", "vstack", "hstack", "spacer", "divider"]);
