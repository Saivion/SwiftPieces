// swiftpieces:
// title: QR Code
// description: "Turns any string, link or Wi-Fi login into a styled QR code: round dots, soft corner eyes with red centres, and your icon in the middle, with error correction raised to the highest level so it still scans. When the content changes, the dots ripple out from the centre into the new code. It draws with Core Image's own encoder and Canvas, so it is crisp at any size, and it renders with ImageRenderer for sharing. For tickets, invites, pairing and sharing."
// category: media
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-11-08"
// tags: [qr, code, share, ticket, wifi, canvas, coreimage]

import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI

/// Colors for `QRCode`. A code is always dark on light, so it scans in dark mode too: these don't follow the appearance.
public struct QRCodeStyle: Sendable {
    /// The dots and the eyes' rings.
    public var dots: Color
    /// The eyes' centres.
    public var accent: Color
    /// The card under the code.
    public var background: Color
    /// The tile under the logo.
    public var logoBackground: Color
    /// The logo's tint, for template images and symbols.
    public var logoTint: Color

    public init(
        dots: Color = Color(red: 0.078, green: 0.078, blue: 0.078),
        accent: Color = Color(red: 1, green: 0, blue: 0),
        background: Color = .white,
        logoBackground: Color = Color(red: 1, green: 0, blue: 0),
        logoTint: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
    ) {
        self.dots = dots
        self.accent = accent
        self.background = background
        self.logoBackground = logoBackground
        self.logoTint = logoTint
    }

    public static let standard = QRCodeStyle()
}

/// A styled QR code for a string, with an optional logo in the middle.
///
/// It fills the square it is given. To share it, render it with `ImageRenderer(content: QRCode(text).frame(width: 600))`.
///
/// - Parameters:
///   - content: What the code encodes: a URL, text, or a `WIFI:S:name;T:WPA;P:password;;` login.
///   - logo: An image for the middle. Symbols and template images take `style.logoTint`.
///   - style: Colors. Defaults to ink dots, red eye centres and a white card.
public struct QRCode: View {
    public typealias Style = QRCodeStyle

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The code being left behind while the ripple runs, and how far the ripple has spread.
    @State private var previous: QRCodeMatrix?
    @State private var progress: Double = 1

    private let content: String
    private let logo: Image?
    private let style: Style

    public init(_ content: String, logo: Image? = nil, style: Style = .standard) {
        self.content = content
        self.logo = logo
        self.style = style
    }

    public var body: some View {
        let modules = QRCodeMatrix(content)
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            let quiet = side * 0.07
            let code = side - quiet * 2
            let cell = code / CGFloat(max(modules.count, 1))
            let hole = logo == nil ? 0 : QRCode.hole(for: modules.count)
            ZStack {
                RoundedRectangle(cornerRadius: side * 0.12, style: .continuous)
                    .fill(style.background)
                    .shadow(color: .black.opacity(0.1), radius: side * 0.04, y: side * 0.015)
                QRCodeDots(progress: progress, old: previous, new: modules, hole: hole, style: style)
                    .frame(width: code, height: code)
                if let logo, hole > 0 {
                    let tile = cell * CGFloat(hole - 1)
                    logo
                        .resizable()
                        .scaledToFit()
                        .foregroundStyle(style.logoTint)
                        .padding(tile * 0.2)
                        .frame(width: tile, height: tile)
                        .background(style.logoBackground, in: .rect(cornerRadius: tile * 0.28, style: .continuous))
                        .scaleEffect(previous == nil ? 1 : 0.85 + 0.15 * progress)
                }
            }
            .frame(width: side, height: side)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .onChange(of: content) { old, _ in
            previous = QRCodeMatrix(old)
            guard !reduceMotion else {
                progress = 1
                previous = nil
                return
            }
            progress = 0
            withAnimation(.easeOut(duration: 0.9)) {
                progress = 1
            } completion: {
                if progress == 1 { previous = nil }
            }
        }
        .accessibilityElement()
        .accessibilityLabel("QR code")
        .accessibilityValue(content)
        .accessibilityAddTraits(.isImage)
    }

    /// The side of the cleared square under the logo, in modules: about a fifth of the code, always odd so it centres.
    private static func hole(for count: Int) -> Int {
        let side = Int((Double(count) * 0.22).rounded())
        return side % 2 == 0 ? side + 1 : side
    }
}

/// The modules of a code, top row first, `true` for dark. Encoded by Core Image at the highest error correction.
private struct QRCodeMatrix {
    let rows: [[Bool]]
    var count: Int { rows.count }

    init(_ content: String) {
        rows = QRCodeMatrix.encode(content)
    }

    func dark(_ x: Int, _ y: Int) -> Bool {
        y >= 0 && y < rows.count && x >= 0 && x < rows[y].count && rows[y][x]
    }

    /// Draws Core Image's code into a grey bitmap and reads it back a pixel per module, trimming the quiet zone.
    nonisolated private static func encode(_ content: String) -> [[Bool]] {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(content.utf8)
        filter.correctionLevel = "H"
        guard let output = filter.outputImage,
              let image = CIContext().createCGImage(output, from: output.extent.integral) else { return [] }
        let width = image.width, height = image.height
        var pixels = [UInt8](repeating: 255, count: width * height)
        pixels.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return }
            context.interpolationQuality = .none
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        // The dark modules' bounds are the code without its quiet zone.
        var minX = width, minY = height, maxX = -1, maxY = -1
        for y in 0..<height {
            for x in 0..<width where pixels[y * width + x] < 128 {
                minX = min(minX, x); maxX = max(maxX, x)
                minY = min(minY, y); maxY = max(maxY, y)
            }
        }
        guard maxX >= minX, maxY >= minY else { return [] }
        return (minY...maxY).map { y in (minX...maxX).map { x in pixels[y * width + x] < 128 } }
    }
}

/// The dots and eyes, drawn in one Canvas. While `progress` runs from 0 to 1 a ring spreads from the centre: inside
/// it, dots the new code drops shrink away and dots it adds grow in, with a little overshoot.
private struct QRCodeDots: View, Animatable {
    var progress: Double
    let old: QRCodeMatrix?
    let new: QRCodeMatrix
    let hole: Int
    let style: QRCodeStyle

    nonisolated var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        Canvas { context, size in
            let count = new.count
            guard count > 0 else { return }
            let cell = size.width / CGFloat(count)
            let center = Double(count - 1) / 2
            let reach = (center * center * 2).squareRoot()
            let holeStart = (count - hole) / 2, holeEnd = holeStart + hole
            for y in 0..<count {
                for x in 0..<count {
                    if QRCodeDots.inEye(x, y, count) { continue }
                    if hole > 0, (holeStart..<holeEnd).contains(x), (holeStart..<holeEnd).contains(y) { continue }
                    let now = new.dark(x, y), was = old?.dark(x, y) ?? now
                    guard now || was else { continue }
                    var scale: Double = 1
                    if now != was {
                        let distance = (pow(Double(x) - center, 2) + pow(Double(y) - center, 2)).squareRoot() / reach
                        let local = min(max((progress * 1.6 - distance * 0.6), 0), 1)
                        scale = now ? QRCodeDots.overshoot(local) : 1 - local
                    }
                    guard scale > 0.01 else { continue }
                    let radius = cell * 0.43 * scale
                    let mid = CGPoint(x: (CGFloat(x) + 0.5) * cell, y: (CGFloat(y) + 0.5) * cell)
                    context.fill(Path(ellipseIn: CGRect(x: mid.x - radius, y: mid.y - radius, width: radius * 2, height: radius * 2)), with: .color(style.dots))
                }
            }
            for (ex, ey) in [(0, 0), (count - 7, 0), (0, count - 7)] {
                let origin = CGPoint(x: CGFloat(ex) * cell, y: CGFloat(ey) * cell)
                let ring = CGRect(x: origin.x + cell * 0.5, y: origin.y + cell * 0.5, width: cell * 6, height: cell * 6)
                context.stroke(Path(roundedRect: ring, cornerRadius: cell * 2, style: .continuous), with: .color(style.dots), lineWidth: cell)
                let pupil = CGRect(x: origin.x + cell * 2, y: origin.y + cell * 2, width: cell * 3, height: cell * 3)
                context.fill(Path(roundedRect: pupil, cornerRadius: cell * 1.1, style: .continuous), with: .color(style.accent))
            }
        }
    }

    /// The three finder patterns, with their one-module separators.
    private static func inEye(_ x: Int, _ y: Int, _ count: Int) -> Bool {
        (x < 8 && y < 8) || (x >= count - 8 && y < 8) || (x < 8 && y >= count - 8)
    }

    /// Ease out with a small overshoot, so a new dot lands like a pop.
    private static func overshoot(_ t: Double) -> Double {
        let c = 1.7
        let u = t - 1
        return 1 + (c + 1) * u * u * u + c * u * u
    }
}

// MARK: - Example

/// A code that cycles through a link, a Wi-Fi login and a contact, with what it holds under it.
private struct QRCodeExample: View {
    private let payloads = [
        ("Link", "swiftpieces.com", "https://swiftpieces.com"),
        ("Wi-Fi", "Studio · WPA2", "WIFI:S:Studio;T:WPA;P:paper-lantern;;"),
        ("Contact", "Maya Chen", "MECARD:N:Chen,Maya;EMAIL:maya@example.com;;"),
    ]
    @State private var index = 0

    var body: some View {
        VStack(spacing: 18) {
            QRCode(payloads[index].2, logo: Image(systemName: "swift"))
                .frame(width: 220)
            Button {
                index = (index + 1) % payloads.count
            } label: {
                HStack(spacing: 8) {
                    Text(payloads[index].0)
                    Text(payloads[index].1).foregroundStyle(.secondary)
                }
                .padding(.horizontal, 16)
                .frame(height: 40)
                .background(.background, in: .capsule)
            }
            .buttonStyle(.plain)
        }
        .fontWeight(.semibold)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? UIColor(white: 0.07, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
    }
}

#Preview("Light") {
    QRCodeExample()
}

#Preview("Dark") {
    QRCodeExample()
        .preferredColorScheme(.dark)
}
