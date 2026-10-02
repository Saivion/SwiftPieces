import type { ReactNode } from "react";
import { Arrow } from "@/components/ui/button";
import { ProCard } from "@/components/docs/pro-card";
import { tierById, type Sponsor } from "@/lib/sponsors";
import { cn } from "@/lib/cn";

/**
 * The foot of every docs page's right column, under "On this page": who keeps the library free,
 * then what Pro adds. Pinned to the bottom of the column (mt-auto), in the same glass as the
 * sidebar and navbar.
 */
export function DocsAside({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <div className="mt-auto flex flex-col gap-3 pt-8 pb-3">
      <ProCard />
      <SponsorsCard sponsors={sponsors} />
    </div>
  );
}

/**
 * The right column without a table of contents. The classes are Fumadocs' own TOC column
 * (fumadocs-ui layouts/docs/page/slots/toc.js), so it takes the same grid area, width and stickiness.
 */
export function DocsAsideColumn({ children }: { children: ReactNode }) {
  return (
    <div id="nd-toc" className="sticky top-(--fd-docs-row-1) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] flex flex-col [grid-area:toc] w-(--fd-toc-width) pt-12 pe-4 pb-2 xl:layout:[--fd-toc-width:268px] max-xl:hidden">
      {children}
    </div>
  );
}

/** Gold logos large, Silver small; with no sponsors yet, an open slot that asks for one. */
function SponsorsCard({ sponsors }: { sponsors: Sponsor[] }) {
  const gold = sponsors.filter((s) => s.tier === "gold");
  const silver = sponsors.filter((s) => s.tier === "silver");
  return (
    <div className="docs-glass rounded-[var(--radius)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Sponsors</p>
        <p className="text-[11px] text-subtle">Keep it free</p>
      </div>
      {gold.length ? <Group label={tierById("gold").name} sponsors={gold} large /> : null}
      {silver.length ? <Group label={tierById("silver").name} sponsors={silver} /> : null}
      {!gold.length && !silver.length ? (
        <a href="/sponsors" className="mt-3 flex h-16 items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] text-[12px] text-subtle transition-colors hover:border-[var(--card-border-hover)] hover:text-foreground">
          Your logo here
        </a>
      ) : null}
      <a href="/sponsors" className="group mt-3.5 flex items-center justify-between text-[12px] font-medium text-accent">
        Become a sponsor
        <Arrow className="size-3.5" />
      </a>
    </div>
  );
}

function Group({ label, sponsors, large = false }: { label: string; sponsors: Sponsor[]; large?: boolean }) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">{label}</p>
      <ul className={cn("grid gap-1.5", large ? "grid-cols-1" : "grid-cols-2")}>
        {sponsors.map((s) => (
          <li key={s.name}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer sponsored"
              className={cn("flex items-center gap-2 rounded-[var(--radius)] bg-white/[.04] transition-colors hover:bg-white/[.08]", large ? "px-3 py-2.5 text-[13px] font-medium text-foreground" : "px-2 py-1.5 text-[11.5px] text-muted hover:text-foreground")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote sponsor avatars */}
              <img src={s.logo} alt="" loading="lazy" className={cn("shrink-0 rounded-[3px] object-cover", large ? "size-7" : "size-4")} />
              <span className="truncate">{s.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
