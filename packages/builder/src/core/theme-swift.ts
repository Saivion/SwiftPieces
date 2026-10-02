// The Swift side of Style: what Theme.swift gains beyond colours (fonts, the backdrop, cards, motion),
// the app root's modifiers, and the pass that routes generated code's fonts through Theme.font so the
// Style's heading and body fonts and its text size reach every screen, as they do in the preview.
import type { FontDef } from "./fonts.js";
import type { ResolvedTheme } from "./looks.js";

const DESIGN: Record<FontDef["design"], string> = { default: ".default", rounded: ".rounded", serif: ".serif", monospaced: ".monospaced" };

/** Whether generated text goes through `Theme.font`: a family font, a heading font, or a text size. */
export function usesThemeFonts(t: ResolvedTheme): boolean {
  return Boolean(t.body.family || t.heading.family || t.heading.id !== t.body.id || t.textScale !== 1 || t.titleScale !== 1);
}

const face = (f: FontDef) => (f.family ? `.family(${JSON.stringify(f.family)})` : `.system(${DESIGN[f.design]})`);

/** Theme's fonts: the body and heading faces, text styles, fixed sizes (scaled by Text size), nav bars. */
export function themeFontLines(t: ResolvedTheme): string[] {
  if (!usesThemeFonts(t)) return [];
  const navBars = t.heading.id !== "default";
  return [
    "",
    "extension Theme {",
    `    /// Body text: ${t.body.name}. Titles (large title to title 3): ${t.heading.name}.`,
    `    static let bodyFace = Face${face(t.body)}`,
    `    static let headingFace = Face${face(t.heading)}`,
    "    /// The app's text size (Style → Text size), applied to fixed-size text such as big figures.",
    `    static let textScale: CGFloat = ${t.textScale}`,
    "    /// How much bigger titles and big figures are than body text (Style → Hierarchy).",
    `    static let titleScale: CGFloat = ${t.titleScale}`,
    "",
    "    enum Face {",
    "        case system(Font.Design)",
    "        case family(String)",
    "    }",
    "",
    "    /// A text style in the app's fonts. It still scales with Dynamic Type.",
    "    static func font(_ style: Font.TextStyle) -> Font {",
    "        let title: Set<Font.TextStyle> = [.largeTitle, .title, .title2, .title3]",
    "        let isTitle = title.contains(style)",
    "        let size = pointSize(style) * (isTitle ? titleScale : 1)",
    "        // A title the hierarchy resizes keeps scaling with Dynamic Type from its own text style.",
    "        let font = isTitle && titleScale != 1",
    "            ? make(headingFace, size: UIFontMetrics(forTextStyle: uiStyle(style)).scaledValue(for: size), style: nil, design: nil)",
    "            : make(isTitle ? headingFace : bodyFace, size: size, style: style, design: nil)",
    "        return style == .headline ? font.weight(.semibold) : font",
    "    }",
    "",
    "    private static func uiStyle(_ style: Font.TextStyle) -> UIFont.TextStyle {",
    "        switch style {",
    "        case .largeTitle: .largeTitle",
    "        case .title: .title1",
    "        case .title2: .title2",
    "        default: .title3",
    "        }",
    "    }",
    "",
    "    /// A fixed size in the app's fonts (the heading font from 22 points up), scaled by the text size.",
    "    static func font(size: CGFloat, weight: Font.Weight = .regular, design: Font.Design? = nil) -> Font {",
    "        make(size >= 22 ? headingFace : bodyFace, size: size * textScale * (size >= 22 ? titleScale : 1), style: nil, design: design).weight(weight)",
    "    }",
    "",
    "    private static func make(_ face: Face, size: CGFloat, style: Font.TextStyle?, design: Font.Design?) -> Font {",
    "        switch face {",
    "        case .system(let own):",
    "            // The system font keeps a component's own design unless the app sets one.",
    "            let d = own == .default ? (design ?? .default) : own",
    "            if let style { return .system(style, design: d) }",
    "            return .system(size: size, design: d)",
    "        case .family(let name):",
    "            if let style { return .custom(name, size: size, relativeTo: style) }",
    "            return .custom(name, fixedSize: size)",
    "        }",
    "    }",
    "",
    "    private static func pointSize(_ style: Font.TextStyle) -> CGFloat {",
    "        switch style {",
    "        case .largeTitle: 34",
    "        case .title: 28",
    "        case .title2: 22",
    "        case .title3: 20",
    "        case .callout: 16",
    "        case .subheadline: 15",
    "        case .footnote: 13",
    "        case .caption: 12",
    "        case .caption2: 11",
    "        default: 17",
    "        }",
    "    }",
    ...(navBars
      ? [
          "",
          "    /// Navigation bar titles in the heading font (they don't read SwiftUI's font environment).",
          "    static func styleNavigationBars() {",
          "        let bar = UINavigationBar.appearance()",
          "        bar.largeTitleTextAttributes = [.font: uiFont(headingFace, .largeTitle)]",
          "        bar.titleTextAttributes = [.font: uiFont(headingFace, .headline)]",
          "    }",
          "",
          "    private static func uiFont(_ face: Face, _ style: UIFont.TextStyle) -> UIFont {",
          "        let base = UIFontDescriptor.preferredFontDescriptor(withTextStyle: style)",
          "        var descriptor: UIFontDescriptor",
          "        switch face {",
          "        case .system(let design):",
          "            let ui: UIFontDescriptor.SystemDesign = design == .rounded ? .rounded : design == .serif ? .serif : design == .monospaced ? .monospaced : .default",
          "            descriptor = base.withDesign(ui) ?? base",
          "        case .family(let name):",
          "            descriptor = UIFontDescriptor(fontAttributes: [.family: name])",
          "        }",
          "        descriptor = descriptor.withSymbolicTraits(.traitBold) ?? descriptor",
          "        return UIFont(descriptor: descriptor, size: base.pointSize)",
          "    }",
        ]
      : []),
    "}",
  ];
}

/** The screen ground with Style's backdrop, used behind every screen when there is one. */
export function themeBackgroundLines(t: ResolvedTheme): string[] {
  if (t.backdrop === "none") return [];
  const layer: Record<Exclude<ResolvedTheme["backdrop"], "none">, string[]> = {
    glow: ["            RadialGradient(colors: [Theme.accent.opacity(0.3), .clear], center: UnitPoint(x: 0.5, y: -0.08), startRadius: 0, endRadius: 520)"],
    gradient: ["            LinearGradient(colors: [Theme.accent.opacity(0.16), .clear], startPoint: .top, endPoint: UnitPoint(x: 0.5, y: 0.65))"],
    grid: [
      "            Canvas { context, size in",
      "                for x in stride(from: 9.0, to: size.width, by: 18) {",
      "                    for y in stride(from: 9.0, to: size.height, by: 18) {",
      "                        context.fill(Path(ellipseIn: CGRect(x: x - 1, y: y - 1, width: 2, height: 2)), with: .color(.primary.opacity(0.16)))",
      "                    }",
      "                }",
      "            }",
    ],
    mesh: [
      "            // A soft mesh of the accent, drawn with MeshGradient where the system has it.",
      "            if #available(iOS 18.0, *) {",
      "                MeshGradient(",
      "                    width: 3, height: 3,",
      "                    points: [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.6, 0.42], [1, 0.5], [0, 1], [0.5, 1], [1, 1]],",
      "                    colors: [",
      "                        Theme.accent.opacity(0.42), Theme.accent.opacity(0.16), .clear,",
      "                        Theme.accent.opacity(0.14), .clear, Theme.accent.opacity(0.26),",
      "                        .clear, Theme.accent.opacity(0.1), .clear,",
      "                    ]",
      "                )",
      "            } else {",
      "                LinearGradient(colors: [Theme.accent.opacity(0.3), .clear, Theme.accent.opacity(0.14)], startPoint: .topLeading, endPoint: .bottomTrailing)",
      "            }",
    ],
    paper: [
      "            Canvas { context, size in",
      "                // A fixed grain: the same speckles every time, like a sheet of paper.",
      "                var seed: UInt64 = 0x5EED",
      "                func next() -> Double { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return Double(seed >> 33) / Double(1 << 31) }",
      "                for _ in 0..<Int(size.width * size.height / 90) {",
      "                    context.fill(Path(CGRect(x: next() * size.width, y: next() * size.height, width: 1, height: 1)), with: .color(.primary.opacity(0.07)))",
      "                }",
      "            }",
    ],
  };
  return [
    "",
    "/// The screen ground with the app's backdrop (Style → Backdrop).",
    "struct ThemeBackground: View {",
    "    var body: some View {",
    "        ZStack {",
    "            Theme.background",
    ...layer[t.backdrop],
    "        }",
    "        .ignoresSafeArea()",
    "    }",
    "}",
  ];
}

/** Cards in the app's style (Style → Cards), for every card the screens draw. */
export function themeCardLines(t: ResolvedTheme): string[] {
  const bodies: Record<ResolvedTheme["cards"], string[]> = {
    // Flat cards from a screenshot fill with its card colour (Theme.surface), not the system fill.
    flat: [t.solidCards ? "        content.background(Theme.surface, in: shape)" : "        content.background(.fill.tertiary, in: shape)"],
    raised: ["        content", "            .background(Theme.surface, in: shape)", "            .shadow(color: .black.opacity(0.16), radius: 14, y: 8)"],
    outlined: ["        content", "            .background(Theme.surface, in: shape)", "            .overlay(shape.strokeBorder(Color(.separator)))"],
    glass: ["        content", "            .background(.ultraThinMaterial, in: shape)", "            .overlay(shape.strokeBorder(.white.opacity(0.2), lineWidth: 0.5))"],
    bold: ["        content", "            .background(Theme.surface, in: shape)", "            .overlay(shape.strokeBorder(.primary, lineWidth: 2))", "            .background(shape.fill(.primary).offset(x: 4, y: 4))"],
  };
  return [
    "",
    "extension View {",
    `    /// A card in the app's style (${t.cards}).`,
    "    func themeCard(cornerRadius: CGFloat) -> some View {",
    "        modifier(ThemeCard(radius: cornerRadius))",
    "    }",
    "}",
    "",
    "struct ThemeCard: ViewModifier {",
    "    let radius: CGFloat",
    "",
    "    func body(content: Content) -> some View {",
    "        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)",
    "        return " + bodies[t.cards][0].trim(),
    ...bodies[t.cards].slice(1),
    "    }",
    "}",
  ];
}

/** Theme's motion: the spring things move with (Style → Motion). */
export function themeMotionLines(t: ResolvedTheme): string[] {
  return ["", "extension Theme {", "    /// How things move: the app's spring.", `    static let motion: Animation = .${t.motion}`, "}"];
}

/** Root modifiers Style adds: the nearest system design for components, and the symbol variant. */
export function themeRootModifiers(t: ResolvedTheme): string[] {
  return [
    // Components drawing with the system font take the design closest to the body font.
    t.body.design !== "default" ? `fontDesign(${DESIGN[t.body.design]})` : null,
    usesThemeFonts(t) && t.body.family ? "font(Theme.font(.body))" : null,
    t.symbols !== "outline" ? "symbolVariant(.fill)" : null,
    t.symbols === "hierarchical" ? "symbolRenderingMode(.hierarchical)" : null,
    // Tabular figures: every digit the same width, so counts and times don't jiggle.
    t.numbers === "tabular" ? "monospacedDigit()" : null,
    // Icon size: SF Symbols scale against their text.
    t.iconScale !== "medium" ? `imageScale(.${t.iconScale})` : null,
  ].filter((m): m is string => Boolean(m));
}

const STYLES = "largeTitle|title3|title2|title|headline|subheadline|body|callout|footnote|caption2|caption";

/**
 * Routes a screen's fonts through Theme.font: `.font(.headline)` and `.font(.body.weight(.bold))`
 * take the app's fonts, `.font(.system(size: 40, weight: .bold))` its fonts and text size.
 */
export function rewriteFonts(code: string, t: ResolvedTheme): string {
  if (!usesThemeFonts(t)) return code;
  return code
    .replace(new RegExp(`\\.font\\(\\.(${STYLES})(?![A-Za-z0-9])`, "g"), ".font(Theme.font(.$1)")
    .replace(/\.font\(\.system\(size: ([^,()]+)((?:, weight: \.[a-z]+)?)((?:, design: \.[a-z]+)?)\)/g, (_m, size: string, weight: string, design: string) => `.font(Theme.font(size: ${size}${weight}${design})`);
}

/** Theme's corners: the scale every radius takes, and the pill (capsule) radius below standard corners. */
export function themeShapeLines(t: ResolvedTheme): string[] {
  if (t.cornerScale === 1) return [];
  return [
    "",
    "extension Theme {",
    `    /// Corner scale (Style → Corners: ${t.corners === "tight" && t.cornerScale === 0 ? "square" : t.corners}).`,
    `    static let cornerScale: Double = ${t.cornerScale}`,
    "    /// A radius in the app's corners.",
    "    static func corner<T: BinaryFloatingPoint>(_ radius: T) -> T { radius * T(cornerScale) }",
    ...(t.cornerScale < 1 ? ["    /// What capsules become: rounded rectangles with this radius.", `    static let pillRadius: CGFloat = ${Math.round(22 * t.cornerScale)}`] : []),
    "}",
  ];
}

/**
 * Corners in the app's style, for code the generator doesn't already scale (components' own views
 * and sources): literal radii go through Theme.corner, and capsules become rounded rectangles when
 * the corners are tighter than standard. Radii passed in as values were scaled where they were set.
 */
export function rewriteCorners(code: string, t: ResolvedTheme): string {
  if (t.cornerScale === 1) return code;
  let out = code
    .replace(/\bcornerRadius: (\d+(?:\.\d+)?)(?![\d.])/g, "cornerRadius: Theme.corner($1)")
    .replace(/\.cornerRadius\((\d+(?:\.\d+)?)\)/g, ".cornerRadius(Theme.corner($1))");
  if (t.cornerScale < 1) {
    out = out
      .replace(/\bCapsule\((?:style: \.continuous)?\)/g, "RoundedRectangle(cornerRadius: Theme.pillRadius, style: .continuous)")
      .replace(/(in: |clipShape\(|contentShape\(|mask\()\.capsule\b/g, "$1.rect(cornerRadius: Theme.pillRadius, style: .continuous)");
  }
  return out;
}

/** A component's Swift source in the app's style: its fonts and its corners (see rewriteFonts, rewriteCorners). */
export function styleSwiftSource(code: string, t: ResolvedTheme): string {
  return rewriteCorners(rewriteFonts(code, t), t);
}

/** How screens arrive (Style → Entrance): fading in, or rising into place as they fade in. */
export function themeEntranceLines(t: ResolvedTheme): string[] {
  if (t.entrance === "none") return [];
  return [
    "",
    "extension View {",
    `    /// A screen arriving in the app's style (${t.entrance}).`,
    "    func themeEntrance() -> some View {",
    "        modifier(ThemeEntrance())",
    "    }",
    "}",
    "",
    "struct ThemeEntrance: ViewModifier {",
    "    @State private var shown = false",
    "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
    "",
    "    func body(content: Content) -> some View {",
    "        content",
    "            .opacity(shown ? 1 : 0)",
    ...(t.entrance === "rise" ? ["            .offset(y: shown || reduceMotion ? 0 : 14)"] : []),
    "            .onAppear {",
    "                withAnimation(.smooth(duration: 0.4)) { shown = true }",
    "            }",
    "    }",
    "}",
  ];
}
