import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { faqs } from "@/lib/faqs";
import { RowLink, sectionTitle, sectionBody, stickyColumn } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/**
 * The landing page's questions: the same answers as the Pro page's FAQ, set as plain rows on the
 * page's 1:2 grid. Native <details>, so it is server-rendered, works without JavaScript and is
 * searchable with find-in-page; the open animation is CSS (see `.qa` in globals.css).
 */
export function Questions({ items = faqs, title = "Questions", body, spacing = "mt-24 sm:mt-32" }: { items?: readonly { q: string; a: string }[]; title?: string; body?: ReactNode; spacing?: string } = {}) {
  return (
    <Container className={spacing}>
      <section className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <Reveal as="div" className={stickyColumn}>
          <h2 className={sectionTitle}>{title}</h2>
          <p className={cn("mt-4 max-w-xs", sectionBody)}>{body ?? "The short ones are here. The rest are in the docs."}</p>
          {body ? null : <RowLink href="/docs/introduction" className="mt-6">Read the docs</RowLink>}
        </Reveal>
        <Reveal as="div" className="border-t border-[var(--line)]">
          {items.map((f) => (
            <details key={f.q} className="qa group border-b border-[var(--line)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[22px] pr-0.5 text-[16px] leading-6 tracking-[-0.01em] text-foreground [&::-webkit-details-marker]:hidden sm:text-[16.5px]">
                {f.q}
                <span aria-hidden className="relative grid size-7 shrink-0 place-items-center rounded-full bg-surface text-muted transition-transform duration-300 group-open:rotate-45">
                  <span className="absolute h-[1.5px] w-3 rounded bg-current" />
                  <span className="absolute h-3 w-[1.5px] rounded bg-current" />
                </span>
              </summary>
              <p className="max-w-[62ch] pr-6 pb-6 text-[15px] leading-[26px] text-pretty text-muted sm:pr-16">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </section>
    </Container>
  );
}
