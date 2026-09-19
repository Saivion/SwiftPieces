import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { Reveal } from "@/components/effects/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { PaletteDots } from "@/components/visual/palette-dots";
import { getRegistryIndex } from "@/lib/registry";
import { pro } from "@/lib/site";

/**
 * The close: one card on the same ground as the Pro sign-in panel — a breathing wash of the brand
 * palette, the seeded dot field lighting up under the cursor, and a grain pass over both.
 */
export function GetStarted() {
  const items = getRegistryIndex();
  return (
    <section className="relative border-t border-[var(--line)] py-20 md:py-28">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[#050508] px-8 py-20 md:px-14 md:py-28">
            <div aria-hidden className="auth-wash absolute inset-0" />
            <PaletteDots seedX={0.28} seedY={0.55} seedStrength={0.34} gain={0.8} className="pointer-events-none absolute inset-0 h-full w-full" />
            <div aria-hidden className="grain absolute inset-0" />
            <div className="relative flex flex-col items-start">
              <SectionLabel className="mb-8">Start here</SectionLabel>
              <h2 className="p-title max-w-2xl text-balance">Ready to build something <span className="text-accent">better</span>?</h2>
              <p className="p-body mt-5 max-w-md">Take one file, or take all {items.length}. They are yours either way: no dependencies, nothing to install at runtime.</p>
              <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
                <Button href="/components">Browse the library <Arrow /></Button>
                {/* A quiet text link beside the one button, underlined on hover like every other secondary action. */}
                <a href={pro.home} className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="u-link">Explore Pro</span>
                  <Arrow />
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
