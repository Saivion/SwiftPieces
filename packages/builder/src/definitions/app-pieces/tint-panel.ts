// Tint Panel: a stack on a strong colour field (a navy evening, a berry day, a teal forecast),
// the way calendar and wellness apps give each kind of screen its own ground. Holds any views.
// With zero radius and a tall minimum height it becomes the screen's ground. The ink and night
// grounds are the SwiftPieces card surface and screen ground and follow light and dark; the other
// colours are dark fields that keep their text white. An optional glow washes a sweep colour in.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call, modifiers, num } from "../../core/swift.js";
import { bool, number, opts, select, spacing } from "../shared.js";
import { swiftHex } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

/** Panel grounds: deep enough that white text reads on every one. */
export const PANELS: Record<string, { label: string; top: string; bottom: string }> = {
  plum: { label: "Plum night", top: "#1E0C2A", bottom: "#12071B" },
  navy: { label: "Navy", top: "#1B2352", bottom: "#141A40" },
  berry: { label: "Berry", top: "#A04E73", bottom: "#944468" },
  teal: { label: "Deep teal", top: "#0F4A5A", bottom: "#0B3B48" },
  charcoal: { label: "Charcoal", top: "#1C1C1E", bottom: "#151517" },
  forest: { label: "Forest", top: "#1F3B2C", bottom: "#152A1F" },
  ember: { label: "Ember", top: "#6B2A1A", bottom: "#4F1E12" },
  ink: { label: "Ink (the card surface, light and dark)", top: "#141416", bottom: "#0E0E10" },
  night: { label: "Night (the screen ground, light and dark)", top: "#070708", bottom: "#070708" },
  clear: { label: "Clear (no fill: the screen's own background)", top: "transparent", bottom: "transparent" },
};

/** The fills that are the theme's own surfaces, so they follow the appearance: [dark, light]. */
export const THEME_FILLS: Record<string, [string, string]> = { ink: ["#141416", "#FFFFFF"], night: ["#070708", "#F3F2EE"], clear: ["transparent", "transparent"] };

/** Glows: a sweep colour washed in from the top edge. */
export const GLOWS: Record<string, string> = { signal: "#FF0000", ember: "#FF7A3C", blush: "#FF8FB8", azure: "#4D8DFF" };

/** Its contents settle in (from 0.95 with a fade) when the panel first appears; a cross-fade under Reduce Motion. */
const ENTRANCE = [
  "private struct TintPanelEntrance: ViewModifier {",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "",
  "    func body(content: Content) -> some View {",
  "        content",
  "            .opacity(shown ? 1 : 0)",
  "            .scaleEffect(shown || reduceMotion ? 1 : 0.95, anchor: .top)",
  "            .onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }",
  "    }",
  "}",
];

/** The theme grounds (ink, night): the SwiftPieces surface or ground in light and dark, with an optional glow. */
const GROUND = [
  "private struct TintPanelGround: View {",
  "    var surface = false",
  "    var glow: Color? = nil",
  "    var radius: CGFloat = 0",
  "    @Environment(\\.colorScheme) private var scheme",
  "",
  "    var body: some View {",
  "        let dark = scheme == .dark",
  "        let fill = surface",
  "            ? (dark ? Color(red: 0.078, green: 0.078, blue: 0.086) : Color.white)",
  "            : (dark ? Color(red: 0.027, green: 0.027, blue: 0.031) : Color(red: 0.953, green: 0.949, blue: 0.933))",
  "        ZStack {",
  "            fill",
  "            if let glow {",
  "                RadialGradient(colors: [glow.opacity(dark ? 0.22 : 0.12), .clear], center: .top, startRadius: 0, endRadius: 460)",
  "            }",
  "        }",
  "        .clipShape(.rect(cornerRadius: radius, style: .continuous))",
  "    }",
  "}",
];

export const tintPanel: SwiftPieceDefinition = {
  id: "tint-panel",
  name: "Tint Panel",
  category: "layout",
  description: "A stack on a strong colour field with a soft vertical fade, or on the theme's own surface or ground in light and dark. Give it no radius and a tall minimum height to make it the screen's ground.",
  availability: "free",
  preview: { component: "tint-panel", chunk: "app-pieces" },
  card: (p) => (Number(p.radius ?? 0) > 0 ? Number(p.radius) : null),
  icon: "rectangle.stack",
  container: { axis: "v" },
  concepts: ["vstack", "background"],
  anatomy: [
    { part: "Ground", props: ["fill", "fade", "glow"] },
    { part: "Stack", props: ["alignment", "spacing", "padding"] },
    { part: "Shape", props: ["radius", "minHeight"] },
  ],
  interactions: ["spring", "transition"],
  variants: [
    { id: "ground", label: "Screen ground", props: { radius: 0, minHeight: 760, padding: 24 } },
    { id: "card", label: "Card", props: { radius: 24, minHeight: 0, padding: 20 } },
  ],
  states: [
    { id: "berry", label: "Berry", props: { fill: "berry" } },
    { id: "glow", label: "Ink with a glow", props: { fill: "ink", glow: "signal" } },
  ],
  properties: [
    select("fill", "Colour", "navy", opts(...Object.entries(PANELS).map(([id, v]) => [id, v.label] as [string, string]))),
    bool("fade", "Fade", true, { hint: "A slight darkening towards the bottom." }),
    select("glow", "Glow", "none", opts(["none", "None"], ["signal", "Signal"], ["ember", "Ember"], ["blush", "Blush"], ["azure", "Azure"]), { hint: "A sweep colour washed in from the top." }),
    select("alignment", "Alignment", "leading", opts(["leading", "Leading"], ["center", "Center"], ["trailing", "Trailing"])),
    spacing("spacing", "Spacing", 16),
    spacing("padding", "Padding", 24, 48),
    number("radius", "Corner radius", 0, 0, 44),
    number("minHeight", "Minimum height", 760, 0, 900, 10),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("TintPanelEntrance", ENTRANCE);
      const fillId = s(p, "fill") || "navy";
      const themed = Boolean(THEME_FILLS[fillId]);
      const panel = PANELS[fillId] ?? PANELS.navy;
      const a = s(p, "alignment") || "leading";
      const fill = p.fade === false ? swiftHex(panel.top) : `LinearGradient(colors: [${swiftHex(panel.top)}, ${swiftHex(panel.bottom)}], startPoint: .top, endPoint: .bottom)`;
      const minH = n(p, "minHeight");
      const frameAlign = a === "center" ? "top" : `top${a[0].toUpperCase()}${a.slice(1)}`;
      const radius = num(ctx.corner(n(p, "radius")));
      const glow = GLOWS[s(p, "glow")];
      // Clear paints nothing: the padding and layout of a panel on whatever the screen's ground is.
      const clear = fillId === "clear";
      if (themed && !clear) ctx.declare("TintPanelGround", GROUND);
      const lines = call("VStack", [a !== "center" && ["alignment", `.${a}`], ["spacing", num(ctx.space(n(p, "spacing")))]], ctx.children().flat());
      return {
        lines: modifiers(lines, [
          "modifier(TintPanelEntrance())",
          n(p, "padding") > 0 && `padding(${num(ctx.space(n(p, "padding")))})`,
          `frame(maxWidth: .infinity, ${minH > 0 ? `minHeight: ${num(minH)}, ` : ""}alignment: .${frameAlign})`,
          clear
            ? false
            : themed
            ? `background(TintPanelGround(${[fillId === "ink" && "surface: true", glow && `glow: ${swiftHex(glow)}`, radius !== "0" && `radius: ${radius}`].filter(Boolean).join(", ")}))`
            : glow
              ? `background { ZStack { ${fill}; RadialGradient(colors: [${swiftHex(glow, 0.22)}, .clear], center: .top, startRadius: 0, endRadius: 460) }.clipShape(.rect(cornerRadius: ${radius})) }`
              : `background(${fill}, in: .rect(cornerRadius: ${radius}))`,
          !themed && "foregroundStyle(.white)",
          !themed && "environment(\\.colorScheme, .dark)",
        ]),
      };
    },
  },
};
