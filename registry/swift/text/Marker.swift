// swiftpieces:
// title: Marker
// description: "Hand-drawn marks on the words that matter: a highlighter swipe, a pen underline or a loose circle, drawn on one after another in reading order with a slight wobble so they never look stamped. Each mark follows the text's real lines, so a phrase that wraps gets marked on both lines. You mark words inside an ordinary Text and turn the marks on when they should draw. For onboarding, tips, study notes, reviews and release notes."
// category: text
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [marker, highlight, underline, circle, annotation, text, handwritten]

import SwiftUI

/// The kind of mark on a run of text.
public enum MarkerKind: Hashable, Sendable {
    /// A highlighter swipe behind the words. The words under it turn dark so they read on the colour.
    case highlight
    /// A pen line under the words.
    case underline
    /// A loose pen loop around the words.
    case circle
}

/// Colors and timing for `.markers`.
public struct MarkerStyle: Sendable {
    /// The highlighter's colour.
    public var highlight: Color
    /// The pen's colour, for underlines and circles.
    public var pen: Color
    /// The words' colour under a highlight.
    public var highlightInk: Color
    /// How long each mark takes to draw, in seconds.
    public var duration: Double
    /// The pause between marks, in seconds.
    public var gap: Double

    public init(
        highlight: Color = Color(red: 1, green: 0.761, blue: 0.102),
        pen: Color = Color(red: 1, green: 0, blue: 0),
        highlightInk: Color = Color(red: 0.078, green: 0.078, blue: 0.078),
        duration: Double = 0.5,
        gap: Double = 0.3
    ) {
        self.highlight = highlight
        self.pen = pen
        self.highlightInk = highlightInk
        self.duration = duration
        self.gap = gap
    }

    public static let standard = MarkerStyle()
}

public extension Text {
    /// Marks these words, to be drawn when the text they sit in turns its `.markers` on.
    ///
    /// Interpolate the marked text into a sentence: `Text("Pack \(Text("light layers").marker(.highlight)) today")`.
    /// On iOS 17 the words are underlined in the pen colour instead, with no drawing on.
    func marker(_ kind: MarkerKind, style: MarkerStyle = .standard) -> Text {
        if #available(iOS 18, *) {
            return customAttribute(MarkerRun(kind: kind))
        }
        return underline(color: kind == .highlight ? style.highlight : style.pen)
    }
}

public extension View {
    /// Draws the marks in this text, one after another in reading order, when `isActive` turns on.
    ///
    /// Use it on a `Text` holding runs marked with `.marker`. Under Reduce Motion the marks fade in together.
    ///
    /// - Parameters:
    ///   - isActive: Whether the marks show. Turning it on draws them; turning it off fades them away.
    ///   - style: Colors and timing.
    func markers(isActive: Bool, style: MarkerStyle = .standard) -> some View {
        modifier(MarkerDrawing(isActive: isActive, style: style))
    }
}

/// Animates the marks on and off. Use it through `.markers`.
private struct MarkerDrawing: ViewModifier {
    let isActive: Bool
    let style: MarkerStyle
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var progress: Double = 0
    @State private var fade: Double = 1
    @State private var count = 1

    func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            content
                .textRenderer(MarkerRenderer(progress: reduceMotion ? (progress > 0 ? 1 : 0) : progress, fade: fade, style: style))
                .onAppear { if isActive { progress = 1 } }
                .onChange(of: isActive) { _, active in animate(active) }
        } else {
            content
        }
    }

    private func animate(_ active: Bool) {
        if active {
            progress = 0
            fade = 1
            // The renderer splits the progress between the marks; a long run of marks takes a little longer.
            withAnimation(reduceMotion ? .easeOut(duration: 0.25) : .linear(duration: (style.duration + style.gap) * 3)) { progress = 1 }
        } else {
            withAnimation(.easeOut(duration: 0.35)) { fade = 0 } completion: { progress = 0; fade = 1 }
        }
    }
}

@available(iOS 18, *)
private struct MarkerRun: TextAttribute {
    let kind: MarkerKind
}

/// One mark: its kind and the pieces of line it covers, in reading order.
private struct MarkerMark {
    let kind: MarkerKind
    var rects: [CGRect]
}

/// Draws the text with its marks: highlights under the words, pen marks over them, each drawn on in its share of
/// `progress`.
@available(iOS 18, *)
private struct MarkerRenderer: TextRenderer, Animatable {
    var progress: Double
    var fade: Double
    let style: MarkerStyle

    nonisolated var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        let marks = Self.marks(in: layout)
        let shares = marks.indices.map { Self.share($0, of: marks.count, progress: progress) }

        var marked = context
        marked.opacity = fade
        for (index, mark) in marks.enumerated() where mark.kind == .highlight {
            drawHighlight(mark, amount: shares[index], seed: index, in: marked)
        }

        // The words, darkened under a highlight once it has swept past them.
        for line in layout {
            for run in line {
                if run[MarkerRun.self]?.kind == .highlight, let index = marks.firstIndex(where: { $0.kind == .highlight && $0.rects.contains { $0.intersects(run.typographicBounds.rect) } }), shares[index] > 0.5, fade > 0.5 {
                    var ink = context
                    ink.addFilter(.colorMatrix(Self.tint(style.highlightInk, in: context.environment)))
                    ink.draw(run)
                } else {
                    context.draw(run)
                }
            }
        }

        for (index, mark) in marks.enumerated() where mark.kind != .highlight {
            drawPen(mark, amount: shares[index], seed: index, in: marked)
        }
    }

    private func drawHighlight(_ mark: MarkerMark, amount: Double, seed: Int, in context: GraphicsContext) {
        guard amount > 0 else { return }
        var left = Self.total(mark.rects) * amount
        for (i, rect) in mark.rects.enumerated() {
            guard left > 0 else { break }
            let w = rect.width, top = rect.minY + rect.height * 0.18, bottom = rect.minY + rect.height * 0.86
            let r = { (k: Int) in (Self.random(seed * 31 + i * 7 + k) - 0.5) * 4 }
            var swipe = Path()
            swipe.move(to: CGPoint(x: rect.minX - 2, y: top + r(0)))
            swipe.addQuadCurve(to: CGPoint(x: rect.maxX + 3, y: top + r(1)), control: CGPoint(x: rect.midX, y: top + r(2)))
            swipe.addLine(to: CGPoint(x: rect.maxX + 1, y: bottom + r(3)))
            swipe.addQuadCurve(to: CGPoint(x: rect.minX - 3, y: bottom + r(4)), control: CGPoint(x: rect.midX, y: bottom + r(5)))
            swipe.closeSubpath()
            var local = context
            local.clip(to: Path(CGRect(x: rect.minX - 4, y: rect.minY - 4, width: min(left, w) + 8, height: rect.height + 8)))
            local.opacity *= 0.85
            local.fill(swipe, with: .color(style.highlight))
            left -= w
        }
    }

    private func drawPen(_ mark: MarkerMark, amount: Double, seed: Int, in context: GraphicsContext) {
        guard amount > 0 else { return }
        let width = max(1.5, (mark.rects.first?.height ?? 20) * 0.1)
        let stroke = StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)
        var left = amount * Double(mark.rects.count)
        for (i, rect) in mark.rects.enumerated() {
            guard left > 0 else { break }
            let part = min(left, 1)
            let r = { (k: Int) in (Self.random(seed * 31 + i * 7 + k) - 0.5) }
            var path = Path()
            if mark.kind == .underline {
                let y = rect.maxY + 1
                path.move(to: CGPoint(x: rect.minX, y: y + r(0) * 2))
                path.addCurve(to: CGPoint(x: rect.maxX, y: y + r(1) * 2), control1: CGPoint(x: rect.minX + rect.width * 0.3, y: y + 2.5 + r(2) * 3), control2: CGPoint(x: rect.minX + rect.width * 0.6, y: y - 2.5 + r(3) * 3))
            } else {
                // A loop drawn from just left of the top, overshooting its start a little, never quite closed.
                let rx = rect.width / 2 + rect.height * 0.3, ry = rect.height / 2 + 3
                for step in 0...27 {
                    let a = -Double.pi / 2 - 0.3 + Double(step) / 25 * 2 * .pi
                    let point = CGPoint(x: rect.midX + cos(a) * rx * (1 + r(step + 4) * 0.06), y: rect.midY + sin(a) * ry * (1 + r(step + 40) * 0.08))
                    if step == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
            }
            context.stroke(path.trimmedPath(from: 0, to: part), with: .color(style.pen), style: stroke)
            left -= 1
        }
    }

    /// Collects marked runs into marks: neighbouring runs of one kind make one mark, one rect per line.
    private static func marks(in layout: Text.Layout) -> [MarkerMark] {
        var marks: [MarkerMark] = []
        var open = false
        for line in layout {
            var lineRect: CGRect?
            for run in line {
                guard let kind = run[MarkerRun.self]?.kind else {
                    if let rect = lineRect { marks[marks.count - 1].rects.append(rect); lineRect = nil }
                    open = false
                    continue
                }
                let rect = run.typographicBounds.rect
                if open, marks.last?.kind == kind {
                    lineRect = lineRect.map { $0.union(rect) } ?? rect
                } else {
                    if let previous = lineRect { marks[marks.count - 1].rects.append(previous) }
                    marks.append(MarkerMark(kind: kind, rects: []))
                    lineRect = rect
                    open = true
                }
            }
            if let rect = lineRect { marks[marks.count - 1].rects.append(rect) }
        }
        return marks
    }

    /// How far mark `index` of `count` is drawn when the whole set is `progress` of the way.
    nonisolated private static func share(_ index: Int, of count: Int, progress: Double) -> Double {
        guard count > 0 else { return 0 }
        let slot = 1 / Double(count)
        let t = (progress - Double(index) * slot) / (slot * 0.8)
        let x = min(max(t, 0), 1)
        return 1 - pow(1 - x, 2)
    }

    nonisolated private static func total(_ rects: [CGRect]) -> CGFloat {
        rects.reduce(0) { $0 + $1.width }
    }

    nonisolated private static func random(_ seed: Int) -> Double {
        let x = sin(Double(seed) * 12.9898 + 78.233) * 43758.5453
        return x - floor(x)
    }

    /// A colour matrix that paints everything in `color`, keeping each pixel's alpha.
    private static func tint(_ color: Color, in environment: EnvironmentValues) -> ColorMatrix {
        let resolved = color.resolve(in: environment)
        var matrix = ColorMatrix()
        matrix.r1 = 0; matrix.g2 = 0; matrix.b3 = 0
        matrix.r5 = resolved.red; matrix.g5 = resolved.green; matrix.b5 = resolved.blue
        return matrix
    }
}

// MARK: - Example

/// Trip notes with three marks. Tap Mark up to draw them on.
private struct MarkerExample: View {
    @State private var marked = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Trip notes").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
            Text("Pack \(Text("light layers").marker(.highlight)), the forecast says \(Text("rain after 4 PM").marker(.underline)), and please \(Text("bring your passport").marker(.circle)).")
                .font(.title3.weight(.semibold))
                .lineSpacing(10)
                .markers(isActive: marked)
            Button(marked ? "Clear" : "Mark up") { marked.toggle() }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.bordered)
                .tint(.primary)
        }
        .padding(24)
        .frame(width: 340, alignment: .leading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

#Preview("Light") {
    MarkerExample()
}

#Preview("Dark") {
    MarkerExample()
        .preferredColorScheme(.dark)
}
