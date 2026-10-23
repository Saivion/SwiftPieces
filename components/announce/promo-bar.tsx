"use client";
import { useEffect, useState } from "react";
import { promoKey, type Promo } from "@/lib/promo";

const pad = (n: number) => String(n).padStart(2, "0");

/** "2d 04:12:09", or "04:12:09" inside the last day. */
function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? `${d}d ${clock}` : clock;
}

function Countdown({ endsAt, onEnd }: { endsAt: string; onEnd: () => void }) {
  const end = Date.parse(endsAt);
  // Empty on the server and the first client frame, so the clock never mismatches on hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (now !== null && now >= end) onEnd();
  }, [now, end, onEnd]);
  return (
    <span className="promo-clock tabular-nums" aria-label="Time left">
      {now === null ? " " : left(end - now)}
    </span>
  );
}

/**
 * The announcement bar over the navbar: pearl glass, with soft pastel clouds drifting slowly under a
 * clear pane (globals.css .promo-bar). One line: the offer, an optional countdown, and a glass pill to
 * Pro. Closing it is remembered in this browser; promo-boot.tsx hides a closed bar before first
 * paint so the navbar never jumps.
 */
export function PromoBar({ promo, hidden = false }: { promo: Promo; hidden?: boolean }) {
  const [gone, setGone] = useState(false);
  const close = () => {
    try {
      localStorage.setItem(promoKey(promo.id), "1");
    } catch {}
    document.documentElement.classList.add("promo-off");
    setGone(true);
  };
  if (gone) return null;

  return (
    <div className="promo-slot" data-hidden={hidden || undefined} inert={hidden}>
      <div className="promo-bar" role="region" aria-label="Announcement">
        <div aria-hidden className="promo-aura">
          <i /><i /><i /><i />
        </div>
        <div aria-hidden className="promo-glass" />

        <a href={promo.cta.href} className="promo-line group">
          <span className="promo-message">
            <span className="promo-long">{promo.message}</span>
            {promo.short && <span className="promo-short">{promo.short}</span>}
            {promo.emphasis && <b className="promo-emphasis">{promo.emphasis}</b>}
          </span>
          {promo.endsAt && (
            <>
              <span aria-hidden className="promo-sep">·</span>
              <Countdown endsAt={promo.endsAt} onEnd={() => setGone(true)} />
            </>
          )}
          <span className="promo-cta">
            {promo.cta.label}
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </a>

        <button type="button" onClick={close} aria-label="Close announcement" className="promo-close">
          <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    </div>
  );
}
