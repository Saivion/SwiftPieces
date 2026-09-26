import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { Reveal } from "@/components/effects/reveal";
import { DitherStage } from "@/components/visual/dither-stage";
import { getRegistryIndex } from "@/lib/registry";
import { pro } from "@/lib/site";
import { sectionTitle, sectionBody, CornerTicks } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/**
 * The close: one card split in two, drawn like the landing visuals above it: a dashed frame with
 * corner ticks and a clear left half holding the copy, and on the right the dithered colour field
 * Pro's library cards stand on, so all the colour sits on one side.
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
          {/* The dashed artboard frame and corner ticks of the landing visuals above: the left half is
              clear (the page's dot grid shows through), the colour field fills the right half. The
              ticks sit on the outer wrapper so the inner clip does not cut them off. */}
          <div className="relative">
            <CornerTicks />
          <div className="frame-dashed relative grid overflow-hidden rounded-[16px] md:grid-cols-2">
            <div className="relative px-8 py-20 md:px-14 md:py-28">
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
            {/* The colour field sits inside the frame as its own rounded panel, inset from the dashed
                edge on every side, so the frame reads whole instead of being cut by a hard edge. */}
            <div className="p-2.5 md:pl-0">
              <div className="relative isolate h-full min-h-56 overflow-hidden rounded-[10px]">
                {/* Pro's colours, led by the accent red (see ACCENT_DITHER). */}
                <DitherStage seed="get-started" palette={ACCENT_DITHER} />
              </div>
            </div>
          </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
