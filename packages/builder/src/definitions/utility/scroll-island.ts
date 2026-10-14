// Scroll Island: a floating glass island over a long page that names the section in view, rings it in red with how
// much has been read, buds a back-to-top bubble once the reader leaves the first section, and opens in place into the
// page's contents, where a red puck marks the current section and a pick scrolls the page there. The emitter writes a
// sample page (sections with a title, a reading time and paragraphs) in a ScrollView whose `scrollPosition(id:)`
// shares the island's selection, and calls `ScrollIsland(sections:selection:progress:isExpanded:showsTopButton:
// messages:style:)` exactly as registry/swift/navigation/ScrollIsland.swift declares it, writing only what differs from
// its defaults.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, list, modifiers, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Swift defaults, so the emitted call only spells out what differs. */
export const ISLAND_DEFAULTS = { contents: "Contents", maxWidth: 360 } as const;

/** The most sections a sample page holds. */
export const ISLAND_MAX_SECTIONS = 16;

export const ISLAND_RECIPE = "Overview, Ingredients, Method, Serving, Notes";
export const ISLAND_ARTICLE = "Introduction, The first winter, Building the kiln, What went wrong, What we kept";
export const ISLAND_GUIDE = "Before you start, Create a workspace, Invite your team, Notifications, Privacy, Billing, Troubleshooting, Get help";

/** A paragraph for each sample section, in order, by kind of page; longer pages cycle. Fictional, and the same in the
 *  Playground and the app. */
export const ISLAND_PARAGRAPHS: Record<string, string[]> = {
  recipe: [
    "A slow pot of white beans with charred leeks, lemon and plenty of olive oil. It feeds four, keeps for three days and tastes better on the second.",
    "Two leeks, trimmed and halved lengthways. Two tins of white beans with their liquid, one lemon, four cloves of garlic, a sprig of rosemary and 500 ml of stock.",
    "Char the leeks cut side down in a dry pan until they blacken in places, then slice them. Warm the garlic and rosemary in oil, add the beans, stock and leeks, and simmer for 25 minutes until it thickens.",
    "Spoon into warm bowls with a slick of oil, grated lemon zest and toasted bread on the side. A bitter salad of radicchio and orange cuts through the richness.",
    "The stew thickens overnight, so loosen it with a splash of water as it warms. In summer, swap the leeks for fennel.",
  ],
  article: [
    "We took the lease on the old print shop in March, with a wheel, two tables and no idea how cold a brick room gets by November.",
    "The first winter we fired twice a week and lost a third of every load to cracks we could not explain, however slowly we brought the kiln up.",
    "The kiln took four weekends to build from salvaged bricks, and a fifth to admit that the door would never quite close.",
    "Most of what went wrong came down to drying too fast. The radiator under the shelves had been the culprit all along.",
    "What we kept was the habit of writing every firing down: the weather, the clay, the shelf and what came out.",
  ],
  guide: [
    "You need an account and about ten minutes. Everything here can be changed later from Settings.",
    "Pick a name people will recognise in their notifications. Each workspace keeps its own members, projects and settings.",
    "Invite people by email. They join as members, and you can make anyone an admin once they have accepted.",
    "Choose what reaches you right away and what waits for the daily summary at nine.",
    "Projects are private to their members unless you share a link. Links can expire after a day, a week or never.",
    "Billing is per workspace and per month. Members you remove stop counting from the next invoice.",
    "If an invite never arrives, check the spam folder, then resend it from the Members page.",
    "Write to the support team from the Help menu. Most questions are answered within a working day.",
  ],
};

/** Reading times for the sample sections, in minutes, by place. */
export const ISLAND_MINUTES = [1, 2, 5, 2, 1, 3, 4, 2];

/** A stable id from a section title: lowercase words joined by dashes, made unique by place. */
export function islandId(title: string, index: number): string {
  const slug = title.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `${slug}-${index + 1}` : `section-${index + 1}`;
}

/** The sample page's sections: the screen's own titles (or the recipe), each with its reading time and paragraphs. */
export function islandSections(p: Props) {
  const titles = list(p.sections, ISLAND_MAX_SECTIONS);
  const used = titles.length ? titles : list(ISLAND_RECIPE, ISLAND_MAX_SECTIONS);
  const bank = ISLAND_PARAGRAPHS[s(p, "content")] ?? ISLAND_PARAGRAPHS.recipe;
  return used.map((title, i) => ({
    id: islandId(title, i),
    title,
    minutes: ISLAND_MINUTES[i % ISLAND_MINUTES.length],
    paragraphs: [bank[i % bank.length]],
  }));
}

/** Where the page opens: at the top, or partway down (the third section, or the last when there are fewer). */
export const islandStartIndex = (p: Props, count: number) => (s(p, "start") === "partway" ? Math.min(2, Math.max(count - 1, 0)) : 0);

export const definition: SwiftPieceDefinition = {
  id: "scroll-island",
  name: "Scroll Island",
  category: "pieces",
  description: "A floating island for long pages. It names the section you are in and rings how much is read; tap it for the contents and jump anywhere, or drag it sideways to step through sections.",
  availability: "free",
  preview: { component: "scroll-island", chunk: "pieces-utility" },
  source: { registry: "free", name: "ScrollIsland" },
  docs: "/docs/components/navigation/scroll-island",
  icon: "list.bullet",
  concepts: ["scrollview", "state", "binding", "foreach", "gesture", "formatstyle"],
  interactions: ["scroll", "tap", "expand", "drag", "scrub", "select", "haptic", "spring"],
  properties: [
    text("sections", "Sections", ISLAND_RECIPE, { maxLength: 400, hint: "One per comma. Each is a section of the sample page and a row in the contents." }),
    select("content", "Sample page", "recipe", opts(["recipe", "Recipe"], ["article", "Long read"], ["guide", "Help guide"]), { hint: "The paragraphs under each section. Your app shows its own." }),
    bool("details", "Reading times", true, { hint: "A short detail at the end of each row in the contents, such as 4 min." }),
    bool("showsTopButton", "Back-to-top bubble", true, { group: "interaction", hint: "Buds out of the island once the reader is past the first section." }),
    select("progress", "Read ring", "scroll", opts(["scroll", "From the scroll offset"], ["estimate", "From the section"]), {
      hint: "From the scroll offset needs iOS 18; before that the island estimates it from the section in view.",
    }),
    text("contents", "Contents title", ISLAND_DEFAULTS.contents, { maxLength: 32, hint: "The open panel's title, and the island's name for VoiceOver." }),
    number("maxWidth", "Widest", ISLAND_DEFAULTS.maxWidth, 240, 480, 10, { level: "advanced", group: "layout", hint: "The widest the island and its contents grow, in points." }),
    number("height", "Height", 560, 320, 760, 10, { group: "layout" }),
    select("start", "Opens at", "top", opts(["top", "The top of the page"], ["partway", "Partway down"]), { group: "state" }),
    bool("open", "Contents open", false, { group: "state", hint: "Starts with the contents showing, handy for inspecting them." }),
  ],
  variants: [
    { id: "recipe", label: "Recipe", props: { sections: ISLAND_RECIPE, content: "recipe", details: true, showsTopButton: true, contents: "Contents" } },
    { id: "article", label: "Long read", props: { sections: ISLAND_ARTICLE, content: "article", details: true, showsTopButton: true, contents: "In this story" } },
    { id: "guide", label: "Help guide", props: { sections: ISLAND_GUIDE, content: "guide", details: false, showsTopButton: true, contents: "On this page" } },
  ],
  states: [
    { id: "top", label: "Top of the page", props: { start: "top", open: false } },
    { id: "partway", label: "Partway down", props: { start: "partway", open: false } },
    { id: "open", label: "Contents open", props: { start: "partway", open: true } },
    { id: "one", label: "One section", props: { sections: "Overview", start: "top", open: false } },
  ],
  anatomy: [
    { part: "Page", props: ["sections", "content", "height", "start"] },
    { part: "Island", props: ["progress", "showsTopButton", "maxWidth"] },
    { part: "Contents", props: ["contents", "details", "open"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const sections = islandSections(p);
      const details = b(p, "details");
      const i = INDENT;
      ctx.declare("IslandPagePart", [
        "/// A sample page for the scroll island: sections with a title, a reading time and a few paragraphs. In your",
        "/// app, use your own sections; each section's view carries its id, so the scroll view can reach it.",
        "struct IslandPagePart: Identifiable {",
        `${i}let id: String`,
        `${i}let title: String`,
        `${i}let minutes: Double`,
        `${i}let paragraphs: [String]`,
        "",
        `${i}var readingTime: String {`,
        `${i}${i}Measurement(value: minutes, unit: UnitDuration.minutes).formatted(.measurement(width: .abbreviated, usage: .asProvided))`,
        `${i}}`,
        "",
        `${i}static let all: [IslandPagePart] = [`,
        ...sections.map((x) => `${i}${i}IslandPagePart(id: ${str(x.id)}, title: ${str(x.title)}, minutes: ${num(x.minutes)}, paragraphs: [${x.paragraphs.map(str).join(", ")}]),`),
        `${i}]`,
        "}",
      ]);
      const fromScroll = s(p, "progress") !== "estimate";
      if (fromScroll) {
        ctx.declare("View.readingProgress", [
          "extension View {",
          `${i}/// How far through a scroll view the reader is, 0 to 1, for the scroll island's ring. Needs iOS 18;`,
          `${i}/// before that it stays nil and the island estimates it from the section in view.`,
          `${i}@ViewBuilder func readingProgress(_ fraction: Binding<Double?>) -> some View {`,
          `${i}${i}if #available(iOS 18, *) {`,
          `${i}${i}${i}onScrollGeometryChange(for: Double.self) { geometry in`,
          `${i}${i}${i}${i}let travel = geometry.contentSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom - geometry.containerSize.height`,
          `${i}${i}${i}${i}return travel > 0 ? (geometry.contentOffset.y + geometry.contentInsets.top) / travel : 1`,
          `${i}${i}${i}} action: { _, value in`,
          `${i}${i}${i}${i}fraction.wrappedValue = min(max(value, 0), 1)`,
          `${i}${i}${i}}`,
          `${i}${i}} else {`,
          `${i}${i}${i}self`,
          `${i}${i}}`,
          `${i}}`,
          "}",
        ]);
      }

      const start = islandStartIndex(p, sections.length);
      const section = ctx.state("section", "String?", start > 0 ? str(sections[start].id) : "nil");
      const read = fromScroll ? ctx.state("readFraction", "Double?", "nil") : null;
      const open = b(p, "open") ? ctx.state("contentsOpen", "Bool", "true") : null;
      const contents = s(p, "contents").trim();
      const maxWidth = Math.round(n(p, "maxWidth") || ISLAND_DEFAULTS.maxWidth);
      const styleArgs = [
        ctx.theme && "accent: Theme.accent",
        ctx.theme && "onAccent: Theme.accentInk",
        maxWidth !== ISLAND_DEFAULTS.maxWidth && `maxWidth: ${num(maxWidth)}`,
      ].filter(Boolean);

      const island = call("ScrollIsland", [
        ["sections", `IslandPagePart.all.map { .init(id: $0.id, title: $0.title${details ? ", detail: $0.readingTime" : ""}) }`],
        ["selection", `$${section}`],
        read && ["progress", read],
        open && ["isExpanded", `$${open}`],
        !b(p, "showsTopButton") && ["showsTopButton", "false"],
        contents && contents !== ISLAND_DEFAULTS.contents && ["messages", `.init(contents: ${str(contents)})`],
        styleArgs.length > 0 && ["style", `.init(${styleArgs.join(", ")})`],
      ]);

      const part = [
        "VStack(alignment: .leading, spacing: 12) {",
        ...indent(modifiers(["Text(part.title)"], ["font(.title2)"])),
        ...indent([
          "ForEach(part.paragraphs, id: \\.self) { paragraph in",
          ...indent(modifiers(["Text(paragraph)"], ["foregroundStyle(.secondary)"])),
          "}",
        ]),
        "}",
        ".frame(maxWidth: .infinity, alignment: .leading)",
        ".id(part.id)",
      ];
      const page = [
        "ScrollView {",
        ...indent([
          "LazyVStack(alignment: .leading, spacing: 32) {",
          ...indent(["ForEach(IslandPagePart.all) { part in", ...indent(part), "}"]),
          "}",
          ".scrollTargetLayout()",
          ".padding(.horizontal, 20)",
          ".padding(.top, 20)",
          "// Room under the last section, so it can scroll up to the top too.",
          ".padding(.bottom, 320)",
        ]),
        "}",
        ".scrollPosition(id: $" + section + ", anchor: .top)",
        ...(read ? [`.readingProgress($${read})`] : []),
        ".overlay(alignment: .bottom) {",
        ...indent(island),
        "}",
        `.frame(height: ${num(Math.round(n(p, "height") || 560))})`,
      ];
      return { lines: page };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
