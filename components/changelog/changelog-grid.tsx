import Link from "next/link";
import type { CSSProperties } from "react";
import { Sketch, type SketchKind } from "./sketch";
import { changelogPath } from "@/lib/changelog";
import { cn } from "@/lib/cn";

/** The Pro palette, which tints every changelog card on both sites. */
export const TINTS = {
  red: "#ff0000",
  orange: "#ff7a3c",
  pink: "#ff8fb8",
  blue: "#4d8dff",
  purple: "#a855f7",
} as const;
export type Tint = keyof typeof TINTS;

export type ChangelogEntry = {
  slug: string;
  /** Shown as written: "Sep 23, 2026", or "Sep 2026" when only the month is known. */
  date: string;
  title: string;
  summary: string;
  /** What shipped, one line each. May hold inline code in `backticks`. */
  points: string[];
  visual: SketchKind;
  tint: Tint;
};

/**
 * The panel's ground: a pastel wash of the tint, fading toward the bottom right, in both themes (the
 * wash itself lives in globals.css, .changelog-tint). The drawing is always dark ink on it.
 */
export function tintStyle(tint: Tint): CSSProperties {
  return { ["--tint" as string]: TINTS[tint] };
}


/** The lift and edge every changelog card shares on hover. */
export const CARD = "group overflow-hidden rounded-[var(--radius)] border border-[var(--card-border)] bg-[var(--surface)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-[var(--card-border-hover)] hover:shadow-[0_20px_44px_-26px_rgb(0_0_0/0.4)]";

/**
 * Earlier updates as cards, as many across as the docs column fits: it measures the column rather
 * than the window (container queries), since the sidebar and right column take a changing share of
 * it. Each card is a pastel panel with the update's drawn icon, the date, a two-line headline and a
 * three-line summary, with a Read arrow that slides in on hover, and opens the update's own page.
 * `seedFrom` is the first card's place in the changelog, so each drawing matches its page's.
 */
export function ChangelogGrid({ entries, seedFrom = 1 }: { entries: ChangelogEntry[]; seedFrom?: number }) {
  return (
    <div className="@container">
      <ol className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @4xl:grid-cols-3" aria-label="Earlier updates, newest first">
        {entries.map((e, i) => (
          <li key={e.slug} className="flex flex-col">
            <Link href={changelogPath(e.slug)} className={cn(CARD, "flex h-full flex-col")}>
              <div className="changelog-tint relative grid aspect-[16/10] place-items-center" style={tintStyle(e.tint)}>
                <Sketch kind={e.visual} seed={seedFrom + i} className="h-[42%] w-auto text-[#141414] transition-transform duration-500 group-hover:scale-[1.04]" />
              </div>
              <div className="flex grow flex-col p-4 pb-5">
                <p className="text-[11.5px] leading-none text-subtle">{e.date}</p>
                <h3 className="mt-3 line-clamp-2 text-[15px] leading-[1.3] font-semibold tracking-[-0.015em] text-foreground">{e.title}</h3>
                <p className="mt-2 line-clamp-3 text-[12.5px] leading-[1.55] text-muted">{e.summary}</p>
                <span className="mt-auto flex items-center gap-1 pt-4 text-[12px] font-medium text-subtle transition-colors duration-300 group-hover:text-foreground">
                  Read
                  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-0 group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A point's text with `code` spans. */
export function PointText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part,
      )}
    </>
  );
}
