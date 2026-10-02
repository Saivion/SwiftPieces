// Moment List: the named moments of a day with their times, grouped in cards (dawn and sunrise;
// solar noon; soft evening light and sunset), each with a small label over a large time
// and a symbol for the moment. Tap a moment to set a reminder for it; the bell springs in, in the
// accent. Two layouts: cards, or a rail where each moment is a dot in its own house colour on a line.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call } from "../../core/swift.js";
import { opts, select } from "../shared.js";
import { data, records, swiftHex } from "./data-kit.js";
import { own } from "../../core/own.js";

const s = (p: Props, k: string) => String(p[k] ?? "");

/** Moment kinds: their SF Symbol, whether they take the warm tint, and their dot on the rail (data
 *  colours from the sweep and the house blocks; signal red stays the accent). */
export const MOMENT_KINDS: Record<string, { symbol: string; warm: boolean; dot: string }> = {
  dawn: { symbol: "sun.haze", warm: false, dot: "#4D8DFF" },
  blue: { symbol: "sun.horizon", warm: false, dot: "#9CC2FF" },
  sunrise: { symbol: "sunrise", warm: false, dot: "#FF8FB8" },
  golden: { symbol: "sun.max", warm: true, dot: "#FF7A3C" },
  noon: { symbol: "sun.max.fill", warm: true, dot: "#FFD976" },
  sunset: { symbol: "sunset", warm: false, dot: "#FF8FB8" },
  dusk: { symbol: "moon.stars", warm: false, dot: "#CDB8FF" },
};
/** Warm accents: the sweep, and the older system yellows. */
export const MOMENT_WARM: Record<string, { hex: string; swift: string }> = {
  ember: { hex: "#FF7A3C", swift: swiftHex("#FF7A3C") },
  signal: { hex: "#FF0000", swift: swiftHex("#FF0000") },
  blush: { hex: "#FF8FB8", swift: swiftHex("#FF8FB8") },
  azure: { hex: "#4D8DFF", swift: swiftHex("#4D8DFF") },
  yellow: { hex: "#FFD60A", swift: ".yellow" },
  orange: { hex: "#FF9F0A", swift: ".orange" },
  pink: { hex: "#FF375F", swift: ".pink" },
};

export type Moment = { label: string; value: string; kind: string };
/** "Label | value | kind; …" with "-" starting a new card. */
export function momentGroups(value: unknown): Moment[][] {
  const groups: Moment[][] = [[]];
  for (const r of records(value, 24)) {
    if (r[0] === "-" || r[0] === "") {
      if (groups[groups.length - 1].length) groups.push([]);
      continue;
    }
    groups[groups.length - 1].push({ label: r[0], value: r[1] ?? "", kind: own(MOMENT_KINDS, r[2]) ? r[2] : "golden" });
  }
  return groups.filter((g) => g.length);
}

export const DEFAULT_MOMENTS =
  "Dawn | 6:58 AM | dawn; Sunrise | 7:24 AM | sunrise; Soft light | 7:24 → 8:10 AM | golden; -; Solar noon | 1:22 PM | noon; -; Soft light | 6:35 → 7:21 PM | golden; Sunset | 7:21 PM | sunset; Last light | 7:47 PM | dusk";

const VIEW = [
  "private struct MomentItem: Identifiable {",
  "    let id = UUID()",
  "    let label: String",
  "    let value: String",
  "    let symbol: String",
  "    var warm = false",
  "    var tint: Color = .gray",
  "}",
  "",
  "private struct MomentList: View {",
  "    let groups: [[MomentItem]]",
  "    var warm: Color = .yellow",
  "    /// Moments as dots on a line instead of rows in cards.",
  "    var rail = false",
  "    @State private var reminders: Set<UUID> = []",
  "    @State private var appeared = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    var body: some View {",
  "        VStack(spacing: 16) {",
  "            ForEach(groups.indices, id: \\.self) { g in",
  "                VStack(spacing: 0) {",
  "                    ForEach(Array(groups[g].enumerated()), id: \\.element.id) { index, item in",
  "                        if index > 0 && !rail { Divider().padding(.leading, 16) }",
  "                        row(item, first: index == 0, last: index == groups[g].count - 1)",
  "                    }",
  "                }",
  "                .background(rail ? AnyShapeStyle(Color.clear) : AnyShapeStyle(.fill.tertiary), in: RoundedRectangle(cornerRadius: 16, style: .continuous))",
  "                .clipShape(RoundedRectangle(cornerRadius: rail ? 0 : 16, style: .continuous))",
  "                // Entrance, once: each group settles in from 0.95 with a fade, 40 ms after the one before.",
  "                .opacity(appeared ? 1 : 0)",
  "                .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "                .animation(.easeOut(duration: reduceMotion ? 0.2 : 0.28).delay(reduceMotion ? 0 : Double(min(g, 7)) * 0.04), value: appeared)",
  "            }",
  "        }",
  "        // A success when a reminder is set, a light tap when one is cleared.",
  "        .sensoryFeedback(trigger: reminders.count) { old, new in new > old ? .success : .impact(weight: .light) }",
  "        .onAppear { appeared = true }",
  "    }",
  "",
  "    private func row(_ item: MomentItem, first: Bool, last: Bool) -> some View {",
  "        let on = reminders.contains(item.id)",
  "        return Button {",
  "            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.3, bounce: 0.3)) {",
  "                if on { reminders.remove(item.id) } else { reminders.insert(item.id) }",
  "            }",
  "        } label: {",
  "            HStack(spacing: rail ? 12 : 8) {",
  "                if rail {",
  "                    VStack(spacing: 0) {",
  "                        Rectangle().fill(first ? Color.clear : Color.primary.opacity(0.15)).frame(width: 2)",
  "                        Circle().fill(item.tint).frame(width: 12, height: 12)",
  "                            .overlay(Circle().strokeBorder(Color.primary.opacity(0.12), lineWidth: 0.5))",
  "                        Rectangle().fill(last ? Color.clear : Color.primary.opacity(0.15)).frame(width: 2)",
  "                    }",
  "                    .frame(width: 20)",
  "                }",
  "                VStack(alignment: .leading, spacing: 2) {",
  "                    Text(item.label).font(.subheadline).foregroundStyle(.secondary)",
  "                    Text(item.value).font(.title3.weight(.semibold)).monospacedDigit()",
  "                }",
  "                .padding(.vertical, 12)",
  "                Spacer()",
  "                if on {",
  "                    Image(systemName: \"bell.fill\").foregroundStyle(Color.accentColor).transition(.scale(scale: 0.5).combined(with: .opacity))",
  "                }",
  "                Image(systemName: item.symbol)",
  "                    .font(.title3)",
  "                    .foregroundStyle(item.warm ? AnyShapeStyle(warm) : AnyShapeStyle(.secondary))",
  "                    .frame(width: 32)",
  "            }",
  "            .fixedSize(horizontal: false, vertical: true)",
  "            .padding(.horizontal, rail ? 0 : 16)",
  "            .contentShape(Rectangle())",
  "        }",
  "        .buttonStyle(MomentPress(rail: rail))",
  "        .accessibilityHint(on ? \"Reminder on\" : \"Tap to be reminded\")",
  "    }",
  "}",
  "",
  "/// Press feedback for a moment: a highlight behind the row (not a scale), under 150 ms.",
  "private struct MomentPress: ButtonStyle {",
  "    var rail: Bool",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .background {",
  "                if configuration.isPressed {",
  "                    RoundedRectangle(cornerRadius: rail ? 12 : 0, style: .continuous).fill(Color.primary.opacity(0.06)).padding(.horizontal, rail ? -8 : 0)",
  "                }",
  "            }",
  "            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)",
  "    }",
  "}",
];


/** The Lists style a cards layout takes (set by `listStyle`), or null as built. */
function listMode(p: Props): "cards" | "grouped" | "plain" | null {
  return p.listed === "cards" || p.listed === "grouped" || p.listed === "plain" ? p.listed : null;
}

/** The Swift for a styled list: the theme's card behind each group (8 apart as separate cards), or none. */
function listVariant(mode: "cards" | "grouped" | "plain"): string[] {
  const out: string[] = [];
  for (const line of VIEW) {
    if (line.includes(".background(rail ? AnyShapeStyle(Color.clear)")) {
      if (mode !== "plain") out.push("                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))");
    } else if (line.includes(".clipShape(RoundedRectangle(cornerRadius: rail ? 0 : 16")) {
      if (mode !== "plain") out.push("                .themeCard(cornerRadius: 16)");
    } else if (mode === "cards" && line === "        VStack(spacing: 16) {") {
      out.push("        VStack(spacing: 8) {");
    } else if (mode === "plain") {
      out.push(line.replace("Divider().padding(.leading, 16)", "Divider()").replace(".padding(.horizontal, rail ? 0 : 16)", ".padding(.horizontal, 0)"));
    } else {
      out.push(line);
    }
  }
  return out;
}

export const momentList: SwiftPieceDefinition = {
  id: "moment-list",
  name: "Moment List",
  category: "pieces",
  description: "The named moments of a day with their times, grouped in cards. Tap one to set a reminder.",
  availability: "free",
  preview: { component: "moment-list", chunk: "app-pieces" },
  icon: "sun.max",
  concepts: ["state", "foreach"],
  anatomy: [
    { part: "Moments", props: ["items"] },
    { part: "Accent", props: ["warm", "layout"] },
  ],
  interactions: ["tap", "toggle", "press", "haptic"],
  variants: [
    { id: "rail", label: "A day on a rail", props: { items: DEFAULT_MOMENTS, warm: "ember", layout: "rail" } },
    { id: "day", label: "A day in cards", props: { items: DEFAULT_MOMENTS, warm: "ember", layout: "cards" } },
    { id: "evening", label: "Evening only", props: { items: "Soft light | 6:35 → 7:21 PM | golden; Sunset | 7:21 PM | sunset; -; Last light | 7:47 PM | dusk", warm: "blush", layout: "cards" } },
  ],
  states: [{ id: "one", label: "One moment", props: { items: "Solar noon | 1:22 PM | noon" } }],
  properties: [
    data("items", "Moments", DEFAULT_MOMENTS, { hint: "label | time | kind (dawn, blue, sunrise, golden, noon, sunset, dusk), separated by semicolons; a lone - starts a new card." }),
    select("warm", "Warm accent", "ember", opts(["ember", "Ember"], ["signal", "Signal"], ["blush", "Blush"], ["azure", "Azure"], ["yellow", "Yellow"], ["orange", "Orange"], ["pink", "Pink"]), { group: "color" }),
    select("layout", "Layout", "rail", opts(["rail", "Rail"], ["cards", "Cards"]), { group: "layout" }),
  ],
  // With Style → Lists, the cards layout (a list of its own) follows it: the theme's cards,
  // one card per moment, or plain rows with hairlines. The rail stays as built.
  listStyle: (mode, p) => (p.layout === "cards" ? { listed: mode } : null),
  swift: {
    imports: [],
    emit(p, ctx) {
      const rail = s(p, "layout") !== "cards";
      const list = rail ? null : listMode(p);
      ctx.declare("MomentList", list ? listVariant(list) : VIEW);
      // Style → Lists "cards": every moment on its own card.
      const grouped = momentGroups(p.items);
      const groups = (list === "cards" ? grouped.flat().map((m) => [m]) : grouped).map(
        (g) => `[${g.map((m) => `MomentItem(label: ${ctx.str(m.label)}, value: ${ctx.str(m.value)}, symbol: ${ctx.str(MOMENT_KINDS[m.kind].symbol)}${MOMENT_KINDS[m.kind].warm ? ", warm: true" : ""}${rail ? `, tint: ${swiftHex(MOMENT_KINDS[m.kind].dot)}` : ""})`).join(", ")}]`,
      );
      return {
        lines: call("MomentList", [
          ["groups", `[${groups.join(", ")}]`],
          s(p, "warm") !== "yellow" && ["warm", (MOMENT_WARM[s(p, "warm")] ?? MOMENT_WARM.ember).swift],
          rail && ["rail", "true"],
        ]),
      };
    },
  },
};
