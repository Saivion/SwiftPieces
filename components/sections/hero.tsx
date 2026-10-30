import type { CSSProperties } from "react";
import { Container } from "@/components/ui/container";
// Off with the eyebrow below until its replacement lands.
// import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import Link from "next/link";
import { NewBadge } from "@/components/ui/new-badge";
import { AnimatedText } from "@/components/ui/animated-text";
import { Reveal } from "@/components/effects/reveal";
import { HeroLines } from "@/components/visual/hero-lines";
// import { LiveViews } from "@/components/sections/live-views";
import { HeroRow } from "@/components/sections/hero-row";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { getRegistryIndex } from "@/lib/registry";
import { libraryLead } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * The row under the copy, left to right, with the newest piece in the middle. `y` and `rot` are each
 * tile's place in the resting fan (the outer two lower and tilted further); `show` is where a tile
 * starts to appear, so phones get the middle one, tablets three and wide screens all five.
 */
const ROW = [
  { name: "FanStack", y: 80, rot: -4, show: "hidden xl:block" },
  { name: "ParallaxCard", y: 36, rot: -2, show: "hidden md:block" },
  { name: "PictureHeadline", y: 0, rot: 0, show: "" },
  { name: "FlipCard", y: 36, rot: 2, show: "hidden md:block" },
  { name: "ReactionToggle", y: 80, rot: 4, show: "hidden xl:block" },
];

/**
 * The top of the page: the claim, centred, with a way into the library, then a row of pieces running
 * live, rising out of the bottom of the hero into the ticker. The ribbon runs behind all of it.
 */
export function Hero() {
  const items = getRegistryIndex();
  return (
    <section className="relative overflow-x-clip pt-14 md:pt-20 lg:pt-24">
      {/* Clipped sideways only: the ribbon runs up behind the fixed navbar, so it must not be cut at
          the hero's top edge. */}
      <HeroLines />
      <Container className="relative z-10 text-center">
        {/* The eyebrow (and its live view count) is off for now: something new goes here soon.
        <Reveal priority><Eyebrow>New components every week<LiveViews /></Eyebrow></Reveal> */}
        <AnimatedText as="h1" text="Build apps worthy of an App Store feature." accent="feature" className="mx-auto mt-[28px] max-w-[980px] text-[44px] leading-none font-normal tracking-[-0.04em] text-balance sm:text-[62px] lg:text-[80px] lg:tracking-[-0.05em]" />
        <Reveal priority delay={0.35}><p className="mx-auto mt-6 max-w-[560px] text-[16.5px] leading-[27px] text-balance text-muted sm:text-[18px] sm:leading-[30px]">{libraryLead}</p></Reveal>
        <Reveal priority delay={0.45} className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          <Button href="/components">Explore the library <Arrow /></Button>
          {/* The quiet second way in: words, the Beta badge and an arrow that nudges. */}
          <Link href="/apps" className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">
            Try the new Playground
            <NewBadge>Beta</NewBadge>
            <Arrow />
          </Link>
        </Reveal>
      </Container>

      {/* The row bleeds past the container and fades into the ticker below. */}
      <HeroRow className="hero-row relative z-10 mt-16 flex justify-center gap-3 px-4 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:mt-20">
        {ROW.map((t, i) => {
          const item = items.find((x) => x.name === t.name);
          return (
            <div key={t.name} className={cn("hero-tile w-[300px] shrink-0", t.show)} style={{ "--ty": `${t.y}px`, "--rot": `${t.rot}deg` } as CSSProperties}>
              {/* The entrance rides on an inner box, so it never fights the scroll transform above. */}
              <div className="hero-tile-in rounded-[22px] bg-surface-2 p-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.06)]" style={{ animationDelay: `${0.45 + Math.abs(i - 2) * 0.12}s` }}>
                <PreviewFrame aspect="aspect-[4/3]" className="rounded-[17px]">
                  <PiecePreview name={t.name} />
                </PreviewFrame>
                <p className="flex h-9 items-center px-2.5 pt-0.5 text-left text-[13px] font-medium text-foreground">{item?.title ?? t.name}</p>
              </div>
            </div>
          );
        })}
      </HeroRow>
    </section>
  );
}
