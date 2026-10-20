import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { Reveal } from "@/components/effects/reveal";
import { sectionBody } from "@/components/sections/feature-row";
import { pro } from "@/lib/site";
import { getRegistryIndex } from "@/lib/registry";
import { cn } from "@/lib/cn";

/**
 * The close of the library pages (components, a hub, blocks): one centred panel on a tray, the same
 * shape as the landing's GetStarted, with the accent on the headline's one word.
 */
export function CTA() {
  return (
    <section className="relative pt-12 pb-24 sm:pt-[68px] sm:pb-[136px]">
      <Container>
        <Reveal className="tray">
          <div className="panel px-6 py-20 text-center sm:py-28">
            <h2 className="mx-auto max-w-[920px] text-[36px] leading-[1.04] font-normal tracking-[-0.04em] text-balance sm:text-[48px] lg:text-[58px] lg:tracking-[-0.045em]">
              Ready to build something <span className="text-accent">better</span>?
            </h2>
            <p className={cn("mx-auto mt-4 max-w-[520px]", sectionBody)}>
              {getRegistryIndex().length} pieces, one file each, yours to keep. Start with the
              library or see what the whole app looks like.
            </p>
            <div className="mt-[38px] flex flex-wrap items-center justify-center gap-2.5">
              <Button href="/docs/components">
                Get started <Arrow />
              </Button>
              <a href={pro.home} className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">
                Explore Pro
                <Arrow />
              </a>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
