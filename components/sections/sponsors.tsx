import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/animated-text";
import { pageLede } from "@/components/ui/section-header";
import { Index } from "@/components/ui/panel";
import { Reveal, RevealGroup, RevealItem } from "@/components/effects/reveal";
import { GrainStage } from "@/components/visual/grain-stage";
import { SectionHead, Glyph, band, cardTitle, heroTitle } from "@/components/sections/feature-row";
import { getRegistryIndex } from "@/lib/registry";
import { getStarCount, formatCount } from "@/lib/github";
import { getViews } from "@/lib/views";
import { sponsorLinks, tiers, type Sponsor, type Tier } from "@/lib/sponsors";
import { cn } from "@/lib/cn";

/* ---------- Hero ---------- */

/** The quiet second action beside a primary pill: words and an arrow that nudges, as on the landing. */
const quietLink = "group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground";

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
    <section className="relative pt-16 pb-12 md:pt-28 sm:pb-[68px] lg:pt-[120px]">
      <Container className="flex flex-col items-center text-center">
        <Reveal priority>
          <Eyebrow>
            Sponsor
            <span aria-hidden className="h-3 w-px bg-[var(--line-strong)]" />
            <span className="text-muted">Open-source SwiftUI</span>
          </Eyebrow>
        </Reveal>
        {/* Same title and subtitle styles as the homepage and /pro heroes. */}
        <AnimatedText as="h1" text="Keep the pieces free." accent="free." className={cn("mt-[30px] max-w-4xl", heroTitle)} />
        <Reveal priority delay={0.35}>
          <p className={cn("mx-auto mt-[26px] max-w-[580px]", pageLede)}>SwiftPieces is built and maintained by one developer. Sponsorship pays for new free pieces, updates for every iOS release, and the docs, CLI and MCP server that go with them. Companies get their logo in front of the iOS developers who use it.</p>
        </Reveal>
        <Reveal priority delay={0.45} className="mt-[38px] flex flex-wrap items-center justify-center gap-2.5">
          <Button href={sponsorLinks.github}>Sponsor on GitHub <Arrow /></Button>
          {/* Companies see the tiers first; the invoice email sits under the tier cards. */}
          <a href="#tiers" className={quietLink}>Company sponsorship <Arrow /></a>
        </Reveal>
        <Reveal priority delay={0.55}>
          <ul className="mt-12 flex flex-wrap items-center justify-center gap-2">
            {reach.map((r) => <li key={r} className="inline-flex h-9 items-center rounded-full bg-surface px-[15px] text-[13.5px] whitespace-nowrap text-muted">{r}</li>)}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Tiers ---------- */

function Check() {
  return <svg aria-hidden viewBox="0 0 16 16" className="ai mt-[3px] size-3.5 shrink-0 text-foreground" fill="none" stroke="currentColor" strokeWidth="1.75"><path className="ai-check" pathLength={1} d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/**
 * One tier as a panel in the tiers' shared tray, set like the offer on pro.swiftpieces.com: who it is
 * for, the name, the price large and regular-weight, the pitch, the perks under a hairline, the way in.
 * Gold stands on a strip of the Pro cards' grain ground; the others stay quiet.
 */
function TierCard({ tier, taken }: { tier: Tier; taken: number }) {
  const gold = tier.id === "gold";
  const full = tier.slots !== undefined && taken >= tier.slots;
  return (
    <div className="panel flex h-full flex-col">
      {gold ? (
        <div className="relative isolate h-20 overflow-hidden">
          <GrainStage seed="sponsor-gold" className="-z-10" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-6 md:p-7">
        <div className="flex h-6 items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-subtle">{tier.audience === "company" ? "Company" : "Individual"}</span>
          {tier.slots ? <span className="inline-flex h-6 items-center rounded-full border border-[var(--line-strong)] px-2.5 text-[11.5px] font-medium text-muted tabular-nums">{full ? "Full" : `${tier.slots - taken} of ${tier.slots} open`}</span> : null}
        </div>
        <h3 className={cn("mt-5", cardTitle)}>{tier.name}</h3>
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="text-[44px] leading-none font-normal tracking-[-0.045em] tabular-nums">${tier.price}</span>
          <span className="text-[13.5px] text-muted">/ month</span>
        </p>
        <p className="mt-4 text-[14px] leading-[23px] text-pretty text-muted">{tier.pitch}</p>
        <ul className="mt-6 flex flex-col gap-3 border-t border-[var(--line)] pt-5">
          {tier.perks.map((p) => <li key={p} className="flex gap-2.5 text-[13.5px] leading-snug text-foreground"><Check />{p}</li>)}
        </ul>
        <div className="mt-auto pt-8">
          {full ? (
            <a href={sponsorLinks.email} className="group inline-flex items-center gap-2 text-[14.5px] font-semibold text-foreground">Join the waitlist <Arrow /></a>
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
    <section id="tiers" className={cn("relative scroll-mt-16", band)}>
      <Container>
        <SectionHead
          tags={[{ label: "Monthly", icon: <Glyph.tag /> }, { label: "Cancel any time", icon: <Glyph.check /> }]}
          title="Four tiers, one for giving and three for being seen"
          body="Individual sponsorship is a thank-you. Company tiers buy placement where iOS developers read: the homepage, every docs page and the README."
        />
        <Reveal className="tray">
          <RevealGroup className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" stagger={0.08}>
            {tiers.map((t) => (
              <RevealItem key={t.id} className="h-full">
                <TierCard tier={t} taken={sponsors.filter((s) => s.tier === t.id).length} />
              </RevealItem>
            ))}
          </RevealGroup>
        </Reveal>
        <Reveal>
          <p className="mt-6 text-[14px] text-muted">Need an invoice, a yearly plan or a custom amount? <a href={sponsorLinks.email} className="u-link font-medium text-foreground">Email saivion@swiftpieces.com</a>.</p>
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
      <a href={sponsor.url} target="_blank" rel="noreferrer sponsored" className="group flex h-44 flex-col items-center justify-center gap-3 px-6 transition-colors hover:bg-surface-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote sponsor avatars, sized in CSS */}
        <img src={sponsor.logo} alt="" className="size-14 rounded-[14px] object-cover" loading="lazy" />
        <span className="truncate text-[14px] font-medium text-foreground">{sponsor.name}</span>
      </a>
    );
  }
  return (
    <a href={sponsorLinks.github} className="group flex h-44 flex-col items-center justify-center gap-3 px-6 text-center transition-colors hover:bg-surface-3">
      <span aria-hidden className="grid size-10 place-items-center rounded-full border border-[var(--line-strong)] text-muted transition-colors group-hover:text-foreground">
        <svg viewBox="0 0 16 16" className="ai ai-spin size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3.5v9M3.5 8h9" /></svg>
      </span>
      <span className="text-[14px] font-medium text-foreground">Your logo on the homepage</span>
      <span className="-mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors group-hover:text-foreground">${price} / month <Arrow className="size-3" /></span>
    </a>
  );
}

/** A lower tier as one row: tier and price, who sponsors (or what the seat gets), and the way in. */
function TierRow({ tier, open, children }: { tier: Tier; open: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-[var(--line)] py-6 md:grid-cols-[180px_1fr_auto] md:items-center md:gap-8">
      <div>
        <p className="text-[15px] font-medium text-foreground">{tier.name}</p>
        <p className="mt-1 text-[13px] text-subtle tabular-nums">${tier.price} / month</p>
      </div>
      <div className="min-w-0">{children}</div>
      <a href={sponsorLinks.github} className="group inline-flex items-center gap-2 text-[14px] font-semibold text-muted transition-colors hover:text-foreground">
        {open} <Arrow className="size-3.5" />
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
            <img src={s.logo} alt="" className={cn("object-cover", size === "silver" ? "size-9 rounded-[10px]" : "size-7 rounded-[8px]")} loading="lazy" />
            <span className={size === "silver" ? "text-[14px] font-medium" : "text-[13px]"}>{s.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Gold is the only boxed thing in the section: a tray holding one panel, its head (the placement, the
 * price and the open seats, marked with a live red dot while any are free) over three large seats in
 * columns. Silver, Bronze and Supporters sit under it as plain hairline rows, each with its price, its
 * sponsors (or a line about the open seat) and a link, so nothing competes with Gold.
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
  const empty = (text: string) => <p className="text-[14px] text-subtle">{text}</p>;
  return (
    <section className={band}>
      <Container>
        <SectionHead
          tags={[{ label: "Sponsors", icon: <Glyph.gift /> }]}
          title={sponsors.length ? "Thank you to the sponsors keeping it free" : "Be the first to sponsor SwiftPieces"}
          body={sponsors.length ? "Every name here pays for work that stays free for everyone." : "Every seat below is open. The first sponsors are listed first, and stay at the top of their tier."}
        />

        <Reveal>
          <div className="tray">
            <div className="panel">
              <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 md:px-8 md:pt-8">
                <div>
                  <p className="text-[13px] font-medium text-subtle">Gold</p>
                  <p className={cn("mt-2", cardTitle)}>The headline placement</p>
                  <p className="mt-2 text-[14.5px] text-muted">On the homepage, at the top of this page and the README, and in the docs.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13.5px] text-muted tabular-nums">${goldTier.price} / month</span>
                  <span className="inline-flex h-[30px] items-center gap-2 rounded-full bg-surface px-3 text-[12.5px] font-medium text-foreground tabular-nums">
                    {open ? <span aria-hidden className="size-[7px] rounded-full bg-accent shadow-[0_0_0_3px_rgb(255_0_0/0.2)]" /> : null}
                    {open ? `${open} of ${seats} seats open` : "All seats taken"}
                  </span>
                </div>
              </div>
              <div className="mt-6 grid border-t border-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-[var(--line)] max-sm:divide-y max-sm:divide-[var(--line)]">
                {gold.map((s) => <GoldSeat key={s.name} sponsor={s} price={goldTier.price} />)}
                {Array.from({ length: open }).map((_, i) => <GoldSeat key={i} price={goldTier.price} />)}
              </div>
            </div>
          </div>

          {/* The lower tiers: quiet rows, no boxes. */}
          <div className="mt-6 border-t border-[var(--line)]">
            <TierRow tier={tier("silver")} open="Become a Silver sponsor">
              {silver.length ? <LogoRow list={silver} size="silver" /> : empty("Open. Your logo on this page, the README and every docs page.")}
            </TierRow>
            <TierRow tier={tier("bronze")} open="Become a Bronze sponsor">
              {bronze.length ? <LogoRow list={bronze} size="bronze" /> : empty("Open. Your logo on this page and in the README.")}
            </TierRow>
            <TierRow tier={tier("supporter")} open="Sponsor on GitHub">
              {supporters.length ? (
                <p className="text-[14px] leading-7 text-muted">
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
    <section className={band}>
      <Container>
        <SectionHead tags={[{ label: "Where it goes", icon: <Glyph.bolt /> }]} title="What sponsorship pays for" />
        <RevealGroup className="grid gap-3 md:grid-cols-3" stagger={0.08}>
          {items.map((it, i) => (
            <RevealItem key={it.title} className="h-full">
              {/* Numbered tiles, as on pro.swiftpieces.com: the index, then the point well below it. */}
              <div className="flex h-full min-h-[220px] flex-col rounded-[22px] bg-surface px-6 pt-[26px] pb-7">
                <Index n={i + 1} />
                <h3 className="mt-12 text-[19px] font-medium tracking-[-0.02em] sm:mt-14">{it.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-[23px] text-pretty text-muted">{it.body}</p>
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
  { q: "Does sponsoring give me SwiftPieces Pro?", a: "Gold includes one Pro license for your team. The other tiers support the free library and do not include Pro, which is a separate one-time purchase on pro.swiftpieces.com." },
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
        <a href="/sponsors" className="text-[13px] font-medium text-subtle transition-colors hover:text-foreground">Sponsored by</a>
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {sponsors.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer sponsored" className="flex h-11 items-center gap-2.5 rounded-full bg-surface pr-4 pl-2 text-[13.5px] font-medium text-muted transition-colors hover:bg-surface-3 hover:text-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote sponsor avatars */}
                <img src={s.logo} alt="" className="size-7 rounded-full object-cover" loading="lazy" />
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
