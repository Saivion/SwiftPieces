"use client";
import { useEffect, useState } from "react";
import { Odometer } from "@/components/ui/odometer";

/** How often the total refreshes while the tab is in front. */
const POLL_MS = 15_000;

/**
 * One page load counts once, no matter how many times this mounts.
 *
 * React Strict Mode runs effects twice in development, and a client navigation back to the home
 * page mounts this again. Neither is a new page view, so the POST is fired once per document.
 */
let counted = false;

/**
 * The all-time view count, counted and read from our own Cloudflare KV counter (lib/views.ts).
 *
 * It rides inside the hero's eyebrow pill, after the tagline, as an eye and a number.
 *
 * The count is not rendered into the page: the homepage is static and cached at the edge, so a
 * number baked into it would be frozen at whatever the last build saw. It arrives just after first
 * paint instead, and keeps up on its own.
 *
 * Polling pauses while the tab is hidden, since nobody is reading the number in a background tab.
 */
export function LiveViews({ className }: { className?: string }) {
  const [views, setViews] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = (value: unknown) => {
      if (live) setViews(typeof value === "number" ? value : null);
    };

    const call = async (method: "GET" | "POST") => {
      try {
        // The path rides along on the count so reporting can group views by page and by piece.
        const url = method === "POST" ? `/api/views?path=${encodeURIComponent(location.pathname)}` : "/api/views";
        const res = await fetch(url, { method, cache: "no-store" });
        // A 429 or 5xx carries no count. Treat it like a dropped poll and keep the last number,
        // rather than reading `views` off an error body and hiding the line.
        if (!res.ok) return;
        const data = (await res.json()) as { views: number | null };
        apply(data.views);
      } catch {
        // Leave the last good number on screen; a dropped poll is not worth a visible change.
      }
    };

    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      timer = setTimeout(async () => {
        await call("GET");
        schedule();
      }, POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void call("GET");
        schedule();
      } else {
        clearTimeout(timer);
      }
    };

    // The first call of the document counts; every later one only reads.
    const first = counted ? "GET" : "POST";
    counted = true;
    void call(first);
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Nothing shows until there is a number, so a missing count never leaves an empty slot in the pill.
  if (views === null) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span aria-hidden className="mx-1 h-3.5 w-px bg-white/15" />
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <Odometer value={views} className="text-foreground" />
      <span className="sr-only">views</span>
    </span>
  );
}
