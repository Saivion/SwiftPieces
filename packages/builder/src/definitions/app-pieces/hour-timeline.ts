// Hour Timeline: a day's schedule as hour slots down the screen, times on the left, each free hour
// a dim rounded cell and each event a raised card spanning its hours with a coloured capsule, in
// light and dark.
// Tap a free hour to pencil in a new event there (tap it again to clear it). An optional now line
// in signal red marks the current time.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number } from "../shared.js";
import { data, records, swiftNums, swiftStrs, swiftTint } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

/** "Lunch | 12 | 14 | pink; …" → blocks (hours on a 24-hour clock, halves allowed). */
export const timelineEvents = (value: unknown) =>
  records(value, 8).map(([title = "", from = "12", to = "13", color = "blue"]) => ({ title, from: Number(from) || 0, to: Number(to) || 0, color })).filter((e) => e.to > e.from);

export const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 || h === 24 ? "AM" : "PM"}`;

const SWIFT = [
  "private struct HourTimeline: View {",
  "    var start = 10",
  "    var end = 17",
  "    var titles: [String] = []",
  "    var from: [Double] = []",
  "    var to: [Double] = []",
  "    var colors: [Color] = []",
  "    var hourHeight: CGFloat = 64",
  "    var now: Double = 0",
  "    @State private var pencilled: Set<Int> = []",
  "    @Environment(\\.colorScheme) private var scheme",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "",
  "    var body: some View {",
  "        HStack(alignment: .top, spacing: 12) {",
  "            VStack(alignment: .trailing, spacing: 0) {",
  "                ForEach(start..<end, id: \\.self) { h in",
  "                    Text(label(h)).font(.footnote.weight(.medium)).monospacedDigit().foregroundStyle(.secondary).frame(height: hourHeight, alignment: .top)",
  "                }",
  "            }",
  "            .frame(width: 52, alignment: .trailing)",
  "            .offset(y: -8)",
  "            ZStack(alignment: .topLeading) {",
  "                VStack(spacing: 4) {",
  "                    ForEach(start..<end, id: \\.self) { h in",
  "                        Button {",
  "                            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .snappy(duration: 0.3)) {",
  "                                if pencilled.contains(h) { pencilled.remove(h) } else { pencilled.insert(h) }",
  "                            }",
  "                        } label: {",
  "                            RoundedRectangle(cornerRadius: 16, style: .continuous)",
  "                                .fill(Color.primary.opacity(scheme == .dark ? 0.05 : 0.04))",
  "                                .frame(height: hourHeight - 4)",
  "                                .overlay(alignment: .topLeading) {",
  "                                    if pencilled.contains(h) {",
  "                                        Label(\"New event\", systemImage: \"plus\")",
  "                                            .font(.body)",
  "                                            .foregroundStyle(.primary)",
  "                                            .padding(16)",
  "                                            .transition(reduceMotion ? .opacity : .scale(scale: 0.95, anchor: .topLeading).combined(with: .opacity))",
  "                                    }",
  "                                }",
  "                        }",
  "                        .buttonStyle(HourSlotPress())",
  "                    }",
  "                }",
  "                ForEach(titles.indices, id: \\.self) { i in",
  "                    HStack(alignment: .top, spacing: 12) {",
  "                        Capsule().fill(colors[i % max(colors.count, 1)]).frame(width: 8)",
  "                        Text(titles[i]).font(.headline).lineLimit(2)",
  "                        Spacer(minLength: 0)",
  "                    }",
  "                    .padding(16)",
  "                    .frame(height: hourHeight * (to[i] - from[i]) - 4, alignment: .top)",
  "                    .background(scheme == .dark ? Color(red: 0.11, green: 0.11, blue: 0.122) : .white, in: .rect(cornerRadius: 16, style: .continuous))",
  "                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.primary.opacity(scheme == .dark ? 0.08 : 0.06)))",
  "                    .shadow(color: .black.opacity(scheme == .dark ? 0.35 : 0.06), radius: 8, y: 4)",
  "                    .offset(y: hourHeight * (from[i] - Double(start)))",
  "                    .allowsHitTesting(false)",
  "                    .scaleEffect(shown || reduceMotion ? 1 : 0.95, anchor: .top)",
  "                    .opacity(shown ? 1 : 0)",
  "                    .animation(.easeOut(duration: reduceMotion ? 0.2 : 0.28).delay(Double(min(i, 7)) * 0.04), value: shown)",
  "                }",
  "                if now > Double(start) && now < Double(end) {",
  "                    HStack(spacing: 0) {",
  "                        Circle().fill(Color(red: 1, green: 0, blue: 0)).frame(width: 10, height: 10)",
  "                        Rectangle().fill(Color(red: 1, green: 0, blue: 0)).frame(height: 2)",
  "                    }",
  "                    .offset(x: -5, y: hourHeight * (now - Double(start)) - 5)",
  "                    .allowsHitTesting(false)",
  "                }",
  "            }",
  "        }",
  "        .padding(.top, 8)",
  "        .sensoryFeedback(.impact(weight: .light), trigger: pencilled)",
  "        .onAppear { shown = true }",
  "    }",
  "",
  "    private func label(_ h: Int) -> String {",
  "        \"\\((h + 11) % 12 + 1) \\(h < 12 ? \"AM\" : \"PM\")\"",
  "    }",
  "}",
  "",
  "/// A free hour under a finger: a quick highlight.",
  "private struct HourSlotPress: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .overlay { RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.primary.opacity(configuration.isPressed ? 0.06 : 0)) }",
  "            .animation(.easeOut(duration: configuration.isPressed ? 0.1 : 0.2), value: configuration.isPressed)",
  "    }",
  "}",
];

export const hourTimeline: SwiftPieceDefinition = {
  id: "hour-timeline",
  name: "Hour Timeline",
  category: "pieces",
  description: "A day as hour slots: times down the left, free hours as dim cells, events as raised blocks with a coloured capsule. Tap a free hour to pencil in an event.",
  availability: "free",
  preview: { component: "hour-timeline", chunk: "app-pieces" },
  icon: "clock",
  concepts: ["state", "zstack"],
  anatomy: [
    { part: "Hours", props: ["start", "end", "hourHeight"] },
    { part: "Events", props: ["events", "now"] },
  ],
  interactions: ["tap", "spring", "haptic"],
  variants: [
    { id: "afternoon", label: "Afternoon", props: {} },
    { id: "morning", label: "Morning", props: { start: 7, end: 12, events: "Run | 7 | 8 | ember; Stand-up | 9.5 | 10 | azure; Design review | 10 | 11.5 | blush", now: 9.2 } },
  ],
  states: [{ id: "compact", label: "Compact", props: { hourHeight: 48 } }],
  properties: [
    number("start", "First hour", 10, 0, 23),
    number("end", "Last hour", 17, 1, 24),
    data("events", "Events", "Studio visit | 12 | 13.5 | azure; Climbing | 15 | 16 | ember", { hint: "Title | from hour | to hour | colour, separated by semicolons. 13.5 is 1:30 PM." }),
    number("hourHeight", "Hour height", 64, 40, 100),
    number("now", "Now", 0, 0, 24, 0.25, { hint: "Draws a signal-red line at this hour. 0 hides it." }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      // In an app styled with cards, each event block is one of the app's cards.
      ctx.declare("HourTimeline", ctx.theme && ctx.theme.cards !== "flat"
        ? SWIFT.filter((l) => !l.includes(".shadow(color: .black.opacity(scheme == .dark ? 0.35 : 0.06)")).map((l) => (l.includes(".overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder") ? l.replace(/\.overlay\(.*$/, ".themeCard(cornerRadius: 16)") : l))
        : SWIFT);
      const ev = timelineEvents(s(p, "events"));
      const start = Math.round(n(p, "start"));
      const end = Math.max(start + 1, Math.round(n(p, "end")));
      return {
        lines: call("HourTimeline", [
          start !== 10 && ["start", String(start)],
          end !== 17 && ["end", String(end)],
          ev.length > 0 && ["titles", swiftStrs(ev.map((e) => e.title), ctx.str)],
          ev.length > 0 && ["from", swiftNums(ev.map((e) => e.from))],
          ev.length > 0 && ["to", swiftNums(ev.map((e) => e.to))],
          ev.length > 0 && ["colors", `[${ev.map((e) => swiftTint(e.color, "blue")).join(", ")}]`],
          n(p, "hourHeight") !== 64 && ["hourHeight", num(n(p, "hourHeight"))],
          n(p, "now") > 0 && ["now", num(n(p, "now"))],
        ]),
      };
    },
  },
};
