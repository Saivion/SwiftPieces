import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Arrow, Button } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { EmberStage } from "@/components/visual/ember-stage";
import { PLAN_COVER } from "@/lib/plan-cover";
import { SectionHead, Glyph } from "@/components/sections/feature-row";
import { proCatalog, proGames, proGamesPricingList, proPlans } from "@/lib/pro-catalog";
import { pro } from "@/lib/site";
import { cn } from "@/lib/cn";

function Check() {
  return <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-foreground" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

type Plan = { id: string; eyebrow: string; name: string; line: string; price: number; was?: number; items: string[]; cta: string; href: string; featured?: boolean; isNew?: boolean };

/** The same three plans, words and order as Pro's pricing (SwiftPiecesPro components/blocks/plans.tsx). */
function plans(): Plan[] {
  const both = proPlans.pro + proPlans.games;
  return [
    {
      id: "pro",
      eyebrow: "Build apps",
      name: "SwiftPieces Pro",
      line: "Screens, patterns and complete app templates.",
      price: proPlans.pro,
      items: [`${proCatalog.screens} screens and ${proCatalog.blocks} patterns`, `${proCatalog.templates} complete app templates`, "The Game UI screens, as they land", "Build Kit skills for your agent", "Everything added to the Pro library"],
      cta: "Get SwiftPieces Pro",
      href: pro.pricing,
    },
    {
      id: "everything",
      eyebrow: "Best value",
      name: "Pro and Games",
      line: "Every app and every game, for one price.",
      price: proPlans.everything,
      was: both,
      items: ["Everything in Pro", "Everything in Games", "Both licenses on one account and one key", `Save $${both - proPlans.everything}`],
      cta: "Get Pro and Games",
      href: pro.pricing,
      featured: true,
    },
    {
      id: "games",
      eyebrow: "Build games",
      name: "SwiftPieces Games",
      line: "Complete iOS games in SwiftUI and Metal, and the engine they run on.",
      price: proPlans.games,
      items: [`${proGames.list.length} complete games: ${proGamesPricingList}`, `The engine: ${proGames.systems} modules and the shader pack`, "Game Center, StoreKit 2 and saves, wired", "Every game added later"],
      cta: "Get SwiftPieces Games",
      href: pro.gamesPricing,
      isNew: true,
    },
  ];
}

/**
 * Pricing on the free site: the three plans exactly as pro.swiftpieces.com shows them, Pro and Games
 * in the middle on the ember cover. Checkout happens on Pro, so each button opens Pro's pricing.
 */
export function Plans({ className }: { className?: string }) {
  return (
    <section id="pricing" className={cn("relative scroll-mt-24 py-12 sm:py-[68px]", className)}>
      <Container>
        <SectionHead
          centered
          tags={[{ label: "One payment", icon: <Glyph.tag /> }, { label: "Lifetime access", icon: <Glyph.bolt /> }]}
          title="Pick apps, games, or both."
          body={`Pay once and keep everything, including what we add later. Own one already? The other is $${proPlans.upgrade}.`}
        />
        <Reveal className="tray grid gap-2 lg:grid-cols-3">
          {plans().map((p) => (
            <div key={p.id} className={cn("panel isolate flex flex-col px-7 pt-8 pb-7", p.featured && "plan-ink relative lg:-my-3 lg:py-11")}>
              <div className={cn(p.featured && "relative text-[#fff]")}>
                {/* Pro's cover exactly: one fixed seed, shipped as a still so it is whole on the first frame (lib/plan-cover.ts). */}
                {p.featured ? <div aria-hidden className="plan-cover"><EmberStage seed={PLAN_COVER.seed} core={PLAN_COVER.core} still={PLAN_COVER.still} /></div> : null}
                <p className={cn("text-[12.5px]", p.featured ? "font-medium text-[rgb(255_255_255/0.85)]" : "text-subtle")}>{p.eyebrow}</p>
                <p className="mt-2.5 flex items-center gap-2.5 text-[22px] leading-tight font-medium tracking-[-0.02em]">{p.name}{p.isNew ? <NewBadge /> : null}</p>
                <p className={cn("mt-1.5 min-h-[44px] text-[14px] leading-[22px]", p.featured ? "text-[rgb(255_255_255/0.85)]" : "text-muted")}>{p.line}</p>
              </div>
              <p className="mt-6 flex items-baseline gap-2.5">
                <span className="text-[56px] leading-none font-normal tracking-[-0.05em] tabular-nums">${p.price}</span>
                {p.was ? <span className="text-[18px] text-muted tabular-nums line-through decoration-1">${p.was}</span> : null}
              </p>
              <p className="mt-2 text-[13px] text-muted">One-time purchase · Lifetime access</p>
              <ul className="mt-6 flex flex-col gap-3 border-t border-[var(--line)] pt-6">
                {p.items.map((v) => <li key={v} className="flex gap-2.5 text-[14px] leading-5"><Check /><span>{v}</span></li>)}
              </ul>
              <div className="mt-8 lg:mt-auto lg:pt-8">
                <Button href={p.href} size="md" className="w-full">{p.cta} <Arrow /></Button>
              </div>
            </div>
          ))}
        </Reveal>
        {/* The founding offer, as on Pro (PlansNote). The $129 upgrade is already in the heading above. */}
        <div className="mx-auto mt-6 flex max-w-[760px] flex-col items-center gap-2 text-center text-[14px] text-muted">
          <p><strong className="font-semibold text-foreground">For Pro owners:</strong> if you had Pro before Games launched, Games is half the add-on price, ${proPlans.founding}. It is applied at checkout.</p>
        </div>
      </Container>
    </section>
  );
}
