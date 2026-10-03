import { startAnalytics } from "@/lib/analytics";

// PostHog starts on the visitor's first interaction rather than at page load (lib/analytics.ts), the
// way the first screen holds its loops until then: nothing third-party runs before first paint.
const FIRST = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"] as const;

function start() {
  FIRST.forEach((e) => window.removeEventListener(e, start));
  void startAnalytics();
}

FIRST.forEach((e) => window.addEventListener(e, start, { passive: true }));
