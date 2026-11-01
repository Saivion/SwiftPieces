import type { CSSProperties } from "react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Button, Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { band, sectionBody, sectionTitle } from "@/components/sections/feature-row";
import { proGames, proGamesList } from "@/lib/pro-catalog";
import { pro } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * A still of a game mid-play in a plain phone bezel. The stills are Pro's own simulator captures
 * (SwiftPiecesPro public/game-shots), copied to public/pro-games/<id>.webp.
 */
function GamePhone({ id, title, className }: { id: string; title: string; className?: string }) {
  return (
    <div className={cn("rounded-[34px] bg-[#0b0b0b] p-[5px] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)] ring-1 ring-[#000]/10", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static simulator stills, already 720px webp */}
      <img src={`/pro-games/${id}.webp`} alt={`${title} being played, from SwiftPieces Games`} loading="lazy" decoding="async" className="aspect-[720/1565] w-full rounded-[29px] object-cover" />
    </div>
  );
}

function Kicker() {
  return (
    <p className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
      <NewBadge /> SwiftPieces Games
    </p>
  );
}

/**
 * SwiftPieces Games on the free site, as Pro's home page points to it (Pro components/blocks/games-teaser.tsx):
 * one tray, the line on the left and three games rising out of a paper panel on the right. The
 * whole tray opens Games on pro.swiftpieces.com.
 */
export function GamesTeaser() {
  const picks = proGames.list.slice(0, 3);
  return (
    <Container className={band}>
      <Reveal>
        <a href={pro.games} className="group tray grid overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background lg:grid-cols-[1fr_1.15fr]">
          <div className="flex flex-col justify-center gap-4 px-6 py-10 sm:px-10">
            <Kicker />
            <h2 className={sectionTitle}>
              Building a game? <span className="text-muted">There are {proGames.list.length} of those too.</span>
            </h2>
            <p className={cn(sectionBody, "max-w-[44ch]")}>Complete iOS games in SwiftUI and Metal: {proGamesList}. Real levels, Game Center and a StoreKit shop, with the full source.</p>
            <span className="mt-2 inline-flex items-center gap-2 text-[15px] font-semibold text-foreground">See SwiftPieces Games <Arrow /></span>
          </div>
          <div className="relative h-[340px] overflow-hidden rounded-[22px] bg-surface-2 sm:h-[380px] lg:h-auto lg:min-h-[400px]">
            <ul className="absolute inset-x-0 top-10 flex items-start justify-center gap-4">
              {picks.map((g, i) => (
                <li key={g.id} className={cn("w-[150px] shrink-0 transition-transform duration-700 ease-out sm:w-[170px]", i === 1 ? "group-hover:-translate-y-2.5" : "translate-y-8 group-hover:translate-y-6", i !== 1 && "hidden sm:block")}>
                  <GamePhone id={g.id} title={g.title} />
                </li>
              ))}
            </ul>
          </div>
        </a>
      </Reveal>
    </Container>
  );
}

/** Places for the five phones in the fan, as on Pro's /games hero: one on phones, three from sm, all five from xl. */
const FAN: { y: number; rot: number; show: string }[] = [
  { y: 110, rot: -7, show: "hidden xl:block" },
  { y: 40, rot: -3.5, show: "hidden sm:block" },
  { y: 0, rot: 0, show: "" },
  { y: 40, rot: 3.5, show: "hidden sm:block" },
  { y: 110, rot: 7, show: "hidden xl:block" },
];

/**
 * The louder option: Pro's /games hero in small, as a band of its own. The line centred, the two
 * actions, and all five games fanned underneath on the plain page, fading out at the foot.
 */
export function GamesFan() {
  return (
    <section className={cn("relative overflow-x-clip", band)}>
      <Container className="text-center">
        <Reveal>
          <div className="flex justify-center"><Kicker /></div>
          <h2 className={cn(sectionTitle, "mx-auto mt-5 max-w-[760px]")}>
            Ship a real <span className="text-accent">game</span> in Swift.
          </h2>
          <p className={cn(sectionBody, "mx-auto mt-4 max-w-[560px]")}>
            {proGames.list.length} complete iOS games in SwiftUI and Metal, with real levels, Game Center, a StoreKit 2 shop and the engine they run on.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Button href={pro.games}>See the games <Arrow /></Button>
            <a href={pro.gamesPricing} className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">From ${proGames.price} <Arrow /></a>
          </div>
        </Reveal>
      </Container>
      <div className="relative mt-12 flex h-[360px] items-start justify-center gap-5 overflow-y-clip px-4 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:h-[420px] lg:gap-7">
        {proGames.list.map((g, i) => (
          <a key={g.id} href={`${pro.games}/${g.id}`} aria-label={g.title} className={cn("w-[190px] shrink-0 transition-transform duration-500 hover:-translate-y-1.5 sm:w-[200px] lg:w-[210px]", FAN[i].show)} style={{ transform: `translateY(${FAN[i].y}px) rotate(${FAN[i].rot}deg)` } as CSSProperties}>
            <GamePhone id={g.id} title={g.title} />
          </a>
        ))}
      </div>
    </section>
  );
}
