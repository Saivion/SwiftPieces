import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { Reveal } from "@/components/effects/reveal";
import { PaletteDots } from "@/components/visual/palette-dots";
import { DitherStage } from "@/components/visual/dither-stage";
import { getRegistryIndex } from "@/lib/registry";
import { pro } from "@/lib/site";
import { sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/**
 * The close: one card split in two. The left half is the same ground as the Pro sign-in panel (a
 * breathing wash of the brand palette, the seeded dot field lighting up under the cursor); the
 * right half is the dithered colour field Pro's library cards stand on. One grain pass covers both.
 * On small screens the colour field drops below the copy as a band.
 */
/**
 * Pro's dither palette led by the accent: an orange-to-red wash, a pink ribbon and a blue bloom.
 * The pale honeydew stop is left out, so it stays as colourful as Pro's cards but reads deeper.
 */
const ACCENT_DITHER = ["#ff7a3c", "#ff0000", "#ff8fb8", "#4d8dff"] as const;

export function GetStarted() {
  const items = getRegistryIndex();
  return (
    <section className="relative py-24 sm:py-32">
      <Container>
        <Reveal>
          <div className="relative grid overflow-hidden rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[#050508] md:grid-cols-2">
            <div className="relative overflow-hidden px-8 py-20 md:px-14 md:py-28">
              <div aria-hidden className="auth-wash absolute inset-0" />
              <PaletteDots seedX={0.5} seedY={0.55} seedStrength={0.34} gain={0.8} className="pointer-events-none absolute inset-0 h-full w-full" />
              <div className="relative flex flex-col items-start">
                {/* Same heading and subtitle as every row above it; the card and its ground carry the weight. */}
                <h2 className={cn("max-w-2xl", sectionTitle)}>Ready to build something <span className="text-accent">better</span>?</h2>
                <p className={cn("mt-4 max-w-md", sectionBody)}>Take one file, or take all {items.length}. They are yours either way: no dependencies, nothing to install at runtime.</p>
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
            <div className="relative min-h-56 border-t border-[var(--card-border)] md:min-h-0 md:border-t-0 md:border-l">
              {/* Pro's colours, led by the accent red (see ACCENT_DITHER). */}
              <DitherStage seed="get-started" palette={ACCENT_DITHER} />
            </div>
            <div aria-hidden className="grain pointer-events-none absolute inset-0" />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
