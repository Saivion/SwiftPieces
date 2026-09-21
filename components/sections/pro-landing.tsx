import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow, TextLink } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/animated-text";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionLabel } from "@/components/ui/section-label";
import { Stat } from "@/components/ui/stat";
import { Reveal, RevealGroup, RevealItem } from "@/components/effects/reveal";
import { cn } from "@/lib/cn";
import { CornerDither } from "@/components/visual/corner-dither";
import { pro } from "@/lib/site";
import { buildKitLine, namesWithMore, proCatalog, proCountsLabel } from "@/lib/pro-catalog";

// Marketing copy only. Counts and names come from lib/pro-catalog.ts, the one hand-maintained copy of Pro's catalog.
const buy = pro.buy;
const { screens, templates, buildKit } = proCatalog;
// No prices on Free: pricing lives on Pro, so the secondary CTAs say "View pricing" and go there.
const pricing = pro.pricing;

type Kind = "screen" | "template";
const catalog: { name: string; kind: Kind; cat: string }[] = [
  { name: "Wallet", kind: "screen", cat: "Finance" },
  { name: "Onboarding", kind: "screen", cat: "Onboarding" },
  { name: "Subscription App", kind: "template", cat: "Commerce" },
  { name: "Chat", kind: "screen", cat: "AI" },
  { name: "Now Playing", kind: "screen", cat: "Media" },
  { name: "Meditation App", kind: "template", cat: "Health" },
  { name: "Paywall", kind: "screen", cat: "Commerce" },
  { name: "Dashboard", kind: "screen", cat: "Productivity" },
  { name: "Finance App", kind: "template", cat: "Finance" },
  { name: "Voice Mode", kind: "screen", cat: "AI" },
  { name: "Breathe", kind: "screen", cat: "Health" },
  { name: "AI Assistant", kind: "template", cat: "AI" },
  { name: "Discover", kind: "screen", cat: "Travel" },
  { name: "Travel App", kind: "template", cat: "Travel" },
];

const kindLabel: Record<Kind, string> = { screen: "Screen", template: "Template" };

/* ---------- Hero ---------- */

export function ProHero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-10 md:pt-28">
      {/* Full-height dot field with a long, soft fade so the dots dissolve well before the gallery instead of stopping on a line. */}
      <Container className="flex flex-col items-center text-center">
        <Reveal priority><Eyebrow>Swift Pieces Pro · Production-ready SwiftUI</Eyebrow></Reveal>
        <AnimatedText as="h1" text="The pieces to build the whole app." accent="whole" className="p-hero mt-8 max-w-4xl" />
        <Reveal priority delay={0.35}>
          <p className="p-body mx-auto mt-7 max-w-xl text-[15px]">Free is a curated taste of Swift Pieces. Pro is the complete library: production-ready SwiftUI screens, complete app templates and the Build Kit for your coding agent. Start from a finished screen or a whole Xcode project. Copy the source. Make it yours.</p>
        </Reveal>
        <Reveal priority delay={0.45} className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
          <Button href={buy}>Get Swift Pieces Pro <Arrow /></Button>
          <TextLink href={pricing}>View pricing</TextLink>
        </Reveal>
        <Reveal priority delay={0.55}>
          <p className="t-meta mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-subtle">
            <span>{screens} screens</span><span aria-hidden>·</span><span>{templates} app templates</span><span aria-hidden>·</span><span>{buildKit.total}-item Build Kit</span><span aria-hidden>·</span><span>Swift source, no runtime</span>
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Gallery ---------- */

/** Abstract phone mock so the gallery reads as a product wall without shipping Pro previews in Free. */
function Mock({ kind, i }: { kind: Kind; i: number }) {
  const bar = "rounded-[3px] bg-foreground/[.10]";
  const rows = kind === "template" ? 6 : 5;
  return (
    <div className="relative mx-auto h-[150px] w-[76px] rounded-[16px] border border-foreground/[.14] bg-background p-2">
      <div className="mx-auto mb-2 h-1 w-6 rounded-full bg-foreground/[.12]" />
      {kind === "screen" ? <div className={cn("mb-2 h-9 rounded-[6px]", i % 2 ? "bg-accent/40" : "bg-foreground/[.16]")} /> : null}
      <div className="space-y-1.5">
        {Array.from({ length: rows }, (_, r) => <div key={r} className={cn(bar, "h-1.5")} style={{ width: `${[92, 64, 78, 50, 84, 40][(r + i) % 6]}%` }} />)}
      </div>
      {kind === "template" ? <div className="absolute inset-x-2 bottom-2 flex h-5 items-center justify-around rounded-[6px] bg-foreground/[.10]">{[0, 1, 2, 3].map((d) => <span key={d} className={cn("size-1.5 rounded-full", d === 1 ? "bg-accent" : "bg-foreground/30")} />)}</div> : null}
    </div>
  );
}

function Tile({ item, i }: { item: (typeof catalog)[number]; i: number }) {
  return (
    <a href={buy} className="group stage dots relative flex h-[260px] w-[300px] shrink-0 flex-col justify-end overflow-hidden p-4 transition-transform duration-500 hover:-translate-y-1">
      <div className="absolute inset-x-0 top-6"><Mock kind={item.kind} i={i} /></div>
      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="p-meta text-subtle">{kindLabel[item.kind]} · {item.cat}</p>
          <p className="mt-1.5 text-[15px] font-semibold">{item.name}</p>
        </div>
        <span className="pill inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap bg-background/80 px-2.5 text-[12px] font-medium text-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">Open in Pro <Arrow className="size-3" /></span>
      </div>
    </a>
  );
}

export function ProGallery() {
  const a = catalog.slice(0, 7);
  const b = catalog.slice(7);
  const tabs: { label: string; n: string }[] = [
    { label: "Screens", n: String(screens) }, { label: "Templates", n: String(templates) },
  ];
  return (
    <section className="relative pb-20 md:pb-32">
      <div className="marquee-pause space-y-4 overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee flex w-max gap-4" style={{ ["--marquee-duration" as string]: "70s" }}>
          {[...a, ...a].map((item, i) => <Tile key={`${item.name}-${i}`} item={item} i={i} />)}
        </div>
        <div className="marquee marquee-reverse flex w-max gap-4" style={{ ["--marquee-duration" as string]: "80s" }}>
          {[...b, ...b].map((item, i) => <Tile key={`${item.name}-${i}`} item={item} i={i + 7} />)}
        </div>
      </div>
      <Container>
        <Reveal className="mt-10 flex flex-wrap justify-center gap-2">
          {tabs.map((t) => (
            <a key={t.label} href={buy} className="pill inline-flex h-9 items-center gap-2 px-4 text-[13px] font-medium text-muted transition-colors hover:border-[var(--card-border-hover)] hover:bg-surface-2 hover:text-foreground">
              {t.label}<span className="text-[11px] text-subtle">{t.n}</span>
            </a>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- What you get ---------- */

export function WhatYouGet() {
  const items = [
    { n: "01", value: screens, label: "Screens", detail: `${namesWithMore(proCatalog.screenExamples)}. Production-ready, not mockups.` },
    { n: "02", value: templates, label: "App templates", detail: `Complete Xcode projects: ${namesWithMore(proCatalog.templateNames, 5)} apps, each a running app you download, rename and ship.` },
    { n: "03", value: proCatalog.buildKit.total, label: "Build Kit items", detail: `${buildKitLine}.` },
  ];
  return (
    <section className="relative py-20 md:py-28">
      <Container>
        <SectionHeader label="Inside Pro" title="Finished screens, whole apps, and an agent that builds the rest to match." />
        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
          {items.map((s) => (
            <RevealItem key={s.label}>
              <a href={buy} className="card group block h-full p-6 transition-colors">
                <p className="p-meta text-accent">{s.n}</p>
                <Stat value={s.value} label={s.label} detail={s.detail} />
              </a>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}

/* ---------- Free vs Pro ---------- */

function Check({ strong }: { strong?: boolean }) {
  return <svg aria-hidden viewBox="0 0 16 16" className={cn("mt-[3px] size-3.5 shrink-0", strong ? "text-foreground" : "text-subtle")} fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Quiet comparison card: eyebrow tag, statement title, short body, three points, one action. The Pro card carries a single accent hairline. */
function PlanCard({ tag, title, body, points, cta, pro: isPro }: { tag: string; title: string; body: string; points: string[]; cta: string; pro?: boolean }) {
  return (
    <div className={cn("card relative flex flex-col overflow-hidden p-8 md:p-9", isPro && "border-[var(--card-border-hover)]")}>
      {isPro ? <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent)_30%,var(--accent)_70%,transparent)]" /> : null}
      <div className="flex items-center justify-between">
        <span className={cn("p-meta", isPro ? "text-accent" : "text-subtle")}>{tag}</span>
        {isPro ? <span className="rounded-[4px] bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Pro</span> : null}
      </div>
      <h3 className="mt-6 text-[22px] font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="p-body mt-2.5 max-w-md">{body}</p>
      <ul className="mt-7 flex flex-col gap-2.5">
        {points.map((pt) => <li key={pt} className={cn("flex gap-2.5 text-[14px] leading-snug", isPro ? "text-foreground" : "text-muted")}><Check strong={isPro} />{pt}</li>)}
      </ul>
      <a href={buy} className={cn("group mt-auto inline-flex items-center gap-2 pt-8 text-[13.5px] font-semibold", isPro ? "text-foreground" : "text-muted hover:text-foreground")}><span className="u-link">{cta}</span><Arrow className="size-3.5" /></a>
    </div>
  );
}

export function Compare() {
  return (
    <section className="relative py-20 md:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="p-title text-balance">A curated taste, then the complete library.</h2>
          <p className="p-body mx-auto mt-5 max-w-lg">Free gives you standout pieces for a single moment. Pro gives you the screens and complete apps around them. Both are plain SwiftUI source in your project, so mixing them is the normal case.</p>
        </div>
        <Reveal className="mt-12 grid gap-3 lg:grid-cols-2">
          <PlanCard tag="Free library" title="A curated taste of Swift Pieces." body="Fifty-three animated pieces, Liquid Glass effects and Metal shaders. Genuinely good, and free to ship wherever a screen feels flat." points={["MIT + Commons Clause, forever", "Single-file pieces", "Install by CLI, MCP or copy-paste"]} cta="See what Pro adds" />
          <PlanCard tag="Swift Pieces Pro" title="The pieces to build the whole app." body="Production-ready SwiftUI screens, complete app templates, and a Build Kit that teaches your coding agent the same design. Install by copy, CLI or MCP." points={[proCountsLabel, "Full SwiftUI source that lives in your project", "Lifetime access, everything added later included"]} cta="Get Swift Pieces Pro" pro />
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Preview the quality ---------- */

export function TryFirst() {
  const cards = [
    { eyebrow: "Pro screen", title: "Wallet", body: "Stacked cards and passes you tap forward, fan out and reorder, with springs and haptics already tuned.", kind: "screen" as Kind, more: "More screens", href: pro.screens },
    { eyebrow: "Pro template", title: "AI Assistant", body: "Nimbus, a complete Xcode project with streaming chat, a conversation library, voice mode and widgets. Download it and it runs.", kind: "template" as Kind, more: "More templates", href: pro.templates },
  ];
  return (
    <section className="relative py-20 md:py-28">
      <Container>
        <SectionHeader label="Look before you buy" title="Every Pro piece has a public page. Look, then decide." />
        <RevealGroup className="mt-12 grid gap-4 lg:grid-cols-2" stagger={0.1}>
          {cards.map((c, i) => (
            <RevealItem key={c.title}>
              <div className="card flex h-full flex-col overflow-hidden">
                <div className="stage dots relative h-[240px] rounded-none"><div className="absolute inset-x-0 top-8"><Mock kind={c.kind} i={i + 3} /></div></div>
                <div className="p-8">
                  <SectionLabel className="text-accent">{c.eyebrow}</SectionLabel>
                  <h3 className="p-item mt-4">{c.title}</h3>
                  <p className="p-body mt-2 max-w-md">{c.body}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button href={c.href} size="sm">View in Pro <Arrow /></Button>
                    <Button href={c.href} size="sm" variant="ghost">{c.more}</Button>
                  </div>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}

/* ---------- FAQ copy ---------- */

export const proFaqs = [
  { q: "Does Pro change anything about the free library?", a: "No. The free pieces stay MIT + Commons Clause and maintained on GitHub. Pro is the complete library that builds on them, and it is what pays for the free work." },
  { q: "How does installation work?", a: "Screens install the same way as the free pieces: the CLI or the MCP server writes Swift files into your project, or you copy them by hand. Templates are complete Xcode projects you download from their page, with a guide from download to a running, renamed app. Nothing is linked at runtime." },
  { q: "Can I ship Pro pieces in client and App Store apps?", a: "Yes. A per-developer license covers unlimited personal and commercial apps, including client work. Reselling or redistributing the pieces as a competing library, or sharing your key, is what it excludes." },
  { q: "Is there a subscription or are there tiers?", a: "Neither. Swift Pieces Pro is one plan with lifetime access to everything, including every piece added later. Files already in your projects are yours regardless. The plan and pricing are on pro.swiftpieces.com." },
  { q: "Does it work with my coding agent?", a: "Yes. Connect Claude Code, Cursor or Xcode to the Pro MCP server with your license key, and your agent searches the library and installs the real screen instead of inventing a lookalike." },
  { q: "What are the requirements?", a: "An iOS 17 deployment target as the floor, with Xcode 16 for pieces and screens and Xcode 26 to open the app templates. Liquid Glass pieces use the real material on iOS 26 and fall back gracefully below it. Apple frameworks only, nothing third-party." },
];

/* ---------- Closing summary ---------- */

/**
 * The close is a summary, not a slogan: the promise and the action on the left (no price: that lives on Pro), what
 * the purchase contains on the right, with a halftone swell rising out of the card's corner.
 */
/** The offer card. Used to close the Pro page and, with `id="pro"`, as the landing page's Pro block. */
export function ProCTA({ className }: { className?: string }) {
  const included = [
    { n: screens, label: "Screens", note: namesWithMore(proCatalog.screenExamples, 4) },
    { n: templates, label: "App templates", note: "Complete Xcode projects you download and ship" },
    { n: proCatalog.buildKit.total, label: "Build Kit items", note: `${buildKit.styles} styles, ${buildKit.briefs} briefs, ${buildKit.recipes} recipes and ${buildKit.tools} tools for your coding agent` },
  ];
  const promises = ["Unlimited apps, commercial use included", "Everything added later included", "No subscription, nothing expires"];
  return (
    <section id="pro" className={cn("relative py-20 md:py-28", className)}>
      <Container>
        <Reveal className="cta-wash relative isolate overflow-hidden">
          <CornerDither className="pointer-events-none absolute right-0 bottom-0 -z-10 h-32 w-full md:h-40 [mask-image:radial-gradient(120%_120%_at_100%_100%,black_35%,transparent_78%)] lg:h-[27%] lg:w-[36%]" />
          <div className="grid lg:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col p-8 md:p-12 lg:p-14">
              <SectionLabel className="text-accent">One purchase</SectionLabel>
              <h2 className="p-title mt-6 max-w-md text-balance">One payment. Lifetime access.</h2>
              <p className="p-body mt-4 max-w-md">The complete library, {proCountsLabel}, delivered as Swift you keep.</p>
              <ul className="mt-10 flex flex-col gap-2.5">
                {promises.map((p) => <li key={p} className="flex gap-2.5 text-[14px] leading-snug text-foreground/90"><Check strong />{p}</li>)}
              </ul>
              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button href={pricing}>View pricing <Arrow /></Button>
                <TextLink href={pro.library}>Browse the library</TextLink>
              </div>
            </div>
            <div className="flex flex-col border-t border-[var(--line)] p-8 pb-28 md:p-12 md:pb-32 lg:border-t-0 lg:border-l lg:p-14">
              <p className="p-meta text-subtle">Included</p>
              <ul className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
                {included.map((row) => (
                  <li key={row.label} className="flex flex-col bg-background/80 p-6 sm:last:odd:col-span-2">
                    <span className="text-[44px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{row.n}</span>
                    <span className="mt-4 text-[15px] font-semibold">{row.label}</span>
                    <span className="mt-1.5 text-[12.5px] leading-snug text-muted">{row.note}</span>
                  </li>
                ))}
              </ul>
              {/* The templates by name, so the count on the right reads as six real apps. */}
              <p className="p-meta mt-10 text-subtle">The app templates</p>
              <ul className="mt-3 grid sm:grid-cols-2 sm:gap-x-8">
                {proCatalog.templateApps.map((t) => (
                  <li key={t.app} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-3">
                    <span className="text-[14px] font-semibold">{t.app}</span>
                    <span className="text-[12.5px] text-muted">{t.kind}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-xs text-[12.5px] leading-relaxed text-subtle">Each one a complete Xcode project, built on the same design system as every screen.</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
