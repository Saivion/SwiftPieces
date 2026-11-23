// swiftpieces:
// title: Distortion Wave
// description: "A transition from one screen to the next that starts at the button you tapped: a ring of glass opens from it, magnifying the new screen toward its rim and drawing the old one into it, with a thin highlight and a touch of colour split along the edge. Set it back and the ring closes into the button again. It runs as two Metal layer effects on your own views, and crossfades instead under Reduce Motion. For confirmations, payments sent, unlocks and big moments."
// category: motion
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-23"
// tags: [transition, shader, metal, ripple, refraction, reveal, confirm]
// shaders: [DistortionWave.metal]

import SwiftUI

/// Sizes and timing for `DistortionWave`.
public struct DistortionWaveStyle: Sendable {
    /// How long the ring takes to cross the screen, in seconds.
    public var duration: Double
    /// How wide the band of bending is around the ring, in points.
    public var band: CGFloat

    public init(duration: Double = 1.1, band: CGFloat = 40) {
        self.duration = duration
        self.band = band
    }

    public static let standard = DistortionWaveStyle()
}

/// Shows `content` until `isRevealed` turns on, then opens `next` through a ring of refraction from `origin`.
///
/// Requires `DistortionWave.metal` in the same target: its `distortionWaveOld` and `distortionWaveNew` kernels are
/// looked up through `ShaderLibrary`. Give the ring its starting point with `.distortionWaveOrigin($frame)` on
/// the button, or leave the frame empty to start from the centre.
///
/// - Parameters:
///   - isRevealed: Whether `next` shows.
///   - origin: The frame, in global coordinates, the ring opens from. Usually the button's.
///   - style: Sizes and timing.
///   - content: The screen being left.
///   - next: The screen arriving.
public struct DistortionWave<Content: View, Next: View>: View {
    public typealias Style = DistortionWaveStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isRevealed: Bool
    @State private var progress: CGFloat = 0
    @State private var frame: CGRect = .zero
    @State private var waves = 0

    private let origin: CGRect
    private let style: Style
    private let content: Content
    private let next: Next

    public init(
        isRevealed: Binding<Bool>,
        from origin: CGRect = .zero,
        style: Style = .standard,
        @ViewBuilder content: () -> Content,
        @ViewBuilder next: () -> Next
    ) {
        self._isRevealed = isRevealed
        self.origin = origin
        self.style = style
        self.content = content()
        self.next = next()
        self._progress = State(initialValue: isRevealed.wrappedValue ? 1 : 0)
    }

    public var body: some View {
        let center = origin == .zero || frame == .zero
            ? CGPoint(x: frame.width / 2, y: frame.height / 2)
            : CGPoint(x: origin.midX - frame.minX, y: origin.midY - frame.minY)
        let reach = farthestCorner(from: center, in: frame.size) + style.band
        let moving = progress > 0 && progress < 1

        ZStack {
            next
                .modifier(DistortionWaveLayer(progress: progress, center: center, reach: reach, band: style.band, arriving: true, active: moving && !reduceMotion))
                .opacity(reduceMotion ? Double(progress) : (progress > 0 ? 1 : 0))
                .allowsHitTesting(isRevealed)
                .accessibilityHidden(!isRevealed)
            content
                .modifier(DistortionWaveLayer(progress: progress, center: center, reach: reach, band: style.band, arriving: false, active: moving && !reduceMotion))
                .opacity(reduceMotion ? Double(1 - progress) : (progress < 1 ? 1 : 0))
                .allowsHitTesting(!isRevealed)
                .accessibilityHidden(isRevealed)
        }
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame = $0 }
        .onChange(of: isRevealed) { _, revealed in
            waves += 1
            withAnimation(reduceMotion ? .easeInOut(duration: 0.3) : .timingCurve(0.65, 0, 0.35, 1, duration: revealed ? style.duration : style.duration * 0.8)) {
                progress = revealed ? 1 : 0
            }
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: waves)
    }

    private func farthestCorner(from point: CGPoint, in size: CGSize) -> CGFloat {
        let dx = max(point.x, size.width - point.x), dy = max(point.y, size.height - point.y)
        return hypot(dx, dy)
    }
}

/// One side of the ring: the old screen outside it or the new one inside, as a Metal layer effect.
private struct DistortionWaveLayer: ViewModifier, Animatable {
    var progress: CGFloat
    let center: CGPoint
    let reach: CGFloat
    let band: CGFloat
    let arriving: Bool
    let active: Bool

    nonisolated var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let radius = Float(progress * reach)
        let shader = arriving
            ? ShaderLibrary.distortionWaveNew(.float2(center), .float(radius), .float(Float(band)))
            : ShaderLibrary.distortionWaveOld(.float2(center), .float(radius), .float(Float(band)))
        content
            .layerEffect(shader, maxSampleOffset: CGSize(width: band, height: band), isEnabled: active)
    }
}

public extension View {
    /// Reports this view's global frame, so a `DistortionWave` can open from it.
    func distortionWaveOrigin(_ frame: Binding<CGRect>) -> some View {
        onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame.wrappedValue = $0 }
    }
}

// MARK: - Example

/// A payment review. Confirm opens the receipt through the ring; Done closes it back into the button.
private struct DistortionWaveExample: View {
    @State private var sent = false
    @State private var button: CGRect = .zero
    private let ink = Color(red: 0.078, green: 0.078, blue: 0.078)
    private let red = Color(red: 1, green: 0, blue: 0)
    private let yellow = Color(red: 1, green: 0.761, blue: 0.102)
    private let page = Color(UIColor { @Sendable traits in
        traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1)
    })

    var body: some View {
        DistortionWave(isRevealed: $sent, from: button) {
            VStack(spacing: 18) {
                Text("MC")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(ink)
                    .frame(width: 64, height: 64)
                    .background(yellow, in: .circle)
                Text("Sending to Maya Chen").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                Text("$1,250.00").font(.system(size: 44, weight: .semibold)).monospacedDigit()
                VStack(spacing: 0) {
                    row("From", "Everyday ··4821")
                    Divider()
                    row("Arrives", "In seconds")
                }
                .background(Color(UIColor.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18, style: .continuous))
                Spacer()
                Button {
                    sent = true
                } label: {
                    Text("Confirm")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(ink)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(red, in: .rect(cornerRadius: 23, style: .continuous))
                }
                .buttonStyle(.plain)
                .distortionWaveOrigin($button)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(page)
        } next: {
            VStack(spacing: 14) {
                Spacer()
                Image(systemName: "checkmark")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 84, height: 84)
                    .background(red, in: .circle)
                Text("Sent").font(.largeTitle.weight(.semibold))
                Text("$1,250.00 to Maya Chen").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Button {
                    sent = false
                } label: {
                    Text("Done")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(Color(UIColor.tertiarySystemFill), in: .rect(cornerRadius: 23, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(page)
        }
    }

    private func row(_ name: String, _ value: String) -> some View {
        HStack {
            Text(name).foregroundStyle(.secondary)
            Spacer()
            Text(value)
        }
        .font(.subheadline.weight(.semibold))
        .padding(.horizontal, 16)
        .frame(height: 52)
    }
}

#Preview("Light") {
    DistortionWaveExample()
}

#Preview("Dark") {
    DistortionWaveExample()
        .preferredColorScheme(.dark)
}
