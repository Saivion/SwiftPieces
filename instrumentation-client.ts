import { startAnalytics } from "@/lib/analytics";
import { guardForeignDomEdits } from "@/lib/dom-guard";

// Before hydration, so a translated page can't crash React's first update (lib/dom-guard.ts).
guardForeignDomEdits();

// PostHog starts on the visitor's first interaction rather than at page load (lib/analytics.ts), the
// way the first screen holds its loops until then: nothing third-party runs before first paint.
const FIRST = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"] as const;

function start() {
  FIRST.forEach((e) => window.removeEventListener(e, start));
  void startAnalytics();
}

FIRST.forEach((e) => window.addEventListener(e, start, { passive: true }));
