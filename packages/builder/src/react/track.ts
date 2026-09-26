// Client side of the builder's product analytics. Events queue in memory and leave in one small
// batch every few seconds (and when the tab hides) through `sendBeacon`, so no interaction ever waits
// on the network and a burst of edits is one request, not dozens. The server keeps only allow-listed
// names and short enum values (core/events.ts): no project, no text, no ids.

type Queued = { name: string; props?: Record<string, string | number> };

const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let bound = false;

let endpoint = "/api/events";

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify(queue.splice(0, 20));
  try {
    const sent = navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }));
    if (!sent) void fetch(endpoint, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  } catch {}
  if (queue.length) timer = setTimeout(flush, 1000);
}

/** Returns a `track` function for BuilderHost that posts batches to `url`. */
export function beaconTracker(url = "/api/events") {
  endpoint = url;
  return trackBuilder;
}

function trackBuilder(name: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  // Respect Do Not Track / Global Privacy Control: nothing leaves the browser.
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
  queue.push({ name, props });
  if (!bound) {
    bound = true;
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }
  if (!timer) timer = setTimeout(flush, 5000);
}
