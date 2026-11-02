import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Arrow } from "@/components/ui/button";
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
