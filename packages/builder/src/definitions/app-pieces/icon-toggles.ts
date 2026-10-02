// Icon Toggles: a row of round icon buttons with a label under each, any number on at once. Tags
// for a diary entry (what you did, how you slept), picked with a tap instead of typed.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { icons } from "../../core/palette.js";
import { color, number, opts, select, text } from "../shared.js";
import { TINTS, swiftHex } from "./data-kit.js";
import { ENTRANCE, PRESS_STYLE, words } from "./wellbeing-shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

const iconIds = new Set(icons.map((i) => i.id));

/** Labels and icons paired in order; an unknown or missing icon falls back to a tag. */
export function toggleItems(p: Props): Array<{ label: string; icon: string }> {
  const labels = words(p.labels, 8);
  const glyphs = words(p.icons, 8);
  return labels.map((label, i) => ({ label, icon: iconIds.has(glyphs[i] ?? "") ? glyphs[i] : "tag" }));
}

/** The Swift Pieces sweep tints a toggle row can take instead of a system colour. */
export const SWEEP_TINTS = ["signal", "ember", "blush", "azure"];
/** The sweep hex for `palette`, or null when the row uses its `tint` colour. */
export const sweepHex = (p: Props): string | null => (SWEEP_TINTS.includes(s(p, "palette")) ? TINTS[s(p, "palette")] : null);

/** The indices that start on, from "0, 2". */
export const startsOn = (p: Props) => words(p.selected, 8).map(Number).filter((i) => Number.isInteger(i) && i >= 0);

const VIEW = [
  "private struct IconToggles: View {",
  "    let items: [(label: String, symbol: String)]",
  "    @Binding var selection: Set<String>",
  "    var tint: Color = .accentColor",
  "    var size: CGFloat = 46",
  "    @State private var appeared = false",
  "",
  "    var body: some View {",
  "        HStack(alignment: .top, spacing: 0) {",
  "            ForEach(Array(items.enumerated()), id: \\.element.label) { index, item in",
  "                let on = selection.contains(item.label)",
  "                Button {",
  "                    withAnimation(.spring(duration: 0.25, bounce: 0.3)) {",
  "                        if on { selection.remove(item.label) } else { selection.insert(item.label) }",
  "                    }",
  "                } label: {",
  "                    VStack(spacing: 6) {",
  "                        Image(systemName: item.symbol)",
  "                            .font(.system(size: size * 0.42, weight: .semibold))",
  "                            .foregroundStyle(on ? .white : tint)",
  "                            .frame(width: size, height: size)",
  "                            .background(on ? tint : .clear, in: .circle)",
  "                            .overlay { Circle().strokeBorder(tint.opacity(on ? 0 : 0.45), lineWidth: 1.5) }",
  "                            .scaleEffect(on ? 1.06 : 1)",
  "                        Text(item.label)",
  "                            .font(.caption2)",
  "                            .foregroundStyle(.secondary)",
  "                            .multilineTextAlignment(.center)",
  "                            .lineLimit(2)",
  "                    }",
  "                    .frame(maxWidth: .infinity, minHeight: 44)",
  "                    .modifier(WellbeingEntrance(shown: appeared, delay: Double(min(index, 7)) * 0.04))",
  "                }",
  "                .buttonStyle(WellbeingPressStyle())",
  "                .accessibilityAddTraits(on ? .isSelected : [])",
  "            }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selection)",
  "        .onAppear { appeared = true }",
  "    }",
  "}",
];

export const iconToggles: SwiftPieceDefinition = {
  id: "icon-toggles",
  name: "Icon Toggles",
  category: "pieces",
  description: "A row of round icon buttons with labels; tap any number of them on, like tags for a diary entry.",
  availability: "free",
  preview: { component: "icon-toggles", chunk: "app-pieces" },
  icon: "checkmark.circle.fill",
  concepts: ["state", "binding", "spring"],
  anatomy: [
    { part: "Items", props: ["labels", "icons"] },
    { part: "Look", props: ["palette", "tint", "size"] },
    { part: "Selection", props: ["selected"] },
  ],
  interactions: ["tap", "toggle", "spring", "haptic"],
  variants: [
    { id: "rest", label: "Rest", props: { labels: "rested, restless, short night, early night", icons: "bed.double, moon, alarm, sun.max", selected: "0" } },
    { id: "people", label: "People", props: { labels: "home, a call, a walk, a meal out", icons: "house, phone, figure.walk, fork.knife", selected: "" } },
  ],
  states: [
    { id: "none", label: "None on", props: { selected: "" } },
    { id: "two", label: "Two on", props: { selected: "0, 2" } },
  ],
  properties: [
    text("labels", "Labels", "rested, restless, short night, early night"),
    text("icons", "Icons", "bed.double, moon, alarm, sun.max", { hint: "One symbol per label, in the same order." }),
    text("selected", "Start on", "0", { group: "state", hint: "Positions that start on, from 0, like 0, 2." }),
    select("palette", "Colour", "tint", opts(["tint", "Tint colour"], ["signal", "Signal"], ["ember", "Ember"], ["blush", "Blush"], ["azure", "Azure"])),
    color("tint", "Tint", "accent", { when: { prop: "palette", equals: ["tint"] } }),
    number("size", "Button size", 46, 32, 72),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("WellbeingEntrance", ENTRANCE);
      ctx.declare("WellbeingPressStyle", PRESS_STYLE);
      ctx.declare("IconToggles", VIEW);
      const items = toggleItems(p);
      const on = startsOn(p).filter((i) => i < items.length).map((i) => ctx.str(items[i].label));
      const name = ctx.state("activities", "Set<String>", `[${on.join(", ")}]`);
      return {
        lines: call("IconToggles", [
          ["items", `[${items.map((it) => `(${ctx.str(it.label)}, ${ctx.str(ctx.symbol(it.icon))})`).join(", ")}]`],
          ["selection", `$${name}`],
          sweepHex(p) ? ["tint", swiftHex(sweepHex(p)!)] : s(p, "tint") !== "accent" && ["tint", ctx.color(s(p, "tint"))],
          n(p, "size") !== 46 && ["size", num(n(p, "size"))],
        ]),
      };
    },
  },
};
