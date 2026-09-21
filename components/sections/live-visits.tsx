"use client";
import { useEffect, useState } from "react";

/** How often the count refreshes while the tab is in front. */
const POLL_MS = 15_000;

const exact = new Intl.NumberFormat("en");

/**
 * The visit count, kept current in the browser.
 *
 * `initial` is whatever the page was built with, which is usually nothing: the Cloudflare build has
 * no Worker secrets, so the prerendered HTML carries no count. The first poll runs immediately on
 * mount and fills it in, so the number no longer depends on the page being rebuilt.
 *
 * Polling pauses while the tab is hidden. A background tab has nobody reading the number, and this
 * would otherwise be a request every 15 seconds for as long as the tab stayed open.
 *
 * Cloudflare's own ingestion lag sets the real floor here: the number moves as soon as Web
 * Analytics exposes the change, which is a minute or two, not 15 seconds.
 */
export function LiveVisits({ initial, children }: { initial: number | null; children: React.ReactNode }) {
  const [visits, setVisits] = useState<number | null>(initial);
  // Until the first answer lands the row keeps its height, so a count arriving never shifts the
  // hero. Once we know there is no count to show, it collapses.
  const [answered, setAnswered] = useState(initial !== null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const read = async () => {
      try {
        const res = await fetch("/api/visits", { cache: "no-store" });
        const data = (await res.json()) as { visits: number | null };
        if (live) setVisits(typeof data.visits === "number" ? data.visits : null);
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
        await read();
        schedule();
      }, POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void read();
        schedule();
      } else {
        clearTimeout(timer);
      }
    };

    void read();
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (answered && visits === null) return null;

  return (
    <div className="flex min-h-7 items-center gap-3">
      {children}
      <p className="text-[13px] text-muted">
        {visits === null ? null : (
          <>
            <span className="font-semibold text-foreground tabular-nums">{exact.format(visits)}</span> total visits
          </>
        )}
      </p>
    </div>
  );
}
