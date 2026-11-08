import cards from "@/lib/pro-cards.json";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Button, Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { ProBadge } from "@/components/ui/pro-badge";
import { band, sectionBody } from "@/components/sections/feature-row";
import { proCatalog, proGames } from "@/lib/pro-catalog";
import { pro, site } from "@/lib/site";
import { cn } from "@/lib/cn";

type Card = (typeof cards)[number];
type Game = (typeof proGames.list)[number];

/** Where a Pro still opens: its own page in Pro's library. */
const itemUrl = (c: Card) => `${site.proUrl}/library/screens/${c.id}`;
const screens = cards.filter((c) => c.type === "screen").slice(0, 16);
const games = proGames.list;

/** The reel: a Pro screen, then a game, while the games last, then the rest of the screens. */
const reel: ({ kind: "pro"; card: Card } | { kind: "game"; game: Game })[] = screens.flatMap((card, i) => [
  { kind: "pro" as const, card },
  ...(games[i] ? [{ kind: "game" as const, game: games[i] }] : []),
]);

const title = "text-[28px] leading-[1.08] font-normal tracking-[-0.035em] text-balance sm:text-[34px]";
const quietLink = "group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground";

/**
 * The step past the free pieces, as one section (Saivion picked C, "Shared reel", 2026-11-08): SwiftPieces
 * Games on the left and SwiftPieces Pro on the right, each under its own badge and built the same way
 * (badge line, title, one line, a button and View pricing), then one reel under both that alternates
 * Pro's screen stills with games mid-play, each tile wearing its badge. Hover pauses the reel.
 * No prices here: pricing lives on Pro, so the second action says View pricing and goes there.
 */
export function MorePair() {
  return (
    <Container className={band}>
      <section className="tray overflow-hidden" aria-labelledby="more-pair">
        <h2 id="more-pair" className="sr-only">More from SwiftPieces: Games and Pro</h2>
        <div className="grid gap-10 px-4 pt-6 sm:px-6 sm:pt-8 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:pt-10">
          <Reveal className="flex flex-col gap-4">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
              <ProBadge tone="games" label="Games" /> SwiftPieces Games <NewBadge />
            </p>
            <h3 className={title}>
              Building a game? <span className="text-muted">There are {games.length} of those too.</span>
            </h3>
            <p className={cn(sectionBody, "max-w-[42ch]")}>Complete iOS games in SwiftUI and Metal. Real levels, Game Center and a StoreKit shop, with the full source.</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <Button href={pro.games}>See the games <Arrow /></Button>
              <a href={pro.pricing} className={quietLink}>View pricing <Arrow /></a>
            </div>
          </Reveal>
          <Reveal className="flex flex-col gap-4 lg:border-l lg:border-[var(--line)] lg:pl-16">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
              <ProBadge /> SwiftPieces Pro
            </p>
            <h3 className={title}>
              Building an app? <span className="text-muted">Build the whole thing with Pro.</span>
            </h3>
            <p className={cn(sectionBody, "max-w-[42ch]")}>
              {proCatalog.screens} screens, {proCatalog.flows.total} flows and {proCatalog.templates} complete app templates, themed by one design system.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <Button href={pro.library}>Explore Pro <Arrow /></Button>
              <a href={pro.pricing} className={quietLink}>View pricing <Arrow /></a>
            </div>
          </Reveal>
        </div>

        {/* The 8px above the reel (taken back by the negative margin) is room for a tile's hover lift. */}
        <div className="marquee-pause mt-10 overflow-hidden pt-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] lg:mt-12">
          <div className="marquee flex w-max gap-2" style={{ ["--marquee-duration" as string]: "100s" }}>
            {[...reel, ...reel].map((r, i) => {
              const copy = i >= reel.length;
              return r.kind === "pro" ? (
                <a
                  key={`p-${r.card.id}-${i}`}
                  href={itemUrl(r.card)}
                  aria-hidden={copy || undefined}
                  tabIndex={copy ? -1 : undefined}
                  className="group relative block size-[180px] shrink-0 overflow-hidden rounded-[20px] transition-transform duration-300 ease-out hover:-translate-y-1 sm:size-[205px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static stills of Pro's library cards */}
                  <img src={`/pro-cards/${r.card.id}.webp`} alt={copy ? "" : `${r.card.title}, a SwiftPieces Pro screen`} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  <ProBadge size="sm" className="absolute top-3 left-3" />
                </a>
              ) : (
                <a
                  key={`g-${r.game.id}-${i}`}
                  href={`${pro.games}/${r.game.id}`}
                  aria-hidden={copy || undefined}
                  tabIndex={copy ? -1 : undefined}
                  className="group relative flex h-[180px] w-[140px] shrink-0 items-start justify-center overflow-hidden rounded-[20px] bg-surface-2 pt-4 transition-transform duration-300 ease-out hover:-translate-y-1 sm:h-[205px] sm:w-[160px]"
                >
                  <span className="w-[104px] rounded-[24px] bg-[#0b0b0b] p-[4px] shadow-[0_20px_40px_-24px_rgb(0_0_0/0.45)] ring-1 ring-[#000]/10 sm:w-[118px]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static simulator stills, already 720px webp */}
                    <img src={`/pro-games/${r.game.id}.webp`} alt={copy ? "" : `${r.game.title} being played, from SwiftPieces Games`} loading="lazy" decoding="async" className="aspect-[720/1565] w-full rounded-[20px] object-cover" />
                  </span>
                  <ProBadge size="sm" tone="games" label="Games" className="absolute top-3 left-3" />
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </Container>
  );
}
