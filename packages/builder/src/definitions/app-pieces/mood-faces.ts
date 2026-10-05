// Mood Faces: a mood picked by tapping one of five drawn faces, from a frown to a grin (or five discs
// filled to their level). Plain discs for a quiet journal, or a colour per mood for a diary that
// charts them later, in the SwiftPieces sweep from a cool low to a warm high.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { bool, link, number, opts, select, text } from "../shared.js";
import { ENTRANCE, PRESS_STYLE, linkAction, swiftArray, words } from "./wellbeing-shared.js";
import { swiftSignal } from "../../core/palette.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** One colour per mood, lowest first, cool to warm: azure, sky, sand, blush, ember. */
export const MOOD_COLORS = ["#4D8DFF", "#9CC2FF", "#E9D5B3", "#FF8FB8", "#FF7A3C"];
export const DEFAULT_MOODS = "Awful, Bad, Okay, Good, Great";
/** The same moods a shade deeper, for lines and rings drawn on a light ground (the pale sky and sand would wash out). */
export const MOOD_STROKES_LIGHT = ["#3F7FF2", "#5E95EC", "#BF9F6E", "#F0709F", "#F06C2E"];
/** Each mood's stroke as a light/dark pair, so exported charts follow the appearance like the preview. */
export const swiftMoodStrokes = (hex: (h: string) => string) =>
  `[${MOOD_COLORS.map((dark, i) => `Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(${hex(dark)}) : UIColor(${hex(MOOD_STROKES_LIGHT[i])}) })`).join(", ")}]`;

/** The five labels, lowest mood first, always five (missing ones fall back to the defaults). */
export function moodLabels(value: unknown): string[] {
  const given = words(value, 5);
  const base = words(DEFAULT_MOODS);
  return base.map((d, i) => given[i] ?? d);
}

const rgb = (hex: string) => {
  const v = hex.replace("#", "");
  const sig = swiftSignal(v);
  if (sig) return sig;
  const c = (i: number) => num(Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000);
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
};

/** The drawn face (eyes and a mouth bent to the level) as its own view, for any piece that shows a mood. */
export const MOOD_FACE_GLYPH = [
  "private struct MoodFaceGlyph: View {",
  "    let level: Int",
  "",
  "    var body: some View {",
  "        Canvas { context, size in",
  "            let w = size.width, h = size.height",
  "            let eye = w * 0.055",
  "            for x in [0.37, 0.63] {",
  "                context.fill(Path(ellipseIn: CGRect(x: w * x - eye, y: h * 0.4 - eye, width: eye * 2, height: eye * 2)), with: .foreground)",
  "            }",
  "            let bend = CGFloat(level - 2) * h * 0.075",
  "            let y = h * 0.62 - bend * 0.35",
  "            var mouth = Path()",
  "            mouth.move(to: CGPoint(x: w * 0.36, y: y))",
  "            mouth.addQuadCurve(to: CGPoint(x: w * 0.64, y: y), control: CGPoint(x: w * 0.5, y: y + bend * 1.6))",
  "            if level == 4 {",
  "                mouth.closeSubpath()",
  "                context.fill(mouth, with: .foreground)",
  "            } else {",
  "                context.stroke(mouth, with: .foreground, style: StrokeStyle(lineWidth: w * 0.045, lineCap: .round))",
  "            }",
  "        }",
  "        .accessibilityHidden(true)",
  "    }",
  "}",
];
const GLYPH = MOOD_FACE_GLYPH;

const VIEW = [
  "private struct MoodFaces: View {",
  "    @Binding var selection: Int?",
  "    /// Lowest mood first.",
  "    let labels: [String]",
  "    /// One fill per mood, lowest first; empty draws plain discs.",
  "    var colors: [Color] = []",
  "    var descending = false",
  "    var size: CGFloat = 56",
  "    var showsLabels = false",
  "    var stacked = false",
  "    /// Shows only the picked face, as a badge (a diary entry's mood).",
  "    var only = false",
  "    /// Discs filled from the bottom to their level instead of drawn faces.",
  "    var meter = false",
  "    var onPick: (Int) -> Void = { _ in }",
  "    @State private var appeared = false",
  "",
  "    private var levels: [Int] { descending ? Array(labels.indices.reversed()) : Array(labels.indices) }",
  "",
  "    var body: some View {",
  "        Group {",
  "            if only, let selection {",
  "                face(selection).allowsHitTesting(false)",
  "            } else if stacked {",
  "                VStack(spacing: size * 0.14) {",
  "                    HStack(spacing: size * 0.14) { ForEach(Array(levels.prefix(3)), id: \\.self, content: face) }",
  "                    HStack(spacing: size * 0.14) { ForEach(Array(levels.dropFirst(3)), id: \\.self, content: face) }",
  "                }",
  "            } else {",
  "                HStack(spacing: size * 0.18) { ForEach(levels, id: \\.self, content: face) }",
  "            }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selection)",
  "        .onAppear { appeared = true }",
  "    }",
  "",
  "    private func face(_ level: Int) -> some View {",
  "        let fill = colors.indices.contains(level) ? colors[level] : nil",
  "        let picked = selection == level",
  "        return Button {",
  "            withAnimation(.spring(duration: 0.3, bounce: 0.25)) { selection = level }",
  "            onPick(level)",
  "        } label: {",
  "            VStack(spacing: 6) {",
  "                Group {",
  "                    if meter {",
  "                        Circle()",
  "                            .fill((fill ?? .primary).opacity(0.2))",
  "                            .overlay(alignment: .bottom) {",
  "                                Rectangle()",
  "                                    .fill(fill ?? .primary)",
  "                                    .frame(height: size * CGFloat(level + 1) / CGFloat(max(labels.count, 1)))",
  "                            }",
  "                            .clipShape(.circle)",
  "                    } else {",
  "                        MoodFaceGlyph(level: level)",
  "                            .foregroundStyle(fill == nil ? Color.primary : Color.black.opacity(0.78))",
  "                            .background {",
  "                                if let fill {",
  "                                    Circle().fill(fill)",
  "                                } else {",
  "                                    Circle().fill(Color(.secondarySystemFill))",
  "                                }",
  "                            }",
  "                    }",
  "                }",
  "                .frame(width: size, height: size)",
  "                .modifier(WellbeingEntrance(shown: appeared || only, delay: Double(min(levels.firstIndex(of: level) ?? 0, 7)) * 0.04))",
  "                .overlay { Circle().strokeBorder(Color.primary, lineWidth: picked && (fill == nil || meter) && !only ? 2 : 0).padding(-4) }",
  "                if showsLabels {",
  "                    Text(labels[level])",
  "                        .font(.caption.weight(picked ? .semibold : .regular))",
  "                        .foregroundStyle(picked ? Color.primary : Color.secondary)",
  "                }",
  "            }",
  "            .scaleEffect(only ? 1 : picked ? 1.1 : (selection == nil ? 1 : 0.94))",
  "            .opacity(only || selection == nil || picked ? 1 : 0.55)",
  "            .frame(minWidth: 44, minHeight: 44)",
  "        }",
  "        .buttonStyle(WellbeingPressStyle())",
  "        .accessibilityLabel(labels[level])",
  "        .accessibilityAddTraits(picked ? .isSelected : [])",
  "    }",
  "}",
];

export const moodFaces: SwiftPieceDefinition = {
  id: "mood-faces",
  name: "Mood Faces",
  category: "pieces",
  description: "Five drawn faces, frown to grin, or five discs filled to their level: tap one to log how you feel.",
  availability: "free",
  preview: { component: "mood-faces", chunk: "app-pieces" },
  icon: "hand.thumbsup",
  concepts: ["state", "binding", "spring"],
  anatomy: [
    { part: "Faces", props: ["glyph", "style", "size", "layout", "order"] },
    { part: "Labels", props: ["labels", "showsLabels"] },
    { part: "Selection", props: ["selected"] },
    { part: "Interaction", props: ["link"] },
  ],
  interactions: ["tap", "select", "spring", "haptic"],
  variants: [
    { id: "plain", label: "Plain discs", props: { style: "plain", layout: "row", order: "ascending", showsLabels: false, size: 56 } },
    { id: "color", label: "Colour per mood", props: { style: "color", layout: "row", order: "descending", showsLabels: true, size: 54 } },
    { id: "stacked", label: "Two rows", props: { style: "plain", layout: "stacked", order: "ascending", showsLabels: false, size: 88 } },
    { id: "badge", label: "One face badge", props: { style: "color", only: true, selected: 3, size: 44, showsLabels: false } },
    { id: "meter", label: "Level discs", props: { glyph: "level", style: "color", layout: "row", order: "ascending", showsLabels: true, size: 50 } },
  ],
  states: [
    { id: "none", label: "Nothing picked", props: { selected: -1 } },
    { id: "good", label: "Good", props: { selected: 3 } },
    { id: "awful", label: "Awful", props: { selected: 0 } },
  ],
  properties: [
    text("labels", "Moods, lowest first", DEFAULT_MOODS, { hint: "Five words, from the worst mood to the best." }),
    select("glyph", "Glyph", "face", opts(["face", "Drawn face"], ["level", "Disc filled to its level"])),
    select("style", "Style", "plain", opts(["plain", "Plain discs"], ["color", "Colour per mood"])),
    select("layout", "Layout", "row", opts(["row", "One row"], ["stacked", "Three over two"])),
    select("order", "Order", "ascending", opts(["ascending", "Worst first"], ["descending", "Best first"])),
    number("size", "Face size", 56, 36, 110),
    bool("showsLabels", "Show labels", false),
    bool("only", "Only the picked face", false, { hint: "Shows the picked mood alone, as a badge, like a diary entry does." }),
    number("selected", "Starts on", -1, -1, 4, 1, { group: "state", hint: "-1 starts with nothing picked; 0 is the lowest mood." }),
    link("link", "After picking", { hint: "Where a tap on a face goes once it's picked." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("WellbeingEntrance", ENTRANCE);
      ctx.declare("WellbeingPressStyle", PRESS_STYLE);
      ctx.declare("MoodFaceGlyph", GLYPH);
      ctx.declare("MoodFaces", VIEW);
      const sel = n(p, "selected");
      const name = ctx.state("mood", "Int?", sel >= 0 ? String(sel) : "nil");
      const action = linkAction(ctx, p.link);
      const labels = moodLabels(p.labels);
      return {
        lines: call("MoodFaces", [
          ["selection", `$${name}`],
          ["labels", swiftArray(labels, (x) => ctx.str(x))],
          s(p, "style") === "color" && ["colors", `[${MOOD_COLORS.map(rgb).join(", ")}]`],
          s(p, "order") === "descending" && ["descending", "true"],
          n(p, "size") !== 56 && ["size", num(n(p, "size"))],
          b(p, "showsLabels") && ["showsLabels", "true"],
          s(p, "layout") === "stacked" && ["stacked", "true"],
          p.only === true && sel >= 0 && ["only", "true"],
          s(p, "glyph") === "level" && ["meter", "true"],
          action && ["onPick", `{ _ in ${action} }`],
        ]),
      };
    },
  },
};
