// Glow Number: one big figure in the middle of a soft glowing orb, with a symbol above it and a
// comparison under it ("Ahead of your usual day"). The figure counts up when it appears and
// again when tapped (a light tap). In light appearance the Swift Pieces halos turn pale-centred.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { icon, number, opts, select, text } from "../shared.js";
import { swiftHex } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

/** Orb palettes: centre, middle, rim (as hex), and the ink the figure is drawn in. The Swift Pieces
 *  halos also carry a light-appearance pair (a pale centre so the figure reads in dark ink). */
export const ORBS: Record<string, { stops: [string, string, string]; ink: string; light?: { stops: [string, string, string]; ink: string } }> = {
  // Swift Pieces halos: a dark centre that glows out to a sweep colour at the rim, white figure.
  signal: { stops: ["#16080A", "#7A1208", "#FF3A1A"], ink: "#FFFFFF", light: { stops: ["#FFF6F3", "#FFC2B5", "#FF4A2A"], ink: "#141414" } },
  azure: { stops: ["#080B16", "#1B3778", "#4D8DFF"], ink: "#FFFFFF", light: { stops: ["#F4F7FF", "#BCD3FF", "#4D8DFF"], ink: "#141414" } },
  blush: { stops: ["#150A10", "#6E2446", "#FF8FB8"], ink: "#FFFFFF", light: { stops: ["#FFF6F9", "#FFD0E1", "#FF8FB8"], ink: "#141414" } },
  sunrise: { stops: ["#FFC20E", "#F9A21B", "#E5503C"], ink: "#C8471B" },
  lagoon: { stops: ["#9BE7F2", "#4FB7E8", "#2E67C9"], ink: "#1E4F9E" },
  meadow: { stops: ["#D8F57A", "#7ED67A", "#2FA36B"], ink: "#1F7A4C" },
  dusk: { stops: ["#F7B7E6", "#B28CF5", "#5B4FD6"], ink: "#43359E" },
};

/** The orb for an appearance: the light pair when there is one. */
export const orbFor = (palette: string, scheme: "light" | "dark") => {
  const o = ORBS[palette] ?? ORBS.signal;
  return scheme === "light" && o.light ? o.light : o;
};

const SWIFT = [
  "private struct GlowNumber: View {",
  "    let value: Int",
  "    var caption = \"\"",
  "    var symbol = \"figure.walk\"",
  "    var colors: [Color] = [.yellow, .orange, .red]",
  "    var ink: Color = .orange",
  "    var lightColors: [Color]? = nil",
  "    var lightInk: Color? = nil",
  "    var diameter: CGFloat = 300",
  "    var trend = 1",
  "    var design: Font.Design = .rounded",
  "    @State private var shown = 0",
  "    @State private var appeared = false",
  "    @State private var taps = 0",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @Environment(\\.colorScheme) private var scheme",
  "",
  "    private var light: Bool { scheme == .light && lightColors != nil }",
  "",
  "    var body: some View {",
  "        ZStack {",
  "            Circle()",
  "                .fill(RadialGradient(colors: light ? lightColors! : colors, center: .center, startRadius: 0, endRadius: diameter / 2))",
  "                .frame(width: diameter, height: diameter)",
  "                .blur(radius: 18)",
  "            VStack(spacing: 6) {",
  "                Image(systemName: symbol)",
  "                    .font(.system(size: 34, weight: .semibold))",
  "                Text(shown, format: .number)",
  "                    .font(.system(size: diameter * 0.21, weight: .heavy, design: design))",
  "                    .monospacedDigit()",
  "                    .contentTransition(.numericText(value: Double(shown)))",
  "                if !caption.isEmpty {",
  "                    Label(caption, systemImage: trend > 0 ? \"arrow.up.circle.fill\" : trend < 0 ? \"arrow.down.circle.fill\" : \"minus.circle.fill\")",
  "                        .font(.title3)",
  "                        .opacity(0.8)",
  "                }",
  "            }",
  "            .foregroundStyle(light ? lightInk ?? ink : ink)",
  "        }",
  "        .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "        .opacity(appeared ? 1 : 0)",
  "        .frame(maxWidth: .infinity)",
  "        .contentShape(.circle)",
  "        .onTapGesture { taps += 1; count() }",
  "        .onAppear {",
  "            withAnimation(.easeOut(duration: 0.3)) { appeared = true }",
  "            count()",
  "        }",
  "        .sensoryFeedback(.impact(weight: .light), trigger: taps)",
  "        .accessibilityElement(children: .combine)",
  "    }",
  "",
  "    private func count() {",
  "        if reduceMotion { shown = value; return }",
  "        shown = 0",
  "        withAnimation(.snappy(duration: 0.8)) { shown = value }",
  "    }",
  "}",
];

export const glowNumber: SwiftPieceDefinition = {
  id: "glow-number",
  name: "Glow Number",
  category: "pieces",
  description: "One big figure inside a soft glowing orb, with a symbol and a comparison. It counts up as it appears, and again when tapped.",
  availability: "free",
  preview: { component: "glow-number", chunk: "app-pieces" },
  icon: "sun.max",
  concepts: ["state", "animation"],
  anatomy: [
    { part: "Figure", props: ["value", "symbol"] },
    { part: "Comparison", props: ["caption", "trend"] },
    { part: "Orb", props: ["palette", "diameter"] },
  ],
  interactions: ["tap", "haptic"],
  variants: [
    { id: "signal", label: "Signal halo", props: { palette: "signal" } },
    { id: "azure", label: "Azure halo", props: { palette: "azure", symbol: "drop", value: 1850, caption: "On track for today" } },
    { id: "sunrise", label: "Sunrise", props: { palette: "sunrise", figure: "rounded" } },
    { id: "dusk", label: "Dusk", props: { palette: "dusk", symbol: "moon", value: 482, caption: "Below a usual night", trend: "down" } },
  ],
  states: [{ id: "small", label: "Small orb", props: { diameter: 220 } }],
  properties: [
    number("value", "Figure", 8436, 0, 9999999),
    text("caption", "Comparison", "Ahead of your usual day"),
    select("trend", "Trend", "up", opts(["up", "Up"], ["down", "Down"], ["flat", "Flat"])),
    icon("symbol", "Symbol", "figure.walk"),
    select("palette", "Orb", "signal", opts(["signal", "Signal halo"], ["azure", "Azure halo"], ["blush", "Blush halo"], ["sunrise", "Sunrise"], ["lagoon", "Lagoon"], ["meadow", "Meadow"], ["dusk", "Dusk"])),
    select("figure", "Figure type", "default", opts(["default", "System"], ["rounded", "Rounded"])),
    number("diameter", "Orb size", 300, 180, 360),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("GlowNumber", SWIFT);
      const orb = ORBS[s(p, "palette")] ?? ORBS.signal;
      const accentHalo = ctx.theme && orb === ORBS.signal ? "[Theme.accent.opacity(0.1), Theme.accent.opacity(0.5), Theme.accent]" : null;
      const trend = s(p, "trend") === "down" ? -1 : s(p, "trend") === "flat" ? 0 : 1;
      return {
        lines: call("GlowNumber", [
          ["value", String(Math.round(n(p, "value")))],
          s(p, "caption").trim() && ["caption", ctx.str(s(p, "caption").trim())],
          ["symbol", ctx.str(ctx.symbol(s(p, "symbol") || "figure.walk"))],
          // A themed app's signal halo is its accent, fading into the ground (as in the preview).
          ["colors", accentHalo ? accentHalo : `[${orb.stops.map((c) => swiftHex(c)).join(", ")}]`],
          ["ink", swiftHex(orb.ink)],
          orb.light && ["lightColors", accentHalo ? accentHalo : `[${orb.light.stops.map((c) => swiftHex(c)).join(", ")}]`],
          orb.light && ["lightInk", swiftHex(orb.light.ink)],
          n(p, "diameter") !== 300 && ["diameter", num(n(p, "diameter"))],
          trend !== 1 && ["trend", String(trend)],
          s(p, "figure") !== "rounded" && ["design", ".default"],
        ]),
      };
    },
  },
};
