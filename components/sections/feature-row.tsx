import type { ReactNode } from "react";
import { Reveal } from "@/components/effects/reveal";
import Link from "next/link";
import { Arrow } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The landing page's shared section shapes (Graphite): regular-weight statement headings over muted
 * body copy, outlined tag pills, text links with an arrow, and visuals on trays (a tray one step off
 * the ground holding a panel). The visuals carry the page; the copy only names them.
 */

export type Tag = { label: string; icon: ReactNode };

/** The section heading and subtitle every block below the hero uses, so they cannot drift apart. */
export const sectionTitle = "text-[32px] leading-[1.06] font-normal tracking-[-0.035em] text-balance sm:text-[40px] lg:text-[46px] lg:tracking-[-0.038em]";
export const sectionBody = "text-[16px] leading-[26px] text-pretty text-muted sm:text-[17px] sm:leading-[28px]";
/** A card's title inside a tray (the two-up feature cards, tiles with a caption). */
export const cardTitle = "text-[22px] leading-[1.15] font-normal tracking-[-0.025em] sm:text-[26px] sm:tracking-[-0.03em]";
/**
 * The landing page's vertical rhythm. Every section carries half the gap above and below, so any
 * two neighbours sit one gap apart (96 on phones, 136 from sm up), measured content to content.
 */
export const band = "py-12 sm:py-[68px]";
/** The heading column of a 1:2 section: from lg up it stays in view while the longer column beside it scrolls. */
export const stickyColumn = "lg:sticky lg:top-24 lg:self-start";
export const heroTitle = "text-[44px] leading-none font-normal tracking-[-0.04em] text-balance sm:text-[60px] lg:text-[74px] lg:tracking-[-0.047em]";

/** Outlined pills naming what a section covers. The glyphs stay in the data but Graphite shows words only. */
export function Tags({ tags, className }: { tags: Tag[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((t) => (
        <li key={t.label} className="inline-flex h-[26px] items-center rounded-full border border-[var(--line-strong)] px-2.5 text-[12.5px] text-muted">
          {t.label}
        </li>
      ))}
    </ul>
  );
}

/** Tags, heading, sentence, link: the copy block a section opens with when its visual sits below it. */
export function SectionCopy({ tags, title, body, action, className, bodyClassName }: { tags: Tag[]; title: ReactNode; body?: ReactNode; action?: { label: string; href: string }; className?: string; bodyClassName?: string }) {
  return (
    <Reveal className={className}>
      <Tags tags={tags} className="mb-5" />
      <h2 className={sectionTitle}>{title}</h2>
      {body ? <p className={cn("mt-4", sectionBody, bodyClassName ?? "max-w-xl")}>{body}</p> : null}
      {action ? <RowLink href={action.href} className="mt-7">{action.label}</RowLink> : null}
    </Reveal>
  );
}

/**
 * A section's head row: tags, heading and sentence on the left, the section's one link on the right,
 * bottom-aligned. Stacks on phones.
 */
export function SectionHead({ tags, title, body, action, id, className }: { tags?: Tag[]; title: ReactNode; body?: ReactNode; action?: { label: string; href: string }; id?: string; className?: string }) {
  return (
    <Reveal className={cn("mb-9 flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12", className)}>
      <div className="max-w-[640px]">
        {tags ? <Tags tags={tags} className="mb-5" /> : null}
        <h2 id={id} className={sectionTitle}>{title}</h2>
        {body ? <p className={cn("mt-4 max-w-[540px]", sectionBody)}>{body}</p> : null}
      </div>
      {action ? <RowLink href={action.href} className="shrink-0 md:pb-1.5">{action.label}</RowLink> : null}
    </Reveal>
  );
}

/**
 * A feature as a full-width showcase: the head row, then the visual on a tray across the container.
 * `children` is the visual; it should render a bare `Stage` (the panel) at the height it wants.
 */
export function FeatureRow({ tags, title, body, cta, children }: { tags: Tag[]; title: string; body: string; cta: { label: string; href: string }; reverse?: boolean; children: ReactNode }) {
  return (
    <section className={band}>
      <SectionHead tags={tags} title={title} body={body} action={cta} />
      <Reveal className="tray min-w-0">{children}</Reveal>
    </section>
  );
}

/**
 * A feature as a card: the visual's panel on top of a tray, the copy (tags, title, sentence, link)
 * under it inside the same tray. Two sit side by side from lg up.
 */
export function FeatureCard({ tags, title, body, cta, children }: { tags: Tag[]; title: string; body: string; cta: { label: string; href: string }; children: ReactNode }) {
  return (
    <Reveal className="tray flex min-w-0 flex-col">
      {children}
      <div className="px-3.5 pt-6 pb-4 sm:px-4">
        <Tags tags={tags} className="mb-4" />
        <h3 className={cardTitle}>{title}</h3>
        <p className="mt-2.5 max-w-[440px] text-[15px] leading-[25px] text-pretty text-muted">{body}</p>
        <RowLink href={cta.href} className="mt-5">{cta.label}</RowLink>
      </div>
    </Reveal>
  );
}

/** A section's link: words and an arrow that nudges on hover (Graphite never uses a button here). */
export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const cls = cn("group inline-flex items-center gap-2 text-[14.5px] font-semibold whitespace-nowrap text-foreground", className);
  const inner = <>{children} <Arrow /></>;
  return href.startsWith("http") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}

/** A 16px tile behind a tag's glyph: a lifted chip, not a colored badge. */
export function TagIcon({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span aria-hidden className={cn("grid size-4 place-items-center rounded-[5px] p-[3px] [&_svg]:size-full", accent ? "bg-accent/15 text-accent" : "bg-surface-2 text-[var(--tag-ink)]")}>
      {children}
    </span>
  );
}

/* ---------- Surfaces the visuals are built from ---------- */

/** A tray holding a panel: the base a visual sits on. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("tray", className)}>
      <div className="panel">{children}</div>
    </div>
  );
}

/** A floating card's surface: the raised layer, a hairline and the float shadow. */
export const floatCard = "rounded-[16px] border border-[var(--line-strong)] bg-surface-3 shadow-[var(--shadow-float)]";

/**
 * A card that floats over a panel's corner. In flow below the panel on small screens, where there
 * is no room to overlap; lifted onto the corner from `md` up. Position with md: utilities.
 */
export function Floating({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative mt-3 md:absolute md:mt-0", floatCard, className)}>{children}</div>;
}

/** One line of a floating list: a label, a right-aligned value, and an optional hairline meter. */
export function ListRow({ icon, label, value, meter, accent }: { icon?: ReactNode; label: string; value: string; meter?: number; accent?: boolean }) {
  return (
    <div className="border-b border-[var(--line)] px-4 py-[13px] last:border-b-0">
      <div className="flex items-center justify-between gap-6 text-[13px]">
        <span className="flex min-w-0 items-center gap-2 text-muted">
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
  flow: () => <G><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H15a3 3 0 0 1 3 3v6.5" /></G>,
  palette: () => <G><circle cx="12" cy="12" r="9" /><circle cx="8" cy="10" r="1.2" fill="currentColor" /><circle cx="12" cy="7.5" r="1.2" fill="currentColor" /><circle cx="16" cy="10" r="1.2" fill="currentColor" /></G>,
  spark: () => <G fill><path d="M12 2c.4 4.8 2.2 7.6 8 10-5.8 2.4-7.6 5.2-8 10-.4-4.8-2.2-7.6-8-10 5.8-2.4 7.6-5.2 8-10Z" /></G>,
  gift: () => <G><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1Z" /></G>,
};
