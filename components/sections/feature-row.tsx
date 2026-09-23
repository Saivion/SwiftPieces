import type { ReactNode } from "react";
import { Reveal } from "@/components/effects/reveal";
import { Button, Arrow } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The landing page's one section shape, below the hero: a narrow copy column (tags, a quiet
 * heading, one sentence, one button) beside a wide visual built from real pieces and real output.
 * Deliberately small type and lots of air: the visuals carry the page, the copy only names them.
 */

export type Tag = { label: string; icon: ReactNode };

/** The section heading and subtitle every block below the hero uses, so they cannot drift apart. */
export const sectionTitle = "text-[26px] leading-[1.12] font-medium tracking-[-0.025em] text-balance sm:text-[30px]";
export const sectionBody = "text-[16px] leading-[26px] text-pretty text-muted";

/** `reverse` puts the visual on the left from `lg` up; on small screens the copy always leads. */
export function FeatureRow({ tags, title, body, cta, reverse, children }: { tags: Tag[]; title: string; body: string; cta: { label: string; href: string }; reverse?: boolean; children: ReactNode }) {
  return (
    <section className={cn("grid items-center gap-12 py-16 sm:py-24 lg:gap-16", reverse ? "lg:grid-cols-[2fr_1fr]" : "lg:grid-cols-[1fr_2fr]")}>
      <Reveal className={reverse ? "lg:order-2" : undefined}>
        <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
          {tags.map((t) => (
            <li key={t.label} className="flex items-center gap-1.5 text-[13px] text-muted">
              <TagIcon>{t.icon}</TagIcon>
              {t.label}
            </li>
          ))}
        </ul>
        <h2 className={sectionTitle}>{title}</h2>
        <p className={cn("mt-4 max-w-[34ch]", sectionBody)}>{body}</p>
        <RowLink href={cta.href} className="mt-8">{cta.label}</RowLink>
      </Reveal>
      <Reveal>{children}</Reveal>
    </section>
  );
}

/** Each row's action: the site's own Button (the navbar's Get Pro, the hero's CTA), in its light variant. */
export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <Button variant="secondary" href={href} className={className}>{children} <Arrow /></Button>;
}

/** A 16px tile behind a tag's glyph: a lifted chip, not a colored badge. */
export function TagIcon({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span aria-hidden className={cn("grid size-4 place-items-center rounded-[5px] p-[3px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] [&_svg]:size-full", accent ? "bg-accent/15 text-accent" : "bg-surface-muted text-[#c4c4c4]")}>
      {children}
    </span>
  );
}

/* ---------- Surfaces the visuals are built from ---------- */

/** The base panel a visual sits on: one hairline edge, nothing else. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#0e0e0f]", className)}>{children}</div>;
}

/**
 * A card that floats over a panel's corner. In flow below the panel on small screens, where there
 * is no room to overlap; lifted onto the corner from `md` up. Position with md: utilities.
 */
export function Floating({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative mt-3 rounded-[16px] border border-white/[0.09] bg-[#1a1a1b] shadow-[0_30px_70px_-24px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(255_255_255/0.05)] md:absolute md:mt-0", className)}>
      {children}
    </div>
  );
}

/** One line of a floating list: a label, a right-aligned value, and an optional hairline meter. */
export function ListRow({ icon, label, value, meter, accent }: { icon?: ReactNode; label: string; value: string; meter?: number; accent?: boolean }) {
  return (
    <div className="border-b border-[var(--line)] px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-6 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 text-foreground">
          {icon ? <TagIcon accent={accent}>{icon}</TagIcon> : null}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 font-medium text-foreground tabular-nums">{value}</span>
      </div>
      {meter !== undefined ? (
        <div className="mt-2 ml-auto h-px w-16 bg-white/10">
          <div className={cn("h-px", accent ? "bg-accent" : "bg-white/60")} style={{ width: `${Math.round(meter * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}
