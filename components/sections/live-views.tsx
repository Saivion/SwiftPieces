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
 * The count is not rendered into the page: the homepage is static and cached at the edge, so a
 * number baked into it would be frozen at whatever the last build saw. It arrives just after first
 * paint instead, and keeps up on its own.
 *
 * Polling pauses while the tab is hidden, since nobody is reading the number in a background tab.
 */
export function LiveViews({ className }: { className?: string }) {
  const [views, setViews] = useState<number | null>(null);
  // Until the first answer lands the row keeps its height, so the number arriving never shifts the
  // hero. Once we know there is nothing to show, it collapses.
  const [answered, setAnswered] = useState(false);

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
        const data = (await res.json()) as { views: number | null };
        apply(data.views);
      } catch {
        // Leave the last good number on screen; a dropped poll is not worth a visible change.
      } finally {
        if (live) setAnswered(true);
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

  if (answered && views === null) return null;

  return (
    <p className={`flex min-h-6 items-baseline gap-2 text-[13px] text-muted ${className ?? ""}`}>
      {views === null ? null : (
        <>
          <Odometer value={views} className="text-[15px] font-semibold text-foreground" />
          <span>views</span>
        </>
      )}
    </p>
  );
}
