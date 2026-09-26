import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import { Command } from "@/components/ui/code";
import { AnimatedText } from "@/components/ui/animated-text";
import { Reveal } from "@/components/effects/reveal";
// The halftone 3D Swift mark, retired for the flowing lines (hero-lines.tsx). Kept for now.
// import { HeroDither } from "@/components/visual/hero-dither";
import { HeroLines } from "@/components/visual/hero-lines";
import { LiveViews } from "@/components/sections/live-views";
import { sectionBody } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/**
 * The top of the page: the mark, the claim, and a way into the library. Shared shape with Pro's hero.
 * Same type system as the sections below it (medium weight, tight tracking, the 16/26 subtitle), only larger.
 */
export function Hero() {
  return (
    <section className="relative overflow-x-clip pt-20 pb-20 md:pt-28 md:pb-28 lg:pt-32">
      {/* Clipped sideways only: the ribbon runs up behind the fixed navbar, so it must not be cut at
          the hero's top edge. */}
      <HeroLines />
      <Container className="relative">
        {/* <HeroDither /> */}
        <div className="relative z-10">
          {/* The copy column stops short of the mark, so the headline never runs under it. */}
          <div className="max-w-[46rem]">
            <Reveal priority><Eyebrow>New Components Every Week<LiveViews /></Eyebrow></Reveal>
            <AnimatedText as="h1" text="Build apps that belong in the App Store's top 1%." accent="1%" className="mt-8 text-[34px] leading-[1.04] font-medium tracking-[-0.035em] text-balance sm:text-[42px] lg:text-[49px]" />
            <Reveal priority delay={0.35}><p className={cn("mt-6 max-w-xl", sectionBody)}>The motion, haptics and accessibility the best apps get right, as production SwiftUI components. Install with one command and make them yours.</p></Reveal>       
            <Reveal priority delay={0.45} className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/components">Browse the library <Arrow /></Button>
              {/* Same h-11 as the md Button, with its 10px corner and hairline so the pair reads as one row. */}
              <Command text="npx swiftpieces init" className="rounded-[4px]! border border-[var(--card-border)]" />
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
