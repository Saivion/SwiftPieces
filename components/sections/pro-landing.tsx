import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/animated-text";
import { ProBadge } from "@/components/ui/pro-badge";
import { pageLede } from "@/components/ui/section-header";
import { RowLink, SectionHead, Tags, Glyph, band, cardTitle, heroTitle, sectionTitle, sectionBody } from "@/components/sections/feature-row";
import { CountUp } from "@/components/ui/stat";
import { DitherStage } from "@/components/visual/dither-stage";
import { Reveal, RevealGroup, RevealItem } from "@/components/effects/reveal";
import { cn } from "@/lib/cn";
import { pro } from "@/lib/site";
import { buildKitLine, namesWithMore, proCatalog, proCountsLabel, remixingLine, remixingPoint } from "@/lib/pro-catalog";
import { getRegistryIndex } from "@/lib/registry";

// Marketing copy only. Counts and names come from lib/pro-catalog.ts, the one hand-maintained copy of Pro's catalog.
const buy = pro.buy;
const { screens, templates, buildKit } = proCatalog;
/** The free count, read from the registry so it never drifts when pieces are added or removed. */
const freeCount = getRegistryIndex().length;
// No prices on Free: pricing lives on Pro, so the secondary CTAs say "View pricing" and go there.
// The hero is the exception: its secondary CTA sends people into the Pro library instead.
const pricing = pro.pricing;

type Kind = "screen" | "flow" | "template";
const catalog: { name: string; kind: Kind; cat: string }[] = [
  { name: "Wallet", kind: "screen", cat: "Finance" },
  { name: "Onboarding", kind: "screen", cat: "Onboarding" },
  { name: "Subscription App", kind: "template", cat: "Commerce" },
  { name: "Chat", kind: "screen", cat: "AI" },
  { name: "Now Playing", kind: "screen", cat: "Media" },
  { name: "Meditation App", kind: "template", cat: "Health" },
  { name: "Paywall", kind: "screen", cat: "Commerce" },
  { name: "Book A Stay", kind: "flow", cat: "Travel" },
  { name: "Dashboard", kind: "screen", cat: "Productivity" },
  { name: "Finance App", kind: "template", cat: "Finance" },
  { name: "Voice Mode", kind: "screen", cat: "AI" },
  { name: "Cook Tonight's Dinner", kind: "flow", cat: "Meal planner" },
  { name: "Breathe", kind: "screen", cat: "Health" },
  { name: "First Run", kind: "flow", cat: "Weather" },
  { name: "AI Assistant", kind: "template", cat: "AI" },
  { name: "Discover", kind: "screen", cat: "Travel" },
  { name: "Travel App", kind: "template", cat: "Travel" },
];

const kindLabel: Record<Kind, string> = { screen: "Screen", flow: "Flow", template: "Template" };

/* ---------- Hero ---------- */

/** The quiet second action beside a primary pill: words and an arrow that nudges, as on the landing. */
const quietLink = "group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground";

/** A fact as a 36px chip on the tray colour, the landing ticker's shape standing still. */
const chip = "inline-flex h-9 items-center rounded-full bg-surface px-[15px] text-[13.5px] whitespace-nowrap text-muted";

export function ProHero() {
  const facts = [`${screens} screens`, `${proCatalog.flows.total} flows`, `${templates} app templates`, `${buildKit.total}-item Build Kit`, "Pro remixing", "Swift source, no runtime"];
  return (
    <section className="relative pt-16 pb-14 md:pt-28 md:pb-16 lg:pt-[120px]">
      <Container className="flex flex-col items-center text-center">
        <Reveal priority>
          <Eyebrow>
            SwiftPieces Pro
            <span aria-hidden className="h-3 w-px bg-[var(--line-strong)]" />
            <span className="text-muted">Production-ready SwiftUI</span>
          </Eyebrow>
        </Reveal>
        <AnimatedText as="h1" text="Every flow a featured app needs." accent="featured" className={cn("mt-[30px] max-w-[880px]", heroTitle)} />
        <Reveal priority delay={0.35}>
          <p className={cn("mx-auto mt-[26px] max-w-[580px]", pageLede)}>Free is a taste. Pro is the complete library: production-ready screens, whole flows, full app templates, the Build Kit for your coding agent and Pro remixing in the Playground. Copy the source. Make it yours.</p>
        </Reveal>
        <Reveal priority delay={0.45} className="mt-[38px] flex flex-wrap items-center justify-center gap-2.5">
          <Button href={buy}>Start building <Arrow /></Button>
          <a href={pro.library} className={quietLink}>Browse the library <Arrow /></a>
        </Reveal>
        <Reveal priority delay={0.55}>
          <ul className="mt-12 flex flex-wrap items-center justify-center gap-2">
            {facts.map((f) => <li key={f} className={chip}>{f}</li>)}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Gallery ---------- */

/** Abstract phone mock so the gallery reads as a product wall without shipping Pro previews in Free. Greys only, so it never competes with the grounds it sits on. */
function Mock({ kind, i }: { kind: Kind; i: number }) {
  const bar = "rounded-full bg-foreground/[.10]";
  const rows = kind === "screen" ? 5 : 6;
  return (
    <div className="relative mx-auto h-[150px] w-[76px] rounded-[14px] border border-[var(--line-strong)] bg-background p-2">
      <div className="mx-auto mb-2 h-1 w-6 rounded-full bg-foreground/[.12]" />
      {kind === "screen" ? <div className="mb-2 h-9 rounded-[8px] bg-foreground/[.16]" /> : null}
      <div className="space-y-1.5">
        {Array.from({ length: rows }, (_, r) => <div key={r} className={cn(bar, "h-1.5")} style={{ width: `${[92, 64, 78, 50, 84, 40][(r + i) % 6]}%` }} />)}
      </div>
      {kind === "template" ? <div className="absolute inset-x-2 bottom-2 flex h-5 items-center justify-around rounded-full bg-foreground/[.10]">{[0, 1, 2, 3].map((d) => <span key={d} className={cn("size-1.5 rounded-full", d === 1 ? "bg-foreground/60" : "bg-foreground/25")} />)}</div> : null}
    </div>
  );
}

/** A flow as the gallery draws it: three phones of a journey in a row, each with its step number. */
function FlowMock({ i }: { i: number }) {
  return (
    <div className="flex items-start justify-center gap-2">
      {[1, Math.max(2, 4 + (i % 3)), 9 + (i % 4)].map((n, k) => (
        <div key={k} className="flex flex-col items-center gap-1.5" style={{ transform: `translateY(${k * -6}px)` }}>
          <div className="origin-top scale-[0.82]"><Mock kind={k === 1 ? "screen" : "flow"} i={i + k} /></div>
          <span className="-mt-6 rounded-full bg-foreground/[.12] px-1.5 text-[9.5px] font-semibold tabular-nums text-muted">{String(n).padStart(2, "0")}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * One gallery card, Graphite's library card: the mock rising out of the bottom of a panel inset in a
 * tray, its name and kind under it. "Open in Pro" shows on the panel on hover.
 */
function Tile({ item, i }: { item: (typeof catalog)[number]; i: number }) {
  return (
    <a href={buy} className="group flex w-[264px] shrink-0 flex-col rounded-[26px] bg-surface p-1.5 transition-colors duration-200 hover:bg-surface-3">
      <div className="relative h-[180px] overflow-hidden rounded-[20px] bg-surface-2">
        <div className="absolute inset-x-0 top-[38px] transition-transform duration-500 ease-out group-hover:-translate-y-1">{item.kind === "flow" ? <FlowMock i={i} /> : <Mock kind={item.kind} i={i} />}</div>
        <span className="absolute right-3 bottom-3 inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-surface-3 px-2.5 text-[11.5px] font-medium whitespace-nowrap text-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">Open in Pro <Arrow className="size-3" /></span>
      </div>
      <div className="px-2.5 pt-3 pb-1.5">
        <p className="truncate text-[14px] font-medium">{item.name}</p>
        <p className="mt-0.5 text-[12.5px] text-subtle">{kindLabel[item.kind]} · {item.cat}</p>
      </div>
    </a>
  );
}

export function ProGallery() {
  const a = catalog.slice(0, 9);
  const b = catalog.slice(9);
  const tabs: { label: string; n: string }[] = [
    { label: "Screens", n: String(screens) }, { label: "Flows", n: String(proCatalog.flows.total) }, { label: "Templates", n: String(templates) },
  ];
  return (
    <section className="relative pb-12 sm:pb-[68px]">
      <div className="marquee-pause space-y-3 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee flex w-max gap-3" style={{ ["--marquee-duration" as string]: "70s" }}>
          {[...a, ...a].map((item, i) => <Tile key={`${item.name}-${i}`} item={item} i={i} />)}
        </div>
        <div className="marquee marquee-reverse flex w-max gap-3" style={{ ["--marquee-duration" as string]: "80s" }}>
          {[...b, ...b].map((item, i) => <Tile key={`${item.name}-${i}`} item={item} i={i + 9} />)}
        </div>
      </div>
      <Container>
        <Reveal className="mt-8 flex flex-wrap justify-center gap-2">
          {tabs.map((t) => (
            <a key={t.label} href={buy} className={cn(chip, "gap-2.5 transition-colors duration-200 hover:bg-surface-3 hover:text-foreground")}>
              <span className="font-medium text-foreground">{t.label}</span><span className="tabular-nums">{t.n}</span>
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
    { value: screens, label: "Screens", detail: `${namesWithMore(proCatalog.screenExamples)}. Production-ready, not mockups.` },
    { value: proCatalog.flows.total, label: "Flows", detail: `Whole journeys through every template: ${proCatalog.flows.onboarding} first runs through sign in and the paywall, ${proCatalog.flows.core} core journeys and ${proCatalog.flows.account} profile and settings flows.` },
    { value: templates, label: "App templates", detail: `Complete Xcode projects: ${namesWithMore(proCatalog.templateNames, 5)} apps, each a running app you download, rename and ship.` },
    { value: proCatalog.buildKit.total, label: "Build Kit items", detail: `${buildKitLine}.` },
    { value: proCatalog.remixing.apps, label: "Apps to remix", detail: `${remixingLine}.` },
  ];
  return (
    <section className={band}>
      <Container>
        <SectionHead
          tags={[{ label: "Screens", icon: <Glyph.phone /> }, { label: "Flows", icon: <Glyph.flow /> }, { label: "App templates", icon: <Glyph.grid /> }, { label: "Build Kit", icon: <Glyph.wand /> }, { label: "Remixing", icon: <Glyph.split /> }]}
          title="Finished screens, whole flows and apps, and an agent that builds the rest to match"
        />
        <RevealGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" stagger={0.08}>
          {items.map((s) => (
            <RevealItem key={s.label}>
              <a href={buy} className="group flex h-full flex-col rounded-[26px] bg-surface p-1.5 transition-colors duration-200 hover:bg-surface-3">
                {/* The same dithered Pro ground as Pro's library cards, seeded per card, on the inset panel.
                    The count is ink on it in both themes (the ground is always light), so it is a fixed colour. */}
                <div className="relative isolate flex h-[168px] flex-col justify-end overflow-hidden rounded-[20px] p-5 text-[#141414]">
                  <DitherStage seed={`pro-page-${s.label}`} className="-z-10 transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                  <CountUp value={s.value} className="text-[56px] leading-[0.9] font-normal tracking-[-0.045em] tabular-nums" />
                </div>
                <div className="px-3.5 pt-5 pb-4">
                  <p className="text-[16px] font-medium tracking-[-0.01em]">{s.label}</p>
                  <p className="mt-2 text-[14px] leading-[23px] text-pretty text-muted">{s.detail}</p>
                </div>
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
  return <svg aria-hidden viewBox="0 0 16 16" className={cn("ai mt-[3px] size-3.5 shrink-0", strong ? "text-foreground" : "text-subtle")} fill="none" stroke="currentColor" strokeWidth="1.75"><path className="ai-check" pathLength={1} d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/**
 * Quiet comparison card: tag, statement title, short body, points, one action. Both sit in one tray:
 * Free on the tray itself, Pro lifted onto a panel with the Pro badge, so the step up reads at a
 * glance. On wide screens both cards share one set of rows (CSS subgrid), so tag, title, body, points
 * and action line up across the pair whatever each holds; the header row is a fixed height so the
 * badge cannot push its card down.
 */
function PlanCard({ tag, title, body, points, cta, pro: isPro }: { tag: string; title: string; body: string; points: string[]; cta: string; pro?: boolean }) {
  return (
    <div className={cn("relative flex flex-col rounded-[23px] p-7 md:p-9 lg:row-span-5 lg:grid lg:grid-rows-subgrid lg:gap-y-0", isPro && "bg-surface-2")}>
      <div className="flex h-[26px] items-center justify-between">
        <span className={cn("text-[13px] font-medium", isPro ? "text-foreground" : "text-subtle")}>{tag}</span>
        {isPro ? <ProBadge /> : null}
      </div>
      <h3 className={cn("mt-6", cardTitle)}>{title}</h3>
      <p className="mt-3 max-w-md text-[15px] leading-[25px] text-pretty text-muted">{body}</p>
      <ul className="mt-7 flex flex-col gap-3 border-t border-[var(--line)] pt-6">
        {points.map((pt) => <li key={pt} className={cn("flex gap-2.5 text-[14px] leading-snug", isPro ? "text-foreground" : "text-muted")}><Check strong={isPro} />{pt}</li>)}
      </ul>
      <a href={buy} className={cn("group mt-auto inline-flex items-center gap-2 justify-self-start pt-8 text-[14.5px] font-semibold", isPro ? "text-foreground" : "text-muted transition-colors hover:text-foreground")}>{cta}<Arrow /></a>
    </div>
  );
}

export function Compare() {
  return (
    <section className={band}>
      <Container>
        <SectionHead
          tags={[{ label: "Free", icon: <Glyph.gift /> }, { label: "Pro", icon: <Glyph.split /> }]}
          title="A curated taste, then the complete library"
          body="Free gives you standout pieces for a single moment, and blocks that lay them out as a section. Pro gives you the screens, its own themed blocks, the flows through them and the complete apps around them. Both are plain SwiftUI source in your project, so mixing them is the normal case."
        />
        <Reveal className="tray grid gap-2 lg:grid-cols-2 lg:gap-y-0">
          <PlanCard tag="Free library" title="A curated taste of SwiftPieces." body={`${freeCount} animated pieces, Liquid Glass effects and Metal shaders, and blocks built from them. Genuinely good, and free to ship wherever a screen feels flat.`} points={["MIT + Commons Clause, forever", "Single-file pieces, and blocks built from them", "Install by CLI, MCP or copy-paste"]} cta="See what Pro adds" />
          <PlanCard tag="SwiftPieces Pro" title="Every flow a featured app needs." body="Complete SwiftUI app flows, templates and screens, and a Build Kit that teaches your coding agent the same design. Install by copy, CLI or MCP." points={[proCountsLabel, remixingPoint, "Full SwiftUI source that lives in your project", "Lifetime access, everything added later included"]} cta="Get SwiftPieces Pro" pro />
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Preview the quality ---------- */

export function TryFirst() {
  const cards = [
    { eyebrow: "Pro screen", cat: "Finance", title: "Wallet", body: "Stacked cards and passes you tap forward, fan out and reorder, with springs and haptics already tuned.", kind: "screen" as Kind, more: "More screens", href: pro.screens, seed: "try-wallet" },
    { eyebrow: "Pro flow", cat: "Travel", title: "Book A Stay", body: "Wayfare's whole booking journey, eleven steps from a trip's recommendation through the booking card and checkout to a swipe to pay.", kind: "flow" as Kind, more: "More flows", href: `${pro.flows}/wayfare-book-a-stay`, seed: "try-book-a-stay" },
    { eyebrow: "Pro template", cat: "AI", title: "AI Assistant", body: "Nimbus, a complete Xcode project with streaming chat, a conversation library, voice mode and widgets. Download it and it runs.", kind: "template" as Kind, more: "More templates", href: pro.templates, seed: "try-assistant" },
  ];
  return (
    <section className={band}>
      <Container>
        <SectionHead
          tags={[{ label: "Look before you buy", icon: <Glyph.eye /> }]}
          title="Every Pro piece has a public page. Look, then decide"
        />
        <RevealGroup className="grid gap-3 lg:grid-cols-3" stagger={0.1}>
          {cards.map((c, i) => (
            <RevealItem key={c.title} className="h-full">
              {/* Graphite's library card: the same dithered ground as Pro's library cards on a panel inset in
                  a tray, the device rising out of its bottom edge, the words under it. */}
              <div className="group flex h-full flex-col rounded-[26px] bg-surface p-1.5">
                <a href={c.href} className="relative isolate block h-[260px] overflow-hidden rounded-[20px]" aria-label={`${c.title} in SwiftPieces Pro`}>
                  <DitherStage seed={c.seed} className="-z-10 transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                  {c.kind === "flow" ? (
                    <div className="absolute inset-x-0 top-10 origin-top scale-[1.35] transition-transform duration-500 ease-out group-hover:-translate-y-1">
                      <FlowMock i={i + 2} />
                    </div>
                  ) : c.kind === "template" ? (
                    // A template is a whole app, so it shows three of its screens, stacked the way Pro's
                    // template preview stacks them: the centre phone forward at full size, the two either
                    // side tucked behind it at 86%, lower, overlapping its edges.
                    <div className="absolute inset-x-0 top-10 origin-top scale-[1.7] transition-transform duration-500 ease-out group-hover:-translate-y-1">
                      <div className="relative mx-auto h-[150px] w-[76px]">
                        {[
                          { x: -60, y: 10, s: 0.86, z: 1, kind: "screen" as Kind, i: 1 },
                          { x: 60, y: 11, s: 0.86, z: 2, kind: "screen" as Kind, i: 4 },
                          { x: 0, y: -3, s: 1, z: 3, kind: "template" as Kind, i: i + 3 },
                        ].map((p) => (
                          <div
                            key={p.x}
                            className={cn("absolute inset-0 rounded-[14px]", p.z === 3 ? "shadow-[0_12px_28px_-8px_rgb(0_0_0/0.7)]" : "opacity-90")}
                            style={{ transform: `translate(${p.x}px, ${p.y}px) scale(${p.s})`, zIndex: p.z }}
                          >
                            <Mock kind={p.kind} i={p.i} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-x-0 top-10 origin-top scale-[1.9] transition-transform duration-500 ease-out group-hover:-translate-y-1">
                      <Mock kind={c.kind} i={i + 3} />
                    </div>
                  )}
                  {/* Fixed black and white: it sits on the always-light dither, in both themes. */}
                  <span className="absolute top-3.5 left-3.5 inline-flex h-6 items-center rounded-full bg-[#000]/55 px-2.5 text-[11.5px] font-semibold text-[#fff] backdrop-blur-sm">{c.eyebrow}</span>
                </a>
                <div className="flex flex-1 flex-col px-4 pt-5 pb-4 sm:px-5">
                  <p className="text-[12.5px] text-subtle">{c.cat}</p>
                  <h3 className={cn("mt-1.5", cardTitle)}>{c.title}</h3>
                  <p className="mt-2.5 max-w-md text-[15px] leading-[25px] text-pretty text-muted">{c.body}</p>
                  {/* Pinned to the bottom so the cards' actions line up whatever the copy length. */}
                  <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-7">
                    <Button href={c.href} variant="secondary" size="sm">View in Pro <Arrow /></Button>
                    <RowLink href={c.href}>{c.more}</RowLink>
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
  { q: "Is there a subscription or are there tiers?", a: "Neither. SwiftPieces Pro is one plan with lifetime access to everything, including every piece added later. Files already in your projects are yours regardless. The plan and pricing are on pro.swiftpieces.com." },
  { q: "Does it work with my coding agent?", a: "Yes. Connect Claude Code, Cursor or Xcode to the Pro MCP server with your license key, and your agent searches the library and installs the real screen instead of inventing a lookalike." },
  { q: "What are the requirements?", a: "An iOS 17 deployment target as the floor, with Xcode 16 for pieces and screens and Xcode 26 to open the app templates. Liquid Glass pieces use the real material on iOS 26 and fall back gracefully below it. Apple frameworks only, nothing third-party." },
];

/* ---------- Closing summary ---------- */

/**
 * The close is a summary, not a slogan: the promise and the action on a panel (no price: that lives on
 * Pro), what the purchase contains as six panels beside it, all in one tray, the shape of the offer on
 * pro.swiftpieces.com.
 */
/** The offer card. Used to close the Pro page and, with `id="pro"`, as the landing page's Pro block. */
export function ProCTA({ className }: { className?: string }) {
  // The same six parts, in the same order, as the offer card on pro.swiftpieces.com.
  const included = [
    { n: screens, label: "Screens", note: namesWithMore(proCatalog.screenExamples, 3), href: pro.screens },
    { n: proCatalog.flows.total, label: "Flows", note: `${proCatalog.flows.onboarding} onboarding, ${proCatalog.flows.core} core journeys and ${proCatalog.flows.account} settings`, href: `${pro.library}/flows` },
    { n: templates, label: "App Templates", note: "Complete Xcode projects you download and ship", href: pro.templates },
    { n: proCatalog.buildKit.total, label: "Build Kit Items", note: `${buildKit.styles} styles, ${buildKit.briefs} briefs, ${buildKit.recipes} recipes and ${buildKit.tools} tools`, href: pro.kit },
    { n: proCatalog.presets.total, label: "Brand Presets", note: `${proCatalog.presets.families} design families, each a one-tap restyle`, href: pro.templates },
    { n: proCatalog.remixing.saves, label: "Remix Saves", note: `All ${proCatalog.remixing.apps} Playground apps, remixed with AI`, href: "/apps" },
  ];
  const promises = ["Unlimited apps, commercial use included", "Everything added later included", "No subscription, nothing expires"];
  return (
    <section id="pro" className={cn("relative pt-12 pb-24 sm:pt-[68px] sm:pb-[136px]", className)}>
      <Container>
        <Reveal className="tray grid gap-2 lg:grid-cols-[5fr_7fr]">
          <div className="panel flex flex-col p-7 md:p-10">
            <Tags tags={[{ label: "One purchase", icon: <Glyph.tag /> }]} className="mb-5" />
            <h2 className={cn("max-w-md", sectionTitle)}>One Payment. Lifetime Access.</h2>
            <p className={cn("mt-4 max-w-md", sectionBody)}>The complete library, {proCountsLabel}, delivered as Swift you keep, with Pro remixing in the Playground.</p>
            <ul className="mt-8 flex flex-col gap-3 border-t border-[var(--line)] pt-6">
              {promises.map((p) => <li key={p} className="flex gap-2.5 text-[14px] leading-snug text-foreground"><Check strong />{p}</li>)}
            </ul>
            {/* Pinned to the bottom of the panel, level with the end of the included panels beside it. */}
            <div className="mt-10 flex flex-wrap items-center gap-2.5 lg:mt-auto lg:pt-10">
              <Button href={pricing}>View pricing <Arrow /></Button>
              <a href={pro.library} className={quietLink}>Browse the library <Arrow /></a>
            </div>
          </div>
          {/* Everything it includes, as six panels in the same tray: label, count, one line. */}
          <div className="flex flex-col">
            <div className="flex items-baseline justify-between gap-4 px-4 pt-4 pb-4 sm:px-5 lg:pt-5">
              <p className="text-[13px] font-medium text-foreground">Everything included</p>
              <p className="hidden text-[13px] text-subtle sm:block">One price for all of it</p>
            </div>
            <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
              {included.map((row) => (
                <li key={row.label}>
                  <a href={row.href} className="group flex h-full min-h-[184px] flex-col rounded-[23px] bg-surface-2 p-5 transition-colors duration-200 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/40 sm:min-h-[208px] sm:p-6">
                    <span className="flex items-center gap-2 text-[13px] font-medium whitespace-nowrap text-muted transition-colors group-hover:text-foreground">
                      {row.label}
                      <svg aria-hidden viewBox="0 0 16 16" className="ml-auto size-3.5 text-subtle opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 11l6-6M6 5h5v5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="mt-auto pt-8 text-[40px] leading-none font-normal tracking-[-0.045em] tabular-nums sm:text-[52px]">{row.n}</span>
                    {/* Held to its clamp's height, so the counts line up across a row whatever each note's length. */}
                    <span className="mt-2.5 line-clamp-3 min-h-[57px] text-[13px] leading-[19px] text-pretty text-subtle sm:line-clamp-2 sm:min-h-[38px]">{row.note}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
