import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Button, Arrow } from "@/components/ui/button";
import { ProBadge } from "@/components/ui/pro-badge";
import { NewBadge } from "@/components/ui/new-badge";
import { MoreLink } from "@/components/landing/link";
import { GrainStage } from "@/components/visual/grain-stage";
import type { GrainKind } from "@/lib/grain";
import { Tile } from "@/components/landing/wall";
import { Loop, Phone, Scaled } from "@/components/landing/live";
import { Cycle } from "@/components/landing/cycle";
import { allStills, stills } from "@/components/landing/stills";
import { body, gap, ground, heading, small } from "@/components/landing/type";
import { categories } from "@/lib/categories";
import { proCatalog, proGames } from "@/lib/pro-catalog";
import { pro } from "@/lib/site";
import { cn } from "@/lib/cn";

/** A section's head: the heading (lead dark, rest muted) and its one link on the right. */
function Head({ title, rest, link, id }: { title: string; rest?: string; link?: { label: string; href: string }; id?: string }) {
  return (
    <Reveal className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
      <h2 id={id} className={cn(heading, "max-w-[560px]")}>
        {title} {rest ? <span className="text-muted">{rest}</span> : null}
      </h2>
      {link ? <MoreLink href={link.href} className="shrink-0 sm:pb-1">{link.label}</MoreLink> : null}
    </Reveal>
  );
}

/* ---------- Facts ---------- */

/** The piece that best shows each category in a small pill: vivid and moving at that size. */
const LEAD: Record<string, string> = {
  text: "GlassText", backgrounds: "Silk", glass: "GlassSegments", controls: "ElasticButton", inputs: "SecureEntry",
  cards: "SwipeDeck", lists: "TaskRow", navigation: "FloatingDock", sheets: "PermissionSheet",
  feedback: "ReactionToggle", motion: "DragToDismiss", data: "ScrubChart", ai: "AssistantOrb", media: "StoryStrip",
};

/**
 * Every category as one line of type drifting by under the hero: the name large, its count small
 * beside it, and its lead piece playing live in a pill between names.
 */
export function Facts() {
  const all = allStills();
  const chips = Object.values(categories)
    .map((c) => {
      const items = all.filter((s) => s.category === c.title);
      return { slug: c.slug, title: c.title, count: items.length, lead: items.find((s) => s.name === LEAD[c.slug]) ?? items[0] };
    })
    .filter((c) => c.count > 0);
  return (
    <section aria-label="Categories" className="pt-6 sm:pt-8">
      <div className="marquee-pause overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee flex w-max" style={{ "--marquee-duration": "120s" } as CSSProperties}>
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 items-center gap-5 pr-5">
              {chips.map((c) => (
                <li key={c.slug} className="flex items-center gap-5">
                  <Link href={`/components/${c.slug}`} tabIndex={copy === 1 ? -1 : undefined} className="text-[32px] leading-none tracking-[-0.03em] text-foreground transition-colors hover:text-muted sm:text-[44px]">
                    {c.title}<sup className="ml-0.5 align-top text-[12px] tracking-normal text-subtle tabular-nums sm:text-[14px]">{c.count}</sup>
                  </Link>
                  <Scaled s={c.lead} w={110} h={60} zoom={1.5} className="rounded-[25px] ring-1 ring-[var(--line)]" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Library ---------- */

/** Every piece drifting past in two rows going opposite ways, captioned small. */
export function Library() {
  const all = allStills();
  const rows = [all.filter((_, i) => i % 2 === 0).slice(0, 18), all.filter((_, i) => i % 2 === 1).slice(0, 18)];
  return (
    <section aria-labelledby="library" className={gap}>
      <Container>
        <Head id="library" title="The library." rest="Every piece runs live on the site with its source one tap away." link={{ label: `Browse all ${all.length}`, href: "/components" }} />
      </Container>
      <Reveal className="marquee-pause flex flex-col gap-4 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        {rows.map((row, r) => (
          <div key={r} className={cn("marquee flex w-max", r === 1 && "marquee-reverse")} style={{ "--marquee-duration": "140s" } as CSSProperties}>
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 gap-3 pr-3">
                {row.map((s) => (
                  <li key={s.name} className="w-[200px] shrink-0 sm:w-[240px]">
                    <Tile s={s} alt={copy === 0} tabIndex={copy === 1 ? -1 : undefined} />
                    <p className="mt-2 px-1 text-[12px]"><span className="text-foreground">{s.title}</span> <span className="text-subtle">· {s.category}</span></p>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ))}
      </Reveal>
    </section>
  );
}

/* ---------- Statement ---------- */

/** The one idea the library is built on, set over a faded strip of the hero's wall so the page rhymes with its top. */
export function Statement() {
  const s = stills(["MotionCard", "ScrubChart", "ReactionToggle", "TimerDial", "QRCode", "ActivityHeatmap", "CommitButton", "AmountField", "RatingScrub", "FlipCard"]);
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_center,transparent_25%,black_75%),linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] [mask-composite:intersect]">
        <div className="absolute top-1/2 left-1/2 grid w-[1700px] grid-cols-5 gap-4" style={{ transform: "translate(-50%,-50%) perspective(2400px) rotateX(40deg) rotateZ(-18deg)" }}>
          {[...s, ...s].map((p, i) => <Tile key={i} s={p} alt={false} tabIndex={-1} />)}
        </div>
      </div>
      <Container>
        <Reveal className="relative mx-auto max-w-[680px] text-center">
          <h2 className="text-[26px] leading-[1.2] tracking-[-0.02em] text-balance sm:text-[32px]">You own the code. <span className="text-muted">Nothing to update, nothing to wrap.</span></h2>
          <p className="mx-auto mt-4 max-w-[440px] text-[14px] leading-[22px] text-muted">Every piece is one Swift file in your project, on SwiftUI and Apple frameworks only. Accessible by default, Liquid Glass on iOS 26.</p>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------- Games and Pro ---------- */

const quiet = "group inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground";

function MoreCard({ badge, title, rest, links, kind, motif, seed, children }: { badge: ReactNode; title: string; rest: string; links: { label: string; href: string }[]; kind: GrainKind; motif?: GrainKind; seed: string; children: ReactNode }) {
  return (
    <Reveal className={cn(ground, "flex flex-col overflow-hidden p-1.5")}>
      <div className="p-5 sm:p-7">
        <p className="flex items-center gap-2 text-[13px] text-muted">{badge}</p>
        <h3 className={cn(heading, "mt-4 max-w-[440px]")}>{title} <span className="text-muted">{rest}</span></h3>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l, i) => <a key={l.href} href={l.href} className={cn(quiet, i > 0 && "text-muted hover:text-foreground")}>{l.label} {i === 0 ? <Arrow className="size-3.5" /> : null}</a>)}
        </div>
      </div>
      <div className="relative isolate mt-auto h-[360px] overflow-hidden rounded-[19px] sm:h-[400px]">
        <GrainStage seed={seed} kind={kind} motif={motif} className="-z-10" />
        {children}
      </div>
    </Reveal>
  );
}

type Shown = { id: string; title: string; kind: string; href: string; src: string; poster: string; island: boolean };

/**
 * One screen at a time, playing on a phone, with a numbered index on its left: the line under the one
 * on show fills while it plays, then the next takes over. Hover, focus or tap an entry to jump to it.
 */
function Spotlight({ items, label }: { items: Shown[]; label: string }) {
  return (
    <Cycle
      ms={4800}
      label={label}
      className="spotlight absolute inset-0 grid grid-cols-[auto_1fr]"
      items={items.map((x, k) => <span key={x.id} className="spot-name"><span className="spot-num">{String(k + 1).padStart(2, "0")}</span>{x.title}<span className="spot-line" /></span>)}
      panels={items.map((x) => (
        <a key={x.id} href={x.href} className="spot-panel">
          <Phone island={x.island} className="w-[150px] sm:w-[176px]"><Loop src={x.src} poster={x.poster} label={`${x.title}, ${x.kind}`} /></Phone>
          <span className="spot-cap">{x.title} <span className="opacity-70">· {x.kind}</span></span>
        </a>
      ))}
    />
  );
}

const GAMES_SHOWN = ["cairn", "pane", "thrum", "ripple", "parlour", "drift", "lumen"];
const PRO_SHOWN = [
  { id: "wallet-stack", title: "Wallet", kind: "Finance" },
  { id: "spending-ring", title: "Budget", kind: "Finance" },
  { id: "ai-chat-screen", title: "Chat", kind: "AI" },
  { id: "voice-orb", title: "Voice Mode", kind: "AI" },
  { id: "focus-timer", title: "Focus", kind: "Productivity" },
  { id: "dashboard-screen", title: "Dashboard", kind: "Business" },
  { id: "glass-paywall-screen", title: "Paywall", kind: "Subscription" },
];

/** The step past the free pieces: Games and Pro side by side, each playing its own screens one at a time. */
export function More() {
  const games: Shown[] = GAMES_SHOWN.map((id) => proGames.list.find((g) => g.id === id)).filter((g) => g !== undefined).map((g) => ({
    id: g.id, title: g.title, kind: g.genre, href: `${pro.games}/${g.id}`, src: `/pro-games/play/${g.id}.mp4`, poster: `/pro-games/play/${g.id}.webp`, island: true,
  }));
  const screens: Shown[] = PRO_SHOWN.map((sc) => ({ ...sc, href: `${pro.home}/library/screens/${sc.id}`, src: `/pro-screens/${sc.id}.mp4`, poster: `/pro-screens/${sc.id}.webp`, island: false }));
  return (
    <Container className={gap}>
      <section aria-labelledby="more" className="grid gap-4 lg:grid-cols-2">
        <h2 id="more" className="sr-only">More from SwiftPieces: Games and Pro</h2>
        <MoreCard
          badge={<><ProBadge tone="games" label="Games" size="sm" /> SwiftPieces Games <NewBadge /></>}
          title="Building a game?"
          rest="Start from a finished one, in SwiftUI and Metal."
          links={[{ label: `See all ${proGames.list.length} games`, href: pro.games }, { label: "View pricing", href: pro.pricing }]}
          kind="brand"
          motif="template"
          seed="more-games"
        >
          <Spotlight items={games} label="Games" />
        </MoreCard>
        <MoreCard
          badge={<><ProBadge size="sm" /> SwiftPieces Pro</>}
          title="Building an app?"
          rest={`${proCatalog.screens} screens, ${proCatalog.flows.total} flows and ${proCatalog.templates} app templates on one design system.`}
          links={[{ label: "Explore Pro", href: pro.library }, { label: "View pricing", href: pro.pricing }]}
          kind="brand"
          motif="flow"
          seed="more-pro"
        >
          <Spotlight items={screens} label="Pro screens" />
        </MoreCard>
      </section>
    </Container>
  );
}

/* ---------- App icon ---------- */

const ICONS = ["tiles", "camera", "umbrella", "moon", "scales", "donut", "grapefruit", "ripple", "tiles"];

/** "Need an app icon?": a big arc of TinyPersonas logos with one raised in the middle, the copy under them. */
export function AppIcon() {
  return (
    <Container className={gap}>
      <Reveal className={cn(ground, "overflow-hidden px-6 pt-12 pb-10 text-center sm:px-10 sm:pt-14")}>
        <ul aria-label="Icons from TinyPersonas" className="flex justify-center gap-4 sm:gap-6">
          {ICONS.map((id, i) => {
            const d = i - 4;
            return (
              <li key={i} className={cn("w-[64px] shrink-0 sm:w-[96px]", Math.abs(d) > 2 && "max-sm:hidden", Math.abs(d) > 3 && "max-lg:hidden")} style={{ transform: `translateY(${d * d * 6}px) rotate(${d * 4}deg)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/app-icons/${id}.webp`} alt="" loading="lazy" className="w-full rounded-[22.5%] shadow-[0_1px_2px_rgb(0_0_0/0.08),0_14px_30px_-12px_rgb(0_0_0/0.35)]" />
              </li>
            );
          })}
        </ul>
        <div className="mx-auto mt-14 flex max-w-[460px] flex-col items-center sm:mt-16">
          <h2 className={heading}>Need an app icon? <span className="text-muted">TinyPersonas makes one-off logos for single apps.</span></h2>
          <MoreLink href="https://tinypersonas.com" className="mt-5">Visit TinyPersonas</MoreLink>
        </div>
      </Reveal>
    </Container>
  );
}

/* ---------- Questions ---------- */

/** The questions as plain rows beside a small heading. Native <details>, so it works without JavaScript. */
export function Questions({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <Container className={gap}>
      <section className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <Reveal as="div" className="lg:sticky lg:top-24 lg:self-start">
          <h2 className={heading}>Questions. <span className="text-muted">The rest are in the docs.</span></h2>
          <MoreLink href="/docs/introduction" className="mt-5">Read the docs</MoreLink>
        </Reveal>
        <Reveal as="div" className="border-t border-[var(--line)]">
          {items.map((f) => (
            <details key={f.q} className="qa group border-b border-[var(--line)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-[15px] leading-6 text-foreground [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="relative grid size-5 shrink-0 place-items-center text-muted transition-transform duration-300 group-open:rotate-45">
                  <span className="absolute h-[1.5px] w-2.5 rounded bg-current" />
                  <span className="absolute h-2.5 w-[1.5px] rounded bg-current" />
                </span>
              </summary>
              <p className={cn(body, "max-w-[62ch] pr-6 pb-5 text-[14px] leading-[23px]")}>{f.a}</p>
            </details>
          ))}
        </Reveal>
      </section>
    </Container>
  );
}

/* ---------- Close ---------- */

/** The last word, over the hero's wall again so the page ends the way it starts. */
export function Close() {
  const s = stills(["SwipeDeck", "TimerDial", "ScrubChart", "QRCode", "MotionCard", "CommitButton", "ReactionToggle", "ActivityHeatmap", "RatingScrub", "FlipCard", "AmountField", "LiquidSwitch"]);
  return (
    <section className="relative h-[520px] overflow-hidden sm:h-[620px]">
      <div aria-hidden className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_38%,black_64%,transparent_92%)]">
        <div className="absolute inset-0 origin-top scale-[0.6] sm:scale-[0.85] lg:scale-100">
          <div className="absolute top-[300px] left-1/2 grid w-[1800px] grid-cols-6 gap-4 sm:top-[260px] lg:top-[240px]" style={{ transform: "translateX(-50%) perspective(2400px) rotateX(48deg) rotateZ(-18deg)", transformOrigin: "50% 0" }}>
            {[...s, ...s].map((p, i) => <Tile key={i} s={p} alt={false} tabIndex={-1} />)}
          </div>
        </div>
      </div>
      <Container>
        <Reveal className="relative mx-auto max-w-[620px] pt-10 text-center sm:pt-14">
          <h2 className="text-[30px] leading-[1.12] tracking-[-0.03em] text-balance sm:text-[44px]">Start with a piece.</h2>
          <p className="mx-auto mt-3 max-w-[420px] text-[15px] leading-[24px] text-muted">Spend the week on your idea, not on rebuilding another picker.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <Button href="/components" size="sm">Browse components <Arrow /></Button>
            <a href={pro.home} className="group inline-flex h-[38px] items-center gap-1.5 px-3 text-[13.5px] font-semibold text-foreground">Explore Pro <Arrow /></a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
