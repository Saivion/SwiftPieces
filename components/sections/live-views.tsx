"use client";
import { useEffect, useRef, useState } from "react";
import { Odometer } from "@/components/ui/odometer";

/**
 * How often the total refreshes while the tab is in front. The server re-reads PostHog every two
 * minutes (lib/views.ts), so asking more often than once a minute only costs Worker requests.
 */
const POLL_MS = 60_000;

/**
 * The total is re-read from PostHog every two minutes (lib/views.ts), so new views arrive a few at a
 * time. Shown as is, the number sits still, then jumps. Instead each batch is walked up one view at a
 * time over the two minutes until the next one. It only ever walks toward a total PostHog has
 * reported, so it never shows a view that hasn't happened; it just shows the latest ones a little late.
 */
const SPREAD_MS = 2 * 60_000;
/** The fastest and slowest a walk steps. A batch that lands mid-walk speeds the rest of it up. */
const STEP_MIN_MS = 2_000;
const STEP_MAX_MS = 60_000;
/** A gap this wide (the tab came back after an hour in the background) is shown at once instead. */
const SNAP = 60;

/**
 * The all-time page views across the whole site, from PostHog (lib/views.ts). It only reads: PostHog
 * counts the views themselves (lib/analytics.ts), so watching the number never inflates it.
 *
 * It rides inside the hero's eyebrow pill, after the tagline: "Explored 1,284 times".
 *
 * The count is not rendered into the page: the homepage is static and cached at the edge, so a
 * number baked into it would be frozen at whatever the last build saw. It arrives just after first
 * paint instead, and keeps up on its own.
 *
 * Polling pauses while the tab is hidden, since nobody is reading the number in a background tab.
 */
export function LiveViews({ className }: { className?: string }) {
  // The latest total from the API, and the number on screen, which walks up to it (SPREAD_MS).
  const [target, setTarget] = useState<number | null>(null);
  const [views, setViews] = useState<number | null>(null);
  const pace = useRef(STEP_MAX_MS);
  const paced = useRef<number | null>(null);

  // A new total: the first one, or one far ahead, shows at once; otherwise the walk is paced to
  // spread the gap over SPREAD_MS.
  useEffect(() => {
    if (target === null || target === paced.current) return;
    paced.current = target;
    if (views === null || target - views > SNAP || target < views) setViews(target);
    else if (target > views) pace.current = Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, SPREAD_MS / (target - views)));
  }, [target, views]);

  // The walk: one view at a time toward the total.
  useEffect(() => {
    if (target === null || views === null || views >= target) return;
    const id = setTimeout(() => setViews((v) => (v === null ? v : Math.min(target, v + 1))), pace.current);
    return () => clearTimeout(id);
  }, [target, views]);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // The total only ever moves up (lib/views.ts keeps it from going backwards). A response without
    // a number keeps the last one on screen rather than hiding the line.
    const apply = (value: unknown) => {
      if (live && typeof value === "number") setTarget((t) => (t === null || value > t ? value : t));
    };

    const call = async () => {
      try {
        const res = await fetch("/api/views", { cache: "no-store" });
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
        await call();
        schedule();
      }, POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void call();
        schedule();
      } else {
        clearTimeout(timer);
      }
    };

    void call();
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
      {/* Words rather than an eye icon. The count is page views, not people, so it counts times
          the library was explored rather than claiming a number of developers. */}
      <span className="text-muted">Explored</span>
      <Odometer value={views} className="text-foreground" />
      <span className="text-muted">Times</span>
    </span>
  );
}
