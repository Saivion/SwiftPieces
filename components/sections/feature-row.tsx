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
export const sectionTitle = "text-[23.5px] leading-[1.12] font-medium tracking-[-0.025em] text-balance sm:text-[27px]";
export const sectionBody = "text-[15px] leading-[26px] text-pretty text-muted";
export const heroTitle = "text-[34px] leading-[1.04] font-medium tracking-[-0.035em] text-balance sm:text-[42px] lg:text-[49px]";

export function Tags({ tags, className }: { tags: Tag[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
      {tags.map((t) => (
        <li key={t.label} className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <TagIcon>{t.icon}</TagIcon>
          {t.label}
        </li>
      ))}
    </ul>
  );
}

/** Tags, heading, sentence, button: the copy block a section opens with when its visual sits below it. */
export function SectionCopy({ tags, title, body, action, className, bodyClassName }: { tags: Tag[]; title: ReactNode; body?: ReactNode; action?: { label: string; href: string }; className?: string; bodyClassName?: string }) {
  return (
    <Reveal className={className}>
      <Tags tags={tags} className="mb-5" />
      <h2 className={sectionTitle}>{title}</h2>
      {body ? <p className={cn("mt-4", sectionBody, bodyClassName ?? "max-w-xl")}>{body}</p> : null}
      {action ? <RowLink href={action.href} className="mt-8">{action.label}</RowLink> : null}
    </Reveal>
  );
}

/** `reverse` puts the visual on the left from `lg` up; on small screens the copy always leads. */
export function FeatureRow({ tags, title, body, cta, reverse, children }: { tags: Tag[]; title: string; body: string; cta: { label: string; href: string }; reverse?: boolean; children: ReactNode }) {
  return (
    <section className={cn("grid grid-cols-1 items-center gap-12 py-16 sm:py-24 lg:gap-16", reverse ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]")}>
      <Reveal className={reverse ? "lg:order-2" : undefined}>
        <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
          {tags.map((t) => (
            <li key={t.label} className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <TagIcon>{t.icon}</TagIcon>
              {t.label}
            </li>
          ))}
        </ul>
        <h2 className={sectionTitle}>{title}</h2>
        <p className={cn("mt-4 max-w-[34ch]", sectionBody)}>{body}</p>
        <RowLink href={cta.href} className="mt-8">{cta.label}</RowLink>
      </Reveal>
      {/* min-w-0: a wide child (the carousel's scrolling tab rail) must scroll, not widen the column. */}
      <Reveal className="min-w-0">{children}</Reveal>
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

/**
 * The base a visual sits on: no fill, a dashed hairline and a tick at each corner, like an artboard.
 * The page's own dot grid shows through, so the only solid surfaces are the pieces and the
 * floating cards. That keeps the visuals from reading as grey slabs with boxes inside boxes.
 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("frame-dashed relative", className)}>
      <CornerTicks />
      <div className="relative overflow-hidden">{children}</div>
    </div>
  );
}

/** Four small crosshairs sitting on a frame's corners. */
export function CornerTicks() {
  return (
    <>
      {["-top-[5px] -left-[5px]", "-top-[5px] -right-[5px]", "-bottom-[5px] -left-[5px]", "-bottom-[5px] -right-[5px]"].map((pos) => (
        <svg key={pos} aria-hidden viewBox="0 0 9 9" className={cn("pointer-events-none absolute size-[9px] text-white/35", pos)}>
          <path d="M4.5 0v9M0 4.5h9" stroke="currentColor" strokeWidth="1" />
        </svg>
      ))}
    </>
  );
}

/**
 * A card that floats over a panel's corner. In flow below the panel on small screens, where there
 * is no room to overlap; lifted onto the corner from `md` up. Position with md: utilities.
 */
export function Floating({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative mt-3 rounded-[6px] border border-white/[0.09] bg-[#1a1a1b] shadow-[0_30px_70px_-24px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(255_255_255/0.05)] md:absolute md:mt-0", className)}>
      {children}
    </div>
  );
}

/** One line of a floating list: a label, a right-aligned value, and an optional hairline meter. */
export function ListRow({ icon, label, value, meter, accent }: { icon?: ReactNode; label: string; value: string; meter?: number; accent?: boolean }) {
  return (
    <div className="border-b border-[var(--line)] px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-6 text-[12.5px]">
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

/* ---------- Glyphs for tags: 24px grid, drawn to sit inside a 16px tile ---------- */

function G({ children, fill }: { children: ReactNode; fill?: boolean }) {
  return <svg viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

export const Glyph = {
  phone: () => <G><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></G>,
  grid: () => <G><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></G>,
  wand: () => <G><path d="m4 20 11-11" /><path d="m15 4 1.5 1.5M19 8l1.5 1.5M18.5 3.5v2M20.5 5.5h-2" /><path d="m13 7 4 4" /></G>,
  check: () => <G><path d="m5 12.5 4.5 4.5L19 7.5" /></G>,
  eye: () => <G><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></G>,
  tag: () => <G><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" /><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" /></G>,
  bolt: () => <G fill><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></G>,
  split: () => <G><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M12 4v16" /></G>,
  gift: () => <G><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1Z" /></G>,
};
