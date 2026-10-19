"use client";
// The App Library header (Graphite): the page's copy and, in one tray, the three free apps side by
// side over the way into Pro on the left; on the right, in a tray holding a panel, an App Store
// screenshot beside the screen we remixed from it (a Pro app's blurred, with a lock, should one be
// picked). The picked app's pair shows; each has a turn of a few seconds, drawn as a bar filling
// under its name, and the bar running out is what moves to the next one, so whatever holds the bar
// (the motion gate, reduced motion, a hidden tab) holds the turns too. Plain data in (remix-showcase.tsx builds it on the server), so the app library's data
// never reaches the client bundle; the copy and the Pro cell arrive as server-rendered children.
import Link from "next/link";
import { useState, type ReactNode } from "react";
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

      {/* The pair, on a tray holding a panel. On a phone it sits between the copy and the picker; from
          lg it spans both rows, so its bottom edge always lines up with the picks' tray. */}
      <div className="tray flex flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="panel min-h-[300px] flex-1 sm:min-h-[560px]">
          {pairs.map((p, i) => (
            <div key={p.slug} className="remix-pair absolute inset-0 flex items-center justify-center gap-3 px-4 sm:gap-6 sm:px-8" data-active={i === active || undefined} aria-hidden={i !== active || undefined}>
              <Side caption="From the App Store" detail={`© ${p.store.developer}`}>
                <img
                  src={p.store.src}
                  alt={`${p.name} App Store screenshot, shown for reference`}
                  width={p.store.width}
                  height={p.store.height}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-[210px] w-auto rounded-[12px] border border-[var(--line)] sm:h-[430px]"
                />
              </Side>
              <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full border border-[var(--line-strong)] bg-surface-3 text-foreground">
                <Arrow className="size-3.5" />
              </span>
              {/* Our remix opens in the Playground at this very screen. */}
              <Link href={p.remix.href} tabIndex={i === active ? undefined : -1} className="group rounded-[16px] no-underline" aria-label={`Open ${p.remix.title}, our remix inspired by ${p.name}, in the Playground${p.remix.pro ? " (Pro)" : ""}`}>
                <Side caption="SwiftPieces remix" detail={p.remix.pro ? `Pro · ${p.remix.title}` : p.remix.title} ours>
                  <span className="relative block transition-transform duration-300 ease-out group-hover:-translate-y-1">
                    <img
                      src={p.remix.src}
                      alt=""
                      width={480}
                      height={1040}
                      loading={i === 0 ? "eager" : "lazy"}
                      className="h-[210px] w-auto rounded-[14.7%/6.8%] border border-[var(--line)] sm:h-[430px]"
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

      {/* The picks side by side as tiles in one tray, the picked one lifted onto a panel, then the
          way into Pro across the bottom. */}
      <div className="tray flex flex-col gap-2 lg:col-start-1 lg:row-start-2 lg:self-end">
        <ul aria-label="Free remixes" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${pairs.length}, minmax(0, 1fr))` }}>
          {pairs.map((p, i) => (
            <li key={p.slug}>
              <button
                type="button"
                className="relative flex h-full w-full flex-col items-start gap-3.5 rounded-[22px] px-3.5 pt-4 pb-6 text-left text-muted transition-colors duration-200 hover:bg-surface-3 hover:text-foreground data-[active]:bg-surface-2 data-[active]:text-foreground sm:px-4"
                data-active={i === active || undefined}
                aria-pressed={i === active}
                onClick={() => pick(i)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <img src={p.icon} alt="" width={32} height={32} className="size-8 flex-none rounded-[8px]" />
                  <PlanChip pro={Boolean(p.remix.pro)} className="max-sm:hidden" />
                </span>
                <span className="block w-full min-w-0">
                  <span className="block truncate text-[14px] font-medium tracking-[-0.01em]">{p.name}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-subtle">{p.remix.title}</span>
                </span>
                {i === active ? (
                  // Its turn, filling along the tile's foot. When it runs out, the next app is up.
                  <span key={`${active}-${round}`} aria-hidden className="remix-progress rounded-full" style={{ left: 16, right: 16, bottom: 12 }} onAnimationEnd={() => setActive((a) => (a + 1) % pairs.length)} />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        <div>{pro}</div>
      </div>
    </div>
  );
}

function Side({ caption, detail, ours, children }: { caption: string; detail: string; ours?: boolean; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col items-center gap-3">
      {children}
      <figcaption className="max-w-[200px] text-center">
        <span className="flex items-center justify-center gap-1.5 text-[11.5px] font-medium whitespace-nowrap text-foreground sm:text-[12.5px]">
          {ours ? <span aria-hidden className="size-1.5 rounded-full bg-accent" /> : null}
          {caption}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-subtle sm:text-[11.5px]">{detail}</span>
      </figcaption>
    </figure>
  );
}
