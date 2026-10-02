// Feeling Mark: the shape a feeling wears. One per corner of the mood field, the way an emotions
// journal badges a check-in: a burst for high energy and unpleasant, a sun for high and pleasant, a
// drop for low and unpleasant, a clover for low and pleasant, each in its corner's colour. It settles
// in from 0.95 with a fade; a tap gives it a springy wobble with a light tap (Reduce Motion keeps it
// still and keeps the tap).
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, opts, select } from "../shared.js";
import { FEELING_MARKS, swiftArtwork } from "./artwork.js";
import { CORNER_COLORS, FEELING_COLORS } from "./mood-calendar.js";
import { swiftHex } from "./data-kit.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** Dark ink, for a mark set on a pastel card that already carries the feeling's colour. */
export const MARK_INK = "#141414";

/** A mark's colour: its corner's, in the four-corner palette or the Swift Pieces sweep, or ink. */
export function feelingMarkColor(p: Props): string {
  if (s(p, "palette") === "ink") return MARK_INK;
  const i = Math.max(0, (FEELING_MARKS as readonly string[]).indexOf(s(p, "feeling")));
  return (s(p, "palette") === "sweep" ? FEELING_COLORS : CORNER_COLORS)[i];
}

const SWIFT = [
  "/// A feeling's mark (a burst, a sun, a drop or a clover) in its corner's colour. Tap it to wobble.",
  "private struct FeelingMark: View {",
  "    let mark: Artwork",
  "    let color: Color",
  "    var size: CGFloat = 56",
  "    @State private var shown = false",
  "    @State private var taps = 0",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    var body: some View {",
  "        mark",
  "            .foregroundStyle(color)",
  "            .frame(width: size, height: size)",
  "            .keyframeAnimator(initialValue: 0.0, trigger: reduceMotion ? 0 : taps) { content, angle in",
  "                content.rotationEffect(.degrees(angle))",
  "            } keyframes: { _ in",
  "                KeyframeTrack {",
  "                    SpringKeyframe(16, duration: 0.12)",
  "                    SpringKeyframe(-9, duration: 0.14)",
  "                    SpringKeyframe(0, duration: 0.3, spring: .bouncy)",
  "                }",
  "            }",
  "            .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "            .opacity(shown ? 1 : 0)",
  "            .contentShape(.rect)",
  "            .onTapGesture { taps += 1 }",
  "            .sensoryFeedback(.impact(weight: .light), trigger: taps)",
  "            .onAppear { withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "            .accessibilityHidden(true)",
  "    }",
  "}",
];

export const feelingMark: SwiftPieceDefinition = {
  id: "feeling-mark",
  name: "Feeling Mark",
  category: "pieces",
  description: "The shape a feeling wears: a burst, a sun, a drop or a clover, one per corner of the mood field, in that corner's colour. It settles in, and a tap gives it a springy wobble.",
  availability: "free",
  preview: { component: "feeling-mark", chunk: "app-pieces" },
  icon: "drop",
  concepts: ["zstack", "animation", "state"],
  anatomy: [
    { part: "Mark", props: ["feeling", "size"] },
    { part: "Colour", props: ["palette"] },
  ],
  interactions: ["tap", "spring", "haptic"],
  variants: [
    { id: "burst", label: "Burst", props: { feeling: "burst" } },
    { id: "sun", label: "Sun", props: { feeling: "sun" } },
    { id: "drop", label: "Drop", props: { feeling: "drop" } },
    { id: "clover", label: "Clover", props: { feeling: "clover" } },
  ],
  properties: [
    select("feeling", "Feeling", "sun", opts(["burst", "Burst: high energy, unpleasant"], ["sun", "Sun: high energy, pleasant"], ["drop", "Drop: low energy, unpleasant"], ["clover", "Clover: low energy, pleasant"])),
    select("palette", "Colours", "corners", opts(["corners", "Four corners (red, gold, blue, green)"], ["sweep", "Swift Pieces sweep"], ["ink", "Ink (on a pastel card)"]), { group: "color" }),
    number("size", "Size", 56, 16, 160),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const feeling = (FEELING_MARKS as readonly string[]).includes(s(p, "feeling")) ? s(p, "feeling") : "sun";
      const mark = swiftArtwork(ctx, feeling) ?? "Artwork.sun";
      ctx.declare("FeelingMark", SWIFT);
      return {
        lines: call("FeelingMark", [
          ["mark", mark],
          ["color", swiftHex(feelingMarkColor(p))],
          n(p, "size") !== 56 && ["size", num(n(p, "size") || 56)],
        ]),
      };
    },
  },
};
