// SwiftUI generation. Reads the same ScreenNode tree the preview renders, through the same
// definitions, so the code always describes what is on screen. It never parses code back.
import { colorEntry } from "./palette.js";
import { defaultProps, type ComponentRegistry } from "./registry.js";
import type { EmitContext, Project, Screen, ScreenNode } from "./schema.js";
import { identifier, importLine, indent, str } from "./swift.js";

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

const SWIFTUI = "SwiftUI";

/**
 * Generates one screen. `markers` is filled with the line span of every node so the code view can
 * highlight the selected component; the markers are computed from line counts, never from parsing.
 */
export function generateScreen(screen: Screen, registry: ComponentRegistry): GeneratedScreen {
  const states: Array<{ name: string; type: string; initial: string }> = [];
  const stateNames = new Set<string>();
  const imports = new Set<string>();
  const pieces = new Map<string, { registry: "free" | "pro"; name: string }>();

  const baseCtx = {
    str,
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
    color: (id: string) => colorEntry(id).swift,
    style: (id: string) => (id === "accent" ? ".tint" : colorEntry(id).swift),
    symbol: (id: string) => id,
  };

  // Emission is depth-first; each node's lines are tagged so ranges survive indentation.
  const TAG = "\u0000";
  function emitNode(node: ScreenNode): string[] {
    const def = registry.get(node.component);
    if (!def) throw new GenerationError(`Unknown component "${node.component}"`);
    if (def.source) pieces.set(`${def.source.registry}:${def.source.name}`, { ...def.source });
    const ctx: EmitContext = {
      ...baseCtx,
      piece: (name: string) => pieces.set(`${def.source?.registry ?? "free"}:${name}`, { registry: def.source?.registry ?? "free", name }),
      children: () => (node.children ?? []).map(emitNode),
    };
    let lines: string[];
    try {
      // Defaults first, so a prop missing from an older saved project still emits valid Swift.
      lines = def.swift.emit({ ...defaultProps(def), ...node.props }, ctx).lines;
    } catch (e) {
      if (e instanceof GenerationError) throw e;
      throw new GenerationError(`"${def.name}" couldn't be written as SwiftUI: ${(e as Error).message}`);
    }
    if (!lines.length) return lines;
    // Open and close tags on the first and last line mark the node's span.
    const out = [...lines];
    out[0] = `${TAG}o${node.id}${TAG}${out[0]}`;
    out[out.length - 1] = `${out[out.length - 1]}${TAG}c${node.id}${TAG}`;
    return out;
  }

  const bodyLines = emitNode(screen.root);
  const head: string[] = [];
  head.push(importLine(SWIFTUI));
  for (const m of [...imports].sort()) head.push(importLine(m));
  head.push("");
  head.push(`struct ${screen.name}: View {`);
  for (const s of states) head.push(`${indent([`@State private var ${s.name}${s.type ? `: ${s.type}` : ""} = ${s.initial}`])[0]}`);
  if (states.length) head.push("");
  head.push(indent(["var body: some View {"])[0]);
  const tail = [indent(["}"])[0], "}", "", "#Preview {", indent([`${screen.name}()`])[0], "}", ""];
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

function appFile(appName: string, root: string): string {
  return [
    importLine(SWIFTUI),
    "",
    "@main",
    `struct ${appName}App: App {`,
    "    var body: some Scene {",
    "        WindowGroup {",
    `            ${root}()`,
    "        }",
    "    }",
    "}",
    "",
  ].join("\n");
}

const TAB_SYMBOLS = ["house", "magnifyingglass", "bell", "person", "gearshape", "star", "heart", "bookmark", "calendar", "chart.bar", "tray", "sparkles"];

function tabsFile(screens: Screen[]): string {
  const tabs = screens.flatMap((s, i) => {
    const title = s.name.replace(/View$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
    return [`            ${s.name}()`, `                .tabItem { Label(${str(title)}, systemImage: ${str(TAB_SYMBOLS[i % TAB_SYMBOLS.length])}) }`];
  });
  return [importLine(SWIFTUI), "", "struct ContentView: View {", "    var body: some View {", "        TabView {", ...tabs, "        }", "    }", "}", "", "#Preview {", "    ContentView()", "}", ""].join("\n");
}

/** Every file a project needs, except SwiftPieces component sources (fetched at export). */
export function generateProject(project: Project, registry: ComponentRegistry): GeneratedProject {
  const appName = project.name;
  const screens = project.screens.map((s) => generateScreen(s, registry));
  const files: GeneratedProject["files"] = screens.map((s) => ({ path: s.fileName, content: s.code }));
  let root = screens[0].name;
  if (project.screens.length > 1 && project.shell === "tabs") {
    files.push({ path: "ContentView.swift", content: tabsFile(project.screens) });
    root = "ContentView";
  }
  files.unshift({ path: `${appName}App.swift`, content: appFile(appName, root) });
  const pieces = new Map<string, { registry: "free" | "pro"; name: string }>();
  for (const s of screens) for (const p of s.pieces) pieces.set(`${p.registry}:${p.name}`, p);
  return { files, screens, pieces: [...pieces.values()], appName };
}
