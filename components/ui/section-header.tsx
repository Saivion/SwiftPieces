import type { ReactNode } from "react";
import { Reveal } from "@/components/effects/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { RowLink, sectionBody, sectionTitle } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/**
 * The title a page opens with (the Library, Blocks, a hub, the legal pages): one step under the
 * landing hero's 74px, the same regular weight and tight tracking.
 */
export const pageTitle = "text-[40px] leading-[1.02] font-normal tracking-[-0.04em] text-balance sm:text-[52px] lg:text-[60px] lg:tracking-[-0.045em]";
/** The sentence under a page title: the hero's 18/30 muted lede. */
export const pageLede = "text-[16.5px] leading-[27px] text-pretty text-muted sm:text-[18px] sm:leading-[30px]";

type Props = { label?: string; title: ReactNode; description?: ReactNode; action?: { label: string; href: string; motion?: boolean }; align?: "left" | "center"; size?: "h1" | "h2"; className?: string };

/**
 * The Graphite head row: a label pill, the heading and a sentence on the left, the section's one
 * link on the right, bottom-aligned. Stacks on phones.
 */
export function SectionHeader({ label, title, description, action, size = "h2", className }: Props) {
  // `size="h1"` when the header opens its page, so the page has exactly one top-level heading.
  const Heading = size;
  return (
    <Reveal className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12", className)}>
      <div className="max-w-3xl">
        {label ? <SectionLabel className="mb-5">{label}</SectionLabel> : null}
        <Heading className={size === "h1" ? pageTitle : sectionTitle}>{title}</Heading>
        {description ? <p className={cn("mt-4 max-w-[560px]", sectionBody)}>{description}</p> : null}
      </div>
      {action ? <RowLink href={action.href} className="shrink-0 md:pb-1.5">{action.label}</RowLink> : null}
    </Reveal>
  );
}
