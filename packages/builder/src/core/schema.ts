// The builder's data model. Everything the playground shows, edits, saves and exports is one of
// these shapes, and nothing else: the preview, the property editor and the SwiftUI generator all
// read the same `ScreenNode` tree through the same `SwiftPieceDefinition`.

/** Where a component can be used. Free apps only register "free" definitions. */
export type Availability = "free" | "pro";

/**
 * Who a property is for. `basic` shows by default; `advanced` sits behind "More options"
 * (progressive disclosure), and is where motion, timing and fine layout live.
 */
export type PropertyLevel = "basic" | "advanced";

export type PropertyType = "text" | "number" | "boolean" | "select" | "color" | "icon" | "spacing";

export type PropertyOption = { value: string; label: string };

export type PropertyDefinition = {
  id: string;
  label: string;
  type: PropertyType;
  defaultValue: string | number | boolean;
  /** For `select`: the allowed values. `color` and `icon` read their fixed palettes instead. */
  options?: PropertyOption[];
  /** For `number` and `spacing`. */
  min?: number;
  max?: number;
  step?: number;
  level?: PropertyLevel;
  /** Only editable on the Pro plan; Free shows the default and a quiet Pro badge. */
  pro?: boolean;
  /** Longest accepted text; longer values are cut on validation. */
  maxLength?: number;
  /** One line under the control, for beginners. */
  hint?: string;
  /** Show the control only when another prop has one of these values. */
  when?: { prop: string; equals?: Array<string | number | boolean>; notEquals?: Array<string | number | boolean> };
};

export type PropValue = string | number | boolean;
export type Props = Record<string, PropValue>;

/** The canonical representation of a design. Never HTML, never pixels. */
export type ScreenNode = {
  id: string;
  /** A `SwiftPieceDefinition.id`. */
  component: string;
  props: Props;
  children?: ScreenNode[];
};

export type Screen = {
  id: string;
  /** Swift type name of the generated view, e.g. "LoginView". */
  name: string;
  /** The root node. Always a `screen` component. */
  root: ScreenNode;
};

export type Project = {
  /** Format version, so saved projects can be migrated instead of dropped. */
  v: 1;
  id: string;
  /** App name used for the Xcode project and the @main type. */
  name: string;
  screens: Screen[];
  /** How several screens are presented. One screen ignores it. */
  shell: "single" | "tabs";
  updatedAt: number;
};

export type Category = "layout" | "content" | "controls" | "inputs" | "pieces" | "pro";

/** Emitted SwiftUI for one node: the expression lines, plus what the file needs around them. */
export type SwiftEmit = {
  /** The view expression, one line per entry, unindented. Children are already inlined. */
  lines: string[];
};

export type EmitContext = {
  /** A Swift string literal with escapes. */
  str(value: string): string;
  /** Emitted children of the current node, each already a list of lines. */
  children(): string[][];
  /** Declares `@State private var <name>: <type> = <initial>` once and returns the binding name. */
  state(hint: string, type: string, initial: string): string;
  /** Records a framework import the file needs (SwiftUI is implied). */
  import(module: string): void;
  /** Records a SwiftPieces component source the project must include. */
  piece(name: string): void;
  /** A palette color where a `Color` is expected, e.g. `.blue` or `.accentColor`. */
  color(id: string): string;
  /** A palette color where a `ShapeStyle` is expected (foregroundStyle, background), e.g. `.tint`. */
  style(id: string): string;
  /** SF Symbol name for an icon id. */
  symbol(id: string): string;
};

/**
 * One component the builder knows. The same object powers the library entry, the property editor,
 * the preview (through `preview`, the renderer key) and the SwiftUI export (through `swift.emit`).
 */
export type SwiftPieceDefinition = {
  id: string;
  name: string;
  category: Category;
  description: string;
  availability: Availability;
  /** Renderer key in the preview. Usually the id. */
  preview: { component: string };
  properties: PropertyDefinition[];
  /** Named presets of props, shown as one-tap variants. */
  variants?: Array<{ id: string; label: string; props: Props }>;
  /** Can hold children; the value lists which components may be placed inside (empty = any). */
  container?: { accepts?: string[] };
  /** Not offered in the library (the screen root). */
  hidden?: boolean;
  /** SwiftPieces registry name when the export must include a component source file. */
  source?: { registry: "free" | "pro"; name: string };
  /** Canonical docs URL path for the component page, when one exists. */
  docs?: string;
  /** Glossary ids ("vstack", "state", …) to offer as "What's this?" when this node is selected. */
  concepts?: string[];
  swift: {
    /** Frameworks this definition may import, beyond SwiftUI. Informational; emit records real use. */
    imports: string[];
    emit(props: Props, ctx: EmitContext): SwiftEmit;
  };
};

/** What a plan allows. The app decides; the builder only enforces. */
export type BuilderLimits = {
  tier: "free" | "pro";
  maxScreens: number;
  maxNodesPerScreen: number;
  /** Definitions of these availabilities are usable. Others show as locked. */
  availability: Availability[];
  /** Pro-only property editing. */
  advancedProperties: boolean;
};

export const FREE_LIMITS: BuilderLimits = { tier: "free", maxScreens: 1, maxNodesPerScreen: 40, availability: ["free"], advancedProperties: false };
export const PRO_LIMITS: BuilderLimits = { tier: "pro", maxScreens: 12, maxNodesPerScreen: 200, availability: ["free", "pro"], advancedProperties: true };

/** Starting point: a whole project, built fresh each time it is picked. */
export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  availability: Availability;
  /** Beginner-facing group ("Account", "First run", …). */
  group: string;
  create(newId: () => string): Pick<Project, "name" | "screens" | "shell">;
};
