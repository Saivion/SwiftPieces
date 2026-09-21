import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/animated-text";
import { Reveal } from "@/components/effects/reveal";
import { HeroDither } from "@/components/visual/hero-dither";
import { LiveViews } from "@/components/sections/live-views";

/** The top of the page: the mark, the claim, and a way into the library. Shared shape with Pro's hero. */
export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-20 md:pt-28 md:pb-28 lg:pt-32">
      <Container className="relative">
        <HeroDither />
        <div className="relative z-10">
          {/* The copy column stops short of the mark, so the headline never runs under it. */}
          <div className="max-w-[46rem]">
            <Reveal priority><Eyebrow>New components every week</Eyebrow></Reveal>
            <AnimatedText as="h1" text="Native SwiftUI that feels alive." accent="alive" className="p-hero mt-8" />
            <Reveal priority delay={0.35}><p className="p-body mt-7 max-w-xl text-[15px]">Designed SwiftUI interactions: swipe decks, glass menus, floating docks, scrubbable charts. One file each, iOS 17 and up, with the motion, haptics and states already done.</p></Reveal>       
            <Reveal priority delay={0.45} className="mt-9">
              <Button href="/components">Browse the library <Arrow /></Button>
            </Reveal>
            <Reveal priority delay={0.55} className="mt-6">
              <LiveViews />
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
