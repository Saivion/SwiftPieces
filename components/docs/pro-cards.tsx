import cards from "@/lib/pro-cards.json";
import { Button, Arrow } from "@/components/ui/button";
import { Panel, PanelBody, PanelMedia } from "@/components/ui/panel";
import { NewBadge } from "@/components/ui/new-badge";
import { pro, site } from "@/lib/site";
import { cn } from "@/lib/cn";

export type ProCardType = "screen" | "flow" | "template";
type ProCard = (typeof cards)[number];

const meta: Record<ProCardType, { label: string; plural: string; listing: string; segment: string }> = {
  screen: { label: "Screen", plural: "screens", listing: pro.screens, segment: "screens" },
  flow: { label: "Flow", plural: "flows", listing: pro.flows, segment: "flows" },
  template: { label: "Template", plural: "templates", listing: pro.templates, segment: "templates" },
};

export const proCards = (type: ProCardType) => cards.filter((c) => c.type === type);

/** Where a card opens: its own page in Pro's library. */
const proItemUrl = (card: ProCard) => `${site.proUrl}/library/${meta[card.type as ProCardType].segment}/${card.id}`;

function External({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn("ai ai-out size-3.5 overflow-visible", className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 10.5l5-5M6.5 5.5h4v4" />
    </svg>
  );
}

/**
 * Explore Pro in the docs: Pro's screens, flows or templates as cards. A flow card names its app and
 * kind and carries its size (screens and steps), as on Pro's own flow cards. The images are stills of Pro's own
 * library cards (scripts/pro-cards/capture.ts); every card opens that item on pro.swiftpieces.com.
 */
export function ProCardGrid({ type }: { type: ProCardType }) {
  const { label, plural, listing } = meta[type];
  // Pro's newest wave leads, as it does on Pro's own library pages; the rest keep Pro's order.
  const all = proCards(type);
  const list = [...all.filter((c) => c.isNew), ...all.filter((c) => !c.isNew)];
  // Flows and templates are several phones wide, so they run two to a row.
  const wide = type !== "screen";
  return (
    <div className="not-prose mb-10">
      <p className="p-meta text-subtle">{list.length} {plural} in Pro</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button href={listing} size="sm">Browse on Pro <External /></Button>
        <Button href={pro.pricing} size="sm" variant="ghost">What's inside <Arrow className="size-3.5" /></Button>
      </div>
      <div className={cn("mt-10 grid gap-4", wide ? "md:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
        {list.map((card, i) => (
          <a key={card.id} href={proItemUrl(card)} className="group block h-full">
            <Panel hover className="h-full">
              <PanelMedia>
                {/* eslint-disable-next-line @next/next/no-img-element -- static stills; next/image would re-encode them per width for no gain */}
                <img
                  src={`/pro-cards/${card.id}.webp`}
                  alt={`${card.title}, a SwiftPieces Pro ${label.toLowerCase()}`}
                  loading={i < (wide ? 2 : 3) ? "eager" : "lazy"}
                  decoding="async"
                  className={cn("block w-full object-cover", wide ? "aspect-[16/10]" : "aspect-square")}
                />
                <span className="absolute top-3 left-3 inline-flex h-[18px] items-center rounded-[5px] bg-black/60 px-1.5 text-[10px] leading-none font-semibold text-white backdrop-blur-sm">Pro</span>
              </PanelMedia>
              <PanelBody>
                <p className="p-meta text-subtle">{label} · {card.category}{"kind" in card && card.kind ? ` · ${card.kind}` : ""}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <p className="p-item min-w-0 truncate">{card.title}</p>
                    {card.isNew ? <NewBadge /> : null}
                  </span>
                  <External className="shrink-0 text-subtle transition-colors duration-300 group-hover:text-foreground" />
                </div>
                <p className="p-body mt-2 line-clamp-2 text-[13px]">{card.summary}</p>
                {"screens" in card && card.screens ? <FlowSize screens={card.screens} steps={card.steps ?? 0} /> : null}
              </PanelBody>
            </Panel>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * A flow's size as two tinted chips, as on Pro's flow cards: the screens it passes through in the
 * brand red at low opacity, the steps beside them in neutral.
 */
function FlowSize({ screens, steps }: { screens: number; steps: number }) {
  const chip = "inline-flex h-[22px] items-center gap-1.5 rounded-[6px] px-2 text-[11.5px] font-medium tabular-nums";
  return (
    <p className="mt-3.5 flex flex-wrap items-center gap-1.5">
      <span className={cn(chip, "bg-accent/[0.13] text-accent")}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>
        <span><span className="font-semibold">{screens}</span> {screens === 1 ? "Screen" : "Screens"}</span>
      </span>
      <span className={cn(chip, "bg-foreground/[0.04] text-muted")}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H15a3 3 0 0 1 3 3v6.5" /></svg>
        <span><span className="font-semibold text-foreground">{steps}</span> Steps</span>
      </span>
    </p>
  );
}
