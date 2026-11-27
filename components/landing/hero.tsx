import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { Reveal } from "@/components/effects/reveal";
import { HeroTile } from "@/components/landing/tiles";
import { display } from "@/components/landing/type";
import { HeroSmear } from "@/components/visual/hero-smear";
import { pro } from "@/lib/site";
import { cn } from "@/lib/cn";

/** The Games launch, as a quiet line above the claim. */
function Announcement({ className }: { className?: string }) {
  return (
    <a href={pro.games} className={cn("group inline-flex items-center gap-2 text-[13px] text-muted transition-colors hover:text-foreground", className)}>
      <NewBadge className="h-[20px] px-2" />
      Introducing SwiftPieces Games
      <Arrow className="size-3.5" />
    </a>
  );
}

function Actions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button href="/components" size="sm">Browse components <Arrow /></Button>
      <Button href="/docs/installation" size="sm" variant="secondary">Install the CLI</Button>
    </div>
  );
}

/** The top of the page: the claim set small on the left, then one tile whose panel holds a wall of whole pieces. */
export function Hero() {
  return (
    <section className="relative overflow-x-clip">
      {/* The fluted glass runs from the top of the page down behind the wall, so it never stops at an edge:
          it fades in under the bar and out below the wall, and the wall stands in front of it. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -top-[calc(var(--nav-h)+var(--promo-h))] [mask-image:linear-gradient(to_bottom,#000_75%,transparent)]">
        <HeroSmear centre={[0.5, 1]} scale={0.82} veil={{ x: 0.28, y: 0.27, rx: 0.26, ry: 0.16 }} fade={[40, 0]} className="absolute inset-0 block h-full w-full" />
      </div>
      <div className="relative pt-14 pb-24 sm:pt-20 sm:pb-28">
        <Container className="relative z-10">
          <Reveal priority><Announcement /></Reveal>
          <Reveal priority delay={0.1}>
            <h1 className={cn(display, "mt-5 max-w-[640px]")}>
              SwiftPieces is a free library of SwiftUI components <span className="text-muted">for apps worth an App Store feature.</span>
            </h1>
          </Reveal>
          <Reveal priority delay={0.2}><Actions className="mt-6" /></Reveal>
        </Container>
      </div>
      <div className="relative z-10 -mt-14 sm:-mt-14"><HeroTile /></div>
    </section>
  );
}

