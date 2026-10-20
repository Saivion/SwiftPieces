import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { pageLede, pageTitle } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/effects/reveal";

/**
 * Editorial single-column page used for license, legal, about, showcase. A long read, so no trays: the
 * page head (label pill, regular-weight title, muted lede), then one column of running text with
 * regular-weight headings and muted 16/28 body. The `prose` class keeps the docs' link underlines,
 * inline code and list markers; the descendant classes set Graphite's type over its defaults.
 */
export function ProsePage({ label, title, lead, children }: { label: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="relative pt-16 pb-24 md:pt-24 md:pb-[136px]">
      <Container>
        <Reveal priority className="max-w-3xl">
          <SectionLabel className="mb-5">{label}</SectionLabel>
          <h1 className={pageTitle}>{title}</h1>
          {lead ? <p className={cn("mt-5 max-w-[620px]", pageLede)}>{lead}</p> : null}
        </Reveal>
        <Reveal
          priority
          delay={0.1}
          className="prose mt-14 max-w-[680px] border-t border-[var(--line)] pt-4 text-[16px] [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-[24px] [&_h2]:leading-[1.2] [&_h2]:font-normal [&_h2]:tracking-[-0.028em] [&_h2]:text-foreground sm:[&_h2]:text-[26px] [&_li]:text-muted [&_li]:marker:text-subtle [&_p]:text-[15.5px] [&_p]:leading-[27px] [&_p]:text-pretty [&_p]:text-muted sm:[&_p]:text-[16px] sm:[&_p]:leading-[28px] [&_li]:text-[15.5px] [&_li]:leading-[27px] sm:[&_li]:text-[16px] [&_a]:text-foreground [&_strong]:text-foreground"
        >
          {children}
        </Reveal>
      </Container>
    </section>
  );
}
