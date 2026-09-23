"use client";
import { useEffect } from "react";

const EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"] as const;

/**
 * Loads Cloudflare's beacon on the visitor's first interaction rather than at page load.
 *
 * Loaded eagerly, it was a third-party request on the critical path, and where it is blocked
 * (content blockers, audit tools) its failed request logged a console error that cost the Best
 * Practices score. Deferred, a bounce with no pointer, key, touch or scroll goes uncounted, which
 * this client-side count already under-reports anyway. The script element is built with DOM APIs:
 * no inline HTML, no code assembled from strings.
 */
export function BeaconLoader({ token }: { token: string }) {
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      EVENTS.forEach((e) => window.removeEventListener(e, go));
      const beacon = document.createElement("script");
      beacon.defer = true;
      beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
      beacon.setAttribute("data-cf-beacon", JSON.stringify({ token }));
      document.head.appendChild(beacon);
    };
    EVENTS.forEach((e) => window.addEventListener(e, go, { passive: true }));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, go));
  }, [token]);
  return null;
}
