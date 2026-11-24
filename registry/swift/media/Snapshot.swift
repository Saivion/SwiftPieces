// swiftpieces:
// title: Snapshot
// description: "Turns any view into an image the way a screenshot feels: a white flash over the view, then the picture lifts off, shrinks with a slight tilt into a framed thumbnail under it, and a glass note says what happened. Tap the thumbnail to share the image, or let it slide away. It renders with ImageRenderer at the screen's scale, so the image is crisp, and hands it to you to save or copy. For sharing a workout, a receipt, a chart or a ticket as a picture."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-24"
// tags: [snapshot, screenshot, share, image, render, export, thumbnail]

import SwiftUI

/// Sizes, timing and colors for `Snapshot`.
public struct SnapshotStyle: Sendable {
    /// The view's corner radius, so the flash and the picture match its shape.
    public var cornerRadius: CGFloat
    /// How big the thumbnail is, as a fraction of the view.
    public var thumbnailScale: CGFloat
    /// How far below the view's bottom edge the thumbnail lands.
    public var thumbnailDrop: CGFloat
    /// The thumbnail's tilt, in degrees.
    public var thumbnailTilt: Double
    /// How long the thumbnail stays before it slides away, in seconds.
    public var holdDuration: Double
    /// The thumbnail's frame.
    public var frame: Color
    /// The check in the note.
    public var accent: Color
    /// The note's text.
    public var label: Color

    public init(
        cornerRadius: CGFloat = 24,
        thumbnailScale: CGFloat = 0.34,
        thumbnailDrop: CGFloat = 64,
        thumbnailTilt: Double = -5,
        holdDuration: Double = 4,
        frame: Color = .white,
        accent: Color = Color(red: 1, green: 0, blue: 0),
        label: Color = Color(UIColor.label)
    ) {
        self.cornerRadius = cornerRadius
        self.thumbnailScale = thumbnailScale
        self.thumbnailDrop = thumbnailDrop
        self.thumbnailTilt = thumbnailTilt
        self.holdDuration = holdDuration
        self.frame = frame
        self.accent = accent
        self.label = label
    }

    public static let standard = SnapshotStyle()
}

/// Captures its content as an image each time `trigger` changes, with a flash and a thumbnail you can share.
///
/// The content is drawn a second time, off screen, for the image, so build it from values rather than from
/// state that only lives inside it. The thumbnail draws below the view, outside its frame: leave room there.
///
/// - Parameters:
///   - trigger: Change it to take a snapshot, for example a counter your Share button adds to.
///   - message: The note beside the thumbnail, such as "Copied" or "Saved to Photos".
///   - style: Sizes, timing and colors.
///   - onCapture: Called with the image as soon as it is taken, to save, copy or upload it.
///   - content: The view to capture.
public struct Snapshot<Trigger: Equatable, Content: View>: View {
    public typealias Style = SnapshotStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.displayScale) private var displayScale
    @State private var image: UIImage?
    @State private var flash: Double = 0
    @State private var shrunk = false
    @State private var noteShown = false
    @State private var shot = 0

    private let trigger: Trigger
    private let message: String
    private let style: Style
    private let onCapture: (UIImage) -> Void
    private let content: () -> Content

    public init(
        trigger: Trigger,
        message: String = "Snapshot taken",
        style: Style = .standard,
        onCapture: @escaping (UIImage) -> Void = { _ in },
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.trigger = trigger
        self.message = message
        self.style = style
        self.onCapture = onCapture
        self.content = content
    }

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        content()
            .overlay { shape.fill(.white).opacity(flash).allowsHitTesting(false) }
            .overlay(alignment: .bottomLeading) { thumbnail }
            .onChange(of: trigger) { capture() }
            .sensoryFeedback(.impact(weight: .medium), trigger: shot)
    }

    @ViewBuilder private var thumbnail: some View {
        if let image {
            GeometryReader { proxy in
                let motion = PieceMotion(reduceMotion: reduceMotion)
                let s = shrunk ? style.thumbnailScale : 1
                let border = shrunk ? 3 / style.thumbnailScale : 0
                let picture = Image(uiImage: image)
                ZStack(alignment: .bottomLeading) {
                    ShareLink(item: picture, preview: SharePreview(message, image: picture)) {
                        picture
                            .resizable()
                            .frame(width: proxy.size.width, height: proxy.size.height)
                            .clipShape(.rect(cornerRadius: style.cornerRadius, style: .continuous))
                            .padding(border)
                            .background(style.frame, in: .rect(cornerRadius: style.cornerRadius + border, style: .continuous))
                            .padding(-border)
                            .shadow(color: .black.opacity(shrunk ? 0.28 : 0), radius: 14 / s, y: 6 / s)
                            .overlay { RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous).fill(.white).opacity(flash) }
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(s, anchor: .bottomLeading)
                    .rotationEffect(.degrees(shrunk && !reduceMotion ? style.thumbnailTilt : 0), anchor: .bottomLeading)
                    .offset(y: shrunk ? style.thumbnailDrop : 0)
                    .accessibilityLabel("Share snapshot")

                    if noteShown {
                        PieceLiquidGroup {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color(red: 0.078, green: 0.078, blue: 0.078))
                                    .frame(width: 20, height: 20)
                                    .background(style.accent, in: .circle)
                                Text(message)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(style.label)
                            }
                            .padding(.leading, 7)
                            .padding(.trailing, 14)
                            .frame(height: 36)
                            .pieceLiquid(Capsule())
                        }
                        .offset(x: proxy.size.width * style.thumbnailScale + 14, y: style.thumbnailDrop - proxy.size.height * style.thumbnailScale / 2 + 18)
                        .transition(motion.transition(.move(edge: .leading).combined(with: .opacity)))
                        .accessibilityHidden(true)
                    }
                }
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .bottomLeading)
            }
            .transition(.opacity)
        }
    }

    @MainActor private func capture() {
        let renderer = ImageRenderer(content: content().environment(\.colorScheme, colorScheme))
        renderer.scale = displayScale
        guard let picture = renderer.uiImage else { return }
        let motion = PieceMotion(reduceMotion: reduceMotion)
        shot += 1
        image = picture
        shrunk = false
        noteShown = false
        flash = reduceMotion ? 0.6 : 1
        withAnimation(.easeOut(duration: 0.45)) { flash = 0 }
        onCapture(picture)
        AccessibilityNotification.Announcement(message).post()
        let current = shot
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(140))
            guard current == shot else { return }
            withAnimation(motion.morph) { shrunk = true }
            try? await Task.sleep(for: .milliseconds(380))
            guard current == shot else { return }
            withAnimation(motion.reveal) { noteShown = true }
            try? await Task.sleep(for: .seconds(style.holdDuration))
            guard current == shot else { return }
            withAnimation(motion.dismiss) { noteShown = false; image = nil }
        }
    }
}

// MARK: - Example

/// A run summary. Tap it to take a snapshot, which is copied to the clipboard.
private struct SnapshotExample: View {
    @State private var shots = 0

    var body: some View {
        Snapshot(trigger: shots, message: "Copied", onCapture: { UIPasteboard.general.image = $0 }) {
            RunCard()
        }
        .onTapGesture { shots += 1 }
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Copies the run as an image")
        .padding(.bottom, 80)
        .frame(width: 300)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in
            traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
        }))
    }
}

/// The card being captured: built from values only, so the snapshot draws it the same.
private struct RunCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Morning run").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                    Text("5.20 km").font(.system(size: 40, weight: .semibold)).monospacedDigit()
                }
                Spacer()
                RunTrace()
                    .stroke(Color(red: 1, green: 0, blue: 0), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    .frame(width: 70, height: 40)
            }
            HStack(spacing: 22) {
                ForEach([("28:14", "Time"), ("5'26\"", "Pace"), ("412", "kcal")], id: \.1) { value, name in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(value).font(.subheadline.weight(.semibold)).monospacedDigit()
                        Text(name).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemGroupedBackground), in: .rect(cornerRadius: 24, style: .continuous))
    }
}

private struct RunTrace: Shape {
    func path(in rect: CGRect) -> Path {
        let points: [CGPoint] = [CGPoint(x: 0, y: 1), CGPoint(x: 0.22, y: 0.55), CGPoint(x: 0.45, y: 0.72), CGPoint(x: 0.62, y: 0.25), CGPoint(x: 0.82, y: 0.42), CGPoint(x: 1, y: 0)]
        var path = Path()
        path.addLines(points.map { CGPoint(x: rect.minX + $0.x * rect.width, y: rect.minY + $0.y * rect.height) })
        return path
    }
}

#Preview("Light") {
    SnapshotExample()
}

#Preview("Dark") {
    SnapshotExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core)

/// The SwiftPieces motion language: five spring tiers, and a named role for every moment a piece moves,
/// each with its Reduce Motion substitute.
///
/// Build one from the environment, `PieceMotion(reduceMotion: reduceMotion)`, and pick the role that names
/// what just happened. Never animate the tracking of a finger: set gesture state directly in `onChanged`, so the
/// surface stays under the finger, and spring only the release.
private struct PieceMotion {
    var reduceMotion = false

    // Tiers. Overshoot and settle times are measured from rest with SwiftUI's Spring.
    /// No overshoot, 90% in about 90ms. A press arriving under the finger.
    static var tight: Spring { Spring(duration: 0.14, bounce: 0) }
    /// About 2.8% overshoot, 90% in about 140ms. Snapping to a detent, page or segment.
    static var responsive: Spring { Spring(duration: 0.32, bounce: 0.25) }
    /// About 8.4% overshoot. Visible give: a release, a return from past an edge, a drag settling home.
    static var elastic: Spring { Spring(duration: 0.42, bounce: 0.38) }
    /// About 15% overshoot. A resolved action landing. At most once per interaction.
    static var expressive: Spring { Spring(duration: 0.48, bounce: 0.48) }
    /// About 1.5% overshoot, unhurried. Opening large surfaces and ambient change.
    static var calm: Spring { Spring(duration: 0.5, bounce: 0.2) }

    /// Reduce Motion: settles become this short spring with no overshoot.
    private static var still: Animation { .spring(duration: 0.25, bounce: 0) }

    // Roles.
    /// Touch-down. Starts on the same frame and never bounces under the finger.
    var press: Animation { .spring(Self.tight) }
    /// The finger lifts off a pressed surface, which springs back through rest.
    var release: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// A dragged thing comes to rest. With a gesture's velocity, use `settle(velocity:from:to:)` instead.
    var settle: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// Lands on a detent, page or segment.
    var snap: Animation { reduceMotion ? Self.still : .spring(Self.responsive) }
    /// A number, a chart value or anything else people read moves to its new value. Never overshoots, so it
    /// never shows a value that isn't true.
    var value: Animation { reduceMotion ? Self.still : .spring(duration: 0.35, bounce: 0) }
    /// Comes back from past a limit: a pull beyond the edge, a value pushed against its bound.
    var rebound: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// A shape or container changes size, corner radius or form, with a little give at the end.
    var morph: Animation { reduceMotion ? Self.still : .spring(duration: 0.4, bounce: 0.2) }
    /// Something appears, opens or expands. Opening is a little slower than closing.
    var reveal: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(Self.calm) }
    /// Something leaves, closes or collapses. Quick and firm, out of the way.
    var dismiss: Animation { reduceMotion ? .easeIn(duration: 0.18) : .spring(duration: 0.3, bounce: 0.08) }
    /// A resolved action lands: a check, a sent state, a reaction.
    var success: Animation { reduceMotion ? .easeOut(duration: 0.24) : .spring(Self.expressive) }
    /// A refused action. Firm, no wobble; `pieceShake` adds the movement.
    var error: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(Self.responsive) }
    /// Slow ambient change. Loops themselves stop under Reduce Motion: check `allowsAmbient`.
    var ambient: Animation { reduceMotion ? .easeInOut(duration: 0.3) : .spring(Self.calm) }

    /// Loops, drifts, idle breathing and parallax run only when this is true.
    var allowsAmbient: Bool { !reduceMotion }

    /// A moving transition, or a plain fade under Reduce Motion.
    func transition(_ transition: AnyTransition) -> AnyTransition {
        reduceMotion ? .opacity : transition
    }

    /// For content replaced inside a container that stays put (a label, a glyph, a count): the old content
    /// blurs out as the new one sharpens in. A fade under Reduce Motion.
    @MainActor var swap: AnyTransition {
        reduceMotion ? .opacity : AnyTransition(.blurReplace)
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.8.0 (liquid)

/// The liquid glass language: one merge distance, two rest gaps, and the springs a bubble leaves and comes home on.
///
/// Glass shapes inside one `PieceLiquidGroup` melt into each other through a neck when they come within `merge`
/// points. Parts of one control rest `joined`, inside that distance, so the neck holds; separate actions rest
/// `apart`, outside it, so they only goo while one buds out of, or melts back into, another.
private enum PieceLiquid {
    /// Glass shapes closer than this share a neck.
    static let merge: CGFloat = 20
    /// The gap between parts of one control (a stepper's buttons, a progress pill and its stop): the neck holds,
    /// short and smooth, about two thirds of the shapes' height at its waist. Joined parts read best at one height.
    static let joined: CGFloat = 4
    /// The gap between separate actions (menu items, confirm and cancel, chips): they rest as their own bubbles.
    static let apart: CGFloat = 26
    /// How far a bubble shrinks while it is home inside its parent.
    static let homeScale: CGFloat = 0.72

    /// A bubble leaving its parent: slow enough that the neck's stretch and snap read.
    static func split(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.62, bounce: 0.22)
    }

    /// A bubble going home. No bounce: a bounce would carry it out through the far side of its parent.
    static func home(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeIn(duration: 0.18) : .spring(duration: 0.5, bounce: 0)
    }
}

/// A group of glass shapes that merge into one liquid surface. On iOS 26 it is a `GlassEffectContainer`; before
/// that, and under Reduce Transparency, the shapes draw on their own and simply don't merge. `lift` adds the soft
/// shadow liquid glass floats on in light mode.
private struct PieceLiquidGroup<Content: View>: View {
    var spacing: CGFloat = PieceLiquid.merge
    var lift = true
    @ViewBuilder var content: Content
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        container
            .shadow(color: .black.opacity(lift && colorScheme == .light ? 0.07 : 0), radius: 18, y: 8)
    }

    @ViewBuilder private var container: some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *), !reduceTransparency {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// One liquid glass shape: Liquid Glass on iOS 26, carrying `tint` as a solid colour and swelling under a press when
/// `interactive`; a frosted Material with a light rim and a soft shadow before that; a solid fill under Reduce
/// Transparency.
///
/// The tint is painted inside clear glass rather than tinting the glass. Tinted glass in a group bleeds its colour
/// through every neck as a smear, so a red button would glow into the white pill it is joined to; painted inside,
/// the colour stays crisp to the shape's edge, the necks between shapes are clear glass, and a tint change animates
/// like any colour (tinted glass snaps).
private struct PieceLiquidSurface<S: Shape>: ViewModifier {
    var shape: S
    var tint: Color?
    var interactive: Bool
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.pieceLiquidScale) private var scale

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *), !reduceTransparency {
            // Scaled as two parts, content and outline, about the same centre. A scaleEffect on a glass view inside a
            // GlassEffectContainer shrinks the glass but leaves what it carries full size, pinned to its corner.
            content
                .background { shape.fill(tint ?? .clear) }
                .scaleEffect(scale)
                .glassEffect(glass, in: shape.scale(scale))
        } else {
            fallback(content).scaleEffect(scale)
        }
        #else
        fallback(content).scaleEffect(scale)
        #endif
    }

    #if compiler(>=6.2)
    @available(iOS 26, *)
    private var glass: Glass {
        interactive ? Glass.regular.interactive() : .regular
    }
    #endif

    private func fallback(_ content: Content) -> some View {
        let dark = colorScheme == .dark
        return content
            .background {
                if reduceTransparency {
                    shape.fill(tint ?? (dark ? Color(white: 0.17) : Color(white: 0.97)))
                } else {
                    ZStack {
                        shape.fill(.regularMaterial)
                        if let tint { shape.fill(tint.opacity(0.88)) }
                    }
                }
            }
            .overlay { shape.stroke(Color.white.opacity(dark ? 0.14 : 0.7), lineWidth: 0.5) }
            .shadow(color: .black.opacity(dark ? 0.32 : 0.08), radius: 10, y: 5)
    }
}

private struct PieceLiquidScaleKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

private extension EnvironmentValues {
    /// How much the liquid shapes below are scaled, about their own centres. Nested scales multiply.
    var pieceLiquidScale: CGFloat {
        get { self[PieceLiquidScaleKey.self] }
        set { self[PieceLiquidScaleKey.self] = newValue }
    }
}

private extension View {
    /// Draws this view on a liquid glass `shape`. Put it inside a `PieceLiquidGroup` so it can merge with its neighbours.
    func pieceLiquid<S: Shape>(_ shape: S, tint: Color? = nil, interactive: Bool = true) -> some View {
        modifier(PieceLiquidSurface(shape: shape, tint: tint, interactive: interactive))
    }

    /// Scales the liquid glass shapes in this view, content and outline together, about their own centres. Use it
    /// instead of `scaleEffect` on a glass view (a press, a lift, a swell): inside a group a plain `scaleEffect` shrinks
    /// the glass but leaves its content full size and off centre. Animates like any other value.
    func pieceLiquidScale(_ scale: CGFloat) -> some View {
        transformEnvironment(\.pieceLiquidScale) { $0 *= scale }
    }
}

// swiftpieces-liquid: end
