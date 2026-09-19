import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/effects/reveal";

/** Editorial single-column page used for license, legal, about, changelog. */
export function ProsePage({ label, title, lead, children }: { label: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="relative pt-16 pb-24 md:pt-24 md:pb-32">
      <Container>
        <Reveal className="max-w-3xl">
          <SectionLabel className="mb-5">{label}</SectionLabel>
          <h1 className="t-h1">{title}</h1>
          {lead ? <p className="t-lead mt-5">{lead}</p> : null}
        </Reveal>
        <Reveal delay={0.1} className="prose prose-invert mt-12 max-w-3xl prose-headings:tracking-tight prose-headings:font-semibold prose-h2:mt-12 prose-h2:text-2xl prose-p:text-[15px] prose-p:leading-relaxed prose-p:text-muted prose-li:text-muted prose-a:text-foreground prose-strong:text-foreground">
          {children}
        </Reveal>
      </Container>
    </section>
  );
}
