import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { Reveal } from "@/components/effects/reveal";
import { HeroWall } from "@/components/landing/wall";
import { display } from "@/components/landing/type";
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

/** The top of the page: the claim set small on the left, then every kind of piece on a wall laid back in perspective. */
export function Hero() {
  return (
    <section className="pt-14 sm:pt-20">
      <Container>
        <Reveal priority><Announcement /></Reveal>
        <Reveal priority delay={0.1}>
          <h1 className={cn(display, "mt-5 max-w-[640px]")}>
            SwiftPieces is a free library of SwiftUI components <span className="text-muted">for apps worth an App Store feature.</span>
          </h1>
        </Reveal>
        <Reveal priority delay={0.2}><Actions className="mt-6" /></Reveal>
      </Container>
      <Reveal priority delay={0.3} className="mt-4 sm:mt-6">
        <HeroWall />
      </Reveal>
    </section>
  );
}

