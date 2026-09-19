import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { Reveal } from "@/components/effects/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { pro } from "@/lib/site";

export function CTA() {
  return (
    <section className="relative border-t border-[var(--line)] py-20 md:py-28">
      <Container>
        <Reveal className="max-w-3xl">
          <SectionLabel className="mb-8">Next</SectionLabel>
          <h2 className="p-title">
            Ready to build something <span className="text-accent">better</span>
            ?
          </h2>
          <p className="p-body mt-5 max-w-lg">
            Fifty-three pieces, one file each, yours to keep. Start with the
            library or see what the whole app looks like.
          </p>
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Button href="/docs/components">
              Get started <Arrow />
            </Button>
            <a
              href={pro.home}
              className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <span className="u-link">Explore Pro</span>
              <Arrow />
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
