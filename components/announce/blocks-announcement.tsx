"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Arrow, buttonClass } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { NewBadge } from "@/components/ui/new-badge";
import { cn } from "@/lib/cn";

/** Bump the date when a new announcement replaces this one, so everyone sees the next one once. */
const SEEN_KEY = "sp-announce-patterns-2026-10";
/** How long after a page settles before the card comes up, so it never fights the first paint. */
const DELAY_MS = 1400;

export type AnnouncedBlock = { id: string; title: string; still: string };

/**
 * The Patterns announcement: once per visitor, a card over the page that introduces Pro's patterns and
 * sends people to /patterns. Graphite's shape: a tray holding a panel, three pattern stills fanned on a
 * quiet dot field at the top, the mark with the New badge, one statement line, one sentence, then an
 * ink pill and a quiet "Maybe later". Never on the patterns pages themselves, where it would announce
 * what is already on screen. Dismissed (any way) means gone, remembered in this browser only.
 */
export function BlocksAnnouncement({ blocks, count }: { blocks: AnnouncedBlock[]; count: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const onBlocks = pathname.startsWith("/patterns") || pathname.startsWith("/docs/patterns");

  useEffect(() => {
    if (onBlocks) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) return;
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [onBlocks]);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setLeaving(true);
    setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 220);
  };

  // While open: Escape closes, the page under it holds still, and focus moves into the card (onto the
  // dialog itself, so no button wears a focus ring before anyone has pressed a key; Tab reaches them).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    dialog.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = was;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={cn("announce fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6", leaving && "announce-out")}>
      {/* The page under it, dimmed and softened; a click outside the card closes it. */}
      <button type="button" aria-label="Close" tabIndex={-1} onClick={close} className="announce-backdrop absolute inset-0 cursor-default bg-[#000]/45 backdrop-blur-[6px]" />

      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="announce-title" className="announce-card tray relative w-full max-w-[520px] outline-none">
        <div className="panel">
          {/* ------------------------------------------------ Stage: three blocks, fanned */}
          <div className="relative h-[210px] overflow-hidden rounded-[17px] bg-surface sm:h-[236px]">
            <div aria-hidden className="absolute inset-0">
              <div className="dot-field dot-field-soft absolute inset-0" />
              <div className="dot-field absolute inset-0" />
            </div>
            <div aria-hidden className="absolute inset-x-0 top-7 flex justify-center">
              {blocks.slice(0, 3).map((b, i) => {
                const side = i - 1; // -1 left, 0 centre, 1 right
                return (
                  <div
                    key={b.id}
                    className={cn("announce-tile absolute top-0 w-[46%] max-w-[220px] overflow-hidden rounded-[16px] border border-[var(--line-strong)] bg-[#f0efe9] shadow-[var(--shadow-float)]", side === 0 ? "z-10" : "z-0")}
                    style={{ "--x": `${side * 58}%`, "--y": `${Math.abs(side) * 22}px`, "--r": `${side * 7}deg`, animationDelay: `${120 + Math.abs(side) * 90}ms` } as CSSProperties}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a small still of a Pro block's preview */}
                    <img src={b.still} alt="" width={1120} height={1120} decoding="async" className="block aspect-square w-full object-cover" />
                  </div>
                );
              })}
            </div>
            {/* The stage fades into the panel under it, so the tiles read as rising out of the copy. */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--surface-2)]" />
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 grid size-9 place-items-center rounded-full border border-[var(--line-strong)] bg-surface-3/90 text-muted backdrop-blur-sm transition-colors hover:text-foreground"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>

          {/* ------------------------------------------------ Copy */}
          <div className="px-5 pt-3 pb-5 sm:px-7 sm:pb-7">
            <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
              <LogoMark className="size-5" />
              Patterns
              <NewBadge />
            </p>
            <h2 id="announce-title" className="mt-4 text-[26px] leading-[1.1] font-normal tracking-[-0.03em] text-balance sm:text-[30px]">Whole sections, ready to drop in.</h2>
            <p className="mt-3 text-[15px] leading-[25px] text-pretty text-muted">
              AI chat, tab bars, settings, forms, sign in and checkout, themed by one design system. {count} patterns in 12 categories, in SwiftPieces Pro.
            </p>
            <div className="mt-6 flex gap-2.5">
              {/* Going to the patterns counts as seen, like closing. */}
              <Link href="/patterns" onClick={close} className={buttonClass("primary", "md", "flex-1")}>
                Explore Patterns <Arrow />
              </Link>
              <Button variant="secondary" onClick={close}>Maybe later</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
