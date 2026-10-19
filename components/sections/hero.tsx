import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import Link from "next/link";
import { NewBadge } from "@/components/ui/new-badge";
import { AnimatedText } from "@/components/ui/animated-text";
import { Reveal } from "@/components/effects/reveal";
// The halftone 3D Swift mark, retired for the flowing lines (hero-lines.tsx). Kept for now.
// import { HeroDither } from "@/components/visual/hero-dither";
import { HeroLines } from "@/components/visual/hero-lines";
import { LiveViews } from "@/components/sections/live-views";
import { heroTitle } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/**
 * The top of the page: the mark, the claim, and a way into the library. Shared shape with Pro's hero.
 * Same type system as the sections below it (medium weight, tight tracking, the 16/26 subtitle), only larger.
 */
export function Hero() {
  return (
    <section className="relative overflow-x-clip pt-16 pb-20 md:pt-28 md:pb-[120px] lg:pt-[120px]">
      {/* Clipped sideways only: the ribbon runs up behind the fixed navbar, so it must not be cut at
          the hero's top edge. */}
      <HeroLines />
      <Container className="relative">
        {/* <HeroDither /> */}
        <div className="relative z-10">
          {/* The copy column stops short of the mark, so the headline never runs under it. */}
          <div className="max-w-[52rem]">
            <Reveal priority><Eyebrow>New components every week<LiveViews /></Eyebrow></Reveal>
            <AnimatedText as="h1" text="Build apps worthy of an App Store feature." accent="feature" className={cn("mt-[30px] max-w-[820px]", heroTitle)} />
            <Reveal priority delay={0.35}><p className="mt-[26px] max-w-[540px] text-[16.5px] leading-[27px] text-pretty text-muted sm:text-[18px] sm:leading-[30px]">The motion, haptics and accessibility the best apps get right, as production SwiftUI components. Install with one command and make them yours.</p></Reveal>
            <Reveal priority delay={0.45} className="mt-[38px] flex flex-wrap items-center gap-2.5">
              <Button href="/components">Browse the library <Arrow /></Button>
              {/* The quiet second way in: words, the Beta badge and an arrow that nudges. */}
              <Link href="/apps" className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">
                Try the new Playground
                <NewBadge>Beta</NewBadge>
                <Arrow />
              </Link>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
