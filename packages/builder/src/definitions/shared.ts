import { colors, grounds, icons } from "../core/palette.js";
import type { EmitContext, PropertyDefinition, PropertyOption } from "../core/schema.js";
import { call, indent, INDENT } from "../core/swift.js";

export const opts = (...pairs: Array<[string, string]>): PropertyOption[] => pairs.map(([value, label]) => ({ value, label }));

export const text = (id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "text", defaultValue, maxLength: 120, ...extra });
export const bool = (id: string, label: string, defaultValue: boolean, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "boolean", defaultValue, ...extra });
export const select = (id: string, label: string, defaultValue: string, options: PropertyOption[], extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "select", defaultValue, options, ...extra });
export const number = (id: string, label: string, defaultValue: number, min: number, max: number, step = 1, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "number", defaultValue, min, max, step, ...extra });
export const spacing = (id: string, label: string, defaultValue: number, max = 48, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "spacing", defaultValue, min: 0, max, step: 1, ...extra });
export const color = (id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "color", defaultValue, options: colors.map((c) => ({ value: c.id, label: c.label })), ...extra });
export const icon = (id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "icon", defaultValue, options: icons.map((i) => ({ value: i.id, label: i.label })), ...extra });
export const ground = (id: string, label: string, defaultValue: string): PropertyDefinition => select(id, label, defaultValue, grounds.map((g) => ({ value: g.id, label: g.label })));

/** SwiftUI text styles, with the point size each has at the default Dynamic Type size. */
export const textStyles: Record<string, { label: string; size: number; weight: number; leading: number }> = {
  largeTitle: { label: "Large title", size: 34, weight: 400, leading: 41 },
  title: { label: "Title", size: 28, weight: 400, leading: 34 },
  title2: { label: "Title 2", size: 22, weight: 400, leading: 28 },
  title3: { label: "Title 3", size: 20, weight: 400, leading: 25 },
  headline: { label: "Headline", size: 17, weight: 600, leading: 22 },
  body: { label: "Body", size: 17, weight: 400, leading: 22 },
  callout: { label: "Callout", size: 16, weight: 400, leading: 21 },
  subheadline: { label: "Subheadline", size: 15, weight: 400, leading: 20 },
  footnote: { label: "Footnote", size: 13, weight: 400, leading: 18 },
  caption: { label: "Caption", size: 12, weight: 400, leading: 16 },
};
export const textStyleOptions = Object.entries(textStyles).map(([value, s]) => ({ value, label: s.label }));

export const weights: Record<string, { label: string; css: number | null }> = {
  default: { label: "Default", css: null },
  regular: { label: "Regular", css: 400 },
  medium: { label: "Medium", css: 500 },
  semibold: { label: "Semibold", css: 600 },
  bold: { label: "Bold", css: 700 },
  heavy: { label: "Heavy", css: 800 },
  black: { label: "Black", css: 900 },
};
export const weightOptions = Object.entries(weights).map(([value, w]) => ({ value, label: w.label }));

/** Horizontal alignment → SwiftUI `HorizontalAlignment` / `TextAlignment` member. */
export const hAlign = opts(["leading", "Leading"], ["center", "Center"], ["trailing", "Trailing"]);

/** `.frame(maxWidth: .infinity, alignment: …)` alignment name from vertical and horizontal parts. */
export function frameAlignment(vertical: "top" | "center" | "bottom", horizontal: string): string {
  const h = horizontal === "leading" ? "Leading" : horizontal === "trailing" ? "Trailing" : "";
  if (vertical === "center") return h ? h.toLowerCase() : "center";
  return `${vertical}${h}`;
}

/** How a presented screen sizes itself, as `.presentationDetents`. Large is the system default. */
const SHEET_DETENTS: Record<string, string | null> = { large: null, medium: "[.medium]", both: "[.medium, .large]" };

/** "On tap": open another screen of the project, or go back. Its choices are the project's screens. */
export const link = (id = "link", label = "On tap", extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({
  id,
  label,
  type: "link",
  defaultValue: "",
  hint: "What a tap does: open another screen, present it as a sheet, or go back.",
  group: "interaction",
  ...extra,
});

/**
 * Something you tap, with its navigation written in: a `NavigationLink` that pushes the linked
 * screen, a `Button` that dismisses for "back", or a plain `Button` when there is no link.
 * `label` is the label's lines, or null for a `Button(title)` shorthand. Modifiers are the
 * caller's: `.buttonStyle` and `.tint` apply to a NavigationLink exactly as to a Button.
 */
/**
 * The statement that follows a link from code, for pieces that move on after their own action
 * (a commit button once it succeeds): a push or sheet becomes a Bool the statement sets, with its
 * destination attached to the screen; root sets the app's flag; back dismisses. Null: no link.
 */
export function linkStatement(ctx: EmitContext, linkValue: unknown): string | null {
  const target = ctx.link(String(linkValue ?? ""));
  if (target?.kind === "push") {
    const flag = ctx.state(`open${target.view.replace(/View$/, "")}`, "", "false");
    ctx.attach([`.navigationDestination(isPresented: $${flag}) {`, `${INDENT}${target.view}()`, "}"]);
    return `${flag} = true`;
  }
  if (target?.kind === "sheet") {
    const flag = ctx.state(`show${target.view.replace(/View$/, "")}`, "", "false");
    const detents = SHEET_DETENTS[target.detent] ?? SHEET_DETENTS.large;
    ctx.attach([`.sheet(isPresented: $${flag}) {`, `${INDENT}NavigationStack { ${target.view}() }`, ...(detents ? [`${INDENT}${INDENT}.presentationDetents(${detents})`] : []), "}"]);
    return `${flag} = true`;
  }
  if (target?.kind === "root") return `${target.flag} = true`;
  if (target?.kind === "tab") return target.set;
  if (target?.kind === "back") return `${ctx.dismiss()}()`;
  return null;
}

export function tappable(ctx: EmitContext, linkValue: unknown, label: string[] | null, title: string): string[] {
  const target = ctx.link(String(linkValue ?? ""));
  if (target?.kind === "push") {
    return ["NavigationLink {", `${INDENT}${target.view}()`, "} label: {", ...indent(label ?? [`Text(${title})`]), "}"];
  }
  if (target?.kind === "sheet") {
    // A sheet is state: a Bool the tap sets, and the presented screen in its own NavigationStack so
    // its title and links work. Detents come from the presented screen.
    const flag = ctx.state(`show${target.view.replace(/View$/, "")}`, "", "false");
    const detents = SHEET_DETENTS[target.detent] ?? SHEET_DETENTS.large;
    ctx.attach([
      `.sheet(isPresented: $${flag}) {`,
      `${INDENT}NavigationStack { ${target.view}() }`,
      ...(detents ? [`${INDENT}${INDENT}.presentationDetents(${detents})`] : []),
      "}",
    ]);
    return label ? call("Button", [["action", `{ ${flag} = true }`]], label) : [`Button(${title}) { ${flag} = true }`];
  }
  if (target?.kind === "root") {
    // The app reads this flag to choose its root (see the App file), so setting it moves on for good.
    return label ? call("Button", [["action", `{ ${target.flag} = true }`]], label) : [`Button(${title}) { ${target.flag} = true }`];
  }
  if (target?.kind === "tab") {
    return label ? call("Button", [["action", `{ ${target.set} }`]], label) : [`Button(${title}) { ${target.set} }`];
  }
  if (target?.kind === "back") {
    const dismiss = ctx.dismiss();
    return label ? call("Button", [["action", `{ ${dismiss}() }`]], label) : [`Button(${title}) { ${dismiss}() }`];
  }
  return label ? call("Button", [["action", "{}"]], label) : [`Button(${title}) {}`];
}

/**
 * Topographic contour lines (the Studio family's texture), in a 400 × 400 box, cropped to fill the
 * card like `aspect-fill`. The web draws the same curves as the Swift `ContourLines` shape.
 */
export const contourD = (i: number) => `M-20 ${60 + i * 48} C 80 ${20 + i * 52}, 160 ${140 + i * 40}, 250 ${70 + i * 50} S 380 ${150 + i * 44}, 440 ${90 + i * 50}`;
export const CONTOUR_SWIFT = [
  "private struct ContourLines: Shape {",
  "    func path(in rect: CGRect) -> Path {",
  "        let side = max(rect.width, rect.height), s = side / 400",
  "        let ox = rect.midX - side / 2, oy = rect.midY - side / 2",
  "        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }",
  "        var path = Path()",
  "        for i in 0..<7 {",
  "            let y = CGFloat(i)",
  "            path.move(to: p(-20, 60 + y * 48))",
  "            path.addCurve(to: p(250, 70 + y * 50), control1: p(80, 20 + y * 52), control2: p(160, 140 + y * 40))",
  "            path.addCurve(to: p(440, 90 + y * 50), control1: p(340, 0 + y * 60), control2: p(380, 150 + y * 44))",
  "        }",
  "        return path",
  "    }",
  "}",
];

/**
 * Liquid Glass controls: a 44pt circle around a symbol, a 44pt capsule around a label, the label in
 * the button's tint. iOS 26 draws real glass that answers the finger (`glassEffect` with an
 * interactive `Glass`); iOS 17 to 18 a frosted material with a hairline edge. Shared by the Button's
 * glass style, Glass Bar and Screen Header's glass buttons (declared once per file by name).
 */
export const GLASS_BUTTON_SWIFT = [
  "private struct GlassButtonStyle: ButtonStyle {",
  "    var circle = false",
  "",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        let label = configuration.label",
  "            .font(.system(size: 15, weight: .semibold))",
  "            .foregroundStyle(.tint)",
  "            .frame(width: circle ? 44 : nil, height: 44)",
  "            .padding(.horizontal, circle ? 0 : 16)",
  "            .contentShape(.capsule)",
  "            .scaleEffect(configuration.isPressed ? 0.94 : 1)",
  "            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)",
  "        if #available(iOS 26.0, *) {",
  "            label.glassEffect(.regular.interactive(), in: .capsule)",
  "        } else {",
  "            label",
  "                .background(.ultraThinMaterial, in: .capsule)",
  "                .overlay { Capsule().strokeBorder(.white.opacity(0.14), lineWidth: 0.5) }",
  "        }",
  "    }",
  "}",
];

/** `.buttonStyle(GlassButtonStyle(…))` for a control, declaring the style in the file once. */
export function glassButtonStyle(ctx: EmitContext, circle: boolean): string {
  ctx.declare("GlassButtonStyle", GLASS_BUTTON_SWIFT);
  return circle ? "buttonStyle(GlassButtonStyle(circle: true))" : "buttonStyle(GlassButtonStyle())";
}

/** Pastel house fills a card can take (the Studio family's blocks), with dark ink on top in both themes. */
export const TONES: Record<string, { label: string; hex: string }> = {
  peach: { label: "Peach", hex: "#F3B994" }, sky: { label: "Sky", hex: "#AFCBF5" }, sage: { label: "Sage", hex: "#B5DCC0" },
  lilac: { label: "Lilac", hex: "#D3C4F5" }, butter: { label: "Butter", hex: "#F7DB8C" }, sand: { label: "Sand", hex: "#E9D5B3" }, blush: { label: "Blush", hex: "#F6B8CE" },
};

/** The contour lines as a CSS background image, for the web preview. */
export const contourBackground = (stroke = "rgba(20,20,20,.13)") =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' preserveAspectRatio='xMidYMid slice'>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d='${contourD(i)}' fill='none' stroke='${stroke}' stroke-width='1.2'/>`).join("")}</svg>`)}")`;
