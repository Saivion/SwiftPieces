import type { CSSProperties } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { Button, Arrow } from "@/components/ui/button";
import { ProBadge } from "@/components/ui/pro-badge";
import { NewBadge } from "@/components/ui/new-badge";
import { MoreLink } from "@/components/landing/link";
import { Still, Tile } from "@/components/landing/wall";
import { allStills, stills } from "@/components/landing/stills";
import { body, gap, ground, heading, small } from "@/components/landing/type";
import { categories } from "@/lib/categories";
import { changelog, changelogPath } from "@/lib/changelog";
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

/** A game's simulator still, cut to a phone's shape. */
function GameShot({ id, alt = "", className, style }: { id: string; alt?: string; className?: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element -- static simulator stills, already 720px webp
  return <img src={`/pro-games/${id}.webp`} alt={alt} loading="lazy" decoding="async" style={style} className={className} />;
}

/* ---------- Facts ---------- */

/** Every category as a chip with one of its pieces and its count, drifting by under the hero. */
export function Facts() {
  const all = allStills();
  const chips = Object.values(categories)
    .map((c) => ({ slug: c.slug, title: c.title, items: all.filter((s) => s.category === c.title) }))
    .filter((c) => c.items.length > 0);
  return (
    <section aria-label="Categories" className="pt-6 sm:pt-8">
      <div className="marquee-pause overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee flex w-max" style={{ "--marquee-duration": "70s" } as CSSProperties}>
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 gap-2 pr-2">
              {chips.map((c) => (
                <li key={c.slug}>
                  <Link href={`/components/${c.slug}`} tabIndex={copy === 1 ? -1 : undefined} className="inline-flex h-11 items-center gap-2.5 rounded-[14px] bg-surface-2 pr-4 pl-1.5 text-[13px] ring-1 ring-[var(--line)] transition-colors hover:bg-surface">
                    <span className="h-8 w-[42px] overflow-hidden rounded-[9px]"><Still s={c.items[0]} alt={false} className="size-full scale-[1.35] object-cover" /></span>
                    <span className="text-foreground">{c.title}</span>
                    <span className="text-subtle tabular-nums">{c.items.length}</span>
                  </Link>
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
const TEMPLATES = ["shop-app", "journal-app", "reading-app", "finance-app", "meditation-app"];
const fan = (n: number, i: number): CSSProperties => ({ transform: `translateY(${Math.abs(i - (n - 1) / 2) * 22}px) rotate(${(i - (n - 1) / 2) * 6}deg)` });

/** The step past the free pieces: Games and Pro side by side, each with a fan of its own work. */
export function More() {
  const games = proGames.list.filter((g) => g.isNew).slice(0, 5);
  return (
    <Container className={gap}>
      <section aria-labelledby="more" className="grid gap-4 lg:grid-cols-2">
        <h2 id="more" className="sr-only">More from SwiftPieces: Games and Pro</h2>

        <Reveal className={cn(ground, "flex flex-col overflow-hidden")}>
          <div className="p-6 sm:p-8">
            <p className="flex items-center gap-2 text-[13px] text-muted"><ProBadge tone="games" label="Games" size="sm" /> SwiftPieces Games <NewBadge /></p>
            <h3 className={cn(heading, "mt-4")}>Building a game? <span className="text-muted">Start from a finished one, in SwiftUI and Metal.</span></h3>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              <a href={pro.games} className={quiet}>See all {proGames.list.length} games <Arrow className="size-3.5" /></a>
              <a href={pro.pricing} className={cn(quiet, "text-muted hover:text-foreground")}>View pricing</a>
            </div>
          </div>
          <div className="mt-auto flex h-[260px] justify-center pt-4 sm:h-[300px]">
            {games.map((g, i) => (
              <a key={g.id} href={`${pro.games}/${g.id}`} className={cn("-mx-3 shrink-0 transition-transform duration-300 hover:-translate-y-1", (i === 0 || i === 4) && "max-sm:hidden")} style={fan(games.length, i)}>
                <GameShot id={g.id} alt={`${g.title} being played, from SwiftPieces Games`} className="h-[280px] w-auto rounded-[24px] border-[4px] border-[#0b0b0b] shadow-[0_24px_40px_-24px_rgb(0_0_0/0.5)] sm:h-[330px]" />
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal className={cn(ground, "flex flex-col overflow-hidden")}>
          <div className="p-6 sm:p-8">
            <p className="flex items-center gap-2 text-[13px] text-muted"><ProBadge size="sm" /> SwiftPieces Pro</p>
            <h3 className={cn(heading, "mt-4")}>Building an app? <span className="text-muted">{proCatalog.screens} screens, {proCatalog.flows.total} flows and {proCatalog.templates} app templates on one design system.</span></h3>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              <a href={pro.library} className={quiet}>Explore Pro <Arrow className="size-3.5" /></a>
              <a href={pro.pricing} className={cn(quiet, "text-muted hover:text-foreground")}>View pricing</a>
            </div>
          </div>
          <div className="mt-auto flex h-[260px] justify-center pt-6 sm:h-[300px]">
            {TEMPLATES.map((t, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- static stills of Pro's library cards
              <img key={t} src={`/pro-cards/${t}.webp`} alt="" loading="lazy" decoding="async" className={cn("-mx-3 size-[150px] shrink-0 rounded-[22px] shadow-[0_24px_40px_-24px_rgb(0_0_0/0.45)] sm:size-[180px]", (i === 0 || i === 4) && "max-sm:hidden")} style={fan(TEMPLATES.length, i)} />
            ))}
          </div>
        </Reveal>
      </section>
    </Container>
  );
}

/* ---------- Changelog ---------- */

/** What each recent release shipped, as its cover picture. Keyed by changelog slug; others fall back to a piece. */
const COVERS: Record<string, { games?: string[]; piece?: string }> = {
  "games-pieces-and-styles": { games: ["cairn", "pane", "thrum"] },
  games: { games: ["drift", "lumen", "twine"] },
  "new-look": { piece: "MotionCard" },
  "pickers-and-controls": { piece: "LiquidSwitch" },
};
const FALLBACK = ["SwipeDeck", "ScrubChart", "TimerDial", "ReactionToggle"];

/** The last four releases as cards, each topped with a picture of what it shipped. */
export function Changelog() {
  const recent = changelog.slice(0, 4);
  return (
    <Container className={gap}>
      <section aria-labelledby="changelog">
        <Head id="changelog" title="Changelog." rest="New pieces most weeks." link={{ label: "See what's new", href: changelogPath() }} />
        <Reveal className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ul className="contents">
          {recent.map((e, n) => {
            const cover = COVERS[e.slug] ?? { piece: FALLBACK[n] };
            const piece = cover.piece ? stills([cover.piece])[0] : null;
            return (
              <li key={e.slug}>
                <Link href={changelogPath(e.slug)} className={cn(ground, "group flex h-full flex-col overflow-hidden p-1.5")}>
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-[18px] bg-surface-2">
                    {cover.games ? (
                      <span className="absolute inset-0 flex items-start justify-center gap-2 pt-5">
                        {cover.games.map((g, i) => (
                          <GameShot key={g} id={g} className="aspect-[9/19.5] w-[29%] rounded-[14px] object-cover object-top shadow-[0_18px_40px_-20px_rgb(0_0_0/0.45)] ring-1 ring-[var(--line)] transition-transform duration-500 group-hover:-translate-y-1" style={{ transform: `translateY(${i === 1 ? 0 : 18}px) rotate(${(i - 1) * 6}deg)` }} />
                        ))}
                      </span>
                    ) : piece ? <Still s={piece} alt={false} className="size-full object-cover" /> : null}
                  </span>
                  <span className="flex flex-1 flex-col justify-between gap-4 p-4">
                    <span className="text-[14px] leading-[21px] text-foreground">{e.title}</span>
                    <span className={small}>{e.date}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul></Reveal>
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
              <li key={i} className={cn("w-[64px] shrink-0 sm:w-[96px]", Math.abs(d) > 2 && "max-sm:hidden", Math.abs(d) > 3 && "max-lg:hidden")} style={{ transform: `translateY(${d * d * 6}px) rotate(${d * 4}deg) scale(${d === 0 ? 1.25 : 1})` }}>
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
