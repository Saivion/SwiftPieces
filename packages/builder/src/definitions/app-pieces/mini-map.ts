// Mini Map: a small stylised street map (blocks, a main road, a side street, a park) in a rounded
// frame with a signal-red location dot and a labelled place. Drag to look around; it springs back
// to the dot when you let go. Tap the dot to make it pulse. Drawn, so it needs no map service. The
// ink map follows the appearance (the day map in light mode); night and day stay as they are.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, num } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";
import { swiftSignal } from "../../core/palette.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

export const MAP_STYLES: Record<string, { ground: string; block: string; road: string; park: string; water: string; label: string }> = {
  ink: { ground: "#18181B", block: "#222226", road: "#0B0B0D", park: "#1F2A24", water: "#16233D", label: "#FF7A3C" },
  night: { ground: "#4A4E72", block: "#5A5D86", road: "#35384F", park: "#4E6A70", water: "#4C6B94", label: "#F2A23C" },
  day: { ground: "#EEF0E8", block: "#E1E3DA", road: "#FFFFFF", park: "#CFE6C4", water: "#AFD3F2", label: "#D9731F" },
};

const SWIFT = [
  "private struct MiniMap: View {",
  "    var place = \"\"",
  "    var ground: Color = .indigo",
  "    var block: Color = .purple",
  "    var road: Color = .gray",
  "    var park: Color = .green",
  "    var water: Color = .blue",
  "    var label: Color = .orange",
  "    /// Follows the appearance: these colours in dark mode, the day map in light mode.",
  "    var adaptive = false",
  "    var height: CGFloat = 150",
  "    @State private var pan: CGSize = .zero",
  "    @State private var pulses = 0",
  "    @State private var pulse = false",
  "    @State private var shown = false",
  "    @Environment(\\.colorScheme) private var scheme",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    private var day: Bool { adaptive && scheme == .light }",
  "    private func rgb(_ r: Double, _ g: Double, _ b: Double) -> Color { Color(red: r / 255, green: g / 255, blue: b / 255) }",
  "",
  "    var body: some View {",
  "        let c = day",
  "            ? (ground: rgb(238, 240, 232), block: rgb(225, 227, 218), road: Color.white, park: rgb(207, 230, 196), water: rgb(175, 211, 242), label: rgb(217, 115, 31))",
  "            : (ground: ground, block: block, road: road, park: park, water: water, label: label)",
  "        ZStack {",
  "            Canvas { ctx, size in",
  "                let w = size.width, h = size.height",
  "                ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(c.ground))",
  "                for i in 0..<6 {",
  "                    let r = CGRect(x: Double(i) * w / 5 - 20, y: h * 0.05, width: w / 6, height: h * 0.3)",
  "                    ctx.fill(Path(roundedRect: r, cornerRadius: 6), with: .color(c.block))",
  "                    ctx.fill(Path(roundedRect: r.offsetBy(dx: 18, dy: h * 0.62), cornerRadius: 6), with: .color(c.block))",
  "                }",
  "                ctx.fill(Path(roundedRect: CGRect(x: w * 0.62, y: h * 0.3, width: w * 0.2, height: h * 0.7), cornerRadius: 8), with: .color(c.water))",
  "                ctx.fill(Path(ellipseIn: CGRect(x: w * 0.08, y: h * 0.45, width: w * 0.22, height: h * 0.3)), with: .color(c.park))",
  "                var main = Path()",
  "                main.move(to: CGPoint(x: -20, y: h * 0.95))",
  "                main.addQuadCurve(to: CGPoint(x: w + 20, y: h * 0.15), control: CGPoint(x: w * 0.45, y: h * 0.35))",
  "                ctx.stroke(main, with: .color(c.road), lineWidth: 16)",
  "                var side = Path()",
  "                side.move(to: CGPoint(x: w * 0.55, y: -10))",
  "                side.addLine(to: CGPoint(x: w * 0.5, y: h + 10))",
  "                ctx.stroke(side, with: .color(c.road), lineWidth: 9)",
  "            }",
  "            .offset(pan)",
  "            Circle().fill(Color(red: 1, green: 0, blue: 0).opacity(0.3)).frame(width: 44, height: 44)",
  "                .scaleEffect(pulse ? 1.8 : 1).opacity(pulse ? 0 : 1)",
  "            Button {",
  "                pulses += 1",
  "                pulse = false",
  "                withAnimation(.easeOut(duration: 0.8)) { pulse = true }",
  "            } label: {",
  "                Circle().fill(Color(red: 1, green: 0, blue: 0))",
  "                    .overlay(Circle().strokeBorder(.white, lineWidth: 3))",
  "                    .frame(width: 22, height: 22)",
  "                    .shadow(color: .black.opacity(0.25), radius: 3, y: 1)",
  "                    .frame(width: 44, height: 44)",
  "                    .contentShape(.circle)",
  "            }",
  "            .buttonStyle(MiniMapDotPress())",
  "            if !place.isEmpty {",
  "                Label(place, systemImage: \"fork.knife.circle.fill\")",
  "                    .font(.subheadline.weight(.bold))",
  "                    .foregroundStyle(c.label)",
  "                    .offset(x: 40 + pan.width, y: 34 + pan.height)",
  "            }",
  "        }",
  "        .frame(height: height)",
  "        .frame(maxWidth: .infinity)",
  "        .clipShape(.rect(cornerRadius: 24, style: .continuous))",
  "        .opacity(shown ? 1 : 0)",
  "        .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "        .gesture(",
  "            DragGesture()",
  "                .onChanged { g in pan = CGSize(width: g.translation.width * 0.6, height: g.translation.height * 0.6) }",
  "                .onEnded { _ in withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .bouncy) { pan = .zero } }",
  "        )",
  "        .sensoryFeedback(.impact(weight: .light), trigger: pulses)",
  "        .onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "    }",
  "}",
  "",
  "private struct MiniMapDotPress: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.9 : 1)",
  "            .animation(.easeOut(duration: configuration.isPressed ? 0.1 : 0.2), value: configuration.isPressed)",
  "    }",
  "}",
];

export const miniMap: SwiftPieceDefinition = {
  id: "mini-map",
  name: "Mini Map",
  category: "pieces",
  description: "A small drawn street map in a rounded frame with a location dot and a labelled place. Drag to look around and it springs back; tap the dot to pulse it.",
  availability: "free",
  preview: { component: "mini-map", chunk: "app-pieces" },
  icon: "map",
  concepts: ["state", "gesture", "view"],
  anatomy: [
    { part: "Map", props: ["style", "height"] },
    { part: "Place", props: ["place"] },
  ],
  interactions: ["drag", "tap", "spring", "haptic"],
  variants: [
    { id: "ink", label: "Ink", props: { style: "ink" } },
    { id: "night", label: "Night", props: { style: "night" } },
    { id: "day", label: "Day", props: { style: "day" } },
  ],
  states: [{ id: "tall", label: "Tall", props: { height: 220 } }],
  properties: [
    text("place", "Place", "Corner café"),
    select("style", "Style", "ink", opts(["ink", "Theme (ink in dark, day in light)"], ["night", "Night"], ["day", "Day"])),
    number("height", "Height", 150, 100, 300),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("MiniMap", SWIFT);
      const st = MAP_STYLES[s(p, "style")] ?? MAP_STYLES.ink;
      const hex = (h: string) => {
        const v = h.replace("#", "");
        const sig = swiftSignal(v);
        if (sig) return sig;
        const c = [0, 2, 4].map((i) => num(parseInt(v.slice(i, i + 2), 16) / 255));
        return `Color(red: ${c[0]}, green: ${c[1]}, blue: ${c[2]})`;
      };
      return {
        lines: call("MiniMap", [
          s(p, "place").trim() && ["place", ctx.str(s(p, "place").trim())],
          ["ground", hex(st.ground)],
          ["block", hex(st.block)],
          ["road", hex(st.road)],
          ["park", hex(st.park)],
          ["water", hex(st.water)],
          ["label", hex(st.label)],
          (s(p, "style") || "ink") === "ink" && ["adaptive", "true"],
          n(p, "height") !== 150 && ["height", num(n(p, "height"))],
        ]),
      };
    },
  },
};
