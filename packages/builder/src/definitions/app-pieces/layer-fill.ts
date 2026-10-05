// Layer Fill: a silhouette that fills from the bottom in coloured bands, one band per thing you
// log (a drink, a serving, a deposit), with a shelf of quick-add buttons under it. Each tap drops a
// new band in with a spring and a wave on its top edge; tapping the figure takes the last one back.
// The SwiftUI is written inline: a Shape per silhouette, a wave Shape per band, one small view.
import { swiftRGB } from "../../core/palette.js";
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, indent, list, num, str } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";
import { own } from "../../core/own.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** Colours for things people usually log, by name; anything else takes the next of `CYCLE`. */
// The SwiftPieces palette: the signal sweep plus the house blocks.
const NAMED: Record<string, string> = {
  water: "#4D8DFF", "green tea": "#A9DCB7", tea: "#FFD976", coffee: "#FF7A3C", juice: "#FFD976", soda: "#FF0000",
  milk: "#F4F3EF", smoothie: "#FF8FB8", energy: "#9CC2FF", sparkling: "#9CC2FF", savings: "#A9DCB7", rent: "#CDB8FF",
};
const CYCLE = ["#4D8DFF", "#FF8FB8", "#FF7A3C", "#FFD976", "#FF0000", "#9CC2FF", "#A9DCB7", "#CDB8FF"];

export type LayerItem = { name: string; color: string };
export type LayerBand = { item: number; amount: number };

/** The quick-add items and their colours, in shelf order. */
export function layerItems(value: unknown): LayerItem[] {
  const names = [...new Set(list(value, 6))];
  const safe = names.length ? names : ["Water"];
  return safe.map((name, i) => ({ name, color: own(NAMED, name.toLowerCase()) ?? CYCLE[i % CYCLE.length] }));
}

/**
 * The bands already logged, bottom first: "Coffee: 8, Water: 16". A name that isn't on the shelf
 * joins it (so its colour is known); amounts clamp to something drawable.
 */
export function layerBands(value: unknown, items: LayerItem[]): { items: LayerItem[]; bands: LayerBand[] } {
  const all = [...items];
  const bands: LayerBand[] = [];
  for (const part of list(value, 12)) {
    const [rawName, rawAmount] = part.split(":").map((x) => x.trim());
    const amount = Math.min(1000, Math.max(0, Number(rawAmount)));
    if (!rawName || !Number.isFinite(amount) || amount <= 0) continue;
    let index = all.findIndex((it) => it.name.toLowerCase() === rawName.toLowerCase());
    if (index < 0) {
      if (all.length >= 8) continue;
      all.push({ name: rawName, color: own(NAMED, rawName.toLowerCase()) ?? CYCLE[all.length % CYCLE.length] });
      index = all.length - 1;
    }
    bands.push({ item: index, amount });
  }
  return { items: all, bands };
}

// ---------------------------------------------------------------- Silhouettes

/** Outlines in a 100 × 100 box, absolute M/L/C/Q/Z only, so the same numbers draw on the web and in Swift. */
export const SILHOUETTES: Record<string, { label: string; d: string }> = {
  // The SwiftPieces mascot's blob (definitions/app-pieces/mascot.ts), so a tracker can fill the mascot.
  blob: { label: "Mascot", d: "M 50 6 C 70 6 88 18 92 38 C 97 60 86 86 62 93 C 38 100 10 88 7 62 C 3 34 22 6 50 6 Z" },
  orb: { label: "Orb", d: "M 50 4 C 75.4 4 96 24.6 96 50 C 96 75.4 75.4 96 50 96 C 24.6 96 4 75.4 4 50 C 4 24.6 24.6 4 50 4 Z" },
  glass: { label: "Glass", d: "M 18 6 L 82 6 L 74 90 C 73.5 95 70 98 65 98 L 35 98 C 30 98 26.5 95 26 90 Z" },
  drop: { label: "Drop", d: "M 50 3 C 50 3 86 43 86 63 C 86 84 70 98 50 98 C 30 98 14 84 14 63 C 14 43 50 3 50 3 Z" },
  bottle: { label: "Bottle", d: "M 40 3 L 60 3 L 60 15 C 60 22 76 26 76 38 L 76 90 C 76 95 72 98 67 98 L 33 98 C 28 98 24 95 24 90 L 24 38 C 24 26 40 22 40 15 Z" },
};
const shapeOpts = opts(...Object.entries(SILHOUETTES).map(([k, v]): [string, string] => [k, v.label]));

/** The path as Swift `Path` calls, in a rect `r`. */
function swiftPath(d: string): string[] {
  const t = d.trim().split(/\s+/);
  const out: string[] = [];
  const pt = (x: string, y: string) => `pt(${x}, ${y})`;
  let i = 0;
  while (i < t.length) {
    const c = t[i++];
    if (c === "M") out.push(`p.move(to: ${pt(t[i++], t[i++])})`);
    else if (c === "L") out.push(`p.addLine(to: ${pt(t[i++], t[i++])})`);
    else if (c === "Q") {
      const cx = t[i++], cy = t[i++], x = t[i++], y = t[i++];
      out.push(`p.addQuadCurve(to: ${pt(x, y)}, control: ${pt(cx, cy)})`);
    } else if (c === "C") {
      const a = t[i++], b = t[i++], c2 = t[i++], d2 = t[i++], x = t[i++], y = t[i++];
      out.push(`p.addCurve(to: ${pt(x, y)}, control1: ${pt(a, b)}, control2: ${pt(c2, d2)})`);
    } else if (c === "Z") out.push("p.closeSubpath()");
  }
  return out;
}

const shapeName = (shape: string) => `${shape[0].toUpperCase()}${shape.slice(1)}Silhouette`;

// ---------------------------------------------------------------- Definition

export const layerFill: SwiftPieceDefinition = {
  id: "layer-fill",
  name: "Layer Fill",
  category: "pieces",
  description: "A silhouette that fills from the bottom in coloured bands, one per thing you log, with a shelf of quick-add buttons. Each tap drops a band in with a spring; tap the figure to take the last one back.",
  availability: "free",
  preview: { component: "layer-fill", chunk: "app-pieces" },
  icon: "drop",
  concepts: ["state", "zstack", "spring"],
  interactions: ["tap", "spring", "haptic"],
  anatomy: [
    { part: "Readout", props: ["readout", "unit", "goal"] },
    { part: "Silhouette", props: ["shape", "layers", "height"] },
    { part: "Shelf", props: ["items", "serving"] },
  ],
  properties: [
    select("shape", "Silhouette", "orb", shapeOpts),
    text("items", "Shelf", "Water, Sparkling, Tea, Coffee", { maxLength: 80, hint: "Quick-add buttons, up to six, separated by commas. Leave empty to hide the shelf." }),
    text("layers", "Logged", "Coffee: 8, Water: 16, Tea: 8, Sparkling: 12, Water: 8", { maxLength: 160, hint: "What's in it already, bottom first: name and amount, separated by commas." }),
    number("goal", "Goal", 64, 1, 5000, 1),
    text("unit", "Unit", "oz", { maxLength: 6 }),
    number("serving", "Per tap", 8, 1, 100, 1, { hint: "How much one tap on the shelf adds." }),
    select("readout", "Readout", "large", opts(["large", "Large"], ["small", "Small"], ["hidden", "Hidden"])),
    number("height", "Height", 300, 80, 460, 1, { group: "layout" }),
  ],
  variants: [
    { id: "drinks", label: "Drinks", props: { shape: "orb", items: "Water, Sparkling, Tea, Coffee", layers: "Coffee: 8, Water: 16, Tea: 8, Sparkling: 12, Water: 8", goal: 64, unit: "oz" } },
    { id: "glass", label: "Glass", props: { shape: "glass", items: "Water, Tea", layers: "Water: 500, Tea: 250", goal: 2000, unit: "ml", serving: 250, height: 260 } },
    { id: "bottle", label: "Bottle", props: { shape: "bottle", items: "Water, Sparkling, Tea", layers: "Water: 750, Sparkling: 330", goal: 2000, unit: "ml", serving: 250, height: 260 } },
    { id: "jar", label: "Savings drop", props: { shape: "drop", items: "Savings", layers: "Savings: 120, Savings: 80", goal: 500, unit: "$", serving: 25, readout: "small", height: 220 } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { layers: "" } },
    { id: "full", label: "Goal reached", props: { layers: "Water: 32, Tea: 16, Coffee: 16" } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const shape = SILHOUETTES[s(p, "shape")] ? s(p, "shape") : "orb";
      const shelf = s(p, "items").trim() ? layerItems(p.items) : [];
      const { items, bands } = layerBands(p.layers, shelf.length ? shelf : layerItems("Water"));
      const shapeType = shapeName(shape);
      ctx.declare(`layer-fill:${shape}`, [
        `private struct ${shapeType}: Shape {`,
        `${INDENT}func path(in r: CGRect) -> Path {`,
        `${INDENT}${INDENT}func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + r.width * x / 100, y: r.minY + r.height * y / 100) }`,
        `${INDENT}${INDENT}var p = Path()`,
        ...indent(swiftPath(SILHOUETTES[shape].d), 2),
        `${INDENT}${INDENT}return p`,
        `${INDENT}}`,
        "}",
      ]);
      ctx.declare("layer-fill:view", LAYER_FILL_SWIFT);
      const itemLines = items.map((it) => `.init(name: ${str(it.name)}, color: ${swiftRGB(it.color)}),`);
      const bandLines = bands.length ? `[${bands.map((b) => `.init(item: ${b.item}, amount: ${num(b.amount)})`).join(", ")}]` : "[]";
      const readout = ["large", "small", "hidden"].includes(s(p, "readout")) ? s(p, "readout") : "large";
      return {
        lines: [
          "LayerFill(",
          `${INDENT}silhouette: AnyShape(${shapeType}()),`,
          `${INDENT}items: [`,
          ...itemLines.map((l) => `${INDENT}${INDENT}${l}`),
          `${INDENT}],`,
          `${INDENT}shelf: ${shelf.length},`,
          `${INDENT}logged: ${bandLines},`,
          `${INDENT}goal: ${num(Math.max(1, n(p, "goal")))},`,
          `${INDENT}unit: ${str(s(p, "unit"))},`,
          `${INDENT}serving: ${num(Math.max(1, n(p, "serving")))},`,
          `${INDENT}readout: .${readout},`,
          `${INDENT}height: ${num(n(p, "height"))}`,
          ")",
        ],
      };
    },
  },
};

const I = INDENT;
/** The view every Layer Fill uses: bands as wave shapes, a readout, a shelf. */
const LAYER_FILL_SWIFT = [
  "private struct LayerFill: View {",
  `${I}struct Item { let name: String; let color: Color }`,
  `${I}struct Band: Identifiable { let id = UUID(); let item: Int; let amount: Double }`,
  `${I}enum Readout { case large, small, hidden }`,
  "",
  `${I}let silhouette: AnyShape`,
  `${I}let items: [Item]`,
  `${I}let shelf: Int`,
  `${I}@State var logged: [Band]`,
  `${I}let goal: Double`,
  `${I}let unit: String`,
  `${I}let serving: Double`,
  `${I}let readout: Readout`,
  `${I}let height: CGFloat`,
  `${I}@State private var filled = false`,
  `${I}@State private var pop = false`,
  `${I}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  "",
  `${I}private var total: Double { logged.reduce(0) { $0 + $1.amount } }`,
  `${I}private var percent: Int { Int((total / goal * 100).rounded()) }`,
    "",
  `${I}/// Where band \`i\` tops out, as a share of the height (bands stack; past the goal they squeeze to fit).`,
  `${I}private func top(_ i: Int) -> CGFloat {`,
  `${I}${I}let upTo = logged.prefix(i + 1).reduce(0) { $0 + $1.amount }`,
  `${I}${I}return CGFloat(upTo / max(goal, total))`,
  `${I}}`,
  "",
  `${I}var body: some View {`,
  `${I}${I}VStack(spacing: 14) {`,
  `${I}${I}${I}switch readout {`,
  `${I}${I}${I}case .large:`,
  `${I}${I}${I}${I}VStack(spacing: 2) {`,
  `${I}${I}${I}${I}${I}Text("\\(Int(total))\\(unit)")`,
  `${I}${I}${I}${I}${I}${I}.font(.system(size: 46, weight: .bold))`,
  `${I}${I}${I}${I}${I}${I}.monospacedDigit()`,
  `${I}${I}${I}${I}${I}${I}.contentTransition(.numericText(value: total))`,
  `${I}${I}${I}${I}${I}Text("\\(percent)% of your goal")`,
  `${I}${I}${I}${I}${I}${I}.font(.headline)`,
  `${I}${I}${I}${I}}`,
  `${I}${I}${I}case .small:`,
  `${I}${I}${I}${I}VStack(alignment: .leading, spacing: 0) {`,
  `${I}${I}${I}${I}${I}Text("\\(Int(total))\\(unit)").font(.title3.bold()).monospacedDigit().contentTransition(.numericText(value: total))`,
  `${I}${I}${I}${I}${I}Text("\\(percent)%").font(.caption.bold()).foregroundStyle(.secondary)`,
  `${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}.frame(maxWidth: .infinity, alignment: .leading)`,
  `${I}${I}${I}case .hidden:`,
  `${I}${I}${I}${I}EmptyView()`,
  `${I}${I}${I}}`,
  `${I}${I}${I}ZStack {`,
  `${I}${I}${I}${I}Rectangle().fill(Color.gray.opacity(0.14))`,
  `${I}${I}${I}${I}ForEach(Array(logged.enumerated()).reversed(), id: \\.element.id) { i, band in`,
  `${I}${I}${I}${I}${I}LayerWave(level: filled ? top(i) : 0, phase: CGFloat(i) * 1.7)`,
  `${I}${I}${I}${I}${I}${I}.fill(items[band.item].color)`,
  `${I}${I}${I}${I}${I}${I}.transition(.move(edge: .bottom))`,
  `${I}${I}${I}${I}}`,
  `${I}${I}${I}}`,
  `${I}${I}${I}.clipShape(silhouette)`,
  `${I}${I}${I}.scaleEffect(pop ? 1.06 : 1)`,
  `${I}${I}${I}.frame(width: height, height: height)`,
  `${I}${I}${I}.contentShape(silhouette)`,
  `${I}${I}${I}.onTapGesture { if !logged.isEmpty { logged.removeLast() } }`,
  `${I}${I}${I}.accessibilityLabel("\\(Int(total)) \\(unit) of \\(Int(goal))")`,
  `${I}${I}${I}if shelf > 0 {`,
  `${I}${I}${I}${I}HStack(spacing: 10) {`,
  `${I}${I}${I}${I}${I}ForEach(0..<min(shelf, items.count), id: \\.self) { i in`,
  `${I}${I}${I}${I}${I}${I}Button { add(i) } label: {`,
  `${I}${I}${I}${I}${I}${I}${I}VStack(spacing: 6) {`,
  `${I}${I}${I}${I}${I}${I}${I}${I}UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 8, bottomTrailingRadius: 8, topTrailingRadius: 4)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.fill(items[i].color)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.frame(width: 34, height: 42)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.overlay(alignment: .bottom) {`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}${I}Image(systemName: "plus.circle.fill")`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}${I}${I}.font(.body)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}${I}${I}.foregroundStyle(.white.opacity(0.9))`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}${I}${I}.offset(y: 8)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}${I}${I}${I}Text(items[i].name.uppercased())`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.font(.caption2.bold())`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.foregroundStyle(.secondary)`,
  `${I}${I}${I}${I}${I}${I}${I}${I}${I}.lineLimit(1)`,
  `${I}${I}${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}${I}${I}.frame(maxWidth: .infinity)`,
  `${I}${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}${I}${I}.buttonStyle(LayerShelfPress())`,
  `${I}${I}${I}${I}${I}}`,
  `${I}${I}${I}${I}}`,
  `${I}${I}${I}}`,
  `${I}${I}}`,
  `${I}${I}.animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.2), value: logged.count)`,
  `${I}${I}.onAppear {`,
  `${I}${I}${I}withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.3)) { filled = true }`,
  `${I}${I}}`,
  `${I}${I}.sensoryFeedback(trigger: logged.count) { old, new in`,
  `${I}${I}${I}if new > old { return total >= goal ? .success : .increase }`,
  `${I}${I}${I}return .decrease`,
  `${I}${I}}`,
  `${I}}`,
  "",
  `${I}/// Logs one serving; crossing the goal gives the figure one small bounce (a rare, earned moment).`,
  `${I}private func add(_ i: Int) {`,
  `${I}${I}let crossing = total < goal && total + serving >= goal`,
  `${I}${I}logged.append(Band(item: i, amount: serving))`,
  `${I}${I}guard crossing, !reduceMotion else { return }`,
  `${I}${I}withAnimation(.spring(duration: 0.25)) { pop = true }`,
  `${I}${I}Task { @MainActor in`,
  `${I}${I}${I}try? await Task.sleep(for: .milliseconds(220))`,
  `${I}${I}${I}withAnimation(.spring(duration: 0.4, bounce: 0.4)) { pop = false }`,
  `${I}${I}}`,
  `${I}}`,
  "}",
  "",
  "private struct LayerShelfPress: ButtonStyle {",
  `${I}func makeBody(configuration: Configuration) -> some View {`,
  `${I}${I}configuration.label`,
  `${I}${I}${I}.scaleEffect(configuration.isPressed ? 0.97 : 1)`,
  `${I}${I}${I}.opacity(configuration.isPressed ? 0.85 : 1)`,
  `${I}${I}${I}.animation(.easeOut(duration: 0.12), value: configuration.isPressed)`,
  `${I}}`,
  "}",
  "",
  "/// A fill from the bottom up to `level` (0 to 1), with a soft wave along its top edge.",
  "private struct LayerWave: Shape {",
  `${I}var level: CGFloat`,
  `${I}var phase: CGFloat`,
  `${I}var animatableData: CGFloat {`,
  `${I}${I}get { level }`,
  `${I}${I}set { level = newValue }`,
  `${I}}`,
  "",
  `${I}func path(in r: CGRect) -> Path {`,
  `${I}${I}var p = Path()`,
  `${I}${I}let y = r.maxY - r.height * level`,
  `${I}${I}let amplitude = r.height * 0.014`,
  `${I}${I}p.move(to: CGPoint(x: r.minX, y: r.maxY))`,
  `${I}${I}for step in 0...24 {`,
  `${I}${I}${I}let t = CGFloat(step) / 24`,
  `${I}${I}${I}p.addLine(to: CGPoint(x: r.minX + r.width * t, y: y + sin(t * .pi * 3 + phase) * amplitude))`,
  `${I}${I}}`,
  `${I}${I}p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))`,
  `${I}${I}p.closeSubpath()`,
  `${I}${I}return p`,
  `${I}}`,
  "}",
];
