import cards from "@/lib/pro-cards.json";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Button, Arrow } from "@/components/ui/button";
import { Tags, band, sectionTitle, sectionBody, Glyph } from "@/components/sections/feature-row";
import { proCatalog } from "@/lib/pro-catalog";
import { pro, site } from "@/lib/site";
import { cn } from "@/lib/cn";

type Card = (typeof cards)[number];

/** Where a card opens: its own page in Pro's library. */
const itemUrl = (c: Card) => `${site.proUrl}/library/${c.type === "template" ? "templates" : "screens"}/${c.id}`;

const screens = cards.filter((c) => c.type === "screen").slice(0, 24);
const templates = cards.filter((c) => c.type === "template");

/**
 * "Want more?": the step from the free pieces to Pro, between the library directory and the questions.
 * Pro's own screens and whole-app templates drift past in two rows going opposite ways, each card a
 * still of Pro's library card that opens its page on pro.swiftpieces.com. No prices: pricing lives only
 * on Pro, so the second button says View pricing and goes there.
 */
export function WantMore() {
  return (
    <section className={cn("overflow-x-clip", band)} aria-labelledby="want-more">
      <Container>
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <Tags tags={[{ label: "Pro screens", icon: <Glyph.phone /> }, { label: "App templates", icon: <Glyph.grid /> }, { label: "Build Kit", icon: <Glyph.wand /> }, { label: "Remixing", icon: <Glyph.split /> }]} className="mb-5" />
            <h2 id="want-more" className={sectionTitle}>
              Want more? <span className="pro-shimmer">Build the whole app with Pro.</span>
            </h2>
            <p className={cn("mt-4", sectionBody)}>
              {proCatalog.screens} finished screens and {proCatalog.templates} complete app templates, built from the same pieces and design system as the free library, plus a Build Kit that teaches your coding agent to build the rest to match, and Pro remixing in the Playground.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Button href={pro.library}>Explore Pro <Arrow /></Button>
            {/* The quiet secondary action, as beside the closing banner's button: a text link underlined on hover. */}
            <a href={pro.pricing} className="group inline-flex h-11 items-center gap-2 px-2 text-sm font-semibold text-foreground">
              <span className="u-link">View pricing</span>
              <Arrow />
            </a>
          </div>
        </Reveal>
      </Container>

      <div className="mt-12 flex flex-col gap-4 sm:mt-14">
        <Row items={screens} duration="90s" />
        <Row items={templates} duration="70s" reverse />
      </div>
    </section>
  );
}

/** One endless row: the cards twice over, so the loop never shows a seam. Hover pauses it. */
function Row({ items, duration, reverse }: { items: Card[]; duration: string; reverse?: boolean }) {
  return (
    <div className="marquee-pause overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]">
      <div className={cn("marquee flex w-max gap-4", reverse && "marquee-reverse")} style={{ ["--marquee-duration" as string]: duration }}>
        {[...items, ...items].map((c, i) => (
          <ProTile key={`${c.id}-${i}`} card={c} copy={i >= items.length} />
        ))}
      </div>
    </div>
  );
}

function ProTile({ card, copy }: { card: Card; copy: boolean }) {
  const wide = card.type === "template";
  return (
    <a
      href={itemUrl(card)}
      aria-hidden={copy || undefined}
      tabIndex={copy ? -1 : undefined}
      className={cn(
        "group relative block shrink-0 overflow-hidden rounded-[14px] border border-[var(--card-border)] transition-[transform,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--card-border-hover)]",
        wide ? "h-[200px] w-[320px] sm:h-[250px] sm:w-[400px]" : "size-[200px] sm:size-[250px]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static stills of Pro's library cards; next/image would re-encode them per width for no gain */}
      <img
        src={`/pro-cards/${card.id}.webp`}
        alt={copy ? "" : `${card.title}, a Swift Pieces Pro ${wide ? "app template" : "screen"}`}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      <span className="absolute top-3 left-3 inline-flex h-[18px] items-center rounded-[5px] bg-[#000]/60 px-1.5 text-[10px] leading-none font-semibold text-[#fff] backdrop-blur-sm">Pro</span>
      <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-[8px] bg-[#000]/55 px-2.5 py-1.5 text-[11.5px] text-[#fff] opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
        <span className="truncate font-medium">{card.title}</span>
        <span className="shrink-0 text-[#fff]/60">{wide ? "Template" : card.category}</span>
      </span>
    </a>
  );
}
