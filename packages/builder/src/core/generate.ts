// SwiftUI generation. Reads the same ScreenNode tree the preview renders, through the same
// definitions, so the code always describes what is on screen. It never parses code back.
import { accentDrivesPalette, colorEntry, withSwiftAccent } from "./palette.js";
import { rewriteCorners, rewriteFonts, themeBackgroundLines, themeCardLines, themeEntranceLines, themeFontLines, themeMotionLines, themeRootModifiers, themeShapeLines, usesThemeFonts } from "./theme-swift.js";
import { defaultProps, type ComponentRegistry } from "./registry.js";
import type { EmitContext, NavTarget, Project, Screen, ScreenNode, Theme } from "./schema.js";
import { DYNAMIC_TYPE, FONT_WEIGHT, FONT_WIDTH, TRACKING, resolveTheme, swiftHex, type ResolvedTheme } from "./looks.js";
import { call, identifier, importLine, indent, INDENT, modifiers, num, str } from "./swift.js";
import { bareProps, LIST_GAP, LIST_INSET, LIST_RADIUS, planList, rowInset, rowPad, type ListMode } from "./lists.js";

export type GeneratedScreen = {
  /** Swift type name, e.g. "LoginView". */
  name: string;
  fileName: string;
  code: string;
  /** Frameworks imported besides SwiftUI. */
  imports: string[];
  /** SwiftPieces component sources this file calls, by registry and name. */
  pieces: Array<{ registry: "free" | "pro"; name: string }>;
  /** Maps each node id to the 1-based line range it produced, for "show me this in the code". */
  ranges: Record<string, [number, number]>;
};

export type GeneratedProject = {
  files: Array<{ path: string; content: string }>;
  screens: GeneratedScreen[];
  pieces: Array<{ registry: "free" | "pro"; name: string }>;
  appName: string;
};

export class GenerationError extends Error {}

/** A link prop's value, split: "sheet:<id>" presents a screen, "root:<id>" makes it the root, a bare id pushes it. */
export function parseLink(value: string): { mode: "push" | "sheet" | "root" | "back" | "none"; id: string } {
  if (!value) return { mode: "none", id: "" };
  if (value === "back") return { mode: "back", id: "" };
  if (value.startsWith("sheet:")) return { mode: "sheet", id: value.slice(6) };
  if (value.startsWith("root:")) return { mode: "root", id: value.slice(5) };
  return { mode: "push", id: value };
}

/**
 * The `@AppStorage` flag behind root links: set when onboarding or sign-in ends, read by the app to
 * pick its root. Named for what the screens are about.
 */
export function rootFlag(screens: Screen[]): string {
  return screens.some((s) => /Sign|Login|Auth|Verify|Account/i.test(s.name)) ? "isSignedIn" : "didFinishOnboarding";
}

/** The screen a root link makes the app's root, if the project has one (the first one found). */
export function rootTarget(project: Pick<Project, "screens">, registry: ComponentRegistry): Screen | null {
  for (const screen of project.screens) {
    const stack = [screen.root];
    while (stack.length) {
      const node = stack.shift()!;
      const def = registry.get(node.component);
      for (const p of def?.properties ?? []) {
        const v = node.props[p.id];
        if (p.type === "link" && typeof v === "string" && v.startsWith("root:")) {
          const hit = project.screens.find((s) => s.id === v.slice(5));
          if (hit && hit.id !== project.screens[0].id) return hit;
        }
      }
      stack.push(...(node.children ?? []));
    }
  }
  return null;
}

const SWIFTUI = "SwiftUI";

/**
 * Generates one screen. `markers` is filled with the line span of every node so the code view can
 * highlight the selected component; the markers are computed from line counts, never from parsing.
 * `screens` are the project's screens, so a link can name the view it opens; without them every
 * link is treated as empty.
 */
export function generateScreen(screen: Screen, registry: ComponentRegistry, screens: Screen[] = [screen], theme?: Theme, tabs: string[] = []): GeneratedScreen {
  // A themed app writes the house signal red as its accent in every component (see swiftSignal).
  const resolved = theme ? resolveTheme(theme) : null;
  const styled = resolved && accentDrivesPalette(resolved.accent.light, resolved.accent.dark) ? { light: resolved.accent.light, dark: resolved.accent.dark } : null;
  const out = withSwiftAccent(theme ? "Theme.accent" : null, () => emitScreen(screen, registry, screens, theme, tabs), styled);
  // The same for the red written straight into components' Swift (their helpers and constants).
  // A wrong answer's red is written as \`red: 1.0\` so it stays red, as in the preview.
  if (!theme) return out;
  // Fonts go through Theme.font when Style sets fonts or a text size (see core/theme-swift.ts).
  const code = rewriteFonts(out.code.replaceAll("Color(red: 1, green: 0, blue: 0)", "Theme.accent"), resolveTheme(theme));
  return { ...out, code };
}

function emitScreen(screen: Screen, registry: ComponentRegistry, screens: Screen[], theme: Theme | undefined, tabs: string[]): GeneratedScreen {
  const resolved = theme ? resolveTheme(theme) : null;
  const states: Array<{ name: string; type: string; initial: string }> = [];
  const stateNames = new Set<string>();
  let usesDismiss = false;
  let usesRoot = false;
  let usesTab = false;
  const imports = new Set<string>();
  const pieces = new Map<string, { registry: "free" | "pro"; name: string }>();

  const shared = new Map<string, { name: string; index: number }>();
  const screenMods: string[][] = [];
  const declarations = new Map<string, string[]>();
  const baseCtx = {
    str,
    declare(key: string, lines: string[]) {
      // A component's own views take the app's corners (its fonts go with the whole screen, below).
      if (!declarations.has(key)) declarations.set(key, resolved ? lines.map((l) => rewriteCorners(l, resolved)) : lines);
    },
    screenModifier(lines: string[]) {
      if (lines.length) screenMods.push(lines);
    },
    shared(key: string, type: string, initial: string, prefer = false) {
      const hit = shared.get(key);
      if (hit) {
        if (prefer) states[hit.index] = { ...states[hit.index], initial };
        return hit.name;
      }
      const name = baseCtx.state(key, type, initial);
      shared.set(key, { name, index: states.length - 1 });
      return name;
    },
    state(hint: string, type: string, initial: string) {
      let name = identifier(hint);
      let i = 2;
      while (stateNames.has(name)) name = `${identifier(hint)}${i++}`;
      stateNames.add(name);
      states.push({ name, type, initial });
      return name;
    },
    import(module: string) {
      if (module !== "SwiftUI") imports.add(module);
    },
    piece(name: string) {},
    link(value: string): NavTarget | null {
      if (value === "back") return { kind: "back" };
      const { mode, id } = parseLink(value);
      const target = id && id !== screen.id ? screens.find((s) => s.id === id) : undefined;
      if (!target) return null;
      if (mode === "sheet") return { kind: "sheet", view: target.name, screenId: target.id, detent: String(target.root.props.detent ?? "large") };
      if (mode === "root") {
        usesRoot = true;
        return { kind: "root", view: target.name, screenId: target.id, flag: rootFlag(screens) };
      }
      // A tab root of a tabs app is selected, not pushed on top of this stack.
      const tab = tabs.indexOf(target.id);
      if (tab >= 0) {
        usesTab = true;
        return { kind: "tab", view: target.name, screenId: target.id, set: `appTab.wrappedValue = ${tab}` };
      }
      return { kind: "push", view: target.name, screenId: target.id };
    },
    dismiss() {
      usesDismiss = true;
      return "dismiss";
    },
    theme: resolved,
    // A pill (radius 100+) stays a pill at standard corners and rounder; tighter corners make it a
    // rounded rectangle (square: square), as in the preview.
    corner: (r: number) => (!resolved ? r : r >= 100 ? (resolved.cornerScale >= 1 ? r : Math.round(22 * resolved.cornerScale)) : Math.round(r * resolved.cornerScale)),
    space: (v: number) => (resolved ? Math.round(v * resolved.spaceScale) : v),
    color: (id: string) => (id === "onAccent" && resolved ? "Theme.accentInk" : colorEntry(id).swift),
    style: (id: string) => (id === "accent" ? ".tint" : id === "onAccent" && resolved ? "Theme.accentInk" : colorEntry(id).swift),
    symbol: (id: string) => id,
  };

  // Emission is depth-first; each node's lines are tagged so ranges survive indentation.
  const TAG = "\u0000";
  function emitNode(node: ScreenNode, inList = false): string[] {
    const def = registry.get(node.component);
    if (!def) throw new GenerationError(`Unknown component "${node.component}"`);
    if (def.source) pieces.set(`${def.source.registry}:${def.source.name}`, { ...def.source });
    const attached: string[][] = [];
    // Style → Lists: runs of rows in this column are drawn as one list (core/lists.ts).
    const plan = resolved ? planList(node, registry, resolved.lists) : null;
    const ctx: EmitContext = {
      ...baseCtx,
      attach: (block: string[]) => void (block.length && attached.push(block)),
      piece: (name: string) => pieces.set(`${def.source?.registry ?? "free"}:${name}`, { registry: def.source?.registry ?? "free", name }),
      children: () => (plan ? plan.parts.map((part) => ("node" in part ? emitNode(part.node) : emitList(part.rows, resolved!.lists!))) : (node.children ?? []).map((c) => emitNode(c))),
    };
    // Defaults first, so a prop missing from an older saved project still emits valid Swift. In a
    // list a row goes bare (its own card or fill off); a column that is the list drops its own card.
    let props = { ...defaultProps(def), ...node.props };
    if (inList) props = bareProps(def, props);
    if (plan?.whole) props = { ...props, style: "plain" };
    // A component that is a list of its own (several items) takes the style through its props.
    const own = resolved?.lists && def.listStyle ? def.listStyle(resolved.lists, props) : null;
    if (own) props = { ...props, ...own };
    let lines: string[];
    try {
      lines = def.swift.emit(props, ctx).lines;
    } catch (e) {
      if (e instanceof GenerationError) throw e;
      throw new GenerationError(`"${def.name}" couldn't be written as SwiftUI: ${(e as Error).message}`);
    }
    if (!lines.length) return lines;
    // A card-shaped component takes the app's card treatment, so every card on every screen matches.
    const cardRadius = resolved && resolved.cards !== "flat" && def.card && !inList ? def.card(props) : null;
    if (cardRadius != null) lines = modifiers(lines, [`themeCard(cornerRadius: ${num(cardRadius)})`]);
    for (const block of attached) {
      const pad = lines.length === 1 || lines.slice(1).every((l) => l.startsWith(`${INDENT}.`) || l.startsWith(`${INDENT}${INDENT}`) || l === `${INDENT}}`) ? INDENT : "";
      lines = [...lines, ...block.map((l) => `${pad}${l}`)];
    }
    // Open and close tags on the first and last line mark the node's span.
    const out = [...lines];
    out[0] = `${TAG}o${node.id}${TAG}${out[0]}`;
    out[out.length - 1] = `${out[out.length - 1]}${TAG}c${node.id}${TAG}`;
    return out;
  }

  /**
   * A run of rows as a list: separate cards, one grouped card with hairlines, or plain rows with
   * hairlines. In a card each row takes its own side inset (less when it pads its own sides), so
   * text lines up down the list; hairlines start at the inset, as in an inset grouped list.
   */
  function emitList(rows: ScreenNode[], mode: ListMode): string[] {
    const radius = num(baseCtx.corner(LIST_RADIUS));
    const carded = mode !== "plain";
    const items = rows.map((row) => {
      const def = registry.get(row.component);
      const pad = rowPad(def);
      const inset = rowInset(def);
      return modifiers(emitNode(row, true), [
        "frame(maxWidth: .infinity, alignment: .leading)",
        pad > 0 && `padding(.vertical, ${num(baseCtx.space(pad))})`,
        carded && inset > 0 && `padding(.horizontal, ${num(baseCtx.space(inset))})`,
        mode === "cards" && `themeCard(cornerRadius: ${radius})`,
      ]);
    });
    if (mode === "cards") return call("VStack", [["spacing", num(baseCtx.space(LIST_GAP))]], items.flat());
    const line = mode === "grouped" ? `Divider().padding(.leading, ${num(baseCtx.space(LIST_INSET))})` : "Divider()";
    const stack = call("VStack", [["spacing", "0"]], items.flatMap((lines, i) => (i ? [line, ...lines] : lines)));
    return mode === "grouped" ? modifiers(stack, [`themeCard(cornerRadius: ${radius})`]) : stack;
  }

  // Screens arrive in the app's style (Style → Entrance).
  if (resolved && resolved.entrance !== "none") screenMods.push([".themeEntrance()"]);
  // Screen-level modifiers (a toast's overlay) follow the root's own modifiers.
  const bodyLines = [...emitNode(screen.root), ...screenMods.flat()];
  const head: string[] = [];
  head.push(importLine(SWIFTUI));
  for (const m of [...imports].sort()) head.push(importLine(m));
  head.push("");
  head.push(`struct ${screen.name}: View {`);
  if (usesDismiss) head.push(indent(["@Environment(\\.dismiss) private var dismiss"])[0]);
  if (usesTab) head.push(indent(["@Environment(\\.appTab) private var appTab"])[0]);
  if (usesRoot) {
    const flag = rootFlag(screens);
    head.push(indent([`@AppStorage(${str(flag)}) private var ${flag} = false`])[0]);
  }
  for (const s of states) head.push(`${indent([`@State private var ${s.name}${s.type ? `: ${s.type}` : ""} = ${s.initial}`])[0]}`);
  if (states.length || usesDismiss || usesRoot || usesTab) head.push("");
  head.push(indent(["var body: some View {"])[0]);
  // Previews sit in a NavigationStack like the running app, so titles and links preview correctly.
  const decls = [...declarations.values()].flatMap((d) => ["", ...d]);
  const tail = [indent(["}"])[0], "}", ...decls, "", "#Preview {", indent(["NavigationStack {"])[0], indent([`${screen.name}()`], 2)[0], indent(["}"])[0], "}", ""];
  const tagged = [...head, ...indent(bodyLines, 2), ...tail];

  // Strip tags, recording spans.
  const open = new Map<string, number>();
  const ranges: Record<string, [number, number]> = {};
  const clean = tagged.map((line, i) => {
    let l = line;
    l = l.replace(/\u0000o([^\u0000]+)\u0000/g, (_, id) => {
      open.set(id, i + 1);
      return "";
    });
    l = l.replace(/\u0000c([^\u0000]+)\u0000/g, (_, id) => {
      ranges[id] = [open.get(id) ?? i + 1, i + 1];
      return "";
    });
    return l;
  });
  const code = clean.map((l) => l.replace(/\s+$/, "")).join("\n");
  return { name: screen.name, fileName: `${screen.name}.swift`, code, imports: [...imports].sort(), pieces: [...pieces.values()], ranges };
}


function appFile(appName: string, root: string, theme: ResolvedTheme | null, after: { view: string; flag: string } | null = null): string {
  const stack = (v: string, pad: string) => (v === "ContentView" ? [`${pad}${v}()`] : [`${pad}NavigationStack {`, `${pad}    ${v}()`, `${pad}}`]);
  // A root link (the end of onboarding or sign-in) switches the root on an @AppStorage flag.
  // A Group, so the look's modifiers below apply to whichever root is showing.
  const view = after
    ? ["            Group {", `                if ${after.flag} {`, ...stack(after.view, "                    "), "                } else {", ...stack(root, "                    "), "                }", "            }"]
    : stack(root, "            ");
  // The look applies once, at the root: every screen, sheet and pushed view inherits it.
  // Xcode's style: under a one-line view, modifiers indent; after a closing brace they align with it.
  const pad = !after && root === "ContentView" ? "                " : "            ";
  const mods = theme ? rootModifiers(theme).map((m) => `${pad}.${m}`) : [];
  return [
    importLine(SWIFTUI),
    "",
    "@main",
    `struct ${appName}App: App {`,
    ...(after ? [`    @AppStorage(${str(after.flag)}) private var ${after.flag} = false`, ""] : []),
    // Navigation bar titles don't read SwiftUI's font environment: set them once, at launch.
    ...(theme && usesThemeFonts(theme) && theme.heading.id !== "default" ? ["    init() {", "        Theme.styleNavigationBars()", "    }", ""] : []),
    "    var body: some Scene {",
    "        WindowGroup {",
    ...view,
    ...mods,
    "        }",
    "    }",
    "}",
    "",
  ].join("\n");
}

/** The modifiers a themed app's root carries, without their dot: every view below inherits them. */
function rootModifiers(theme: ResolvedTheme): string[] {
  return [
    "tint(Theme.accent)",
    ...themeRootModifiers(theme),
    FONT_WEIGHT[theme.weight] ? `fontWeight(${FONT_WEIGHT[theme.weight]})` : null,
    FONT_WIDTH[theme.width] ? `fontWidth(${FONT_WIDTH[theme.width]})` : null,
    TRACKING[theme.tracking] ? `tracking(${TRACKING[theme.tracking]})` : null,
    DYNAMIC_TYPE[theme.textSize] ? `dynamicTypeSize(${DYNAMIC_TYPE[theme.textSize]})` : null,
    theme.appearance !== "system" ? `preferredColorScheme(.${theme.appearance})` : null,
  ].filter((m): m is string => Boolean(m));
}

/**
 * A style for an app of your own, not one from the Playground: Theme.swift exactly as the
 * Playground's export writes it, and an App whose root wears the style (its modifiers, plus the
 * init that styles navigation bars when there's a heading font). With both in an Xcode project,
 * every view under ContentView follows the style. `appName` names the App struct (`<name>App`).
 */
export function styleSwift(theme: Theme, appName = "My"): { theme: string; app: string } {
  const resolved = resolveTheme(theme);
  return { theme: themeFile(resolved, "SwiftPieces Styles"), app: appFile(appName, "ContentView", resolved) };
}

/**
 * Theme.swift: the look's colors as adaptive SwiftUI colors, read by the screens and the app root.
 * `madeIn` names where the style was made, for the file's opening comment.
 */
function themeFile(theme: ResolvedTheme, madeIn = "the SwiftPieces playground"): string {
  const pair = (name: string, doc: string, p: { light: string; dark: string }) => [`    /// ${doc}`, `    static let ${name} = Color(light: ${swiftHex(p.light)}, dark: ${swiftHex(p.dark)})`];
  return [
    importLine(SWIFTUI),
    importLine("UIKit"),
    "",
    `/// The app's look, made in ${madeIn} (${theme.look.name}). Change a value here`,
    "/// and every screen follows. The accent is also the app's AccentColor asset.",
    "enum Theme {",
    ...pair("accent", "Buttons, links, selection and tinted controls.", theme.accent),
    ...pair("accentInk", "Text and icons that sit on the accent.", theme.accentInk),
    ...pair("background", "Screen backgrounds.", theme.background),
    ...pair("surface", "Cards and grouped content.", theme.surface),
    "}",
    ...themeFontLines(theme),
    ...themeMotionLines(theme),
    ...themeShapeLines(theme),
    ...themeCardLines(theme),
    ...themeBackgroundLines(theme),
    ...themeEntranceLines(theme),
    "",
    "extension Color {",
    "    /// A color that switches with light and dark mode.",
    "    init(light: UInt32, dark: UInt32) {",
    "        self.init(uiColor: UIColor { traits in",
    "            let value = traits.userInterfaceStyle == .dark ? dark : light",
    "            return UIColor(",
    "                red: CGFloat((value >> 16) & 0xFF) / 255,",
    "                green: CGFloat((value >> 8) & 0xFF) / 255,",
    "                blue: CGFloat(value & 0xFF) / 255,",
    "                alpha: 1",
    "            )",
    "        })",
    "    }",
    "}",
    "",
  ].join("\n");
}

const TAB_SYMBOLS = ["house", "magnifyingglass", "bell", "person", "gearshape", "star", "heart", "bookmark", "calendar", "chart.bar", "tray", "sparkles"];

/** The tab bar a project exports with: Style's Tab bar when set, else the app's own. */
export function tabBarOf(project: Project): "dock" | "glass" | "system" {
  const style = project.theme?.tabStyle;
  return style ?? (project.tabBar === "dock" ? "dock" : "system");
}

function tabsFile(all: Screen[], dock: boolean, glass = false): string {
  // Tab roots are the screens with a tab item; the rest are pushed or presented from them.
  const screens = all.some((s) => s.tab) ? all.filter((s) => s.tab) : all;
  const items = screens.map((s, i) => ({
    screen: s,
    title: s.tab?.title || s.name.replace(/View$/, "").replace(/([a-z])([A-Z])/g, "$1 $2"),
    symbol: s.tab?.icon || TAB_SYMBOLS[i % TAB_SYMBOLS.length],
  }));
  // The selection is shared through the environment, so any screen can switch tabs (\`appTab\`).
  const env = ["", "extension EnvironmentValues {", "    /// The selected tab, so a screen can switch to another tab.", "    @Entry var appTab: Binding<Int> = .constant(0)", "}"];
  const preview = ["", "#Preview {", "    ContentView()", "}", ...env, ""];
  if (!dock) {
    const tabs = items.flatMap((t, i) => [`            NavigationStack { ${t.screen.name}() }`, `                .tabItem { Label(${str(t.title)}, systemImage: ${str(t.symbol)}) }`, `                .tag(${i})`]);
    return [importLine(SWIFTUI), "", "struct ContentView: View {", "    @State private var tab = 0", "", "    var body: some View {", "        TabView(selection: $tab) {", ...tabs, "        }", "        .environment(\\.appTab, $tab)", "    }", "}", ...preview].join("\n");
  }
  // The Floating Dock stands in for the system tab bar: the TabView keeps each tab's stack and
  // state, its own bar is hidden, and the dock drives the selection.
  const tabs = items.flatMap((t, i) => [`            NavigationStack { ${t.screen.name}() }`, `                .tag(${i})`, "                .toolbar(.hidden, for: .tabBar)"]);
  const dockItems = items.map((t, i) => `                .init(${str(t.title)}, systemImage: ${str(t.symbol)})${i < items.length - 1 ? "," : ""}`);
  return [
    importLine(SWIFTUI), "", "struct ContentView: View {", "    @State private var tab = 0", "", "    var body: some View {", "        TabView(selection: $tab) {", ...tabs, "        }",
    "        .safeAreaInset(edge: .bottom) {", "            FloatingDock(items: [", ...dockItems,
    // Style → Tab bar: glass puts the dock in Liquid Glass (a material before iOS 26).
    glass ? "            ], selection: $tab, tint: .accentColor, style: { var style = FloatingDock.Style.standard; style.usesGlass = true; return style }())" : "            ], selection: $tab, tint: .accentColor)",
    "            .padding(.bottom, 4)", "        }", "        .environment(\\.appTab, $tab)", "    }", "}", ...preview,
  ].join("\n");
}

/** Every file a project needs, except SwiftPieces component sources (fetched at export). */
export function generateProject(project: Project, registry: ComponentRegistry): GeneratedProject {
  const appName = project.name;
  const tabIds = project.screens.length > 1 && project.shell === "tabs" ? (project.screens.some((s) => s.tab) ? project.screens.filter((s) => s.tab) : project.screens).map((s) => s.id) : [];
  const screens = project.screens.map((s) => generateScreen(s, registry, project.screens, project.theme, tabIds));
  const theme = project.theme ? resolveTheme(project.theme) : null;
  const files: GeneratedProject["files"] = screens.map((s) => ({ path: s.fileName, content: s.code }));
  let root = screens[0].name;
  if (project.screens.length > 1 && project.shell === "tabs") {
    const bar = tabBarOf(project);
    files.push({ path: "ContentView.swift", content: tabsFile(project.screens, bar !== "system", bar === "glass") });
    root = "ContentView";
  }
  const after = rootTarget(project, registry);
  files.unshift({ path: `${appName}App.swift`, content: appFile(appName, root, theme, after ? { view: after.name, flag: rootFlag(project.screens) } : null) });
  if (theme) files.push({ path: "Theme.swift", content: themeFile(theme) });
  const pieces = new Map<string, { registry: "free" | "pro"; name: string }>();
  for (const s of screens) for (const p of s.pieces) pieces.set(`${p.registry}:${p.name}`, p);
  if (project.screens.length > 1 && project.shell === "tabs" && tabBarOf(project) !== "system") pieces.set("free:FloatingDock", { registry: "free", name: "FloatingDock" });
  return { files, screens, pieces: [...pieces.values()], appName };
}

/** One tap that leads somewhere: which node, on which screen, to which link value (see parseLink). */
export type FlowLink = { screenId: string; nodeId: string; to: string };

/**
 * Every link in the project, in screen order. The canvas draws these as arrows and the prototype
 * follows them; both read the same props the generator writes as NavigationLinks.
 */
export function projectLinks(project: Project, registry: ComponentRegistry): FlowLink[] {
  const ids = new Set(project.screens.map((s) => s.id));
  const out: FlowLink[] = [];
  for (const screen of project.screens) {
    const walk = (node: ScreenNode) => {
      const def = registry.get(node.component);
      for (const p of def?.properties ?? []) {
        if (p.type !== "link") continue;
        const v = node.props[p.id];
        if (typeof v !== "string" || !v) continue;
        if (p.when) {
          const w = node.props[p.when.prop];
          if (p.when.equals && !p.when.equals.includes(w)) continue;
          if (p.when.notEquals && p.when.notEquals.includes(w)) continue;
        }
        const { mode, id } = parseLink(v);
        if (mode === "back" || (ids.has(id) && id !== screen.id)) out.push({ screenId: screen.id, nodeId: node.id, to: v });
      }
      node.children?.forEach(walk);
    };
    walk(screen.root);
  }
  return out;
}
