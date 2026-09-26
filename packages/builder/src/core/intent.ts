// A deterministic "describe your screen" matcher. It is what the AI layer falls back to when no
// model is available, and it runs entirely in the browser: keywords pick the closest template, then
// a few plain-language tweaks (dark, light, Apple sign in, forgot password) adjust it. It only ever
// rearranges registry components, so its output is as exportable as anything built by hand.
import type { ScreenNode, TemplateDefinition } from "./schema.js";

const KEYWORDS: Record<string, RegExp> = {
  login: /\b(log ?in|sign ?in|signin|auth)/i,
  "sign-up": /\b(sign ?up|register|create (an )?account|join)/i,
  onboarding: /\b(onboard|welcome|intro|first run|get started)/i,
  profile: /\b(profile|account page|avatar|followers)/i,
  settings: /\b(settings|preferences|options)/i,
  "empty-state": /\b(empty|no (items|results|data)|nothing here|zero state)/i,
  home: /\b(home|feed|landing)/i,
  dashboard: /\b(dashboard|analytics|metrics|stats|kpi)/i,
  paywall: /\b(paywall|subscri|upgrade|pricing|purchase|premium)/i,
  detail: /\b(detail|product|item page|article)/i,
  checkout: /\b(checkout|payment|pay|card|send money|transfer)/i,
  chat: /\b(chat|assistant|\bai\b|prompt|conversation)/i,
  verify: /\b(verif|otp|one[- ]time|2fa|code entry)/i,
};

export type IntentMatch = { templateId: string; score: number; tweaks: IntentTweaks };
export type IntentTweaks = { appearance?: "dark" | "light"; apple?: boolean; forgot?: boolean; title?: string };

export function readTweaks(prompt: string): IntentTweaks {
  const t: IntentTweaks = {};
  if (/\b(dark|night|black)\b/i.test(prompt)) t.appearance = "dark";
  else if (/\b(light|white|bright)\b/i.test(prompt)) t.appearance = "light";
  if (/\bapple\b/i.test(prompt)) t.apple = !/\b(no|without)\s+(sign in with )?apple\b/i.test(prompt);
  if (/forgot|reset password/i.test(prompt)) t.forgot = true;
  const named = prompt.match(/\bfor (?:an? |my )?([A-Za-z][\w ]{1,24}?) app\b/i);
  if (named) t.title = named[1].trim();
  return t;
}

/** Best template for the prompt among those available, or null when nothing matches. */
export function matchIntent(prompt: string, templates: TemplateDefinition[]): IntentMatch | null {
  const available = new Set(templates.map((t) => t.id));
  let best: IntentMatch | null = null;
  for (const [id, re] of Object.entries(KEYWORDS)) {
    if (!available.has(id)) continue;
    const hits = prompt.match(new RegExp(re.source, "gi"))?.length ?? 0;
    if (hits && (!best || hits > best.score)) best = { templateId: id, score: hits, tweaks: readTweaks(prompt) };
  }
  return best;
}

/** Applies tweaks to a screen root: appearance, and the Apple and reset-password affordances on sign-in screens. */
export function applyTweaks(root: ScreenNode, tweaks: IntentTweaks): ScreenNode {
  const props = tweaks.appearance ? { ...root.props, appearance: tweaks.appearance } : root.props;
  const keep = (n: ScreenNode): boolean => {
    if (tweaks.apple === false && n.component === "apple-sign-in") return false;
    if (tweaks.forgot === false && n.component === "button" && /forgot/i.test(String(n.props.title))) return false;
    return true;
  };
  const walk = (n: ScreenNode): ScreenNode => (n.children ? { ...n, children: n.children.filter(keep).map(walk) } : n);
  return walk({ ...root, props });
}
