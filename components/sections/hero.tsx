import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import { Command } from "@/components/ui/code";
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
            <Reveal priority><Eyebrow>New Components Every Week<LiveViews /></Eyebrow></Reveal>
            <AnimatedText as="h1" text="Native SwiftUI that feels alive." accent="alive" className="p-hero mt-8" />
            <Reveal priority delay={0.35}><p className="p-body mt-7 max-w-xl text-[15px]">Designed SwiftUI interactions: swipe decks, glass menus, floating docks, scrubbable charts. One file each, iOS 17 and up, with the motion, haptics and states already done.</p></Reveal>       
            <Reveal priority delay={0.45} className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/components">Browse the library <Arrow /></Button>
              {/* Same h-11 as the md Button, with its 10px corner and hairline so the pair reads as one row. */}
              <Command text="npx swiftpieces init" className="rounded-[10px]! border border-[var(--card-border)]" />
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
