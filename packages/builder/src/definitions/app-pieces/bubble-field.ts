// Bubble Field: a honeycomb of word bubbles you pan around, four colour quadrants (energy up/down,
// pleasant/unpleasant) in the Swift Pieces sweep, bubbles swelling as they near the middle. Tinted
// glass bubbles by default, or solid ones. Tap one to pick it.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, num } from "../../core/swift.js";
import { bool, link, number, opts, select, text } from "../shared.js";
import { ENTRANCE, PRESS_STYLE, linkAction, words } from "./wellbeing-shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

type Tones = Array<{ outer: [number, number, number]; inner: [number, number, number] }>;

/** Hue, saturation and brightness per quadrant, at the outer edge and toward the middle. */
export const QUADRANT_TONES: Tones = [
  { outer: [0.0, 1.0, 1.0], inner: [0.012, 0.72, 1.0] }, // high energy, unpleasant: signal
  { outer: [0.053, 0.77, 1.0], inner: [0.075, 0.52, 1.0] }, // high energy, pleasant: ember
  { outer: [0.607, 0.7, 1.0], inner: [0.6, 0.42, 1.0] }, // low energy, unpleasant: azure
  { outer: [0.939, 0.44, 1.0], inner: [0.945, 0.28, 1.0] }, // low energy, pleasant: blush
];

/**
 * The four-corner palette, the way mood meters are read: red for high energy and unpleasant, gold
 * for high and pleasant, blue for low and unpleasant, green for low and pleasant.
 */
export const CORNER_TONES: Tones = [
  { outer: [0.012, 0.74, 1.0], inner: [0.022, 0.5, 1.0] }, // red
  { outer: [0.119, 0.76, 1.0], inner: [0.128, 0.5, 1.0] }, // gold
  { outer: [0.607, 0.7, 1.0], inner: [0.6, 0.42, 1.0] }, // blue
  { outer: [0.411, 0.57, 0.8], inner: [0.4, 0.38, 0.88] }, // green
];

export const bubbleTones = (palette: unknown): Tones => (palette === "corners" ? CORNER_TONES : QUADRANT_TONES);

export type Bubble = { word: string; quadrant: number; col: number; row: number; x: number; y: number; tone: [number, number, number]; t: number };

/** How much a bubble swells at `distance` from the middle, in view widths: a lens over the centre. */
export function lensScale(distance: number): number {
  const bump = Math.max(0, 1 - distance / 0.3);
  return Math.max(0.6, 1 + 0.45 * bump * bump - 0.35 * Math.max(0, distance - 0.55));
}

/**
 * Lays the words out: each quadrant gets half the columns and half the rows, filled row by row from
 * its top-left. Odd rows shift half a bubble, the honeycomb. Positions are bubble centres in points.
 */
export function layoutBubbles(quadrants: string[][], columns: number, diameter: number, gap = 3, tones: Tones = QUADRANT_TONES): { bubbles: Bubble[]; width: number; height: number } {
  const half = Math.max(1, Math.floor(columns / 2));
  const rowsHalf = Math.max(1, ...quadrants.map((q) => Math.ceil(q.length / half)));
  const step = diameter + gap;
  const rowStep = step * 0.88;
  const cols = half * 2;
  const rows = rowsHalf * 2;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxD = Math.hypot(cx + 0.5, cy);
  const bubbles: Bubble[] = [];
  quadrants.forEach((list, q) => {
    list.forEach((word, i) => {
      const col = (q % 2) * half + (i % half);
      const row = Math.floor(q / 2) * rowsHalf + Math.floor(i / half);
      const shift = row % 2 ? 0.5 : 0;
      const t = Math.min(1, Math.hypot(col + shift - cx, row - cy) / maxD);
      const { outer, inner } = tones[q];
      const tone = inner.map((v, k) => v + (outer[k] - v) * t) as [number, number, number];
      bubbles.push({ word, quadrant: q, col, row, x: (col + shift) * step + diameter / 2, y: row * rowStep + diameter / 2, tone, t });
    });
  });
  return { bubbles, width: (cols + 0.5) * step, height: (rows - 1) * rowStep + diameter };
}

export function quadrantsOf(p: Props): string[][] {
  return [words(p.highUnpleasant, 16), words(p.highPleasant, 16), words(p.lowUnpleasant, 16), words(p.lowPleasant, 16)];
}

const VIEW = [
  "private struct BubbleField: View {",
  "    @Binding var selection: String?",
  "    /// Words per quadrant: high energy unpleasant, high pleasant, low unpleasant, low pleasant.",
  "    let quadrants: [[String]]",
  "    var columns = 6",
  "    var diameter: CGFloat = 108",
  "    /// Glass bubbles tinted by their corner; false fills them solid.",
  "    var tinted = true",
  "    @State private var appeared = false",
  "",
  "    private struct Bubble: Identifiable {",
  "        let id: String",
  "        let center: CGPoint",
  "        let color: Color",
  "        /// Entrance delay: bubbles pop in from the middle outward.",
  "        let delay: Double",
  "    }",
  "",
  "    /// Hue, saturation and brightness per quadrant, at the outer edge and toward the middle.",
  "    var tones: [(outer: [Double], inner: [Double])] = BubbleField.sweep",
  "    static let sweep: [(outer: [Double], inner: [Double])] = [",
  ...QUADRANT_TONES.map((t) => `        (outer: [${t.outer.map(num).join(", ")}], inner: [${t.inner.map(num).join(", ")}]),`),
  "    ]",
  "",
  "    private var half: Int { max(1, columns / 2) }",
  "    private var rowsHalf: Int { max(1, quadrants.map { ($0.count + half - 1) / half }.max() ?? 1) }",
  "    private var step: CGFloat { diameter + 3 }",
  "",
  "    private var bubbles: [Bubble] {",
  "        let cx = Double(half * 2 - 1) / 2, cy = Double(rowsHalf * 2 - 1) / 2",
  "        let maxD = ((cx + 0.5) * (cx + 0.5) + cy * cy).squareRoot()",
  "        return quadrants.enumerated().flatMap { q, list in",
  "            list.enumerated().map { i, word in",
  "                let col = (q % 2) * half + i % half",
  "                let row = (q / 2) * rowsHalf + i / half",
  "                let shift = row % 2 == 1 ? 0.5 : 0",
  "                let dx = Double(col) + shift - cx, dy = Double(row) - cy",
  "                let t = min(1, (dx * dx + dy * dy).squareRoot() / maxD)",
  "                let tone = tones[q]",
  "                let v = (0..<3).map { tone.inner[$0] + (tone.outer[$0] - tone.inner[$0]) * t }",
  "                return Bubble(",
  "                    id: word,",
  "                    center: CGPoint(x: (CGFloat(col) + shift) * step + diameter / 2, y: CGFloat(row) * step * 0.88 + diameter / 2),",
  "                    color: Color(hue: v[0], saturation: v[1], brightness: v[2]),",
  "                    delay: Double(min(Int((t * 7).rounded()), 7)) * 0.04",
  "                )",
  "            }",
  "        }",
  "    }",
  "",
  "    var body: some View {",
  "        let size = CGSize(width: CGFloat(half * 2) * step + step / 2, height: CGFloat(rowsHalf * 2 - 1) * step * 0.88 + diameter)",
  "        ScrollView([.horizontal, .vertical]) {",
  "            ZStack(alignment: .topLeading) {",
  "                ForEach(bubbles) { bubble in",
  "                    Button {",
  "                        withAnimation(.spring(duration: 0.3, bounce: 0.25)) { selection = bubble.id }",
  "                    } label: {",
  "                        Text(bubble.id)",
  "                            .font(.system(size: diameter * 0.15, weight: .semibold))",
  "                            .multilineTextAlignment(.center)",
  "                            .foregroundStyle(tinted ? Color.primary : Color.black.opacity(0.85))",
  "                            .frame(width: diameter, height: diameter)",
  "                            .background(bubble.color.opacity(tinted ? 0.24 : 1), in: .circle)",
  "                            .overlay { Circle().strokeBorder(bubble.color, lineWidth: tinted ? 1.5 : 0) }",
  "                            .overlay { Circle().strokeBorder(Color.primary, lineWidth: selection == bubble.id ? 3 : 0).padding(-3) }",
  "                    }",
  "                    .buttonStyle(WellbeingPressStyle())",
  "                    .scaleEffect(selection == bubble.id ? 1.12 : 1)",
  "                    .modifier(WellbeingEntrance(shown: appeared, delay: bubble.delay))",
  "                    .visualEffect { content, proxy in",
  "                        // Bubbles swell toward the middle of the screen and shrink toward the edges.",
  "                        let frame = proxy.frame(in: .scrollView)",
  "                        let bounds = proxy.bounds(of: .scrollView) ?? .zero",
  "                        let dx = frame.midX - bounds.midX, dy = frame.midY - bounds.midY",
  "                        let distance = (dx * dx + dy * dy).squareRoot() / max(bounds.width, 1)",
  "                        let bump = max(0, 1 - distance / 0.3)",
  "                        return content.scaleEffect(max(0.6, 1 + 0.45 * bump * bump - 0.35 * max(0, distance - 0.55)))",
  "                    }",
  "                    .position(bubble.center)",
  "                    .accessibilityAddTraits(selection == bubble.id ? .isSelected : [])",
  "                }",
  "            }",
  "            .frame(width: size.width, height: size.height)",
  "        }",
  "        .scrollIndicators(.hidden)",
  "        .defaultScrollAnchor(.center)",
  "        // Rows and columns fade out at the edges instead of being cut off mid-bubble.",
  "        .mask {",
  "            LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.14), .init(color: .black, location: 0.86), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom)",
  "                .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.08), .init(color: .black, location: 0.92), .init(color: .clear, location: 1)], startPoint: .leading, endPoint: .trailing))",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selection)",
  "        .onAppear { appeared = true }",
  "    }",
  "}",
];

export const bubbleField: SwiftPieceDefinition = {
  id: "bubble-field",
  name: "Bubble Field",
  category: "pieces",
  description: "A honeycomb of word bubbles in four colour quadrants that you pan around and tap to pick.",
  availability: "free",
  preview: { component: "bubble-field", chunk: "app-pieces" },
  icon: "square.grid.2x2",
  concepts: ["state", "binding", "gesture", "scrollview"],
  anatomy: [
    { part: "Words", props: ["highUnpleasant", "highPleasant", "lowUnpleasant", "lowPleasant"] },
    { part: "Bubbles", props: ["style", "palette", "columns", "diameter", "height", "radius"] },
    { part: "Selection", props: ["selected", "confirmPrefix"] },
    { part: "Controls", props: ["controls"] },
    { part: "Interaction", props: ["link"] },
  ],
  interactions: ["drag", "tap", "select", "spring", "haptic"],
  variants: [
    { id: "full", label: "Full screen", props: { columns: 6, diameter: 108, height: 700, controls: true } },
    { id: "compact", label: "Compact", props: { columns: 4, diameter: 84, height: 380, controls: false } },
    { id: "solid", label: "Solid bubbles", props: { style: "solid" } },
  ],
  states: [
    { id: "none", label: "Nothing picked", props: { selected: "" } },
    { id: "picked", label: "Picked", props: { selected: "Settled" } },
  ],
  properties: [
    text("highUnpleasant", "High energy, unpleasant", "Fuming, Rattled, Wired, Overloaded, On edge, Prickly, Swamped, Scattered, Pressured, Jumpy"),
    text("highPleasant", "High energy, pleasant", "Buzzing, Bright, Fired up, Zippy, Proud, Inspired, Bold, Lively, Sparky, Ready"),
    text("lowUnpleasant", "Low energy, unpleasant", "Flat, Heavy, Worn out, Foggy, Blue, Left out, Stuck, Hollow, Weary, Low"),
    text("lowPleasant", "Low energy, pleasant", "Settled, Toasty, Soft, Unhurried, Easy, Warm, Rested, Grounded, Thankful, Still"),
    select("style", "Bubbles", "tinted", opts(["tinted", "Tinted glass"], ["solid", "Solid colour"])),
    select("palette", "Colours", "sweep", opts(["sweep", "Swift Pieces sweep"], ["corners", "Four corners (red, gold, blue, green)"]), { group: "color" }),
    number("columns", "Columns", 6, 2, 10, 2),
    number("diameter", "Bubble size", 108, 64, 150),
    number("height", "Height", 700, 280, 900, 10, { group: "layout" }),
    number("radius", "Corner radius", 0, 0, 48, 1, { group: "layout", hint: "0 runs the field edge to edge." }),
    bool("controls", "Close and search buttons", true),
    text("confirmPrefix", "Confirm label", "Log", { hint: "Shown before the picked word on the button that appears." }),
    text("selected", "Starts on", "", { group: "state", hint: "A word to start picked, or empty." }),
    link("link", "Confirm goes to", { hint: "Where the button under a picked bubble goes. Empty logs in place: the button turns into Logged." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("WellbeingEntrance", ENTRANCE);
      ctx.declare("WellbeingPressStyle", PRESS_STYLE);
      ctx.declare("BubbleField", VIEW);
      const picked = s(p, "selected").trim();
      const name = ctx.state("feeling", "String?", picked ? ctx.str(picked) : "nil");
      const quadrants = quadrantsOf(p);
      const lines = call("BubbleField", [
        ["selection", `$${name}`],
        ["quadrants", `[${quadrants.map((q) => `[${q.map((w) => ctx.str(w)).join(", ")}]`).join(", ")}]`],
        n(p, "columns") !== 6 && ["columns", num(n(p, "columns"))],
        n(p, "diameter") !== 108 && ["diameter", num(n(p, "diameter"))],
        s(p, "style") === "solid" && ["tinted", "false"],
        s(p, "palette") === "corners" && ["tones", `[${CORNER_TONES.map((t) => `(outer: [${t.outer.map(num).join(", ")}], inner: [${t.inner.map(num).join(", ")}])`).join(", ")}]`],
      ]);
      lines.push(`.frame(height: ${num(n(p, "height"))})`);
      if (n(p, "radius") > 0) lines.push(`.clipShape(.rect(cornerRadius: ${num(n(p, "radius"))}))`);
      if (b(p, "controls")) {
        lines.push(
          ".overlay(alignment: .top) {",
          `${INDENT}HStack {`,
          `${INDENT}${INDENT}Image(systemName: "xmark").frame(width: 44, height: 44).background(.ultraThinMaterial, in: .circle)`,
          `${INDENT}${INDENT}Spacer()`,
          `${INDENT}${INDENT}Image(systemName: "magnifyingglass").frame(width: 44, height: 44).background(.ultraThinMaterial, in: .circle)`,
          `${INDENT}}`,
          `${INDENT}.font(.title3)`,
          `${INDENT}.padding(16)`,
          "}",
        );
      }
      const action = linkAction(ctx, p.link);
      const prefix = s(p, "confirmPrefix").trim();
      const title = prefix ? `"${ctx.str(prefix).slice(1, -1)} \\(${name}.lowercased())"` : name;
      // With nowhere to go, the confirm logs in place: it turns into "Logged" with a success tap.
      const logged = action ? null : ctx.state("loggedFeeling", "String?", "nil");
      const taps = action ? ctx.state("confirmTaps", "Int", "0") : null;
      lines.push(
        ".overlay(alignment: .bottom) {",
        `${INDENT}if let ${name} {`,
        `${INDENT}${INDENT}Button {`,
        ...(action ? [`${INDENT}${INDENT}${INDENT}${taps} += 1`, `${INDENT}${INDENT}${INDENT}${action}`] : [`${INDENT}${INDENT}${INDENT}withAnimation(.snappy(duration: 0.25)) { ${logged} = ${name} }`]),
        `${INDENT}${INDENT}} label: {`,
        ...(logged
          ? [`${INDENT}${INDENT}${INDENT}Label(${logged} == ${name} ? "Logged" : ${title}, systemImage: ${logged} == ${name} ? "checkmark" : "plus")`, `${INDENT}${INDENT}${INDENT}${INDENT}.contentTransition(.interpolate)`]
          : [`${INDENT}${INDENT}${INDENT}Text(${title})`]),
        `${INDENT}${INDENT}${INDENT}${INDENT}.font(.headline)`,
        `${INDENT}${INDENT}${INDENT}${INDENT}.padding(.horizontal, 24)`,
        `${INDENT}${INDENT}${INDENT}${INDENT}.padding(.vertical, 14)`,
        `${INDENT}${INDENT}${INDENT}${INDENT}.background(Color(red: 1, green: 0, blue: 0), in: .capsule)`,
        `${INDENT}${INDENT}${INDENT}${INDENT}.foregroundStyle(.white)`,
        `${INDENT}${INDENT}}`,
        `${INDENT}${INDENT}.buttonStyle(WellbeingPressStyle())`,
        logged ? `${INDENT}${INDENT}.sensoryFeedback(.success, trigger: ${logged})` : `${INDENT}${INDENT}.sensoryFeedback(.impact(weight: .light), trigger: ${taps})`,
        `${INDENT}${INDENT}.padding(.bottom, 24)`,
        `${INDENT}${INDENT}.transition(.move(edge: .bottom).combined(with: .opacity))`,
        `${INDENT}}`,
        "}",
        `.animation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.28), value: ${name})`,
      );
      return { lines };
    },
  },
};
