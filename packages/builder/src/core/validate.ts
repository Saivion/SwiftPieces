// One gate for every project that enters the builder from outside its own editing: local storage,
// a shared URL, a saved cloud project, a template, and AI output. It never throws on bad input; it
// keeps what is valid, drops what is not, and says what it dropped.
import { colors, grounds, icons } from "./palette.js";
import type { ComponentRegistry } from "./registry.js";
import { defaultProps } from "./registry.js";
import type { BuilderLimits, Project, PropValue, Props, Screen, ScreenNode, SwiftPieceDefinition } from "./schema.js";
import { newId } from "./tree.js";

export const MAX_DEPTH = 8;
const TEXT_MAX = 400;
const colorIds = new Set(colors.map((c) => c.id));
const groundIds = new Set(grounds.map((g) => g.id));
const iconIds = new Set(icons.map((i) => i.id));

export type ValidationResult<T> = { value: T; issues: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A Swift type name: starts with a capital, letters and digits only, never a Swift keyword clash. */
export function toTypeName(input: string, fallback = "ContentView"): string {
  const words = String(input ?? "").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  let name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  if (!name || !/^[A-Za-z]/.test(name)) name = fallback;
  if (/^(View|App|Text|Button|Color|Image|Self|Type|Protocol|Any)$/.test(name)) name = `${name}Screen`;
  return name.slice(0, 48);
}

function sanitizeValue(def: SwiftPieceDefinition, id: string, raw: unknown): PropValue | undefined {
  const p = def.properties.find((x) => x.id === id);
  if (!p) return undefined;
  switch (p.type) {
    case "text": {
      if (typeof raw !== "string" && typeof raw !== "number") return p.defaultValue;
      // Control characters never belong in a label; the Swift writer escapes the rest.
      return String(raw).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").slice(0, p.maxLength ?? TEXT_MAX);
    }
    case "number":
    case "spacing": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return p.defaultValue;
      const min = p.min ?? -Infinity;
      const max = p.max ?? Infinity;
      const clamped = Math.min(max, Math.max(min, n));
      return p.step && p.step >= 1 ? Math.round(clamped) : Math.round(clamped * 100) / 100;
    }
    case "boolean":
      return typeof raw === "boolean" ? raw : raw === "true" ? true : raw === "false" ? false : p.defaultValue;
    case "select":
      return p.options?.some((o) => o.value === raw) ? (raw as string) : p.defaultValue;
    case "color":
      return typeof raw === "string" && (colorIds.has(raw) || (p.options?.some((o) => o.value === raw) ?? false)) ? raw : p.defaultValue;
    case "icon":
      return typeof raw === "string" && iconIds.has(raw) ? raw : p.defaultValue;
  }
}

export function sanitizeProps(def: SwiftPieceDefinition, raw: unknown): Props {
  const props = defaultProps(def);
  if (!isObj(raw)) return props;
  for (const [k, v] of Object.entries(raw)) {
    const clean = sanitizeValue(def, k, v);
    if (clean !== undefined) props[k] = clean;
  }
  return props;
}

type NodeCtx = { registry: ComponentRegistry; limits?: BuilderLimits; issues: string[]; count: number; ids: Set<string> };

function sanitizeNode(raw: unknown, ctx: NodeCtx, depth: number, parent?: SwiftPieceDefinition): ScreenNode | null {
  if (!isObj(raw)) return null;
  const def = typeof raw.component === "string" ? ctx.registry.get(raw.component) : undefined;
  if (!def) {
    ctx.issues.push(`Removed an unknown component "${String(raw.component).slice(0, 40)}".`);
    return null;
  }
  if (depth > 0 && def.hidden) {
    ctx.issues.push(`"${def.name}" can only be the screen itself.`);
    return null;
  }
  if (ctx.limits && !ctx.registry.usable(def, ctx.limits)) {
    ctx.issues.push(`"${def.name}" is a Pro component and was left out.`);
    return null;
  }
  const accepts = parent?.container?.accepts;
  if (accepts?.length && !accepts.includes(def.id)) {
    ctx.issues.push(`"${def.name}" can't go inside "${parent!.name}".`);
    return null;
  }
  if (depth > MAX_DEPTH) {
    ctx.issues.push("Removed components nested too deeply.");
    return null;
  }
  const max = ctx.limits?.maxNodesPerScreen ?? Infinity;
  if (ctx.count >= max) {
    ctx.issues.push(`This screen has the maximum of ${max} components.`);
    return null;
  }
  ctx.count++;
  let id = typeof raw.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ? raw.id : newId();
  if (ctx.ids.has(id)) id = newId();
  ctx.ids.add(id);
  const node: ScreenNode = { id, component: def.id, props: sanitizeProps(def, raw.props) };
  if (def.container) {
    node.children = [];
    if (Array.isArray(raw.children)) {
      for (const c of raw.children) {
        const child = sanitizeNode(c, ctx, depth + 1, def);
        if (child) node.children.push(child);
      }
    }
  } else if (Array.isArray(raw.children) && raw.children.length) {
    ctx.issues.push(`"${def.name}" can't hold other components; its contents were removed.`);
  }
  return node;
}

/** Validates a single screen root. A root that is not a `screen` is wrapped in one. */
export function validateScreenRoot(raw: unknown, registry: ComponentRegistry, limits?: BuilderLimits, issues: string[] = []): ScreenNode {
  const ctx: NodeCtx = { registry, limits, issues, count: 0, ids: new Set() };
  const screenDef = registry.get("screen")!;
  if (isObj(raw) && raw.component === "screen") {
    const node = sanitizeNode(raw, ctx, 0);
    if (node) return node;
  }
  // Anything else becomes the content of a fresh screen.
  const root: ScreenNode = { id: newId(), component: "screen", props: defaultProps(screenDef), children: [] };
  ctx.count = 1;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of list) {
    const child = sanitizeNode(item, ctx, 1, screenDef);
    if (child) root.children!.push(child);
  }
  return root;
}

export function validateProject(raw: unknown, registry: ComponentRegistry, limits?: BuilderLimits): ValidationResult<Project> {
  const issues: string[] = [];
  const obj = isObj(raw) ? raw : {};
  const rawScreens = Array.isArray(obj.screens) ? obj.screens : [];
  const maxScreens = limits?.maxScreens ?? Infinity;
  if (rawScreens.length > maxScreens) issues.push(`Only the first ${maxScreens} screen${maxScreens === 1 ? "" : "s"} can be opened on this plan.`);
  const names = new Set<string>();
  const screens: Screen[] = [];
  for (const s of rawScreens.slice(0, maxScreens)) {
    if (!isObj(s)) continue;
    let name = toTypeName(typeof s.name === "string" ? s.name : "", `Screen${screens.length + 1}View`);
    if (!name.endsWith("View")) name = `${name}View`;
    while (names.has(name)) name = name.replace(/(\d*)View$/, (_, d) => `${Number(d || 1) + 1}View`);
    names.add(name);
    screens.push({ id: typeof s.id === "string" && s.id.length <= 64 ? s.id : newId("s"), name, root: validateScreenRoot(s.root, registry, limits, issues) });
  }
  if (!screens.length) screens.push({ id: newId("s"), name: "ContentView", root: validateScreenRoot(null, registry, limits, issues) });
  const project: Project = {
    v: 1,
    id: typeof obj.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(obj.id) ? obj.id : newId("p"),
    name: toTypeName(typeof obj.name === "string" ? obj.name : "", "MyApp").slice(0, 32),
    screens,
    shell: obj.shell === "tabs" ? "tabs" : "single",
    updatedAt: typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt) ? obj.updatedAt : Date.now(),
  };
  return { value: project, issues };
}

export { groundIds };
