// What an app piece does when it moves on (a feeling picked, a mood tapped): the statement that
// runs, plus the presentation modifier it needs, for every kind of link a project can hold.
import type { EmitContext } from "../../core/schema.js";
import { INDENT } from "../../core/swift.js";

/**
 * The Swift statement that follows `value` (push, sheet, root, back), with the modifier that
 * presents the destination attached to the node. Null when the link is empty or dangling.
 */
export function linkAction(ctx: EmitContext, value: unknown): string | null {
  const target = ctx.link(String(value ?? ""));
  if (!target) return null;
  if (target.kind === "back") return `${ctx.dismiss()}()`;
  if (target.kind === "root") return `${target.flag} = true`;
  if (target.kind === "tab") return target.set;
  const flag = ctx.state(`show${target.view.replace(/View$/, "")}`, "", "false");
  if (target.kind === "push") {
    ctx.attach([`.navigationDestination(isPresented: $${flag}) {`, `${INDENT}${target.view}()`, "}"]);
  } else {
    ctx.attach([`.sheet(isPresented: $${flag}) {`, `${INDENT}NavigationStack { ${target.view}() }`, "}"]);
  }
  return `${flag} = true`;
}

/** An HSB colour as CSS, so previews and the exported `Color(hue:saturation:brightness:)` agree. */
export function hsb(h: number, s: number, v: number, alpha = 1): string {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return alpha === 1 ? `rgb(${f(5)}, ${f(3)}, ${f(1)})` : `rgba(${f(5)}, ${f(3)}, ${f(1)}, ${alpha})`;
}

/** Comma-separated words, trimmed, empties dropped. */
export const words = (value: unknown, max = 40) =>
  String(value ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, max);

/** A Swift string array literal. */
export const swiftArray = (items: string[], str: (s: string) => string) => `[${items.map(str).join(", ")}]`;

/**
 * The entrance every wellbeing piece plays once on first appearance: up from 0.95 with a fade, under
 * 300 ms on a strong ease-out, after a stagger delay. Reduce Motion keeps only the fade.
 */
export const ENTRANCE = [
  "private struct WellbeingEntrance: ViewModifier {",
  "    let shown: Bool",
  "    var delay: Double = 0",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    func body(content: Content) -> some View {",
  "        content",
  "            .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "            .opacity(shown ? 1 : 0)",
  "            .animation(reduceMotion ? .easeOut(duration: 0.2) : .timingCurve(0.22, 1, 0.36, 1, duration: 0.28).delay(delay), value: shown)",
  "    }",
  "}",
];

/** Press feedback for buttons and cards: a quick dip to 0.97 while held. */
export const PRESS_STYLE = [
  "private struct WellbeingPressStyle: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)",
  "    }",
  "}",
];

/** A stagger delay in seconds for Swift: 40 ms a step, capped at 8 steps. */
export const swiftStagger = (index: string) => `Double(min(${index}, 7)) * 0.04`;
