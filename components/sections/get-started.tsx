import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { Reveal } from "@/components/effects/reveal";
import { getRegistryIndex } from "@/lib/registry";
import { pro } from "@/lib/site";
import { sectionBody } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/** The close: one centred panel on a tray, the last call to action before the footer. */
export function GetStarted() {
  const items = getRegistryIndex();
  return (
    // Half a gap above like every band (feature-row.tsx), a full one below: it closes the page.
    <section className="relative pt-12 pb-24 sm:pt-[68px] sm:pb-[136px]">
      <Container>
        <Reveal className="tray">
          {/* One panel, the copy centred: the page's last word before the footer. */}
          <div className="panel isolate px-6 py-20 text-center sm:py-28">
            {/* A slow aura in the brand's four colours rising from the bottom edge (.aura, app/globals.css). */}
            <div aria-hidden className="aura"><i /><i /><i /><i /></div>
            <div className="relative">
              <h2 className="mx-auto max-w-[920px] text-[36px] leading-[1.04] font-normal tracking-[-0.04em] text-balance sm:text-[48px] lg:text-[58px] lg:tracking-[-0.045em]">Ready to build something better?</h2>
              <p className={cn("mx-auto mt-4 max-w-[520px]", sectionBody)}>Take one file, or take all {items.length}. They are yours either way: no dependencies, nothing to install at runtime.</p>
              <div className="mt-[38px] flex flex-wrap items-center justify-center gap-2.5">
                <Button href="/components">Browse the library <Arrow /></Button>
                <a href={pro.home} className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">
                  Explore Pro
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
