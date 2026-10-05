// Breath Scene: a full-bleed breathing guide. A scene (rings, soft orbs, a bloom of petals, stacked
// pillows, a rising tide, drifting leaves, a wave over a ridge, swaying branches) swells as you breathe in and settles as you breathe out, with the
// phase named, an optional fill bar and a coach's note beside the SwiftPieces mascot. Tap to start or
// pause, drag to turn. The default palettes are the SwiftPieces sweep on the near-black ground.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, modifiers, num, str } from "../../core/swift.js";
import { bool, link, number, opts, select, tappable, text } from "../shared.js";
import { PRESS_STYLE } from "./wellbeing-shared.js";
import { swiftSignal } from "../../core/palette.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Scene colours: the ground, the main shapes, their highlight, and the ink for labels. */
export const BREATH_PALETTES: Record<string, { ground: string; ink: string; glow: string; label: string }> = {
  signal: { ground: "#1C1C1E", ink: "#FF0000", glow: "#FF8FB8", label: "#ffffff" },
  ember: { ground: "#1C1C1E", ink: "#FF7A3C", glow: "#FFD976", label: "#ffffff" },
  azure: { ground: "#1C1C1E", ink: "#4D8DFF", glow: "#9CC2FF", label: "#ffffff" },
  blush: { ground: "#1C1C1E", ink: "#FF8FB8", glow: "#FFE3EE", label: "#ffffff" },
  night: { ground: "#1C1C1E", ink: "#F4F3EF", glow: "#6E6D6A", label: "#ffffff" },
  violet: { ground: "#2c209f", ink: "#6a60ef", glow: "#d3d0ff", label: "#ffffff" },
  mint: { ground: "#72e0b2", ink: "#17a05c", glow: "#c3f7dc", label: "#ffffff" },
  cobalt: { ground: "#3a2de2", ink: "#2216a0", glow: "#a9a3ff", label: "#ffffff" },
  coral: { ground: "#4b35ee", ink: "#f4a386", glow: "#ffd9c9", label: "#ffffff" },
  mono: { ground: "#f2f2f3", ink: "#111111", glow: "#8e8e93", label: "#111111" },
};

/**
 * The SwiftPieces palettes follow the appearance: in dark they sit on the grouped surface
 * (secondarySystemBackground), in light on its light twin with dark labels. The coloured grounds
 * (violet, mint, cobalt, coral, mono) are scenes of their own and stay put.
 */
export const ADAPTIVE_PALETTES = new Set(["signal", "ember", "azure", "blush", "night"]);
const LIGHT: Record<string, Partial<{ ground: string; ink: string; glow: string; label: string }>> = {
  signal: { glow: "#FF8FB8" },
  ember: { glow: "#FFB36B" },
  azure: { glow: "#9CC2FF" },
  blush: { glow: "#FFC4DA" },
  night: { ink: "#1C1C1E", glow: "#8E8E93" },
};

/** A palette in an appearance. */
export function breathPalette(id: string, scheme: "dark" | "light") {
  const key = BREATH_PALETTES[id] ? id : "signal";
  const base = BREATH_PALETTES[key];
  if (scheme === "dark" || !ADAPTIVE_PALETTES.has(key)) return base;
  return { ...base, ground: "#F2F2F7", label: "#000000", ...LIGHT[key] };
}

/** The same repeatable 0..1 value the Swift writes, so both scatter leaves and streaks alike. */
export function scatter(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A point on the wave's cubic at `t` (0..1), in a w by h scene. */
export function wavePoint(t: number, w: number, h: number): { x: number; y: number } {
  const p0 = [w * 0.1, h * 0.5], p1 = [w * 0.58, h * 0.54], p2 = [w * 0.5, h * 0.2], p3 = [w * 0.98, h * 0.2];
  const u = 1 - t;
  const f = (k: number) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k];
  return { x: f(0), y: f(1) };
}

const rgb = (hex: string) => {
  const v = hex.replace("#", "");
  const sig = swiftSignal(v);
  if (sig) return sig;
  const c = (i: number) => num(Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000);
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
};

const VIEW = [
  "private struct BreathScene: View {",
  "    enum Scene { case rings, orbs, bloom, pillows, tide, leaves, wave, branches }",
  "    let scene: Scene",
  "    let ground: Color",
  "    let ink: Color",
  "    let glow: Color",
  "    var labelColor: Color = .white",
  "    /// The phase label inside the rings' disc; nil uses the ground colour.",
  "    var ringLabel: Color? = nil",
  "    var inhale = \"Breathe in\"",
  "    var exhale = \"Breathe out\"",
  "    var seconds: Double = 4",
  "    var hint = \"\"",
  "    var coach = \"\"",
  "    var showsBar = false",
  "    var showsPlay = true",
  "    /// Starts breathing as soon as it appears; a tap pauses and resumes.",
  "    var autoplay = true",
  "    /// Lifts the coach's note clear of anything laid over the scene's foot (a next button).",
  "    var coachLift: CGFloat = 0",
  "    /// Where controls laid over the scene's top end, so the phase label sits under them.",
  "    var chromeInset: CGFloat = 0",
  "    @State private var isPlaying = false",
  "    @State private var start = Date.now",
  "    @State private var angle = 0.0",
  "    @State private var dragBase = 0.0",
  "    /// After a flick the scene keeps turning, easing out from the release velocity (radians a second).",
  "    @State private var spinVelocity = 0.0",
  "    @State private var spinStart = Date.distantPast",
  "    @State private var spinning = false",
  "    @State private var appeared = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    private func noise(_ i: Int, _ seed: Double) -> Double {",
  "        let x = sin(Double(i) * 12.9898 + seed * 78.233) * 43758.5453",
  "        return x - x.rounded(.down)",
  "    }",
  "",
  "    private func wavePoint(_ t: Double, _ w: Double, _ h: Double) -> CGPoint {",
  "        let u = 1 - t",
  "        let a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t",
  "        let x = a * w * 0.1 + b * w * 0.58 + c * w * 0.5 + d * w * 0.98",
  "        let y = a * h * 0.5 + b * h * 0.54 + c * h * 0.2 + d * h * 0.2",
  "        return CGPoint(x: x, y: y)",
  "    }",
  "",
  "    var body: some View {",
  "        TimelineView(.animation(paused: !isPlaying && !spinning)) { timeline in",
  "            let t = isPlaying ? timeline.date.timeIntervalSince(start) : 0",
  "            let since = timeline.date.timeIntervalSince(spinStart)",
  "            let turn = spinning ? angle + spinVelocity * (1 - exp(-3 * since)) / 3 : angle",
  "            let cycle = t.truncatingRemainder(dividingBy: seconds * 2)",
  "            let inhaling = cycle < seconds",
  "            let progress = inhaling ? cycle / seconds : 1 - (cycle - seconds) / seconds",
  "            let breath = isPlaying && !reduceMotion ? (1 - cos(progress * .pi)) / 2 : 0.5",
  "            GeometryReader { proxy in",
  "                let size = proxy.size",
  "                ZStack {",
  "                    Canvas { context, size in draw(&context, size: size, breath: breath, angle: turn) }",
  "                        .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "                        .opacity(appeared ? 1 : 0)",
  "                    overlay(size: size, inhaling: inhaling, breath: breath)",
  "                }",
  "            }",
  "            .sensoryFeedback(inhaling ? .increase : .decrease, trigger: inhaling)",
  "        }",
  "        .contentShape(.rect)",
  "        .onTapGesture {",
  "            start = .now",
  "            withAnimation(.snappy) { isPlaying.toggle() }",
  "        }",
  "        .gesture(",
  "            DragGesture(minimumDistance: 8)",
  "                .onChanged { value in",
  "                    if spinning { settleSpin() }",
  "                    angle = dragBase + value.translation.width / 120",
  "                }",
  "                .onEnded { value in",
  "                    dragBase = angle",
  "                    guard !reduceMotion else { return }",
  "                    spinVelocity = value.velocity.width / 120",
  "                    spinStart = .now",
  "                    spinning = abs(spinVelocity) > 0.2",
  "                }",
  "        )",
  "        .task(id: spinStart) {",
  "            guard spinning else { return }",
  "            try? await Task.sleep(for: .seconds(1.6))",
  "            if !Task.isCancelled { settleSpin() }",
  "        }",
  "        .sensoryFeedback(.impact(weight: .light), trigger: isPlaying)",
  "        .sensoryFeedback(.selection, trigger: dragBase)",
  "        .onAppear {",
  "            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .timingCurve(0.22, 1, 0.36, 1, duration: 0.28)) { appeared = true }",
  "            if autoplay && !reduceMotion && !isPlaying {",
  "                start = .now",
  "                isPlaying = true",
  "            }",
  "        }",
  "        .accessibilityElement(children: .combine)",
  "        .accessibilityAddTraits(.isButton)",
  "        .accessibilityLabel(isPlaying ? \"Pause breathing\" : \"Start breathing\")",
  "    }",
  "",
  "    /// Folds the flick's remaining turn into the angle and stops the timeline.",
  "    private func settleSpin() {",
  "        angle += spinVelocity * (1 - exp(-3 * Date.now.timeIntervalSince(spinStart))) / 3",
  "        dragBase = angle",
  "        spinning = false",
  "    }",
  "",
  "    @ViewBuilder",
  "    private func overlay(size: CGSize, inhaling: Bool, breath: Double) -> some View {",
  "        let phase = inhaling ? inhale : exhale",
  "        ZStack {",
  "            switch scene {",
  "            case .rings:",
  "                Text(phase.uppercased())",
  "                    .font(.subheadline.weight(.bold))",
  "                    .tracking(4)",
  "                    .foregroundStyle(ringLabel ?? ground)",
  "            case .wave:",
  "                Text(phase).font(.headline).foregroundStyle(labelColor)",
  "                    .position(x: size.width / 2, y: size.height * 0.47)",
  "            case .bloom, .pillows:",
  "                if isPlaying {",
  "                    Text(phase).font(.headline).foregroundStyle(labelColor)",
  "                        .position(x: size.width / 2, y: max(size.height * 0.09, chromeInset + 28))",
  "                }",
  "            case .branches, .tide:",
  "                VStack(spacing: 10) {",
  "                    if showsBar {",
  "                        Capsule().fill(labelColor.opacity(0.3))",
  "                            .frame(width: size.width * 0.36, height: 8)",
  "                            .overlay(alignment: .leading) {",
  "                                Capsule().fill(labelColor).frame(width: size.width * 0.36 * (inhaling ? 0 : 1 - breath))",
  "                            }",
  "                    }",
  "                    Text(phase).font(.headline).foregroundStyle(labelColor)",
  "                }",
  "                .position(x: size.width / 2, y: max(size.height * 0.3, chromeInset + 56))",
  "            default:",
  "                if isPlaying {",
  "                    Text(phase).font(.headline).foregroundStyle(labelColor)",
  "                }",
  "            }",
  "            if !isPlaying && showsPlay && scene != .rings {",
  "                VStack(spacing: 18) {",
  "                    if !hint.isEmpty {",
  "                        Text(hint).font(.caption).foregroundStyle(labelColor.opacity(0.85))",
  "                    }",
  "                    Image(systemName: \"play.fill\")",
  "                        .font(.largeTitle)",
  "                        .foregroundStyle(ink)",
  "                        .frame(width: 88, height: 88)",
  "                        .background(.white.opacity(0.9), in: .circle)",
  "                        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)",
  "                }",
  "                .transition(.scale(scale: 0.95).combined(with: .opacity))",
  "            }",
  "            if !coach.isEmpty {",
  "                HStack(alignment: .top, spacing: 10) {",
  "                    Canvas { context, box in",
  "                        let s = box.width",
  "                        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x / 100 * s, y: y / 100 * s) }",
  "                        var blob = Path()",
  "                        blob.move(to: p(50, 6))",
  "                        blob.addCurve(to: p(92, 38), control1: p(70, 6), control2: p(88, 18))",
  "                        blob.addCurve(to: p(62, 93), control1: p(97, 60), control2: p(86, 86))",
  "                        blob.addCurve(to: p(7, 62), control1: p(38, 100), control2: p(10, 88))",
  "                        blob.addCurve(to: p(50, 6), control1: p(3, 34), control2: p(22, 6))",
  "                        context.fill(blob, with: .color(Color(red: 1, green: 0, blue: 0)))",
  "                        let ink = Color(red: 0.078, green: 0.078, blue: 0.078)",
  "                        for x in [40.0, 60.0] {",
  "                            context.fill(Path(ellipseIn: CGRect(x: p(x, 44).x - s * 0.045, y: p(x, 44).y - s * 0.045, width: s * 0.09, height: s * 0.09)), with: .color(ink))",
  "                        }",
  "                        var mouth = Path()",
  "                        mouth.move(to: p(42, 58))",
  "                        mouth.addQuadCurve(to: p(58, 58), control: p(50, 66))",
  "                        context.stroke(mouth, with: .color(ink), style: StrokeStyle(lineWidth: s * 0.035, lineCap: .round))",
  "                    }",
  "                    .frame(width: 38, height: 38)",
  "                    .accessibilityHidden(true)",
  "                    Text(coach)",
  "                        .font(.subheadline)",
  "                        .foregroundStyle(.primary)",
  "                        .padding(.horizontal, 16)",
  "                        .padding(.vertical, 12)",
  "                        .background(Color(.systemBackground).opacity(0.92), in: .rect(cornerRadius: 16))",
  "                        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Color.primary.opacity(0.12)) }",
  "                }",
  "                .frame(maxWidth: size.width * 0.82, alignment: .leading)",
  "                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)",
  "                .padding(20)",
  "                .padding(.bottom, coachLift)",
  "            }",
  "        }",
  "        .frame(width: size.width, height: size.height)",
  "    }",
  "",
  "    private func draw(_ context: inout GraphicsContext, size: CGSize, breath: Double, angle: Double) {",
  "        let w = size.width, h = size.height",
  "        let c = CGPoint(x: w / 2, y: h / 2)",
  "        context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(ground))",
  "        switch scene {",
  "        case .rings:",
  "            for k in 0..<9 {",
  "                let r = w * 0.5 * (0.42 + Double(k) * 0.075) * (0.9 + 0.1 * breath)",
  "                let ring = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))",
  "                context.stroke(ring, with: .color(ink.opacity(0.5 - Double(k) * 0.045)), lineWidth: 1)",
  "            }",
  "            let r = w * 0.5 * 0.33 * (0.86 + 0.14 * breath)",
  "            context.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(ink))",
  "        case .orbs:",
  "            for k in 0..<6 {",
  "                let a = Double(k) * 2.3 + angle",
  "                let d = w * (0.1 + Double(k) * 0.055)",
  "                let r = w * (0.24 - Double(k) * 0.02) * (0.82 + 0.25 * breath)",
  "                let p = CGPoint(x: c.x + cos(a) * d, y: c.y + sin(a) * d * 1.3)",
  "                let orb = Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2))",
  "                context.fill(orb, with: .radialGradient(Gradient(colors: [glow, ink]), center: CGPoint(x: p.x - r * 0.35, y: p.y - r * 0.4), startRadius: 0, endRadius: r * 1.5))",
  "            }",
  "        case .bloom:",
  "            // Petals open outward on the in-breath and fold back on the out; a drag turns the flower.",
  "            let length = w * (0.24 + 0.14 * breath)",
  "            for layer in 0..<2 {",
  "                for k in 0..<8 {",
  "                    var petal = context",
  "                    petal.translateBy(x: c.x, y: c.y)",
  "                    petal.rotate(by: .radians(Double(k) * .pi / 4 + (layer == 0 ? .pi / 8 : 0) + angle))",
  "                    let len = length * (layer == 0 ? 1.12 : 1)",
  "                    let shape = Path(ellipseIn: CGRect(x: -len * 0.27, y: -len, width: len * 0.54, height: len))",
  "                    if layer == 0 {",
  "                        petal.fill(shape, with: .color(glow.opacity(0.45)))",
  "                    } else {",
  "                        petal.fill(shape, with: .linearGradient(Gradient(colors: [ink, glow]), startPoint: .zero, endPoint: CGPoint(x: 0, y: -len)))",
  "                    }",
  "                }",
  "            }",
  "            let r = w * 0.07 * (0.9 + 0.2 * breath)",
  "            context.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(glow))",
  "        case .pillows:",
  "            // Three soft cushions, the widest at the bottom, that swell and part as the breath comes in.",
  "            let rise = 0.9 + 0.2 * breath",
  "            // Sized for a phone-shaped scene: a taller one (a whole-screen session) keeps the stack's proportions.",
  "            let hh = min(h, w * 1.45)",
  "            for (k, f) in [0.78, 0.62, 0.46].enumerated() {",
  "                let pw = w * f * rise, ph = hh * 0.16 * rise",
  "                let y = c.y + (1 - Double(k)) * hh * (0.14 + 0.06 * breath)",
  "                context.fill(Path(ellipseIn: CGRect(x: c.x - pw * 0.42, y: y + ph * 0.36, width: pw * 0.84, height: ph * 0.3)), with: .color(.black.opacity(0.18)))",
  "                let rect = CGRect(x: c.x - pw / 2, y: y - ph / 2, width: pw, height: ph)",
  "                let pillow = RoundedRectangle(cornerRadius: ph * 0.45, style: .continuous).path(in: rect)",
  "                context.fill(pillow, with: .linearGradient(Gradient(colors: [glow, ink]), startPoint: CGPoint(x: rect.midX, y: rect.minY), endPoint: CGPoint(x: rect.midX, y: rect.maxY)))",
  "            }",
  "        case .tide:",
  "            // Water rises with the in-breath and ebbs with the out; a drag rolls the waves.",
  "            let level = h * (0.78 - 0.42 * breath)",
  "            for k in 0..<3 {",
  "                let top = level + Double(k) * h * 0.07",
  "                var wave = Path()",
  "                wave.move(to: CGPoint(x: 0, y: h))",
  "                for i in 0...48 {",
  "                    let f = Double(i) / 48",
  "                    wave.addLine(to: CGPoint(x: w * f, y: top + sin(f * .pi * 2.5 + Double(k) * 1.4 + angle + breath * .pi) * h * 0.022))",
  "                }",
  "                wave.addLine(to: CGPoint(x: w, y: h))",
  "                wave.closeSubpath()",
  "                context.fill(wave, with: .color(k == 0 ? glow.opacity(0.55) : ink.opacity(0.55 + Double(k) * 0.2)))",
  "            }",
  "        case .leaves:",
  "            for k in 0..<110 {",
  "                let a = noise(k, 1) * .pi * 2 + angle",
  "                let d = noise(k, 2).squareRoot() * w * 0.66 * (0.7 + 0.4 * breath)",
  "                var leaf = context",
  "                leaf.translateBy(x: c.x + cos(a) * d, y: c.y + sin(a) * d * 1.5)",
  "                leaf.rotate(by: .radians(noise(k, 3) * .pi * 2 + angle))",
  "                let color = k % 3 == 0 ? glow : ink",
  "                let grow = noise(k, 8)",
  "                let leafRect = CGRect(x: -(8 + grow * 10), y: -(3 + grow * 3.5), width: (8 + grow * 10) * 2, height: (3 + grow * 3.5) * 2)",
  "                leaf.fill(Path(ellipseIn: leafRect), with: .color(color.opacity(0.45 + noise(k, 4) * 0.5)))",
  "            }",
  "        case .wave:",
  "            var ridge = Path()",
  "            ridge.move(to: CGPoint(x: 0, y: h * 0.62))",
  "            for (x, y) in [(0.18, 0.3), (0.3, 0.42), (0.46, 0.12), (0.62, 0.34), (0.8, 0.26), (1.0, 0.44)] {",
  "                ridge.addLine(to: CGPoint(x: w * x, y: h * y))",
  "            }",
  "            ridge.addLine(to: CGPoint(x: w, y: h))",
  "            ridge.addLine(to: CGPoint(x: 0, y: h))",
  "            context.fill(ridge, with: .color(ink.opacity(0.55)))",
  "            for k in 0..<140 {",
  "                let x = noise(k, 5) * w, y = noise(k, 6) * h",
  "                var streak = Path()",
  "                streak.move(to: CGPoint(x: x, y: y))",
  "                streak.addLine(to: CGPoint(x: x + 9, y: y - 4))",
  "                context.stroke(streak, with: .color(glow.opacity(0.35)), lineWidth: 1.5)",
  "            }",
  "            var curve = Path()",
  "            curve.move(to: CGPoint(x: w * 0.1, y: h * 0.5))",
  "            curve.addCurve(to: CGPoint(x: w * 0.98, y: h * 0.2), control1: CGPoint(x: w * 0.58, y: h * 0.54), control2: CGPoint(x: w * 0.5, y: h * 0.2))",
  "            context.stroke(curve, with: .color(glow.opacity(0.9)), style: StrokeStyle(lineWidth: 12, lineCap: .round))",
  "            let dot = wavePoint(breath, w, h)",
  "            context.fill(Path(ellipseIn: CGRect(x: dot.x - 13, y: dot.y - 13, width: 26, height: 26)), with: .color(labelColor))",
  "        case .branches:",
  "            for k in 0..<15 {",
  "                let col = Double(k % 3), row = Double(k / 3)",
  "                let base = CGPoint(x: w * (0.14 + col * 0.36 + (Int(row) % 2 == 1 ? 0.12 : 0)), y: h * (0.2 + row * 0.2))",
  "                let length = h * (0.1 + noise(k, 7) * 0.05)",
  "                var branch = context",
  "                branch.translateBy(x: base.x, y: base.y)",
  "                branch.rotate(by: .radians((breath - 0.5) * 0.3 + sin(angle + Double(k)) * 0.08))",
  "                var path = Path()",
  "                path.move(to: .zero)",
  "                path.addLine(to: CGPoint(x: 0, y: -length))",
  "                for (at, spread) in [(0.45, -0.6), (0.6, 0.55), (1.0, -0.35), (1.0, 0.35)] {",
  "                    let from = CGPoint(x: 0, y: -length * at)",
  "                    path.move(to: from)",
  "                    path.addLine(to: CGPoint(x: from.x + sin(spread) * length * 0.45, y: from.y - cos(spread) * length * 0.45))",
  "                }",
  "                branch.stroke(path, with: .color(ink), style: StrokeStyle(lineWidth: 3, lineCap: .round))",
  "            }",
  "        }",
  "    }",
  "}",
];

/** The darker of a palette's ground and ink: the words on the white next pill. */
export function pillInk(pal: { ground: string; ink: string }): string {
  const lum = (hex: string) => {
    const v = hex.replace("#", "");
    const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  return lum(pal.ground) < lum(pal.ink) ? pal.ground : pal.ink;
}

/** Where the controls laid over a scene's top end (the bar, then the round counter), or 0. */
export function chromeInset(p: Props): number {
  const bar = !!String(p.closeLink ?? "") || !!String(p.finish ?? "").trim() || p.likes === true;
  const rounds = Math.round(Number(p.rounds ?? 0)) > 0;
  if (!bar && !rounds) return 0;
  return (p.bleed === true ? 56 : 16) + (bar ? 44 : 0) + (rounds ? 12 + 34 : 0);
}

/** The scene's foot arched up in the middle, so the content under it curves into the scene. */
const FOOT = [
  "private struct BreathSceneFoot: Shape {",
  "    var depth: CGFloat",
  "",
  "    func path(in rect: CGRect) -> Path {",
  "        var path = Path()",
  "        path.move(to: .zero)",
  "        path.addLine(to: CGPoint(x: rect.maxX, y: 0))",
  "        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))",
  "        path.addQuadCurve(to: CGPoint(x: 0, y: rect.maxY), control: CGPoint(x: rect.midX, y: rect.maxY - depth * 2))",
  "        path.closeSubpath()",
  "        return path",
  "    }",
  "}",
];

export const breathScene: SwiftPieceDefinition = {
  id: "breath-scene",
  name: "Breath Scene",
  category: "pieces",
  description: "A full-screen breathing guide whose scene swells as you breathe in and settles as you breathe out.",
  availability: "free",
  preview: { component: "breath-scene", chunk: "app-pieces" },
  icon: "leaf",
  concepts: ["state", "animation", "gesture"],
  anatomy: [
    { part: "Scene", props: ["scene", "palette", "height", "radius"] },
    { part: "Phases", props: ["inhale", "exhale", "seconds"] },
    { part: "Guide", props: ["autoplay", "hint", "coach", "showsBar", "showsPlay"] },
    { part: "Session", props: ["closeLink", "finish", "finishLink", "likes", "rounds", "round", "next", "nextLink"] },
    { part: "Edges", props: ["bleed", "fillsScreen", "curve"] },
  ],
  interactions: ["tap", "drag", "haptic"],
  variants: [
    { id: "rings", label: "Rings", props: { scene: "rings", palette: "night", inhale: "In", exhale: "Out", coach: "", showsBar: false } },
    { id: "orbs", label: "Soft orbs", props: { scene: "orbs", palette: "signal", coach: "Nice and slow. Let the next one out a little longer." } },
    { id: "bloom", label: "Bloom", props: { scene: "bloom", palette: "coral", hint: "Drag to turn" } },
    { id: "pillows", label: "Pillows", props: { scene: "pillows", palette: "violet" } },
    { id: "tide", label: "Tide", props: { scene: "tide", palette: "cobalt", showsBar: true } },
    { id: "leaves", label: "Leaves", props: { scene: "leaves", palette: "ember", hint: "Drag to turn" } },
    { id: "wave", label: "Wave", props: { scene: "wave", palette: "azure" } },
    { id: "branches", label: "Branches", props: { scene: "branches", palette: "blush", showsBar: true } },
  ],
  states: [
    { id: "paused", label: "Paused", props: { showsPlay: true } },
    { id: "coached", label: "With a coach", props: { coach: "Stretch this exhale until the line runs out." } },
  ],
  properties: [
    select("scene", "Scene", "orbs", opts(["rings", "Rings"], ["orbs", "Soft orbs"], ["bloom", "Bloom"], ["pillows", "Pillows"], ["tide", "Tide"], ["leaves", "Leaves"], ["wave", "Wave over a ridge"], ["branches", "Branches"])),
    select("palette", "Colours", "signal", opts(["signal", "Signal"], ["ember", "Ember"], ["azure", "Azure"], ["blush", "Blush"], ["night", "Night"], ["violet", "Violet"], ["mint", "Mint"], ["cobalt", "Cobalt"], ["coral", "Coral on blue"], ["mono", "Black on white"])),
    text("inhale", "Breathe-in label", "Breathe in", { maxLength: 24 }),
    text("exhale", "Breathe-out label", "Breathe out", { maxLength: 24 }),
    number("seconds", "Seconds per breath", 4, 2, 10, 1, { group: "motion" }),
    text("hint", "Hint", "", { hint: "A short line over the play button, like Drag to turn." }),
    text("coach", "Coach says", "", { maxLength: 160, hint: "A note beside the mascot at the bottom; empty hides it." }),
    bool("showsBar", "Fill bar", false, { hint: "A bar that fills as you breathe out (tide and branches scenes)." }),
    bool("autoplay", "Plays on its own", true, { group: "motion", hint: "Starts breathing as soon as it appears; a tap pauses. Off waits for a tap." }),
    bool("showsPlay", "Play button while paused", true),
    number("height", "Height", 620, 280, 900, 10, { group: "layout" }),
    number("radius", "Corner radius", 0, 0, 48, 1, { group: "layout", hint: "0 runs the scene edge to edge." }),
    bool("bleed", "Up under the status bar", false, { group: "layout", hint: "For a scene that opens a screen with no padding: it runs to the top edge." }),
    bool("fillsScreen", "Fills the screen", false, { group: "layout", hint: "Grows to take a screen that doesn't scroll, down to the bottom edge; the height is then the least it takes." }),
    number("curve", "Arched foot", 0, 0, 48, 1, { group: "layout", hint: "How far the bottom edge arches up, for a screen whose content continues under the scene." }),
    link("closeLink", "Close button goes to", { hint: "An xmark at the top left. Empty hides it." }),
    text("finish", "Finish button", "", { maxLength: 16, hint: "A text button at the top right. Empty hides it." }),
    link("finishLink", "Finish goes to", { when: { prop: "finish", notEquals: [""] } }),
    bool("likes", "Favourite heart", false, { hint: "A heart at the top right you tap to keep the exercise (when there's no finish button)." }),
    number("rounds", "Rounds", 0, 0, 20, 1, { hint: "How many rounds the session has; 0 hides the counter." }),
    number("round", "This round", 1, 1, 20, 1, { when: { prop: "rounds", notEquals: [0] } }),
    text("next", "Next button", "", { maxLength: 28, hint: "A pill at the foot of the scene, like Next: Bloom. Empty hides it." }),
    link("nextLink", "Next goes to", { when: { prop: "next", notEquals: [""] } }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("BreathScene", VIEW);
      const id = BREATH_PALETTES[s(p, "palette")] ? s(p, "palette") : "signal";
      const pal = BREATH_PALETTES[id];
      const adaptive = ADAPTIVE_PALETTES.has(id);
      const light = breathPalette(id, "light");
      // A light/dark pair, so the exported scene follows the appearance like the preview does.
      const pair = (dark: string, lite: string) => (dark === lite ? rgb(dark) : `Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(${rgb(dark)}) : UIColor(${rgb(lite)}) })`);
      const lines = call("BreathScene", [
        ["scene", `.${s(p, "scene") || "orbs"}`],
        ["ground", adaptive ? "Color(.secondarySystemBackground)" : rgb(pal.ground)],
        ["ink", adaptive ? pair(pal.ink, light.ink) : rgb(pal.ink)],
        ["glow", adaptive ? pair(pal.glow, light.glow) : rgb(pal.glow)],
        adaptive ? ["labelColor", ".primary"] : pal.label !== "#ffffff" && ["labelColor", rgb(pal.label)],
        adaptive && id !== "night" && ["ringLabel", ".white"],
        s(p, "inhale") !== "Breathe in" && ["inhale", ctx.str(s(p, "inhale"))],
        s(p, "exhale") !== "Breathe out" && ["exhale", ctx.str(s(p, "exhale"))],
        n(p, "seconds") !== 4 && ["seconds", num(n(p, "seconds"))],
        s(p, "hint").trim() && ["hint", ctx.str(s(p, "hint").trim())],
        s(p, "coach").trim() && ["coach", ctx.str(s(p, "coach").trim())],
        b(p, "showsBar") && ["showsBar", "true"],
        !b(p, "showsPlay") && ["showsPlay", "false"],
        p.autoplay === false && ["autoplay", "false"],
        s(p, "next").trim() && ["coachLift", num((p.fillsScreen === true ? 44 : 28) + Math.max(0, n(p, "curve")) + 72 - 20)],
        chromeInset(p) > 0 && ["chromeInset", num(chromeInset(p))],
      ]);
      const fills = p.fillsScreen === true;
      lines.push(fills ? `.frame(minHeight: ${num(n(p, "height"))}, maxHeight: .infinity)` : `.frame(height: ${num(n(p, "height"))})`);
      const curve = Math.max(0, n(p, "curve"));
      if (curve > 0) {
        ctx.declare("BreathSceneFoot", FOOT);
        lines.push(`.clipShape(BreathSceneFoot(depth: ${num(curve)}))`);
      } else if (n(p, "radius") > 0) lines.push(`.clipShape(.rect(cornerRadius: ${num(n(p, "radius"))}))`);

      // The session's controls over the scene: frosted, in the label colour, pressing to 0.97.
      const ink = adaptive ? ".primary" : rgb(pal.label);
      const finish = s(p, "finish").trim();
      const closes = !!ctx.link(s(p, "closeLink"));
      const likes = p.likes === true && !finish;
      const rounds = Math.max(0, Math.round(n(p, "rounds")));
      const round = Math.min(rounds, Math.max(1, Math.round(n(p, "round") || 1)));
      const next = s(p, "next").trim();
      const pressed = (button: string[]) => modifiers(button, ["buttonStyle(WellbeingPressStyle())"]);
      if (closes || finish || likes || rounds > 0 || next) ctx.declare("WellbeingPressStyle", PRESS_STYLE);
      const bar: string[] = [];
      if (closes || finish || likes) {
        const close = closes
          ? pressed(tappable(ctx, p.closeLink, modifiers(['Image(systemName: "xmark")'], ["font(.body.weight(.semibold))", "frame(width: 44, height: 44)", "background(.black.opacity(0.18), in: .circle)"]), '"Close"'))
          : ["Color.clear.frame(width: 44, height: 44)"];
        let trailing: string[] = [];
        if (finish) {
          trailing = pressed(tappable(ctx, p.finishLink, modifiers([`Text(${str(finish)})`], ["font(.subheadline.weight(.semibold))", "padding(.horizontal, 18)", "frame(height: 44)", "background(.black.opacity(0.18), in: .capsule)"]), str(finish)));
        } else if (likes) {
          const liked = ctx.state("liked", "", "false");
          trailing = modifiers(call("Button", [["action", `{ ${liked}.toggle() }`]], modifiers([`Image(systemName: ${liked} ? "heart.fill" : "heart")`], ["font(.title3)", `symbolEffect(.bounce, value: ${liked})`, "frame(width: 44, height: 44)", "background(.black.opacity(0.18), in: .circle)"])), [
            "buttonStyle(WellbeingPressStyle())",
            `sensoryFeedback(.impact(weight: .light), trigger: ${liked})`,
            `accessibilityLabel(${liked} ? "Remove from favourites" : "Add to favourites")`,
          ]);
        }
        bar.push(...call("HStack", [], [...close, "Spacer()", ...trailing]));
      }
      if (rounds > 0) {
        bar.push(...call("VStack", [["spacing", "8"]], [
          ...modifiers([`Text("Round ${round} of ${rounds}")`], ["font(.footnote.weight(.semibold))", "monospacedDigit()"]),
          ...modifiers([`ProgressView(value: ${round}, total: ${rounds})`], [`tint(${ink})`, "frame(width: 120)"]),
        ]));
      }
      if (bar.length) {
        lines.push(
          ".overlay(alignment: .top) {",
          ...indent(modifiers(call("VStack", [["spacing", "12"]], bar), [`foregroundStyle(${ink})`, "padding(.horizontal, 20)", `padding(.top, ${p.bleed === true ? 56 : 16})`])),
          "}",
        );
      }
      if (next) {
        const label = modifiers(call("HStack", [["spacing", "6"]], [`Text(${str(next)})`, 'Image(systemName: "arrow.right")']), [
          "font(.headline)",
          `foregroundStyle(${adaptive ? ".black" : rgb(pillInk(pal))})`,
          "padding(.horizontal, 24)",
          "frame(height: 52)",
          "background(.white.opacity(0.92), in: .capsule)",
          "shadow(color: .black.opacity(0.18), radius: 12, y: 8)",
        ]);
        lines.push(".overlay(alignment: .bottom) {", ...indent(modifiers(pressed(tappable(ctx, p.nextLink, label, str(next))), [`padding(.bottom, ${num((fills ? 44 : 28) + curve)})`])), "}");
      }
      // Up under the status bar, for a scene that opens a screen; down past the home indicator when it fills it.
      if (p.bleed === true || fills) lines.push(`.ignoresSafeArea(edges: ${p.bleed === true && fills ? "[.top, .bottom]" : fills ? ".bottom" : ".top"})`);
      return { lines };
    },
  },
};
