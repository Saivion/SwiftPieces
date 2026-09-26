import type { ReactNode } from "react";
import Link from "next/link";
import { Reveal } from "@/components/effects/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { Arrow } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Props = { label?: string; title: ReactNode; description?: ReactNode; action?: { label: string; href: string }; align?: "left" | "center"; size?: "h1" | "h2"; className?: string };

/** The landing heading pattern shared with Pro: small label, semibold statement, quiet action. */
export function SectionHeader({ label, title, description, action, size = "h2", className }: Props) {
  // `size="h1"` when the header opens its page, so the page has exactly one top-level heading.
  const Heading = size;
  const external = action?.href.startsWith("http");
  const link = action ? (
    external ? <a href={action.href} className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground"><span className="u-link">{action.label}</span><Arrow /></a>
      : <Link href={action.href} className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground"><span className="u-link">{action.label}</span><Arrow /></Link>
  ) : null;
  return (
    <Reveal className={cn("flex flex-col gap-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        {label ? <SectionLabel className="mb-8">{label}</SectionLabel> : null}
        <Heading className="p-title text-balance">{title}</Heading>
        {description ? <p className="p-body mt-5 max-w-xl text-pretty">{description}</p> : null}
      </div>
      {link}
    </Reveal>
  );
}
