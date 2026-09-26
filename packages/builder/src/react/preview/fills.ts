// Which components take all the width they are offered, the way SwiftUI lays them out. A text
// field, a full-width button or a row with a Spacer are greedy; a label or an icon hugs its
// content. A stack is greedy when anything inside it is, exactly as in SwiftUI. Kept apart from the
// renderers so layout is known before a lazily loaded piece has arrived.
import type { ScreenNode } from "../../core/schema.js";

type Rule = boolean | ((node: ScreenNode) => boolean);

const rules: Record<string, Rule> = {
  input: true, toggle: true, segmented: true, row: true, divider: true, card: true, "apple-sign-in": true,
  button: (n) => n.props.fullWidth === true,
  "elastic-button": (n) => n.props.fullWidth === true,
  spacer: false, text: false, symbol: false,
  "commit-button": true, "hold-to-confirm": true, "form-field": true, "secure-entry": true, "amount-field": true, "filter-rail": true,
  "scrub-stepper": false, "task-row": true, "status-timeline": true, "live-stat": true, odometer: false, "ring-breakdown": true,
  "rating-scrub": false, "reaction-toggle": false, "outcome-screen": true, "skeleton-loader": (n) => n.props.shape !== "circle",
  "status-morph": false, "prompt-chips": true, "thinking-state": true, "text-reveal": false, "expandable-text": true,
  "floating-dock": false, "motion-card": true,
};

const extra = new Map<string, Rule>();
/** Pro (or any host) registers layout rules for its own components. */
export function registerFill(id: string, rule: Rule) {
  extra.set(id, rule);
}

export function fills(node: ScreenNode): boolean {
  if (node.component === "vstack" || node.component === "hstack") {
    if (node.props.style === "card" || node.props.style === "outlined") return true;
    return (node.children ?? []).some((c) => fills(c) || (node.component === "hstack" && c.component === "spacer" && c.props.mode !== "fixed"));
  }
  const rule = extra.get(node.component) ?? rules[node.component];
  if (typeof rule === "function") return rule(node);
  return rule ?? false;
}
