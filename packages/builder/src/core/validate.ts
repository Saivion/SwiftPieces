// One gate for every project that enters the builder from outside its own editing: local storage,
// a shared URL, a saved cloud project, a template, and AI output. It never throws on bad input; it
// keeps what is valid, drops what is not, and says what it dropped.
import { colors, grounds, icons } from "./palette.js";
import type { ComponentRegistry } from "./registry.js";
import { defaultProps } from "./registry.js";
import type { BuilderLimits, Project, PropValue, Props, Screen, ScreenNode, SwiftPieceDefinition, Theme } from "./schema.js";
import { isFontId } from "./fonts.js";
import { looks } from "./looks.js";
import { newId } from "./tree.js";

export const MAX_DEPTH = 8;
const TEXT_MAX = 400;
const colorIds = new Set(colors.map((c) => c.id));
const groundIds = new Set(grounds.map((g) => g.id));
const iconIds = new Set(icons.map((i) => i.id));

export type ValidationResult<T> = { value: T; issues: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Text that will be shown and written into Swift: control characters (bar newline and tab), line and
 * paragraph separators, bidirectional overrides and zero-width characters removed. Those never belong
 * in a label, and the last two could make exported code read differently from what it does.
 */
export function cleanText(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
}

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
      // Control and invisible characters never belong in a label; the Swift writer escapes the rest.
      return cleanText(String(raw)).slice(0, p.maxLength ?? TEXT_MAX);
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
    case "link":
      // Shape only here; whether the screen exists is checked once every screen is known (pruneLinks).
      return typeof raw === "string" && (raw === "" || raw === "back" || /^(sheet:|root:)?[A-Za-z0-9_-]{1,64}$/.test(raw)) ? raw : "";
  }
}

/**
 * Clears every link that points at a screen the project no longer has, or at the screen it sits
 * on. Run after screens are added, removed or imported, so a link can never write Swift that names
 * a view which does not exist.
 */
export function pruneLinks(project: Project, registry: ComponentRegistry): Project {
  const ids = new Set(project.screens.map((s) => s.id));
  let changed = false;
  const screens = project.screens.map((screen) => {
    const walk = (node: ScreenNode): ScreenNode => {
      const def = registry.get(node.component);
      let props = node.props;
      for (const p of def?.properties ?? []) {
        if (p.type !== "link") continue;
        const v = props[p.id];
        const target = typeof v === "string" ? v.replace(/^(sheet|root):/, "") : v;
        if (typeof v === "string" && v && v !== "back" && (!ids.has(String(target)) || target === screen.id)) {
          props = { ...props, [p.id]: "" };
        }
      }
      const children = node.children?.map(walk);
      const kidsChanged = children?.some((c, i) => c !== node.children![i]) ?? false;
      if (props === node.props && !kidsChanged) return node;
      changed = true;
      return { ...node, props, ...(children ? { children } : {}) };
    };
    const root = walk(screen.root);
    return root === screen.root ? screen : { ...screen, root };
  });
  return changed ? { ...project, screens } : project;
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

const HEX = /^#[0-9a-f]{6}$/i;

/** Exact screenshot colours: a mode and a ground, both well formed, else nothing. */
function sanitizeCustom(raw: unknown): { custom?: Theme["custom"] } {
  if (!isObj(raw) || (raw.mode !== "light" && raw.mode !== "dark") || typeof raw.ground !== "string" || !HEX.test(raw.ground)) return {};
  return { custom: { mode: raw.mode, ground: raw.ground.toUpperCase(), ...(typeof raw.surface === "string" && HEX.test(raw.surface) ? { surface: raw.surface.toUpperCase() } : {}) } };
}

/** A theme from untrusted input, or undefined. Unknown values fall back to the look's own. */
export function sanitizeTheme(raw: unknown): Theme | undefined {
  if (!isObj(raw)) return undefined;
  const look = looks.find((l) => l.id === raw.look);
  if (!look) return undefined;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const accent = typeof raw.accent === "number" && Number.isInteger(raw.accent) && raw.accent >= -1 && raw.accent < look.light.tiles.length ? raw.accent : -1;
  return {
    look: look.id,
    accent,
    appearance: pick(raw.appearance, ["system", "light", "dark"] as const, look.signature),
    font: isFontId(raw.font) ? raw.font : look.font,
    corners: pick(raw.corners, ["square", "tight", "standard", "soft", "round"] as const, look.corners),
    // Added later: older saved projects have none, and get the defaults.
    textSize: pick(raw.textSize, ["default", "large", "xlarge", "xxlarge"] as const, "default"),
    weight: pick(raw.weight, ["light", "regular", "medium", "bold", "heavy"] as const, "regular"),
    density: pick(raw.density, ["compact", "regular", "roomy", "airy"] as const, "regular"),
    ...(typeof raw.accentHex === "string" && /^#[0-9a-f]{6}$/i.test(raw.accentHex) ? { accentHex: raw.accentHex.toUpperCase() } : {}),
    ...(raw.ground === "tinted" || raw.ground === "plain" ? { ground: raw.ground } : {}),
    ...sanitizeCustom(raw.custom),
    ...(raw.width === "compressed" || raw.width === "condensed" || raw.width === "expanded" ? { width: raw.width } : {}),
    ...(raw.tracking === "tight" || raw.tracking === "wide" ? { tracking: raw.tracking } : {}),
    ...(isFontId(raw.headingFont) ? { headingFont: raw.headingFont } : {}),
    ...(["glow", "gradient", "grid", "paper", "mesh"].includes(raw.backdrop as string) ? { backdrop: raw.backdrop as Theme["backdrop"] } : {}),
    ...(["raised", "outlined", "glass", "bold"].includes(raw.cards as string) ? { cards: raw.cards as Theme["cards"] } : {}),
    ...(["fill", "hierarchical"].includes(raw.symbols as string) ? { symbols: raw.symbols as Theme["symbols"] } : {}),
    ...(["snappy", "bouncy"].includes(raw.motion as string) ? { motion: raw.motion as Theme["motion"] } : {}),
    ...(["soft", "high"].includes(raw.contrast as string) ? { contrast: raw.contrast as Theme["contrast"] } : {}),
    ...(["warm", "cool"].includes(raw.neutrals as string) ? { neutrals: raw.neutrals as Theme["neutrals"] } : {}),
    ...(["black", "graphite"].includes(raw.darkGround as string) ? { darkGround: raw.darkGround as Theme["darkGround"] } : {}),
    ...(raw.numbers === "tabular" ? { numbers: "tabular" as const } : {}),
    ...(["flat", "dramatic"].includes(raw.hierarchy as string) ? { hierarchy: raw.hierarchy as Theme["hierarchy"] } : {}),
    ...(["tinted", "outline", "glass"].includes(raw.buttons as string) ? { buttons: raw.buttons as Theme["buttons"] } : {}),
    ...(["fade", "rise"].includes(raw.entrance as string) ? { entrance: raw.entrance as Theme["entrance"] } : {}),
    ...(raw.mascot === "hidden" ? { mascot: "hidden" as const } : {}),
    ...(["bold", "centered"].includes(raw.headers as string) ? { headers: raw.headers as Theme["headers"] } : {}),
    ...(["compact", "large"].includes(raw.buttonSize as string) ? { buttonSize: raw.buttonSize as Theme["buttonSize"] } : {}),
    ...(["small", "large"].includes(raw.iconScale as string) ? { iconScale: raw.iconScale as Theme["iconScale"] } : {}),
    ...(["dock", "glass", "system"].includes(raw.tabStyle as string) ? { tabStyle: raw.tabStyle as Theme["tabStyle"] } : {}),
    ...(["cards", "grouped", "plain"].includes(raw.lists as string) ? { lists: raw.lists as Theme["lists"] } : {}),
    ...(typeof raw.name === "string" && raw.name.trim() ? { name: cleanText(raw.name).replace(/[^\p{L}\p{N} '&-]/gu, "").trim().slice(0, 40) } : {}),
  };
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
    const tab = isObj(s.tab) && typeof s.tab.title === "string" && iconIds.has(s.tab.icon as string) ? { title: cleanText(s.tab.title).slice(0, 24), icon: s.tab.icon as string } : undefined;
    const src = s.source;
    const source = isObj(src) && typeof src.kind === "string" && typeof src.slug === "string" && Number.isInteger(src.step) && /^[a-z0-9-]{1,64}$/.test(src.kind) && /^[a-z0-9-]{1,96}$/.test(src.slug) ? { kind: src.kind, slug: src.slug, step: Math.max(0, src.step as number) } : undefined;
    screens.push({ id: typeof s.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s.id) ? s.id : newId("s"), name, root: validateScreenRoot(s.root, registry, limits, issues), ...(tab ? { tab } : {}), ...(source ? { source } : {}) });
  }
  if (!screens.length) screens.push({ id: newId("s"), name: "ContentView", root: validateScreenRoot(null, registry, limits, issues) });
  const project: Project = {
    v: 1,
    id: typeof obj.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(obj.id) ? obj.id : newId("p"),
    name: toTypeName(typeof obj.name === "string" ? obj.name : "", "MyApp").slice(0, 32),
    screens,
    shell: obj.shell === "tabs" ? "tabs" : "single",
    ...(obj.tabBar === "dock" ? { tabBar: "dock" as const } : {}),
    ...(sanitizeTheme(obj.theme) ? { theme: sanitizeTheme(obj.theme) } : {}),
    ...(typeof obj.entry === "string" && /^(screens|flows|elements|interactions)\/[a-z0-9-]{1,64}$/.test(obj.entry) ? { entry: obj.entry } : {}),
    updatedAt: typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt) ? obj.updatedAt : Date.now(),
  };
  return { value: pruneLinks(project, registry), issues };
}

export { groundIds };

/** The fields each level of a project may carry. Anything else is refused by `checkProjectStrict`. */
const PROJECT_KEYS = new Set(["v", "id", "name", "screens", "shell", "tabBar", "theme", "entry", "updatedAt"]);
const SCREEN_KEYS = new Set(["id", "name", "root", "tab", "source"]);
const NODE_KEYS = new Set(["id", "component", "props", "children"]);

/**
 * Whether every field present in `raw` survived validation unchanged: same keys, same types, same
 * values, nothing clamped, cleaned, renamed, dropped or added below it. Fields `raw` leaves out are
 * fine (validation fills in defaults); anything it carries must already be exactly valid.
 */
function survives(raw: unknown, clean: unknown, path: string, errors: string[], keys?: Set<string>): void {
  if (errors.length >= 20) return;
  if (Array.isArray(raw)) {
    if (!Array.isArray(clean) || clean.length !== raw.length) {
      errors.push(`${path}: not accepted as sent`);
      return;
    }
    raw.forEach((r, i) => survives(r, clean[i], `${path}[${i}]`, errors, keys));
    return;
  }
  if (isObj(raw)) {
    if (!isObj(clean)) {
      errors.push(`${path}: not accepted as sent`);
      return;
    }
    for (const [k, v] of Object.entries(raw)) {
      if (keys && !keys.has(k)) {
        errors.push(`${path}.${k}: unknown field`);
        continue;
      }
      if (!Object.hasOwn(clean, k)) {
        errors.push(`${path}.${k}: not accepted`);
        continue;
      }
      // Below a known level, keys are free-form (props, theme) but must still come through as sent.
      const next = k === "screens" ? SCREEN_KEYS : k === "root" || k === "children" ? NODE_KEYS : undefined;
      survives(v, clean[k], `${path}.${k}`, errors, next);
    }
    return;
  }
  if (!Object.is(raw, clean)) errors.push(`${path}: invalid value`);
}

/**
 * The strict gate for data crossing into a server (a cloud save, a hand-over): validates like
 * `validateProject`, then refuses the whole project unless it was already exactly valid. Unknown
 * fields, wrong types, out-of-range numbers, invalid options, over-long or dirty text, unknown or
 * Pro-only components, bad ids and links to missing screens are all errors, never quietly repaired.
 */
export function checkProjectStrict(raw: unknown, registry: ComponentRegistry, limits?: BuilderLimits): { ok: true; value: Project } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ["project: not an object"] };
  const { value, issues } = validateProject(raw, registry, limits);
  const errors = [...issues];
  if (!Array.isArray(raw.screens) || raw.screens.length === 0) errors.push("project.screens: at least one screen is required");
  survives(raw, value, "project", errors, PROJECT_KEYS);
  return errors.length ? { ok: false, errors: errors.slice(0, 20) } : { ok: true, value };
}

/**
 * Gives screens fresh ids and rewrites every link to follow them, so a multi-screen template can be
 * added to a project (twice, even) without its links pointing at the wrong screens.
 */
export function withFreshScreenIds(screens: Screen[], registry: ComponentRegistry, makeId: () => string = () => newId("s")): Screen[] {
  const ids = new Map(screens.map((s) => [s.id, makeId()]));
  const walk = (node: ScreenNode): ScreenNode => {
    const def = registry.get(node.component);
    let props = node.props;
    for (const p of def?.properties ?? []) {
      const v = props[p.id];
      if (p.type !== "link" || typeof v !== "string") continue;
      const prefix = v.match(/^(sheet|root):/)?.[0] ?? "";
      const id = v.slice(prefix.length);
      if (ids.has(id)) props = { ...props, [p.id]: `${prefix}${ids.get(id)!}` };
    }
    return { ...node, props, ...(node.children ? { children: node.children.map(walk) } : {}) };
  };
  return screens.map((s) => ({ ...s, id: ids.get(s.id)!, root: walk(s.root) }));
}
