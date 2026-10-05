// Cover Grid: a library of square covers (podcasts, albums, books, playlists), each drawn as
// typographic cover art: a colour, a motif and the title set large. One column makes a single big
// cover for a player; two columns with the glow on make a playlist collage over its own colours.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { bool, link, number, opts, select, text } from "../shared.js";
import { swiftHex } from "./data-kit.js";
import { linkAction } from "./emit-link-action.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** One cover style: ground, ink, a motif colour, the motif and how the title is set. */
export type CoverStyle = { bg: string; ink: string; accent: string; motif: "ring" | "sun" | "stripes" | "dots" | "block" | "none"; type: "heavy" | "serif" | "rounded" | "condensed"; place: "top" | "center" | "bottom" };

export const COVER_PALETTES: Record<string, { label: string; styles: CoverStyle[] }> = {
  // The SwiftPieces sweep and house blocks, set in the system face: the default.
  pieces: {
    label: "SwiftPieces",
    styles: [
      { bg: "#FF0000", ink: "#FFFFFF", accent: "#FF8FB8", motif: "ring", type: "heavy", place: "center" },
      { bg: "#1C1C1F", ink: "#FFFFFF", accent: "#FF0000", motif: "sun", type: "heavy", place: "top" },
      { bg: "#4D8DFF", ink: "#FFFFFF", accent: "#9CC2FF", motif: "stripes", type: "condensed", place: "bottom" },
      { bg: "#FFD976", ink: "#141416", accent: "#FF7A3C", motif: "dots", type: "heavy", place: "top" },
      { bg: "#FF7A3C", ink: "#141416", accent: "#FFD976", motif: "sun", type: "heavy", place: "top" },
      { bg: "#F3F2EE", ink: "#141416", accent: "#FF0000", motif: "ring", type: "heavy", place: "center" },
      { bg: "#FF8FB8", ink: "#141416", accent: "#FF0000", motif: "block", type: "heavy", place: "bottom" },
      { bg: "#26262B", ink: "#FFFFFF", accent: "#4D8DFF", motif: "stripes", type: "condensed", place: "bottom" },
      { bg: "#A9DCB7", ink: "#141416", accent: "#141416", motif: "dots", type: "heavy", place: "center" },
      { bg: "#CDB8FF", ink: "#141416", accent: "#4D8DFF", motif: "ring", type: "heavy", place: "center" },
      { bg: "#E9D5B3", ink: "#141416", accent: "#FF7A3C", motif: "block", type: "heavy", place: "bottom" },
      { bg: "#9CC2FF", ink: "#141416", accent: "#FFFFFF", motif: "sun", type: "condensed", place: "top" },
    ],
  },
  mixed: {
    label: "Mixed",
    styles: [
      { bg: "#1FA2A6", ink: "#FFFFFF", accent: "#F7D046", motif: "ring", type: "rounded", place: "center" },
      { bg: "#2E7D5B", ink: "#FFFFFF", accent: "#9BE3B8", motif: "block", type: "heavy", place: "bottom" },
      { bg: "#101418", ink: "#FFFFFF", accent: "#4DA3FF", motif: "stripes", type: "condensed", place: "bottom" },
      { bg: "#EFE9DE", ink: "#1B1B1B", accent: "#C94F3D", motif: "none", type: "serif", place: "top" },
      { bg: "#1E88E5", ink: "#FFFFFF", accent: "#F3E36B", motif: "sun", type: "heavy", place: "top" },
      { bg: "#FFFFFF", ink: "#11302A", accent: "#3BC3C9", motif: "ring", type: "heavy", place: "center" },
      { bg: "#F25C3C", ink: "#FFFFFF", accent: "#FFD166", motif: "dots", type: "rounded", place: "bottom" },
      { bg: "#F6EFE4", ink: "#1B1B1B", accent: "#E4526B", motif: "dots", type: "serif", place: "top" },
      { bg: "#F7C531", ink: "#1B1B1B", accent: "#FFFFFF", motif: "none", type: "serif", place: "center" },
      { bg: "#E0221B", ink: "#FFFFFF", accent: "#FFFFFF", motif: "stripes", type: "serif", place: "center" },
      { bg: "#26262B", ink: "#FFFFFF", accent: "#E9453A", motif: "block", type: "heavy", place: "bottom" },
      { bg: "#5B6CF0", ink: "#FFFFFF", accent: "#A5B4FF", motif: "ring", type: "rounded", place: "center" },
    ],
  },
  warm: {
    label: "Warm",
    styles: [
      { bg: "#F25C3C", ink: "#FFFFFF", accent: "#FFD166", motif: "sun", type: "heavy", place: "top" },
      { bg: "#F7C531", ink: "#1B1B1B", accent: "#F25C3C", motif: "ring", type: "rounded", place: "center" },
      { bg: "#E0221B", ink: "#FFFFFF", accent: "#FFB199", motif: "stripes", type: "serif", place: "bottom" },
      { bg: "#F6EFE4", ink: "#3A1D12", accent: "#E4526B", motif: "dots", type: "serif", place: "top" },
    ],
  },
  cool: {
    label: "Cool",
    styles: [
      { bg: "#1FA2A6", ink: "#FFFFFF", accent: "#B8F2E6", motif: "ring", type: "rounded", place: "center" },
      { bg: "#1E88E5", ink: "#FFFFFF", accent: "#9AD1FF", motif: "sun", type: "heavy", place: "top" },
      { bg: "#101418", ink: "#FFFFFF", accent: "#4DA3FF", motif: "stripes", type: "condensed", place: "bottom" },
      { bg: "#5B6CF0", ink: "#FFFFFF", accent: "#A5B4FF", motif: "dots", type: "rounded", place: "center" },
    ],
  },
  mono: {
    label: "Mono",
    styles: [
      { bg: "#EDEDED", ink: "#111111", accent: "#111111", motif: "ring", type: "heavy", place: "center" },
      { bg: "#111111", ink: "#FFFFFF", accent: "#FFFFFF", motif: "stripes", type: "condensed", place: "bottom" },
      { bg: "#FFFFFF", ink: "#111111", accent: "#BBBBBB", motif: "dots", type: "serif", place: "top" },
      { bg: "#3A3A3C", ink: "#FFFFFF", accent: "#8E8E93", motif: "block", type: "heavy", place: "bottom" },
    ],
  },
};

export const coverTitles = (value: unknown, max = 16) => String(value ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, max);
/** The style of cover i, offset so two grids with different starts don't repeat each other. */
export const coverStyle = (palette: string, i: number): CoverStyle => {
  const list = (COVER_PALETTES[palette] ?? COVER_PALETTES.pieces).styles;
  return list[((i % list.length) + list.length) % list.length];
};

const MOTIFS = ["ring", "sun", "stripes", "dots", "block", "none"];
const TYPES = ["heavy", "serif", "rounded", "condensed"];
const PLACES = ["top", "center", "bottom"];

const VIEW = [
  "private struct CoverStyle {",
  "    let ground: Color",
  "    let ink: Color",
  "    let accent: Color",
  "    /// 0 ring, 1 sun, 2 stripes, 3 dots, 4 block, 5 none",
  "    let motif: Int",
  "    /// 0 heavy, 1 serif, 2 rounded, 3 condensed",
  "    let type: Int",
  "    /// 0 top, 1 center, 2 bottom",
  "    let place: Int",
  "}",
  "",
  "private struct CoverArt: View {",
  "    let title: String",
  "    let style: CoverStyle",
  "",
  "    var body: some View {",
  "        GeometryReader { geo in",
  "            let side = geo.size.width",
  "            ZStack {",
  "                style.ground",
  "                motif(side)",
  "                Text(title)",
  "                    .font(font(side))",
  "                    .foregroundStyle(style.ink)",
  "                    .multilineTextAlignment(style.place == 1 ? .center : .leading)",
  "                    .lineLimit(3)",
  "                    .minimumScaleFactor(0.4)",
  "                    .padding(side * 0.09)",
  "                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: [.topLeading, .center, .bottomLeading][style.place])",
  "            }",
  "        }",
  "        .aspectRatio(1, contentMode: .fit)",
  "    }",
  "",
  "    private func font(_ side: CGFloat) -> Font {",
  "        let longest = CGFloat(title.split(separator: \" \").map(\\.count).max() ?? 1)",
  "        let size = min(side * (style.place == 1 ? 0.22 : 0.17), side * 0.84 / (longest * 0.58))",
  "        switch style.type {",
  "        case 1: return .system(size: size, weight: .semibold, design: .serif)",
  "        case 2: return .system(size: size, weight: .bold, design: .rounded)",
  "        case 3: return .system(size: size, weight: .heavy).width(.condensed)",
  "        default: return .system(size: size, weight: .black)",
  "        }",
  "    }",
  "",
  "    @ViewBuilder private func motif(_ side: CGFloat) -> some View {",
  "        switch style.motif {",
  "        case 0:",
  "            Circle().stroke(style.accent, lineWidth: side * 0.07).padding(side * 0.12)",
  "        case 1:",
  "            Circle().fill(style.accent).frame(width: side * 0.9).offset(y: side * 0.55)",
  "        case 2:",
  "            VStack(spacing: side * 0.05) {",
  "                ForEach(0..<6, id: \\.self) { _ in Rectangle().fill(style.accent.opacity(0.35)).frame(height: side * 0.035) }",
  "            }",
  "            .frame(maxHeight: .infinity, alignment: .top)",
  "            .padding(.top, side * 0.1)",
  "        case 3:",
  "            Canvas { context, size in",
  "                let step = size.width / 9",
  "                for x in 1..<9 { for y in 1..<9 where (x + y) % 2 == 0 {",
  "                    context.fill(Path(ellipseIn: CGRect(x: CGFloat(x) * step - 2, y: CGFloat(y) * step - 2, width: 4, height: 4)), with: .color(style.accent.opacity(0.6)))",
  "                } }",
  "            }",
  "        case 4:",
  "            Rectangle().fill(style.accent.opacity(0.9)).frame(height: side * 0.36).frame(maxHeight: .infinity, alignment: .bottom)",
  "        default:",
  "            EmptyView()",
  "        }",
  "    }",
  "}",
  "",
  "private struct CoverGrid: View {",
  "    let titles: [String]",
  "    let styles: [CoverStyle]",
  "    var columns = 3",
  "    var spacing: CGFloat = 6",
  "    var radius: CGFloat = 6",
  "    var width: CGFloat? = nil",
  "    var glow = false",
  "    var onOpen: (String) -> Void = { _ in }",
  "",
  "    @State private var opened = 0",
  "    @State private var shown = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    var body: some View {",
  "        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: spacing), count: columns), spacing: spacing) {",
  "            ForEach(titles.indices, id: \\.self) { index in",
  "                Button {",
  "                    opened += 1",
  "                    onOpen(titles[index])",
  "                } label: {",
  "                    CoverArt(title: titles[index], style: styles[index])",
  "                        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))",
  "                }",
  "                .buttonStyle(CoverPressStyle())",
  "                .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "                .opacity(shown ? 1 : 0)",
  "                .animation(.easeOut(duration: 0.28).delay(Double(min(index, 8)) * 0.04), value: shown)",
  "                .accessibilityLabel(titles[index])",
  "            }",
  "        }",
  "        .clipShape(RoundedRectangle(cornerRadius: spacing == 0 ? radius : 0, style: .continuous))",
  "        .frame(width: width)",
  "        .background {",
  "            if glow {",
  "                LinearGradient(colors: styles.prefix(4).map(\\.ground), startPoint: .topLeading, endPoint: .bottomTrailing)",
  "                    .scaleEffect(1.8)",
  "                    .blur(radius: 60)",
  "                    .opacity(0.55)",
  "            }",
  "        }",
  "        .sensoryFeedback(.impact(weight: .light), trigger: opened)",
  "        .onAppear { shown = true }",
  "    }",
  "}",
  "",
  "private struct CoverPressStyle: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)",
  "    }",
  "}",
];

const DEFAULT_TITLES = "Low Orbit, Kiln Hours, Slow Build, Paper Harbor, Night Desk, Open Ledger, Second Draft, Wide Margin, Tidewater, The Long Table, Signal Hour, Half Past";

export const coverGrid: SwiftPieceDefinition = {
  id: "cover-grid",
  name: "Cover Grid",
  category: "pieces",
  description: "A grid of square cover art (shows, albums, books), each a colour, a motif and a big title. Tap a cover to open it.",
  availability: "free",
  preview: { component: "cover-grid", chunk: "app-pieces" },
  icon: "square.grid.2x2",
  concepts: ["foreach", "state", "spring"],
  anatomy: [
    { part: "Covers", props: ["titles", "palette", "start"] },
    { part: "Grid", props: ["columns", "spacing", "radius", "width"] },
    { part: "Glow", props: ["glow"] },
    { part: "Interaction", props: ["link"] },
  ],
  interactions: ["tap", "press", "spring", "haptic"],
  variants: [
    { id: "library", label: "Library", props: { titles: DEFAULT_TITLES, columns: 3, spacing: 6, radius: 6, width: 0, glow: false, palette: "pieces", start: 0 } },
    { id: "collage", label: "Playlist collage", props: { titles: "Slow Build, Low Orbit, Tidewater, Night Desk", columns: 2, spacing: 0, radius: 14, width: 210, glow: true, palette: "pieces", start: 2 } },
    { id: "single", label: "One big cover", props: { titles: "Night Desk", columns: 1, spacing: 0, radius: 12, width: 0, glow: false, palette: "pieces", start: 1 } },
  ],
  states: [{ id: "few", label: "Two covers", props: { titles: "Night Desk, Tidewater", columns: 3 } }],
  properties: [
    { id: "titles", label: "Titles", type: "text", defaultValue: DEFAULT_TITLES, maxLength: 400, group: "content", hint: "Comma-separated, one per cover." },
    select("palette", "Palette", "pieces", opts(...Object.entries(COVER_PALETTES).map(([id, v]): [string, string] => [id, v.label])), { group: "color" }),
    number("start", "First style", 0, 0, 11, 1, { group: "color", hint: "Which style the first cover takes; the rest follow in order." }),
    number("columns", "Columns", 3, 1, 4, 1, { group: "layout" }),
    number("spacing", "Spacing", 6, 0, 20, 1, { group: "layout" }),
    number("radius", "Corner radius", 6, 0, 24, 1, { group: "shape" }),
    number("width", "Width", 0, 0, 360, 10, { group: "layout", hint: "0 fills the width." }),
    bool("glow", "Colour glow", false, { group: "color", hint: "A soft blur of the covers' colours behind the grid." }),
    link("link", "On tap"),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("CoverArt", VIEW);
      const titles = coverTitles(p.titles);
      const start = Math.round(n(p, "start"));
      const styles = titles.map((_, i) => {
        const c = coverStyle(s(p, "palette"), start + i);
        return `CoverStyle(ground: ${swiftHex(c.bg)}, ink: ${swiftHex(c.ink)}, accent: ${swiftHex(c.accent)}, motif: ${MOTIFS.indexOf(c.motif)}, type: ${TYPES.indexOf(c.type)}, place: ${PLACES.indexOf(c.place)})`;
      });
      const action = linkAction(ctx, p.link);
      return {
        lines: call("CoverGrid", [
          ["titles", `[${titles.map((t) => ctx.str(t)).join(", ")}]`],
          ["styles", `[${styles.join(", ")}]`],
          n(p, "columns") !== 3 && ["columns", num(n(p, "columns"))],
          n(p, "spacing") !== 6 && ["spacing", num(n(p, "spacing"))],
          n(p, "radius") !== 6 && ["radius", num(n(p, "radius"))],
          n(p, "width") > 0 && ["width", num(n(p, "width"))],
          b(p, "glow") && ["glow", "true"],
          action && ["onOpen", `{ _ in ${action.slice(2, -2)} }`],
        ]),
      };
    },
  },
};
