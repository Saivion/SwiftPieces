import cards from "@/lib/pro-cards.json";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Button, Arrow } from "@/components/ui/button";
import { band, sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { ProBadge } from "@/components/ui/pro-badge";
import { proCatalog } from "@/lib/pro-catalog";
import { pro, site } from "@/lib/site";
import { cn } from "@/lib/cn";

type Card = (typeof cards)[number];

/** Where a card opens: its own page in Pro's library. */
const segment: Record<string, string> = { screen: "screens", flow: "flows", template: "templates" };
const itemUrl = (c: Card) => `${site.proUrl}/library/${segment[c.type] ?? "screens"}/${c.id}`;

const screens = cards.filter((c) => c.type === "screen").slice(0, 24);
const templates = cards.filter((c) => c.type === "template");
// One flow per app, its first core journey (each app's flows run onboarding, core, core, settings),
// alternating with the templates in the second row: an app, then a journey through one.
const flows = cards.filter((c) => c.type === "flow").filter((_, i) => i % 4 === 1);
const wide = templates.flatMap((t, i) => (flows[i] ? [t, flows[i]] : [t]));

/**
 * "Want more?": the step from the free pieces to Pro, between the library directory and the questions.
 * Pro's own screens, then its whole-app templates with a flow through each, drift past in two rows going opposite ways, each card a
 * still of Pro's library card that opens its page on pro.swiftpieces.com. No prices: pricing lives only
 * on Pro, so the second button says View pricing and goes there.
 */
export function WantMore() {
  return (
    <Container className={band}>
      <section className="tray overflow-hidden pt-10 pb-8 sm:pt-[52px] sm:pb-11" aria-labelledby="want-more">
        <Reveal className="flex flex-col gap-8 px-4 sm:px-10 lg:flex-row lg:items-end lg:justify-between lg:px-12">
          <div className="max-w-[640px]">
            <ProBadge className="mb-5" />
            <h2 id="want-more" className={sectionTitle}>
              Want more? <span className="text-subtle">Build the whole app with Pro.</span>
            </h2>
            <p className={cn("mt-4 max-w-[560px]", sectionBody)}>
              {proCatalog.screens} finished screens, {proCatalog.flows.total} flows that string them into whole journeys and {proCatalog.templates} complete app templates, built from the same pieces and design system as the free library, plus a Build Kit that teaches your coding agent to build the rest to match, and Pro remixing in the Playground.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button href={pro.library}>Explore Pro <Arrow /></Button>
            {/* The quiet second action: words and an arrow. Pricing lives only on Pro. */}
            <a href={pro.pricing} className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">
              View pricing
              <Arrow />
            </a>
          </div>
        </Reveal>

        <div className="mt-10 flex flex-col gap-3">
          <Row items={screens} duration="90s" />
          <Row items={wide} duration="110s" reverse />
        </div>
      </section>
    </Container>
  );
}

/** One endless row: the cards twice over, so the loop never shows a seam. Hover pauses it. */
function Row({ items, duration, reverse }: { items: Card[]; duration: string; reverse?: boolean }) {
  return (
    <div className="marquee-pause overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div className={cn("marquee flex w-max gap-3", reverse && "marquee-reverse")} style={{ ["--marquee-duration" as string]: duration }}>
        {[...items, ...items].map((c, i) => (
          <ProTile key={`${c.id}-${i}`} card={c} copy={i >= items.length} />
        ))}
      </div>
    </div>
  );
}

function ProTile({ card, copy }: { card: Card; copy: boolean }) {
  const wide = card.type !== "screen";
  const kind = card.type === "flow" ? "flow" : card.type === "template" ? "app template" : "screen";
  return (
    <a
      href={itemUrl(card)}
      aria-hidden={copy || undefined}
      tabIndex={copy ? -1 : undefined}
      className={cn(
        "group relative block shrink-0 overflow-hidden rounded-[18px] transition-transform duration-300 ease-out hover:-translate-y-1",
        wide ? "h-[180px] w-[290px] sm:h-[205px] sm:w-[330px]" : "size-[180px] sm:size-[205px]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static stills of Pro's library cards; next/image would re-encode them per width for no gain */}
      <img
        src={`/pro-cards/${card.id}.webp`}
        alt={copy ? "" : `${card.title}, a SwiftPieces Pro ${kind}`}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      <span className="absolute top-3 left-3 inline-flex h-5 items-center rounded-full bg-[#000]/55 px-2 text-[10.5px] leading-none font-semibold text-[#fff] backdrop-blur-sm">Pro</span>
      <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-full bg-[#000]/55 px-3 py-1.5 text-[11.5px] text-[#fff] opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
        <span className="truncate font-medium">{card.title}</span>
        <span className="shrink-0 text-[#fff]/60">{card.type === "flow" ? `Flow · ${card.category}` : card.type === "template" ? "Template" : card.category}</span>
      </span>
    </a>
  );
}
