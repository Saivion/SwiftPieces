import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { faqs } from "@/lib/faqs";
import { sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/**
 * The landing page's questions: the same answers as the Pro page's FAQ, set as plain rows on the
 * page's 1:2 grid. Native <details>, so it is server-rendered, works without JavaScript and is
 * searchable with find-in-page; the open animation is CSS (see `.qa` in globals.css).
 */
export function Questions({ items = faqs, title = "Questions", body }: { items?: readonly { q: string; a: string }[]; title?: string; body?: ReactNode } = {}) {
  return (
    <Container className="mt-24 sm:mt-32">
      <section className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-20">
        <Reveal as="div">
          <h2 className={sectionTitle}>{title}</h2>
          <p className={cn("mt-4 max-w-xs", sectionBody)}>
            {body ?? <>The short ones are here. The rest are in the <Link href="/docs" className="text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white">docs</Link>.</>}
          </p>
        </Reveal>
        <Reveal as="div" className="-mt-5">
          {items.map((f) => (
            <details key={f.q} className="qa group border-b border-[var(--line)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 pr-2 text-[16px] leading-6 text-foreground [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="relative size-3.5 shrink-0 text-subtle transition-transform duration-300 group-open:rotate-45">
                  <span className="absolute top-1/2 left-0 h-[1.5px] w-full -translate-y-1/2 rounded bg-current" />
                  <span className="absolute top-0 left-1/2 h-full w-[1.5px] -translate-x-1/2 rounded bg-current" />
                </span>
              </summary>
              <p className="max-w-[60ch] pr-10 pb-6 text-[15px] leading-[24px] text-pretty text-muted">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </section>
    </Container>
  );
}
