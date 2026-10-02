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

/**
 * `link` is a navigation target: the id of another screen in the project (pushed), "sheet:<id>"
 * (presented as a sheet), "root:<id>" (becomes the app's root), "back" (pop or dismiss), or "" for none. Its options come from the
 * project's screens at edit time, so it never lists fixed values.
 */
export type PropertyType = "text" | "number" | "boolean" | "select" | "color" | "icon" | "spacing" | "link";

export type PropertyOption = { value: string; label: string };

/**
 * What a property changes, in the words the inspector groups by. Meaningful groups only: a
 * component shows the groups its properties fall into, never a generic style sheet.
 */
export type PropertyGroup = "content" | "typography" | "layout" | "shape" | "color" | "material" | "motion" | "state" | "interaction";

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
  /** Inspector group. Inferred from the type and id when absent (see `propertyGroup`). */
  group?: PropertyGroup;
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
  /** Its tab bar item when the project's shell is "tabs". */
  tab?: { title: string; icon: string };
  /**
   * The catalog screen it was brought in from (composing), so the Playground can show what inspired
   * it. Absent on an entry's own screens. Never part of the exported app.
   */
  source?: { kind: string; slug: string; step: number };
};

export type ThemeAppearance = "system" | "light" | "dark";
/** A font from core/fonts.ts: a system design ("default", "rounded", "serif", "mono") or an iOS family. */
export type ThemeFont = string;
/** A pattern or light over the screen ground. */
export type ThemeBackdrop = "none" | "glow" | "gradient" | "grid" | "paper" | "mesh";
/** How cards are drawn: a soft fill, lifted, outlined, frosted glass, or bold (thick edge, hard shadow). */
export type ThemeCards = "flat" | "raised" | "outlined" | "glass" | "bold";
/** SF Symbols: outlined, filled, or filled in two tones. */
export type ThemeSymbols = "outline" | "fill" | "hierarchical";
/** How things move: SwiftUI's smooth, snappy or bouncy springs. */
export type ThemeMotion = "smooth" | "snappy" | "bouncy";
/** How far cards and grounds stand apart: soft, standard or high. */
export type ThemeContrast = "soft" | "standard" | "high";
/** The greys' temperature: neutral, warm or cool. */
export type ThemeNeutrals = "neutral" | "warm" | "cool";
/** The dark-mode ground: the preset's own, true black, or graphite. */
export type ThemeDarkGround = "look" | "black" | "graphite";
/** Figures: the font's own, or tabular (every digit the same width, so counts don't jiggle). */
export type ThemeNumbers = "default" | "tabular";
/** How much bigger titles are than body text. */
export type ThemeHierarchy = "flat" | "balanced" | "dramatic";
/** Primary buttons: a solid accent fill, a tinted wash, an outline, or frosted glass. */
export type ThemeButtons = "solid" | "tinted" | "outline" | "glass";
/** How a screen arrives: at once, fading in, or rising into place. */
export type ThemeEntrance = "none" | "fade" | "rise";
/** Whether the mascot appears. */
export type ThemeMascot = "shown" | "hidden";
/** Screen headers: two weights as designed, one bold weight, or centered. */
export type ThemeHeaders = "split" | "bold" | "centered";
/** How tall buttons are: compact (48), regular (56) or large (64). */
export type ThemeButtonSize = "compact" | "regular" | "large";
/** SF Symbols relative to text: `.imageScale` small, medium or large. */
export type ThemeIconScale = "small" | "medium" | "large";
/** The tab bar of a tabs app: the floating dock, the dock in glass, or the system tab bar. */
export type ThemeTabStyle = "dock" | "glass" | "system";
/** How runs of rows are drawn: each row its own card, rows grouped in one card with hairlines, or plain rows with hairlines. */
export type ThemeLists = "cards" | "grouped" | "plain";
export type ThemeCorners = "square" | "tight" | "standard" | "soft" | "round";
export type ThemeTextSize = "default" | "large" | "xlarge" | "xxlarge";
export type ThemeWeight = "light" | "regular" | "medium" | "bold" | "heavy";
export type ThemeDensity = "compact" | "regular" | "roomy" | "airy";
/** Letter width: SwiftUI's `.fontWidth`. */
export type ThemeWidth = "compressed" | "condensed" | "standard" | "expanded";
/** Letter spacing: SwiftUI's `.tracking`. */
export type ThemeTracking = "tight" | "normal" | "wide";
/** The screen ground: the look's own, washed with the accent, or plain white / black. */
export type ThemeGround = "look" | "tinted" | "plain";
/**
 * Exact colours taken from a screenshot (Match its style), for the appearance it was in: the
 * screen ground and, when it has cards, their fill. They replace the look's own for that mode only.
 */
export type ThemeCustom = { mode: "light" | "dark"; ground: string; surface?: string };

/**
 * The project's look (core/looks.ts): a starting look, an optional accent from its palette, and
 * the three things people adjust. Everything here becomes Swift the export can express.
 */
export type Theme = {
  /** A `Look.id`. */
  look: string;
  /** Index into the look's palette for the accent, or -1 for the look's own accent. */
  accent: number;
  appearance: ThemeAppearance;
  font: ThemeFont;
  corners: ThemeCorners;
  /** The smallest Dynamic Type size the app uses. A floor, so a larger size set in iOS still applies. */
  textSize: ThemeTextSize;
  /** Text weight across the app. */
  weight: ThemeWeight;
  /** Scales every stack's spacing and padding. */
  density: ThemeDensity;
  /** A custom accent ("#RRGGBB"), in place of the look's or its palette's. Optional: added later. */
  accentHex?: string;
  /** The screen ground. Optional: added later (absent is the look's own). */
  ground?: ThemeGround;
  /** Letter width. Optional: added later (absent is standard). */
  width?: ThemeWidth;
  /** Letter spacing. Optional: added later (absent is normal). */
  tracking?: ThemeTracking;
  /** The font for titles and headlines; absent is the same as `font` (the body font). */
  headingFont?: ThemeFont;
  /** A pattern or light over the ground; absent is none. */
  backdrop?: ThemeBackdrop;
  /** Card treatment; absent is flat. */
  cards?: ThemeCards;
  /** SF Symbol variant; absent is outline. */
  symbols?: ThemeSymbols;
  /** Motion personality; absent is smooth. */
  motion?: ThemeMotion;
  /** Added later, each optional (absent is the first choice listed on its type). */
  contrast?: ThemeContrast;
  neutrals?: ThemeNeutrals;
  darkGround?: ThemeDarkGround;
  numbers?: ThemeNumbers;
  hierarchy?: ThemeHierarchy;
  buttons?: ThemeButtons;
  entrance?: ThemeEntrance;
  mascot?: ThemeMascot;
  headers?: ThemeHeaders;
  buttonSize?: ThemeButtonSize;
  iconScale?: ThemeIconScale;
  /** Absent: the app's own tab bar (as its remix was built). */
  tabStyle?: ThemeTabStyle;
  /** Absent: each list as its remix was built. */
  lists?: ThemeLists;
  /** Exact ground and card colours from a screenshot; absent is the look's own. */
  custom?: ThemeCustom;
  /** A name for the style (Shuffle names what it makes, e.g. "Midnight Press"). */
  name?: string;
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
  /** The tabs shell's bar: absent is the system tab bar, "dock" is the Floating Dock piece. */
  tabBar?: "dock";
  /** The app's look. Absent: plain iOS system styling, as before themes existed. */
  theme?: Theme;
  /**
   * The catalog entry this remix started from ("screens/paywall"), so a saved, shared or
   * handed-over remix reopens on its entry.
   */
  entry?: string;
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
  /**
   * One `@State` shared by every node that names the same `key` (a group of option cards shares
   * `@State private var plan = "Yearly"`). Returns its name. `initial` is used when the key is first
   * declared, or replaces it when `prefer` is true (the option that starts selected).
   */
  shared(key: string, type: string, initial: string, prefer?: boolean): string;
  /**
   * Attaches a modifier block after this node's own modifiers, e.g. the `.sheet(isPresented:)` a
   * button presents. Indented the way Xcode would: under a one-line view, level after a brace.
   */
  attach(lines: string[]): void;
  /**
   * Attaches a modifier to the whole screen rather than to this node: presentations that belong
   * to the screen (a toast overlay, an alert) go here so they size and position against the screen.
   * `lines` is the modifier as written, starting with ".", e.g. [".toast(isPresented: $showToast) {", "}"].
   */
  screenModifier(lines: string[]): void;
  /**
   * A declaration at file scope, after the screen's view (a sample model type a component's data
   * needs, e.g. `struct Receipt: Identifiable, Sendable { … }`). `key` dedupes it across nodes.
   */
  declare(key: string, lines: string[]): void;
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
  /**
   * Resolves a `link` prop: the destination view to push, a pop back, or null when the link is
   * empty or points at a screen that no longer exists.
   */
  link(value: string): NavTarget | null;
  /** The project's resolved look, or null for plain system styling. */
  theme: import("./looks.js").ResolvedTheme | null;
  /** A corner radius scaled by the look's corner style (unchanged without a look). */
  corner(radius: number): number;
  /** Spacing or padding scaled by the look's density (unchanged without a look). */
  space(value: number): number;
  /** Declares `@Environment(\.dismiss) private var dismiss` once and returns its name. */
  dismiss(): string;
};

/**
 * Where a tap goes: push another screen's view, present it as a sheet, go back, or make another
 * screen the app's root (the end of onboarding or sign-in: an `@AppStorage` flag the app reads).
 */
export type NavTarget =
  | { kind: "push"; view: string; screenId: string }
  | { kind: "sheet"; view: string; screenId: string; detent: string }
  | { kind: "root"; view: string; screenId: string; flag: string }
  /** Another tab of a tabs app: `set` is the statement that selects it (the app's shared tab binding). */
  | { kind: "tab"; view: string; screenId: string; set: string }
  | { kind: "back" };

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
  /**
   * Renderer key in the preview (usually the id), and the chunk its renderer lives in, so a screen
   * only downloads the renderers it uses. No chunk: the always-loaded native primitives, or, for a
   * free piece, the original pieces chunk.
   */
  preview: { component: string; chunk?: string };
  /**
   * When the component is one card (a surface with rounded corners), its corner radius for these
   * props (null when these props aren't a card). Style's Cards treatment then reaches it like any
   * card: its edge in the preview and `.themeCard(cornerRadius:)` in the Swift.
   */
  card?: (p: Props) => number | null;
  /**
   * When the component is one row of a list. Style's Lists option (cards, grouped, plain) then
   * draws runs of these rows itself: `bare` are the props that take away the row's own card or
   * fill, `pad` the vertical padding the list gives each row (default 12), and `inset` the side
   * padding a card list gives it (default 16; less when the row pads its own sides).
   */
  list?: { bare?: Props; pad?: number; inset?: number };
  /**
   * A list of its own (several items in one component): the props that draw it in each Lists
   * style, or null to keep it as built.
   */
  listStyle?: (mode: ThemeLists, p: Props) => Props | null;
  properties: PropertyDefinition[];
  /** Named presets of props, shown as one-tap variants. */
  variants?: Array<{ id: string; label: string; props: Props }>;
  /**
   * Can hold children; `accepts` lists which components may be placed inside (empty = any), and
   * `axis` says how the children are laid out ("v", the default, or "h"), which is how a drag
   * decides whether "before" means above or to the left.
   */
  container?: { accepts?: string[]; axis?: "v" | "h" };
  /** An SF Symbol (from core/palette.ts `icons`) for its tile in lists, when the UI has no dedicated one. */
  icon?: string;
  /** Not offered in the library (the screen root). */
  hidden?: boolean;
  /** SwiftPieces registry name when the export must include a component source file. */
  source?: { registry: "free" | "pro"; name: string };
  /** Canonical docs URL path for the component page, when one exists. */
  docs?: string;
  /** Glossary ids ("vstack", "state", …) to offer as "What's this?" when this node is selected. */
  concepts?: string[];
  /**
   * How it is put together, as the inspector draws it: Button → Label, Icon, Background,
   * Interaction. Each part names the properties that shape it, so picking a part narrows the
   * controls to that part.
   */
  anatomy?: Array<{ part: string; props: string[] }>;
  /** Interaction ids (core/interactions.ts) this component responds to in the preview and the app. */
  interactions?: string[];
  /** Component states to step through ("Loading", "Success"), each a patch of props. */
  states?: Array<{ id: string; label: string; props: Props }>;
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

export const FREE_LIMITS: BuilderLimits = { tier: "free", maxScreens: 10, maxNodesPerScreen: 40, availability: ["free"], advancedProperties: false };
export const PRO_LIMITS: BuilderLimits = { tier: "pro", maxScreens: 24, maxNodesPerScreen: 200, availability: ["free", "pro"], advancedProperties: true };
