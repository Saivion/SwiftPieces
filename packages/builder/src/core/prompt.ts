// "Copy prompt for your agent": one message a developer pastes into Claude Code, Cursor or Xcode's
// assistant to keep building this app in the same design. It names the look in concrete values,
// the screens and the SwiftPieces the app uses, and where to get more pieces, so the agent extends
// the app instead of inventing a new style.
import type { GeneratedProject } from "./generate.js";
import { resolveTheme } from "./looks.js";
import type { Project } from "./schema.js";

export function agentPrompt(project: Project, generated: GeneratedProject, opts: { repoUrl?: string } = {}): string {
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
    "For new interactive UI, first look for a SwiftPieces component: the MCP server at https://swiftpieces.com/api/mcp (search_pieces, install_piece), or `npx swiftpieces add <Name>`. The catalog is https://swiftpieces.com/llms.txt.",
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
