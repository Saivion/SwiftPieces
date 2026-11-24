import { getRegistryIndex } from "@/lib/registry";
import { homeFaqs } from "@/lib/faqs";
import { proCatalog, proGames } from "@/lib/pro-catalog";
import { pro, site } from "@/lib/site";
import { allStills, stills, type StillPiece } from "@/components/landing/stills";
import { categories } from "@/lib/categories";

/** Brand-direction lab (dev only): the facts every direction tells, so only the look differs. */
export const count = getRegistryIndex().length;
export const faqs = homeFaqs(count, proCatalog).slice(0, 5);
export { pro, site, proCatalog, proGames, stills, allStills };
export type { StillPiece };

/** The nav every direction carries. No Games menu: Games lives on Pro. */
export const NAV = [
  { label: "Components", href: "/components" },
  { label: "Docs", href: "/docs/introduction" },
  { label: "Playground", href: "/apps" },
  { label: "Styles", href: "/styles" },
  { label: "Pro", href: "/pro" },
];

export const FOOT = [
  { h: "Library", l: ["Components", "Playground", "Styles", "Changelog"] },
  { h: "Docs", l: ["Installation", "CLI", "MCP server", "Liquid Glass"] },
  { h: "SwiftPieces", l: ["Pro", "Games", "About", "License"] },
];

/** Category leads, vivid at any size. */
const LEAD: Record<string, string> = {
  text: "PictureHeadline", backgrounds: "Silk", glass: "GlassSegments", controls: "TimerDial", inputs: "AmountField",
  cards: "SwipeDeck", lists: "StatusTimeline", navigation: "FloatingDock", sheets: "PermissionSheet",
  feedback: "ReactionToggle", motion: "DragToDismiss", data: "ScrubChart", ai: "AssistantOrb", media: "NowPlaying",
};

export function categoryLeads() {
  const all = allStills();
  return Object.values(categories)
    .map((c) => {
      const items = all.filter((s) => s.category === c.title);
      return { slug: c.slug, title: c.title, count: items.length, lead: items.find((s) => s.name === LEAD[c.slug]) ?? items[0] };
    })
    .filter((c) => c.count > 0 && c.lead);
}

/** Real usage, from each piece's own Example in registry/swift. */
export const SNIPPETS: Record<string, { file: string; code: string[] }> = {
  SwipeDeck: {
    file: "SwipeDeck.swift",
    code: [
      "struct Dinner: View {",
      "    @State var recipes = Recipe.tonight",
      "    @State var swipe: Edge?",
      "",
      "    var body: some View {",
      "        SwipeDeck(items: $recipes, swipe: $swipe) { _, _ in",
      "        } card: { recipe in",
      "            RecipeCard(recipe: recipe)",
      "        }",
      "    }",
      "}",
    ],
  },
  TimerDial: {
    file: "TimerDial.swift",
    code: [
      "struct Brew: View {",
      "    @State var seconds = 45",
      "    @State var running = false",
      "",
      "    var body: some View {",
      "        TimerDial(seconds: $seconds,",
      "                  isRunning: $running,",
      "                  step: 5, maxSeconds: 60,",
      "                  style: .init(showsControls: true))",
      "    }",
      "}",
    ],
  },
  ScrubChart: {
    file: "ScrubChart.swift",
    code: [
      "struct Portfolio: View {",
      "    @State var range = 1",
      "",
      "    var body: some View {",
      "        ScrubChart(series: history,",
      "                   format: .currency(code: \"USD\"),",
      "                   range: $range)",
      "            .frame(height: 340)",
      "    }",
      "}",
    ],
  },
  WalletStack: {
    file: "WalletStack.swift",
    code: [
      "struct Passes: View {",
      "    @State var open: String?",
      "",
      "    var body: some View {",
      "        WalletStack(passes: trip.passes,",
      "                    selection: $open)",
      "            .padding(.horizontal, 20)",
      "    }",
      "}",
    ],
  },
};

/** Minimal Swift highlighting for the snippets: keywords, types, strings, bindings. */
export function tokens(line: string): { t: string; k?: "kw" | "ty" | "st" | "bd" | "nu" }[] {
  const out: { t: string; k?: "kw" | "ty" | "st" | "bd" | "nu" }[] = [];
  const re = /("[^"]*")|(\$[a-zA-Z]+)|\b(struct|var|let|some|in|func|return)\b|\b([A-Z][A-Za-z]+)\b|\b(\d+)\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    out.push({ t: m[0], k: m[1] ? "st" : m[2] ? "bd" : m[3] ? "kw" : m[4] ? "ty" : "nu" });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}

export const GAMES = ["cairn", "pane", "thrum", "ripple", "drift", "lumen"];
export const SCREENS = ["wallet-stack", "ai-chat-screen", "focus-timer", "spending-ring", "dashboard-screen", "voice-orb"];
