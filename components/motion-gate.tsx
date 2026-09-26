"use client";
import { useEffect } from "react";

const EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "wheel"] as const;

/**
 * Whether this page was opened by a click on swiftpieces.com or pro.swiftpieces.com. That click was
 * the visitor's interaction, just on the other site, so the page should move on arrival instead of
 * holding still until the pointer moves again. Both sites send `strict-origin-when-cross-origin`,
 * so the other site's origin arrives as the referrer. Local dev servers count too.
 *
 * A fresh load with no referrer (a typed URL, a bookmark, PageSpeed and Lighthouse) still waits.
 */
function arrivedFromSwiftPieces(): boolean {
  try {
    const from = new URL(document.referrer).hostname;
    return from === "swiftpieces.com" || from.endsWith(".swiftpieces.com") || from === "localhost" || from === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * The motion gate. The first screen's endless loops (the ticker, the Pro count shimmer, the hero
 * mark) hold still until the visitor first interacts, so the page paints complete and settled. On
 * the first pointer, key, touch or scroll this sets `data-motion` on <html>, which CSS reads
 * (globals.css), and fires `sp:motion`, which the hero canvas listens for.
 *
 * A client component rather than a script tag: it rides in the bundle the page already loads, so it
 * costs no request, no preload and no inline HTML.
 */
export function MotionGate() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.motion) return;
    const go = () => {
      root.dataset.motion = "on";
      EVENTS.forEach((e) => window.removeEventListener(e, go));
      window.dispatchEvent(new Event("sp:motion"));
    };
    if (arrivedFromSwiftPieces()) {
      go();
      return;
    }
    EVENTS.forEach((e) => window.addEventListener(e, go, { passive: true }));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, go));
  }, []);
  return null;
}
