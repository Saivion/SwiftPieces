// Mascot: the SwiftPieces mascot. The soft blob from the Candy templates (SPBlobShape) in signal
// red, with the same two dot eyes and small smile (SPBlobFace). It stands in wherever a screen wants
// a character, an avatar or a companion. It breathes and blinks while idle, squashes and grins with
// a haptic when tapped, can fill up to a level (a day's progress), and carries an optional figure and
// caption under it. The SwiftUI is written inline: one Shape and one small view on a TimelineView.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";
import { swiftHex } from "./data-kit.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** The blob, in a 100 × 100 box: the same curve as SPBlobShape and the templates' `Blob`. */
export const MASCOT_PATH = "M50 6C70 6 88 18 92 38C97 60 86 86 62 93C38 100 10 88 7 62C3 34 22 6 50 6Z";

/** Signal red is the mascot. The others are for the rare screen that needs a second one. */
export const MASCOT_COLORS: Record<string, { label: string; fill: string }> = {
  signal: { label: "Signal red", fill: "#FF0000" },
  ember: { label: "Ember", fill: "#FF7A3C" },
  blush: { label: "Blush", fill: "#FF8FB8" },
  azure: { label: "Azure", fill: "#4D8DFF" },
};
export const MASCOT_INK = "#141414";
export const mascotFill = (id: string) => (MASCOT_COLORS[id] ?? MASCOT_COLORS.signal).fill;

export const EXPRESSIONS = ["smile", "grin", "calm", "wow", "sleepy"] as const;
export type Expression = (typeof EXPRESSIONS)[number];
export const expressionIndex = (id: string) => Math.max(0, EXPRESSIONS.indexOf(id as Expression));

/** Idle motion: 0 still, 1 calm (breathes, blinks), 2 lively (bobs and sways too). */
export const MOTIONS: Record<string, number> = { still: 0, calm: 1, lively: 2 };

/**
 * The face in the 100 × 100 box, per expression (a grin is what a tap shows): eyes as dots or
 * closed lines, the mouth as a quad curve, a line or a small ring.
 */
export function faceParts(expression: Expression, blinking: boolean) {
  const closed = blinking || expression === "sleepy";
  const mouth =
    expression === "grin" ? { kind: "curve" as const, from: [38, 57], to: [62, 57], control: [50, 72] }
    : expression === "calm" ? { kind: "line" as const, from: [43, 60], to: [57, 60] }
    : expression === "wow" ? { kind: "ring" as const, center: [50, 61], r: 4.5 }
    : { kind: "curve" as const, from: [42, 58], to: [58, 58], control: [50, 66] };
  return { closed, mouth };
}

const SWIFT = [
  "private struct MascotShape: Shape {",
  "    func path(in rect: CGRect) -> Path {",
  "        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x / 100 * rect.width, y: rect.minY + y / 100 * rect.height) }",
  "        var path = Path()",
  "        path.move(to: p(50, 6))",
  "        path.addCurve(to: p(92, 38), control1: p(70, 6), control2: p(88, 18))",
  "        path.addCurve(to: p(62, 93), control1: p(97, 60), control2: p(86, 86))",
  "        path.addCurve(to: p(7, 62), control1: p(38, 100), control2: p(10, 88))",
  "        path.addCurve(to: p(50, 6), control1: p(3, 34), control2: p(22, 6))",
  "        path.closeSubpath()",
  "        return path",
  "    }",
  "}",
  "",
  "private struct Mascot: View {",
  "    enum Expression { case smile, grin, calm, wow, sleepy }",
  "    var color = Color(red: 1, green: 0, blue: 0)",
  "    var ink = Color(red: 0.078, green: 0.078, blue: 0.078)",
  "    var size: CGFloat = 160",
  "    var motion = 1",
  "    var level: Double = 1",
  "    var expression: Expression = .smile",
  "    var label = \"\"",
  "    var caption = \"\"",
  "    var hugs = false",
  "    @State private var taps = 0",
  "    @State private var cheering = false",
  "",
  "    var body: some View {",
  "        VStack(spacing: 10) {",
  "            TimelineView(.animation(paused: motion == 0)) { timeline in",
  "                let t = timeline.date.timeIntervalSinceReferenceDate",
  "                let rate = motion == 2 ? 3.2 : 1.6",
  "                let breathe = motion == 0 ? 0 : sin(t * rate) * (motion == 2 ? 0.035 : 0.02)",
  "                let blinking = motion != 0 && t.truncatingRemainder(dividingBy: 4.2) < 0.14",
  "                blob(blinking: blinking)",
  "                    .scaleEffect(x: 1 - breathe * 0.6, y: 1 + breathe, anchor: .bottom)",
  "                    .rotationEffect(.degrees(motion == 2 ? sin(t * 1.9) * 5 : 0))",
  "                    .offset(y: motion == 2 ? sin(t * 3.8) * size * 0.02 : 0)",
  "            }",
  "            .frame(width: size, height: size)",
  "            .keyframeAnimator(initialValue: 1.0, trigger: taps) { content, scale in",
  "                content.scaleEffect(x: 2 - scale, y: scale, anchor: .bottom)",
  "            } keyframes: { _ in",
  "                SpringKeyframe(0.86, duration: 0.12)",
  "                SpringKeyframe(1.0, duration: 0.55, spring: .bouncy)",
  "            }",
  "            .contentShape(MascotShape())",
  "            .onTapGesture { cheer() }",
  "            .sensoryFeedback(.impact(weight: .medium), trigger: taps)",
  "            .accessibilityElement()",
  "            .accessibilityLabel(label.isEmpty ? \"Mascot\" : label)",
  "            .accessibilityAddTraits(.isButton)",
  "            if !label.isEmpty {",
  "                Text(label)",
  "                    .font(.system(size: max(20, size * 0.18), weight: .bold))",
  "                    .monospacedDigit()",
  "                    .contentTransition(.numericText())",
  "            }",
  "            if !caption.isEmpty {",
  "                Text(caption).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)",
  "            }",
  "        }",
  "        .frame(maxWidth: hugs ? nil : .infinity)",
  "    }",
  "",
  "    private func cheer() {",
  "        taps += 1",
  "        withAnimation(.snappy) { cheering = true }",
  "        Task {",
  "            try? await Task.sleep(for: .seconds(0.7))",
  "            withAnimation(.snappy) { cheering = false }",
  "        }",
  "    }",
  "",
  "    private func blob(blinking: Bool) -> some View {",
  "        let face: Expression = cheering ? .grin : expression",
  "        let closed = blinking || face == .sleepy",
  "        return ZStack {",
  "            MascotShape().fill(color.opacity(level < 1 ? 0.24 : 1))",
  "            if level < 1 {",
  "                MascotShape().fill(color)",
  "                    .mask(alignment: .bottom) { Rectangle().frame(height: size * min(max(level, 0), 1)) }",
  "            }",
  "            Canvas { context, box in",
  "                let s = box.width",
  "                func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x / 100 * s, y: y / 100 * s) }",
  "                for x in [40.0, 60.0] {",
  "                    if closed {",
  "                        var lid = Path()",
  "                        lid.move(to: p(x - 4.5, 44))",
  "                        lid.addLine(to: p(x + 4.5, 44))",
  "                        context.stroke(lid, with: .color(ink), style: StrokeStyle(lineWidth: s * 0.035, lineCap: .round))",
  "                    } else {",
  "                        context.fill(Path(ellipseIn: CGRect(x: p(x, 44).x - s * 0.045, y: p(x, 44).y - s * 0.045, width: s * 0.09, height: s * 0.09)), with: .color(ink))",
  "                    }",
  "                }",
  "                var mouth = Path()",
  "                switch face {",
  "                case .grin:",
  "                    mouth.move(to: p(38, 57))",
  "                    mouth.addQuadCurve(to: p(62, 57), control: p(50, 72))",
  "                case .calm:",
  "                    mouth.move(to: p(43, 60))",
  "                    mouth.addLine(to: p(57, 60))",
  "                case .wow:",
  "                    mouth.addEllipse(in: CGRect(x: p(50, 61).x - s * 0.045, y: p(50, 61).y - s * 0.045, width: s * 0.09, height: s * 0.09))",
  "                default:",
  "                    mouth.move(to: p(42, 58))",
  "                    mouth.addQuadCurve(to: p(58, 58), control: p(50, 66))",
  "                }",
  "                context.stroke(mouth, with: .color(ink), style: StrokeStyle(lineWidth: s * 0.035, lineCap: .round))",
  "            }",
  "        }",
  "        .frame(width: size, height: size)",
  "    }",
  "}",
];

export const mascot: SwiftPieceDefinition = {
  id: "mascot",
  name: "Mascot",
  category: "pieces",
  description: "The SwiftPieces mascot: a soft red blob with two dot eyes and a small smile. It breathes and blinks while idle, and squashes and grins with a haptic when you tap it. It can fill up to a level and show a figure and caption under it.",
  availability: "free",
  preview: { component: "mascot", chunk: "app-pieces" },
  icon: "sparkles",
  concepts: ["animation", "state"],
  anatomy: [
    { part: "Blob", props: ["size", "color", "level"] },
    { part: "Face", props: ["expression"] },
    { part: "Idle motion", props: ["motion"] },
    { part: "Text", props: ["label", "caption"] },
  ],
  interactions: ["tap", "haptic"],
  variants: [
    { id: "hello", label: "Hello", props: {} },
    { id: "progress", label: "Filling up", props: { level: 62, label: "62%", caption: "1.2 of 2 L today" } },
    { id: "lively", label: "Lively", props: { motion: "lively", expression: "grin", size: 120 } },
    { id: "sleepy", label: "Sleepy", props: { expression: "sleepy", motion: "calm" } },
    { id: "avatar", label: "Avatar size", props: { size: 44, width: "hug", motion: "still" } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { level: 0 } },
    { id: "full", label: "Full", props: { level: 100 } },
    { id: "still", label: "Still", props: { motion: "still" } },
    { id: "wow", label: "Surprised", props: { expression: "wow" } },
  ],
  properties: [
    number("size", "Size", 160, 40, 320),
    select("expression", "Expression", "smile", opts(["smile", "Smile"], ["grin", "Grin"], ["calm", "Calm"], ["wow", "Surprised"], ["sleepy", "Sleepy"])),
    select("motion", "Idle motion", "calm", opts(["calm", "Breathe and blink"], ["lively", "Lively"], ["still", "Still"])),
    number("level", "Fill level", 100, 0, 100, 1, { hint: "How full the mascot is, in percent." }),
    select("color", "Colour", "signal", opts(...Object.entries(MASCOT_COLORS).map(([k, v]): [string, string] => [k, v.label])), { hint: "Signal red is the SwiftPieces mascot." }),
    text("label", "Figure", "", { hint: "A short figure under the mascot, such as a percentage." }),
    text("caption", "Caption", ""),
    select("width", "Width", "fill", opts(["fill", "Takes the row, centered"], ["hug", "Its own size"]), { hint: "Hug to sit beside other things in a row, like an avatar." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      // Style → Mascot: hidden leaves nothing in its place.
      if (ctx.theme?.mascot === "hidden") return { lines: ["EmptyView()"] };
      ctx.declare("Mascot", SWIFT);
      const motion = MOTIONS[s(p, "motion")] ?? 1;
      const level = Math.min(100, Math.max(0, p.level === undefined ? 100 : n(p, "level")));
      const expression = EXPRESSIONS[expressionIndex(s(p, "expression"))];
      const color = s(p, "color") || "signal";
      return {
        lines: call("Mascot", [
          color !== "signal" && ["color", swiftHex(mascotFill(color))],
          n(p, "size") !== 160 && ["size", num(n(p, "size") || 160)],
          motion !== 1 && ["motion", String(motion)],
          level !== 100 && ["level", num(level / 100)],
          expression !== "smile" && ["expression", `.${expression}`],
          s(p, "label").trim() && ["label", ctx.str(s(p, "label").trim())],
          s(p, "caption").trim() && ["caption", ctx.str(s(p, "caption").trim())],
          s(p, "width") === "hug" && ["hugs", "true"],
        ]),
      };
    },
  },
};
