// "Copy prompt for your agent": one message a developer pastes into Claude Code, Cursor or Xcode's
// assistant to keep building this app in the same design. It names the look in concrete values,
// the screens and the SwiftPieces the app uses, and where to get more pieces, so the agent extends
// the app instead of inventing a new style.
import type { GeneratedProject } from "./generate.js";
import { addCommand, agentSiteUrl } from "./site-url.js";
import { resolveTheme } from "./looks.js";
import type { Project, Theme } from "./schema.js";
import { moods } from "./shuffle.js";

export function agentPrompt(project: Project, generated: GeneratedProject, opts: { repoUrl?: string; siteUrl?: string } = {}): string {
  const site = opts.siteUrl ?? agentSiteUrl();
  const theme = project.theme ? resolveTheme(project.theme) : null;
  const pieces = generated.pieces.map((p) => p.name);
  const lines = [
    `I'm building an iOS app called ${project.name} in SwiftUI (iOS 17+, no third-party packages).`,
    opts.repoUrl ? `Start from this project: git clone ${opts.repoUrl}` : `The project is open in Xcode.`,
    "",
    `Screens so far: ${generated.screens.map((s) => s.name).join(", ")}. Read AGENTS.md first: it has the design rules.`,
  ];
  if (theme) {
    lines.push(
      "",
      // The style's custom name is user text (it travels in shared links), so it is left out of the
      // instructions: only allow-listed values reach the prompt.
      `Design ("${theme.look.name}" look, keep it consistent):`,
      `- Colors come from Theme.swift: accent ${theme.accent.light} / ${theme.accent.dark} (light / dark), background ${theme.background.light} / ${theme.background.dark}. Never hard-code other colors.`,
      theme.heading.id !== theme.body.id
        ? `- Fonts: ${theme.body.name} for text, ${theme.heading.name} for titles. Use Theme.font(.body) … Theme.font(.largeTitle) (Dynamic Type styles), Theme.font(size:weight:) for big figures.`
        : `- Font: ${theme.body.name}${theme.body.family ? ", through Theme.font(_:)" : ""}, Dynamic Type styles only.`,
      `- Cards: ${theme.cards} (use .themeCard(cornerRadius:) from Theme.swift). Backdrop: ${theme.backdrop}${theme.backdrop !== "none" ? " (ThemeBackground)" : ""}. Symbols: ${theme.symbols}. Motion: Theme.motion (${theme.motion}).`,
      ...(theme.lists ? [`- Lists: ${LIST_WORDS[theme.lists]}.`] : []),
      `- Corners: ${theme.corners}. Appearance: ${theme.appearance === "system" ? "light and dark" : theme.appearance}.`,
      `- Text size: ${theme.textSize ?? "default"}. Weight: ${theme.weight ?? "regular"}. Spacing: ${theme.density ?? "regular"}.`,
    );
  }
  lines.push(
    "",
    pieces.length ? `It uses SwiftPieces components: ${pieces.join(", ")} (source in SwiftPieces/).` : "It doesn't use SwiftPieces components yet.",
    `For new interactive UI, first look for a SwiftPieces component: the MCP server at ${site}/api/mcp (search_pieces, install_piece), or \`${addCommand(site)}\`. The catalog is ${site}/llms.txt.`,
    "",
    "Next, help me: ",
  );
  return lines.join("\n");
}

/** Style → Lists, for a prompt or an agent's notes. */
export const LIST_WORDS: Record<"cards" | "grouped" | "plain", string> = {
  cards: "each row its own card (`.themeCard(cornerRadius: 16)`), 8 apart",
  grouped: "rows share one `.themeCard(cornerRadius: 16)`, inset 16, with `Divider()` hairlines between",
  plain: "rows sit on the background with `Divider()` hairlines between, no cards",
};

// ---------------------------------------------------------------- A style on its own

const CARD_WORDS: Record<string, string> = {
  flat: "a soft fill, no border or shadow",
  raised: "the card color with a soft drop shadow",
  outlined: "the card color with a hairline border, no shadow",
  glass: "a thin translucent material with a faint light edge",
  bold: "the card color with a 2 pt border in the text color and a hard offset shadow",
};
const BUTTON_WORDS: Record<string, string> = {
  solid: "filled with the accent, its text in the ink on the accent",
  tinted: "a soft tint of the accent with accent text",
  outline: "accent text inside an accent hairline, no fill",
  glass: "Liquid Glass with accent text (a material before iOS 26)",
};
const BACKDROP_WORDS: Record<string, string> = {
  glow: "a soft glow of the accent behind the top of each screen",
  gradient: "a soft wash of the accent from the top of each screen",
  mesh: "a soft mesh of the accent and the supporting colors",
  grid: "a faint dot grid",
  paper: "a fine paper texture",
};
const TAB_WORDS: Record<string, string> = {
  dock: "a floating dock where the selected tab becomes an accent block",
  glass: "a floating Liquid Glass tab bar (a material before iOS 26)",
  system: "the standard iOS tab bar",
};
const HEADER_WORDS: Record<string, string> = {
  split: "a title in two weights under a small eyebrow",
  bold: "one bold title",
  centered: "centered titles",
};

/**
 * "Copy prompt" on the Styles page: one message to paste into an AI assistant (Claude Code, Cursor,
 * Xcode's assistant) so it designs an app in this style. The style in concrete values (colours,
 * fonts, corners, spacing, motion), then Theme.swift, the same values as code, then where to get
 * components that follow it. Only allow-listed values reach it (the catalogue's look, mood and font
 * names, option words and validated colours), never a name typed or shuffled into the style.
 */
export function stylePrompt(theme: Theme, opts: { code: string; link?: string; mood?: string; swift?: string; siteUrl?: string }): string {
  const t = resolveTheme(theme);
  const site = opts.siteUrl ?? agentSiteUrl();
  const mode = t.appearance;
  const hex = (v: string) => v.toUpperCase();
  // A light-only style gives its light values, a dark-only one its dark; one that follows the device both.
  const pair = (p: { light: string; dark: string }) => (mode === "system" ? `${hex(p.light)} in light, ${hex(p.dark)} in dark` : hex(p[mode]));
  const ink = { light: t.look.light.text, dark: t.look.dark.text };
  const own = t.accent[mode === "dark" ? "dark" : "light"].toLowerCase();
  const support = [...new Set(t.look[mode === "dark" ? "dark" : "light"].tiles.map((c) => c.toLowerCase()))].filter((c) => c !== own).slice(0, 4).map(hex);
  const mood = moods.find((m) => m.id === opts.mood)?.name;
  const pts = (pt: number, title = false) => Math.round(pt * t.textScale * (title ? t.titleScale : 1));
  const space = (v: number) => Math.round(v * t.spaceScale);
  const fonts =
    t.heading.id === t.body.id
      ? `${t.body.name} for headings and body${t.body.family ? "" : " (the system font)"}`
      : `${t.heading.name} for titles, ${t.body.name} for everything else`;
  const words: Array<string | false | null> = [
    `Design my iOS app in this style: SwiftUI, iOS 17 or later. Use these values everywhere, and don't invent other colors, fonts or corner sizes.`,
    "",
    `Style: the ${t.look.name} look${mood ? `, ${mood.toLowerCase()} mood` : ""}, made in SwiftPieces Styles (code ${opts.code})${opts.link ? `. See it: ${opts.link}` : "."}`,
    "",
    "Color",
    `- Accent: ${pair(t.accent)}, with ${pair(t.accentInk)} for text and icons on it. Use it for primary buttons, selection, links, toggles, progress and charts; keep everything else neutral.`,
    `- Background: ${pair(t.background)}. Cards and grouped content: ${pair(t.surface)}.`,
    `- Text: ${pair(ink)}; secondary text is the same color at about 60% opacity.`,
    support.length > 0 && `- Supporting colors, for illustrations, tags and charts only: ${support.join(", ")}.`,
    `- Appearance: ${mode === "system" ? "follows the device, light and dark" : `${mode} only`}.`,
    t.backdrop !== "none" && `- Backdrop: ${BACKDROP_WORDS[t.backdrop] ?? t.backdrop} (ThemeBackground in Theme.swift).`,
    "",
    "Type",
    `- ${fonts}. Use text styles so Dynamic Type works: Theme.font(.largeTitle) down to Theme.font(.caption), and Theme.font(size:weight:) for big figures.`,
    `- Sizes: Title ${pts(28, true)} pt, Headline ${pts(17)} pt semibold, Body ${pts(17)} pt, Caption ${pts(12)} pt. Weight: ${t.weight}${t.hierarchy !== "balanced" ? `. Titles: ${t.hierarchy}` : ""}${t.width !== "standard" ? `. Width: ${t.width}` : ""}${t.tracking !== "normal" ? `. Letter spacing: ${t.tracking === "wide" ? "loose" : t.tracking}` : ""}.`,
    t.headers !== "split" && `- Screen headers: ${HEADER_WORDS[t.headers] ?? t.headers}.`,
    t.numbers === "tabular" && "- Numbers: tabular figures (.monospacedDigit()) wherever a number changes.",
    "",
    "Shape and spacing",
    // The style's own corner choice (the resolved kind folds square into tight).
    `- Corners: ${theme.corners === "square" ? "square, no rounding" : `${theme.corners}, ${t.cornerScale}x the usual radii (a 16 pt card corner is ${Math.round(16 * t.cornerScale)} pt) through Theme.corner(_:), continuous`}.`,
    `- Cards: ${t.cards}, ${CARD_WORDS[t.cards] ?? t.cards}. Use .themeCard(cornerRadius:).`,
    `- Buttons: ${t.buttons}, ${BUTTON_WORDS[t.buttons] ?? t.buttons}, ${t.buttonHeight} pt tall.`,
    t.lists && `- Lists: ${LIST_WORDS[t.lists]}.`,
    `- Spacing: ${t.density}, about ${space(16)} pt screen margins and ${space(12)} pt between items.`,
    `- Icons: SF Symbols, ${t.symbols === "outline" ? "outlined" : t.symbols === "fill" ? "filled (.symbolVariant(.fill))" : "two-tone (.symbolRenderingMode(.hierarchical))"}, ${t.iconScale} size.`,
    t.tabStyle && `- Tab bar: ${TAB_WORDS[t.tabStyle] ?? t.tabStyle}.`,
    "",
    "Motion",
    `- ${t.motion[0].toUpperCase()}${t.motion.slice(1)}: Theme.motion (.${t.motion}) for every state change, springs rather than linear timing, and less motion under Reduce Motion.${t.entrance !== "none" ? ` Screens ${t.entrance === "fade" ? "fade in" : "rise in"} as they appear.` : ""}`,
  ];
  const lines = words.filter((w): w is string => typeof w === "string");
  if (opts.swift) {
    lines.push(
      "",
      "Theme.swift is this style as code. Add it to the project and use Theme.accent, Theme.accentInk, Theme.background, Theme.surface, Theme.font(_:), .themeCard(cornerRadius:) and Theme.motion instead of hard-coded values:",
      "",
      "```swift",
      opts.swift.trimEnd(),
      "```",
    );
  }
  lines.push(
    "",
    `For interactive UI, start from SwiftPieces components, which follow this theme: ${site}/llms.txt, or \`${addCommand(site)}\`.`,
    "",
    "What I want to build: ",
  );
  return lines.join("\n");
}
