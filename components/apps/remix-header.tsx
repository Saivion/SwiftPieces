"use client";
// The App Library header: the page's copy and the three free apps side by side on the left, and on
// the right an App Store screenshot beside the screen we remixed from it (a Pro app's blurred, with a
// lock, should one be picked). The picked app's pair shows; each has a
// turn of a few seconds, drawn as a bar filling under its name, and the bar running out is what moves
// to the next one, so whatever holds the bar (the motion gate, reduced motion, a hidden tab) holds
// the turns too. Plain data in (remix-showcase.tsx builds it on the server), so the app library's data
// never reaches the client bundle; the copy and the Pro cell arrive as server-rendered children.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CornerTicks } from "@/components/sections/feature-row";
import { Arrow } from "@/components/ui/button";
import { LockGlyph, PlanChip } from "./pro-chip";
import { ProSwap } from "./pro-swap";

export type HeaderPair = {
  slug: string;
  name: string;
  icon: string;
  /** The App Store category, quiet at the row's end. */
  category: string;
  store: { src: string; width: number; height: number; developer: string };
  /** Our screen: a Pro app's is blurred (`pro`), and opens with Pro. */
  remix: { src: string; title: string; href: string; pro?: boolean };
};

export function RemixHeader({ pairs, intro, pro }: { pairs: HeaderPair[]; intro: ReactNode; pro: ReactNode }) {
  const [active, setActive] = useState(0);
  // Bumped on every pick, so the picked app's bar starts again from empty.
  const [round, setRound] = useState(0);
  const pick = (i: number) => {
    setActive(i);
    setRound((n) => n + 1);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-x-16 lg:gap-y-10">
      <div className="lg:col-start-1 lg:row-start-1">{intro}</div>

      {/* The pair. On a phone it sits between the copy and the picker; from lg it spans both rows, so
          its bottom edge always lines up with the Pro cell's. */}
      <div className="frame-dashed relative flex flex-col [--grid-line:var(--card-border)] lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <CornerTicks />
        <div className="relative min-h-[300px] flex-1 sm:min-h-[560px]">
          {pairs.map((p, i) => (
            <div key={p.slug} className="remix-pair absolute inset-0 flex items-center justify-center gap-3 px-4 sm:gap-6 sm:px-8" data-active={i === active || undefined} aria-hidden={i !== active || undefined}>
              <Side caption="From the App Store" detail={`© ${p.store.developer}`}>
                <img
                  src={p.store.src}
                  alt={`${p.name} App Store screenshot, shown for reference`}
                  width={p.store.width}
                  height={p.store.height}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-[210px] w-auto rounded-[8px] border border-[var(--card-border)] sm:h-[430px]"
                />
              </Side>
              <span aria-hidden className="grid size-8 flex-none place-items-center rounded-full border border-[var(--card-border)] bg-[var(--raised)] text-foreground">
                <Arrow className="size-3.5" />
              </span>
              {/* Our remix opens in the Playground at this very screen. */}
              <Link href={p.remix.href} tabIndex={i === active ? undefined : -1} className="group rounded-[12px] no-underline" aria-label={`Open ${p.remix.title}, our remix inspired by ${p.name}, in the Playground${p.remix.pro ? " (Pro)" : ""}`}>
                <Side caption="Swift Pieces remix" detail={p.remix.pro ? `Pro · ${p.remix.title}` : p.remix.title} ours>
                  <span className="relative block transition-transform duration-300 ease-out group-hover:-translate-y-1">
                    <img
                      src={p.remix.src}
                      alt=""
                      width={480}
                      height={1040}
                      loading={i === 0 ? "eager" : "lazy"}
                      className="h-[210px] w-auto rounded-[14.7%/6.8%] border border-[var(--card-border)] sm:h-[430px]"
                    />
                    {p.remix.pro ? (
                      <ProSwap pro={null}>
                        <span aria-hidden className="absolute inset-0 grid place-items-center">
                          <span className="grid size-10 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/15 backdrop-blur-md">
                            <LockGlyph className="size-4" />
                          </span>
                        </span>
                      </ProSwap>
                    ) : null}
                  </span>
                </Side>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* The picks side by side, framed cells sharing their seams, then the way into Pro across the bottom. */}
      <div className="[--grid-line:var(--card-border)] lg:col-start-1 lg:row-start-2 lg:self-end">
        <div className="frame-dashed relative">
          <CornerTicks />
          <SeamTicks count={pairs.length} />
          <ul aria-label="Free remixes" className="frame-row grid" style={{ gridTemplateColumns: `repeat(${pairs.length}, minmax(0, 1fr))` }}>
            {pairs.map((p, i) => (
              <li key={p.slug}>
                <button type="button" className="remix-pick relative flex h-full w-full flex-col items-start gap-3.5 px-3.5 pt-4 pb-5 text-left sm:px-5" data-active={i === active || undefined} aria-pressed={i === active} onClick={() => pick(i)}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <img src={p.icon} alt="" width={32} height={32} className="size-8 flex-none rounded-[8px]" />
                    <PlanChip pro={Boolean(p.remix.pro)} className="max-sm:hidden" />
                  </span>
                  <span className="block w-full min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">{p.remix.title}</span>
                  </span>
                  {i === active ? (
                    // Its turn, filling. When it runs out, the next app is up.
                    <span key={`${active}-${round}`} aria-hidden className="remix-progress" onAnimationEnd={() => setActive((a) => (a + 1) % pairs.length)} />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="frame-cell">{pro}</div>
      </div>
    </div>
  );
}

/** The crosses where the row's seams meet its top and bottom edges, as CornerTicks draws the corners. */
function SeamTicks({ count }: { count: number }) {
  const seams = Array.from({ length: Math.max(0, count - 1) }, (_, k) => `calc(${((k + 1) * 100) / count}% - 5px)`);
  return (
    <>
      {seams.flatMap((left) =>
        ["-top-[4px]", "-bottom-[4px]"].map((edge) => (
          <svg key={`${left}${edge}`} aria-hidden viewBox="0 0 9 9" style={{ left }} className={`pointer-events-none absolute z-10 size-[9px] text-white/35 ${edge}`}>
            <path d="M4.5 0v9M0 4.5h9" stroke="currentColor" strokeWidth="1" />
          </svg>
        )),
      )}
    </>
  );
}

function Side({ caption, detail, ours, children }: { caption: string; detail: string; ours?: boolean; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col items-center gap-3">
      {children}
      <figcaption className="max-w-[200px] text-center">
        <span className="flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-foreground">
          {ours ? <span aria-hidden className="size-1.5 rounded-full bg-accent" /> : null}
          {caption}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-subtle">{detail}</span>
      </figcaption>
    </figure>
  );
}
