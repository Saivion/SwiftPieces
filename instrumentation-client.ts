import { startAnalytics, startDatabuddy } from "@/lib/analytics";
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

// Databuddy waits for the page to load and the browser to go idle instead, so a visit that never
// interacts still counts and its Web Vitals still arrive (lib/analytics.ts).
function startWhenIdle() {
  if ("requestIdleCallback" in window) window.requestIdleCallback(startDatabuddy, { timeout: 2000 });
  else setTimeout(startDatabuddy, 1000);
}

if (document.readyState === "complete") startWhenIdle();
else window.addEventListener("load", startWhenIdle, { once: true });
