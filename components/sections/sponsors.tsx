import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow, TextLink } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/animated-text";
import { Reveal, RevealGroup, RevealItem } from "@/components/effects/reveal";
import { DitherStage } from "@/components/visual/dither-stage";
import { CornerDither } from "@/components/visual/corner-dither";
import { SectionCopy, Glyph } from "@/components/sections/feature-row";
import { getRegistryIndex } from "@/lib/registry";
import { getStarCount, formatCount } from "@/lib/github";
import { getViews } from "@/lib/views";
import { sponsorLinks, tiers, type Sponsor, type Tier } from "@/lib/sponsors";
import { cn } from "@/lib/cn";

/* ---------- Hero ---------- */

/** The ask, then the reach behind it: real counts only, so sponsors can judge what a placement is worth. */
export async function SponsorHero() {
  const [views, stars] = await Promise.all([getViews(), getStarCount()]);
  const pieces = getRegistryIndex().length;
  const reach = [
    views ? `${formatCount(views)} page views` : null,
    stars !== null ? `${formatCount(stars)} GitHub stars` : null,
    `${pieces} free pieces`,
    "MIT + Commons Clause",
  ].filter(Boolean) as string[];
  return (
    <section className="relative overflow-hidden pt-20 pb-10 md:pt-28">
      <Container className="flex flex-col items-center text-center">
        <Reveal priority><Eyebrow>Sponsor · Open-source SwiftUI</Eyebrow></Reveal>
        <AnimatedText as="h1" text="Keep the pieces free." accent="free." className="p-hero mt-8 max-w-4xl" />
        <Reveal priority delay={0.35}>
          <p className="p-body mx-auto mt-7 max-w-xl text-[14px]">Swift Pieces is built and maintained by one developer. Sponsorship pays for new free pieces, updates for every iOS release, and the docs, CLI and MCP server that go with them. Companies get their logo in front of the iOS developers who use it.</p>
        </Reveal>
        <Reveal priority delay={0.45} className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
          <Button href={sponsorLinks.github}>Sponsor on GitHub <Arrow /></Button>
          {/* Companies see the tiers first; the invoice email sits under the tier cards. */}
          <TextLink href="#tiers">Company sponsorship</TextLink>
        </Reveal>
        <Reveal priority delay={0.55}>
          <p className="t-meta mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-subtle">
            {reach.map((r, i) => (
              <span key={r} className="contents">
                {i > 0 ? <span aria-hidden>·</span> : null}
                <span>{r}</span>
              </span>
            ))}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Tiers ---------- */

function Check() {
  return <svg aria-hidden viewBox="0 0 16 16" className="mt-[3px] size-3.5 shrink-0 text-foreground" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function TierCard({ tier, taken }: { tier: Tier; taken: number }) {
  const gold = tier.id === "gold";
  const full = tier.slots !== undefined && taken >= tier.slots;
  return (
    <div className={cn("card relative flex h-full flex-col overflow-hidden", gold && "border-[var(--card-border-hover)]")}>
      {/* Gold stands on the same dithered ground as the Pro cards; the others stay quiet. */}
      {gold ? (
        <div className="relative isolate h-24 overflow-hidden">
          <DitherStage seed="sponsor-gold" palette={["#ff7a3c", "#ff0000", "#ff8fb8", "#4d8dff"]} className="-z-10" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-7">
        <div className="flex items-center justify-between gap-3">
          <span className={cn("p-meta", gold ? "text-accent" : "text-subtle")}>{tier.audience === "company" ? "Company" : "Individual"}</span>
          {tier.slots ? <span className="rounded-[4px] border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase tabular-nums">{full ? "Full" : `${tier.slots - taken} of ${tier.slots} open`}</span> : null}
        </div>
        <h3 className="mt-5 text-[18.5px] leading-[1.2] font-medium tracking-[-0.02em]">{tier.name}</h3>
        <p className="mt-2 flex items-baseline gap-1">
          <span className="text-[32.5px] leading-none font-medium tracking-[-0.04em] tabular-nums">${tier.price}</span>
          <span className="text-[12.5px] text-muted">/ month</span>
        </p>
        <p className="mt-4 text-[13px] leading-[22px] text-pretty text-muted">{tier.pitch}</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {tier.perks.map((p) => <li key={p} className="flex gap-2.5 text-[13px] leading-snug text-foreground/90"><Check />{p}</li>)}
        </ul>
        <div className="mt-auto pt-8">
          {full ? (
            <TextLink href={sponsorLinks.email}>Join the waitlist</TextLink>
          ) : (
            <Button href={sponsorLinks.github} variant={gold ? "primary" : "secondary"} className="w-full justify-center">Sponsor as {tier.name} <Arrow /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SponsorTiers({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <section id="tiers" className="relative scroll-mt-16 py-16 sm:py-24">
      <Container>
        <SectionCopy
          tags={[{ label: "Monthly", icon: <Glyph.tag /> }, { label: "Cancel any time", icon: <Glyph.check /> }]}
          title="Four tiers, one for giving and three for being seen"
          body="Individual sponsorship is a thank-you. Company tiers buy placement where iOS developers read: the homepage, every docs page and the README."
        />
        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.08}>
          {tiers.map((t) => (
            <RevealItem key={t.id}>
              <TierCard tier={t} taken={sponsors.filter((s) => s.tier === t.id).length} />
            </RevealItem>
          ))}
        </RevealGroup>
        <Reveal>
          <p className="mt-6 text-[13px] text-muted">Need an invoice, a yearly plan or a custom amount? <a href={sponsorLinks.email} className="u-link text-foreground">Email saivion@swiftpieces.com</a>.</p>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Current sponsors ---------- */

/** One Gold seat: a column inside the Gold panel, split from its neighbours by a hairline. */
function GoldSeat({ sponsor, price }: { sponsor?: Sponsor; price: number }) {
  if (sponsor) {
    return (
      <a href={sponsor.url} target="_blank" rel="noreferrer sponsored" className="group flex h-40 flex-col items-center justify-center gap-3 px-6 transition-colors hover:bg-white/[0.02]">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote sponsor avatars, sized in CSS */}
        <img src={sponsor.logo} alt="" className="size-14 rounded-[6px] object-cover" loading="lazy" />
        <span className="truncate text-[14px] font-medium text-foreground">{sponsor.name}</span>
      </a>
    );
  }
  return (
    <a href={sponsorLinks.github} className="group flex h-40 flex-col items-center justify-center gap-3 px-6 text-center transition-colors hover:bg-white/[0.02]">
      <span aria-hidden className="grid size-10 place-items-center rounded-[6px] border border-dashed border-accent/40 text-accent transition-colors group-hover:border-accent">
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3.5v9M3.5 8h9" /></svg>
      </span>
      <span className="text-[13px] font-medium text-foreground">Your logo on the homepage</span>
      <span className="-mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors group-hover:text-foreground">${price} / month <Arrow className="size-3" /></span>
    </a>
  );
}

/** A lower tier as one row: tier and price, who sponsors (or what the seat gets), and the way in. */
function TierRow({ tier, open, children }: { tier: Tier; open: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-[var(--line)] py-6 md:grid-cols-[180px_1fr_auto] md:items-center md:gap-8">
      <div>
        <p className="text-[14px] font-medium text-foreground">{tier.name}</p>
        <p className="mt-1 text-[12px] text-subtle tabular-nums">${tier.price} / month</p>
      </div>
      <div className="min-w-0">{children}</div>
      <a href={sponsorLinks.github} className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-foreground">
        <span className="u-link">{open}</span> <Arrow className="size-3.5" />
      </a>
    </div>
  );
}

/** Logos in a row, sized by tier. */
function LogoRow({ list, size }: { list: Sponsor[]; size: "silver" | "bronze" }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {list.map((s) => (
        <li key={s.name}>
          <a href={s.url} target="_blank" rel="noreferrer sponsored" className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80" title={s.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote sponsor avatars, sized in CSS */}
            <img src={s.logo} alt="" className={cn("object-cover", size === "silver" ? "size-9 rounded-[5px]" : "size-7 rounded-[4px]")} loading="lazy" />
            <span className={size === "silver" ? "text-[13px] font-medium" : "text-[12.5px]"}>{s.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Gold is the only boxed thing in the section: a gradient-edged panel lit from its corner, with
 * three large seats in columns. Silver, Bronze and Supporters sit under it as plain rows, each with
 * its price, its sponsors (or a line about the open seat) and a link, so nothing competes with Gold.
 */
export function SponsorWall({ sponsors }: { sponsors: Sponsor[] }) {
  const of = (id: Sponsor["tier"]) => sponsors.filter((s) => s.tier === id);
  const tier = (id: Sponsor["tier"]) => tiers.find((t) => t.id === id)!;
  const goldTier = tier("gold");
  const gold = of("gold");
  const seats = goldTier.slots ?? 3;
  const open = Math.max(0, seats - gold.length);
  const silver = of("silver");
  const bronze = of("bronze");
  const supporters = of("supporter");
  const empty = (text: string) => <p className="text-[13px] text-subtle">{text}</p>;
  return (
    <section className="relative py-16 sm:py-24">
      <Container>
        <SectionCopy
          tags={[{ label: "Sponsors", icon: <Glyph.gift /> }]}
          title={sponsors.length ? "Thank you to the sponsors keeping it free" : "Be the first to sponsor Swift Pieces"}
          body={sponsors.length ? "Every name here pays for work that stays free for everyone." : "Every seat below is open. The first sponsors are listed first, and stay at the top of their tier."}
        />

        <Reveal className="mt-12">
          {/* Gold: a 1px gradient edge around a dark panel, with the Pro cards' halftone corner. */}
          <div className="rounded-[7px] bg-[linear-gradient(135deg,#ff7a3c,#ff0000_35%,#ff8fb8_70%,#4d8dff)] p-px shadow-[0_24px_60px_-44px_rgb(255_0_0/0.5)]">
            <div className="relative isolate overflow-hidden rounded-[6px] bg-[#0b0b0c]">
              {/* The Pro cards' halftone corner, so Gold reads as part of that family. Smaller and dimmer than
                  on the Pro cards: here the third seat's copy sits in that corner and has to stay legible. */}
              <CornerDither className="pointer-events-none absolute right-0 bottom-0 -z-10 h-40 w-full opacity-70 [mask-image:radial-gradient(110%_110%_at_100%_100%,black_30%,transparent_72%)] lg:h-[62%] lg:w-[30%]" />
              <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 pt-6 md:px-8 md:pt-8">
                <div>
                  <p className="p-meta text-accent">Gold</p>
                  <p className="mt-2 text-[18.5px] font-medium tracking-[-0.02em] text-foreground">The headline placement</p>
                  <p className="mt-1.5 text-[13px] text-muted">On the homepage, at the top of this page and the README, and in the docs.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] text-muted tabular-nums">${goldTier.price} / month</span>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11.5px] font-semibold text-accent tabular-nums">
                    {open ? `${open} of ${seats} seats open` : "All seats taken"}
                  </span>
                </div>
              </div>
              <div className="relative mt-6 grid border-t border-white/[0.07] sm:grid-cols-3 sm:divide-x sm:divide-white/[0.07] max-sm:divide-y max-sm:divide-white/[0.07]">
                {gold.map((s) => <GoldSeat key={s.name} sponsor={s} price={goldTier.price} />)}
                {Array.from({ length: open }).map((_, i) => <GoldSeat key={i} price={goldTier.price} />)}
              </div>
            </div>
          </div>

          {/* The lower tiers: quiet rows, no boxes. */}
          <div className="mt-4 border-t border-[var(--line)]">
            <TierRow tier={tier("silver")} open="Become a Silver sponsor">
              {silver.length ? <LogoRow list={silver} size="silver" /> : empty("Open. Your logo on this page, the README and every docs page.")}
            </TierRow>
            <TierRow tier={tier("bronze")} open="Become a Bronze sponsor">
              {bronze.length ? <LogoRow list={bronze} size="bronze" /> : empty("Open. Your logo on this page and in the README.")}
            </TierRow>
            <TierRow tier={tier("supporter")} open="Sponsor on GitHub">
              {supporters.length ? (
                <p className="text-[13px] leading-7 text-muted">
                  {supporters.map((s, i) => (
                    <span key={s.name}>
                      {i > 0 ? ", " : null}
                      <a href={s.url} target="_blank" rel="noreferrer" className="u-link text-foreground">{s.name}</a>
                    </span>
                  ))}
                </p>
              ) : (
                empty("Your name here, from $5 a month.")
              )}
            </TierRow>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Where it goes ---------- */

export function SponsorUse() {
  const items = [
    { title: "New free pieces", body: "More of the library stays free. Sponsorship decides how much of the roadmap ships as open source." },
    { title: "Every iOS release", body: "Each piece is rechecked and fixed for new iOS and Xcode versions, including Liquid Glass on iOS 26 and later." },
    { title: "The tooling around it", body: "The docs, the CLI, the registry and the MCP server your agent installs from, kept free and online." },
  ];
  return (
    <section className="relative py-16 sm:py-24">
      <Container>
        <SectionCopy tags={[{ label: "Where it goes", icon: <Glyph.bolt /> }]} title="What sponsorship pays for" />
        <RevealGroup className="mt-12 grid gap-4 md:grid-cols-3" stagger={0.08}>
          {items.map((it, i) => (
            <RevealItem key={it.title}>
              <div className="frame-dashed relative h-full p-7">
                <span className="text-[12.5px] text-subtle tabular-nums">0{i + 1}</span>
                <h3 className="mt-4 text-[15.5px] font-medium tracking-[-0.01em]">{it.title}</h3>
                <p className="mt-2 text-[13px] leading-[22px] text-pretty text-muted">{it.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}

/* ---------- FAQ copy ---------- */

export const sponsorFaqs = [
  { q: "How do I pay?", a: "Through GitHub Sponsors, monthly, cancel any time. GitHub charges no fee on sponsorships from personal accounts, so all of it reaches the project. Companies that need an invoice, a yearly plan or a different payment method can email instead." },
  { q: "Does sponsoring give me Swift Pieces Pro?", a: "Gold includes one Pro license for your team. The other tiers support the free library and do not include Pro, which is a separate one-time purchase on pro.swiftpieces.com." },
  { q: "When does my logo appear?", a: "Within a day of your sponsorship starting. GitHub sponsors are listed automatically; invoiced sponsors are added by hand. Send a square logo and the link you want if your GitHub avatar is not the right mark." },
  { q: "Why is Gold limited to three?", a: "So a homepage logo stays worth paying for. When all three seats are taken, new Gold sponsors join a waitlist and are offered the next open seat." },
  { q: "Can I sponsor privately?", a: "Yes. Choose private sponsorship on GitHub and you will not be listed anywhere. The perks tied to your logo need a public sponsorship." },
];

/* ---------- Placements on other pages ---------- */

/**
 * The homepage's Gold row. Renders nothing until there is a Gold sponsor, so the homepage never
 * shows an empty "sponsored by" band.
 */
export function SponsorStrip({ sponsors }: { sponsors: Sponsor[] }) {
  if (!sponsors.length) return null;
  return (
    <Container className="py-10">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
        <a href="/sponsors" className="p-meta text-subtle transition-colors hover:text-foreground">Sponsored by</a>
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {sponsors.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer sponsored" className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote sponsor avatars */}
                <img src={s.logo} alt="" className="size-7 rounded-[6px] object-cover" loading="lazy" />
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}

/** The docs sidebar's Silver-and-up slot. Nothing until someone sponsors at that level. */
export function DocsSponsors({ sponsors }: { sponsors: Sponsor[] }) {
  if (!sponsors.length) return null;
  return (
    <div className="mb-3 border-b border-[var(--line)] pb-3">
      <a href="/sponsors" className="mb-2 block text-[11px] font-medium tracking-wider text-subtle uppercase hover:text-foreground">Sponsors</a>
      <ul className="flex flex-col gap-1">
        {sponsors.map((s) => (
          <li key={s.name}>
            <a href={s.url} target="_blank" rel="noreferrer sponsored" className="flex items-center gap-2 rounded-[4px] px-1.5 py-1 text-[12.5px] text-muted hover:bg-surface-2 hover:text-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote sponsor avatars */}
              <img src={s.logo} alt="" className="size-5 rounded-[4px] object-cover" loading="lazy" />
              <span className="truncate">{s.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
