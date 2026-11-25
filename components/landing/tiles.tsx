import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { ProBadge } from "@/components/ui/pro-badge";
import { NewBadge } from "@/components/ui/new-badge";
import { MoreLink } from "@/components/landing/link";
import { gap, heading } from "@/components/landing/type";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { EmberStage } from "@/components/visual/ember-stage";
import { getRegistryIndex, getRegistryItem } from "@/lib/registry";
import { piecePath } from "@/lib/registry-paths";
import { categories, categoryTitle } from "@/lib/categories";
import { proCatalog, proGames } from "@/lib/pro-catalog";
import proCards from "@/lib/pro-cards.json";
import { pro } from "@/lib/site";
import { cn } from "@/lib/cn";

/*
 * The landing page as tiles, the same unit as Pro's screens bento: a tray one step off the ground
 * holding a white panel (brand `.tray` / `.panel`), and under the panel a caption with the kind, the
 * name, one sentence, outlined facts and a round arrow. Pieces sit whole in their panels: the stills in
 * public/landing/pieces/ were captured from each piece's live preview in a square frame on the panel's
 * own colour, trimmed to the piece and padded back to 4:3, so nothing is cropped.
 */

/** The meta line over a card title: "Component · Cards". */
const cardMeta = "text-[12.5px] text-subtle";
/** A card's title inside a tray. */
const cardTitle = "text-[22px] leading-[1.15] font-normal tracking-[-0.025em]";
/** A card's sentence under its title. */
const cardBody = "text-[14.5px] leading-[23px] text-pretty text-muted";
/** An outlined fact pill: radius about 42% of its height, as on every small control. */
const factPill = "inline-flex h-[26px] items-center rounded-[11px] border border-[var(--line-strong)] px-2.5 text-[12.5px] text-muted";

/** A piece's whole still, the light one in light mode and the dark one in dark mode. */
function Piece({ slug, alt, className, eager }: { slug: string; alt: string; className?: string; eager?: boolean }) {
  const src = (t: string) => `/landing/pieces/${slug}-${t}.webp`;
  const cls = cn("size-full object-contain", className);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static stills */}
      <img src={src("light")} alt={alt} width={960} height={720} loading={eager ? "eager" : "lazy"} decoding="async" className={cn("hidden [html.light_&]:block", cls)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- static stills */}
      <img src={src("dark")} alt="" aria-hidden width={960} height={720} loading={eager ? "eager" : "lazy"} decoding="async" className={cn("[html.light_&]:hidden", cls)} />
    </>
  );
}

/** The round arrow at the end of a caption: a hairline circle that fills with ink when its tile is hovered. */
function GoButton() {
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[15px] border border-[var(--line-strong)] text-muted transition-colors duration-300 group-hover:border-transparent group-hover:bg-foreground group-hover:text-background">
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 10.5l5-5M6.5 5.5h4v4" /></svg>
    </span>
  );
}

function Caption({ meta, title, text, facts }: { meta: ReactNode; title: string; text: string; facts?: string[] }) {
  return (
    <div className="flex flex-1 items-start justify-between gap-6 px-[18px] pt-5 pb-3.5">
      <div className="min-w-0">
        <p className={cn(cardMeta, "flex items-center gap-2")}>{meta}</p>
        <h3 className={cn("mt-1.5", cardTitle)}>{title}</h3>
        <p className={cn("mt-2 max-w-[420px]", cardBody)}>{text}</p>
        {facts?.length ? (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {facts.map((f) => <li key={f} className={factPill}>{f}</li>)}
          </ul>
        ) : null}
      </div>
      <GoButton />
    </div>
  );
}

/** One tile: the tray, its panel, then the caption. External links open as plain anchors. */
function TileCard({ href, panel, panelClass, children, className }: { href: string; panel: ReactNode; panelClass?: string; children?: ReactNode; className?: string }) {
  const cls = cn("group tray flex h-full flex-col text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background", className);
  const inner = (
    <>
      <div className={cn("panel", panelClass)}>{panel}</div>
      {children}
    </>
  );
  return href.startsWith("http") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}

/** A section's head: a small heading (lead dark, rest muted) and its one link. */
function Head({ id, title, rest, link }: { id?: string; title: string; rest?: string; link?: { label: string; href: string } }) {
  return (
    <Reveal className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
      <h2 id={id} className={cn(heading, "max-w-[640px]")}>
        {title} {rest ? <span className="text-muted">{rest}</span> : null}
      </h2>
      {link ? <MoreLink href={link.href} className="shrink-0 sm:pb-1">{link.label}</MoreLink> : null}
    </Reveal>
  );
}

/* ---------- Hero wall ---------- */

/** The wall's pieces, read across columns: neighbours differ in colour and kind. */
const WALL = [
  "motion-card", "scrub-chart", "swipe-deck", "reaction-toggle", "timer-dial", "qr-code",
  "activity-heatmap", "commit-button", "ring-breakdown", "amount-field", "flip-card", "rating-scrub",
  "status-timeline", "live-stat", "picture-headline", "liquid-switch", "outcome-screen", "elastic-button",
  "wallet-stack", "select-menu", "task-row", "now-playing", "date-strip", "reorder-list",
];

/**
 * The hero's one visual: whole pieces on a wall laid back in perspective inside the hero's panel, six
 * columns drifting in turns up and down (the `.wall-col` loop, off under reduced motion). Each column
 * repeats its pieces so the loop never shows a seam; the copies are hidden from assistive tech.
 */
function Wall() {
  const cols = Array.from({ length: 6 }, (_, c) => WALL.filter((_, i) => i % 6 === c));
  return (
    <div aria-hidden className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
      <div className="absolute inset-0 origin-top scale-[0.55] sm:scale-[0.8] lg:scale-100">
        <div className="absolute top-[-60px] left-1/2 flex origin-top gap-3.5" style={{ transform: "translateX(-50%) perspective(2400px) rotateX(38deg) rotateZ(-18deg)" }}>
          {cols.map((col, c) => (
            <div key={c} className={cn("wall-col flex w-[230px] shrink-0 flex-col gap-3.5", c % 2 === 1 && "wall-rev")} style={{ "--d": `${80 + c * 7}s`, marginTop: c % 2 ? -120 : 0 } as CSSProperties}>
              {[0, 1, 2, 3].flatMap((run) =>
                col.map((slug) => (
                  <div key={`${run}-${slug}`} className="aspect-[4/3] overflow-hidden rounded-[20px] bg-surface-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_18px_40px_-18px_rgb(0_0_0/0.22)] ring-1 ring-[var(--line)]">
                    <Piece slug={slug} alt="" eager />
                  </div>
                )),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The hero's visual alone: one tray, one panel, the wall inside it. */
export function HeroTile() {
  return (
    <Container className="mt-10 sm:mt-12">
      <Reveal priority delay={0.3} className="tray">
        <div className="panel h-[380px] sm:h-[480px] lg:h-[560px]">
          <Wall />
        </div>
      </Reveal>
    </Container>
  );
}

/* ---------- Three ways in ---------- */

const COPY_ICON = <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="2" /><path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" /></svg>;
const centred = "absolute inset-0 flex flex-col items-center justify-center gap-3 p-6";

function CopyVisual() {
  return (
    <div className={centred}>
      <div className="flex w-full max-w-[300px] items-center gap-3 rounded-[20px] bg-background p-2.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-foreground text-[11px] font-semibold tracking-[0.02em] text-background">.swift</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px]">WalletStack.swift</span>
          <span className="mt-0.5 block text-[12.5px] text-subtle">One file · SwiftUI only</span>
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-[13px] border border-[var(--line-strong)] bg-surface-2 px-3 text-[13px] font-medium">{COPY_ICON}Copy</span>
      </div>
      <p className="flex gap-1.5"><span className={factPill}>No package</span><span className={factPill}>No dependencies</span></p>
    </div>
  );
}

/** Swatches from the default style, the brand red and the piece palette. */
const SWATCHES = ["#141414", "#ff3b30", "#34c3a0", "#ffc21a", "#3d8bff"];

function StyleVisual() {
  return (
    <div className={centred}>
      <div className="h-[124px] w-full max-w-[300px] overflow-hidden rounded-[16px] bg-background">
        <Piece slug="wallet-stack" alt="" className="mix-blend-multiply [html:not(.light)_&]:mix-blend-normal" />
      </div>
      <div className="flex gap-1.5">
        {SWATCHES.map((c) => <span key={c} className="size-[22px] rounded-[9px] ring-1 ring-black/10 ring-inset" style={{ background: c }} />)}
      </div>
    </div>
  );
}

function AgentVisual() {
  return (
    <div className="absolute inset-6 flex flex-col justify-end gap-2">
      <p className="max-w-[80%] self-end rounded-[16px] bg-foreground px-3.5 py-2.5 text-[13.5px] leading-5 text-background">Add a wallet of passes to the trip screen</p>
      <p className="max-w-[86%] rounded-[16px] bg-background px-3.5 py-2.5 text-[13.5px] leading-5 text-muted">Using <span className="text-foreground">swiftpieces · Wallet Stack</span>. Added WalletStack.swift and wired it to TripView.</p>
    </div>
  );
}

export function Ways() {
  const ways = [
    { href: "/docs/installation", meta: "01 · Copy", title: "Copy one file", text: "A single Swift file on Apple frameworks only.", visual: <CopyVisual /> },
    { href: "/styles", meta: "02 · Styles", title: "Make it yours", text: "Pick a style and every piece follows it.", visual: <StyleVisual /> },
    { href: "/docs/mcp", meta: "03 · MCP", title: "Ask your agent", text: "Claude Code, Cursor and Codex find the right piece.", visual: <AgentVisual /> },
  ];
  return (
    <Container className={gap}>
      <section aria-labelledby="ways">
        <Head id="ways" title="Three ways in." rest="Pick whichever fits how you work today." />
        <div className="grid gap-3 md:grid-cols-3">
          {ways.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.06}>
              <TileCard href={w.href} panel={w.visual} panelClass="h-[240px] sm:h-[260px]">
                <Caption meta={w.meta} title={w.title} text={w.text} />
              </TileCard>
            </Reveal>
          ))}
        </div>
      </section>
    </Container>
  );
}

/* ---------- Library bento ---------- */

type BentoPiece = { name: string; text: string; facts?: string[] };

/** Rows of a wide tile beside a narrow one, the wide side alternating. Each piece plays live in its panel. */
const BENTO: [BentoPiece, BentoPiece][] = [
  [
    { name: "ParallaxCard", text: "An image card whose picture and glass caption drift at different speeds, so it reads in layers.", facts: ["Layered parallax", "Liquid Glass caption", "Scroll driven"] },
    { name: "TimerDial", text: "A countdown you set by turning the dial, with a live progress ring." },
  ],
  [
    { name: "ReactionToggle", text: "Like and save buttons that burst, count up and settle." },
    { name: "ScrubChart", text: "A line chart you scrub with a finger, with a range you can drag.", facts: ["Scrub for values", "Drag a range", "Period switch"] },
  ],
  [
    { name: "FanStack", text: "Overlapping avatars that fan apart on tap, with a name tag budding out of the one you hold.", facts: ["Fans on tap", "Scrub to pick", "Glass name tag"] },
    { name: "AmountField", text: "A money field with quick amounts and a limit that warns early." },
  ],
  [
    { name: "StatusTimeline", text: "Order steps that tick through and open for detail." },
    { name: "RingBreakdown", text: "A spend ring that splits into categories as you tap them.", facts: ["Tap a slice", "Animated totals"] },
  ],
];

/**
 * A bento tile: the piece's live web preview in a square stage as tall as the panel, on the panel's own
 * colour, so the piece fills the tile and plays. Its whole still (public/landing/pieces/) stands in the
 * server HTML and until the stage nears the viewport.
 */
function BentoTile({ p, wide }: { p: BentoPiece; wide?: boolean }) {
  const item = getRegistryItem(p.name);
  if (!item) return null;
  return (
    <TileCard
      href={piecePath(item)}
      panelClass="flex h-[340px] items-center justify-center sm:h-[440px] lg:h-[460px]"
      panel={
        <PreviewFrame aspect="aspect-square" className="h-full max-w-full rounded-none [--pv-bg:var(--surface-2)]" placeholder={<Piece slug={item.slug} alt={`${item.title}, a SwiftPieces component`} />}>
          <PiecePreview name={item.name} />
        </PreviewFrame>
      }
    >
      <Caption meta={<>Component · {categoryTitle(item.category)}{item.isNew ? <NewBadge /> : null}</>} title={item.title} text={p.text} facts={wide ? p.facts : undefined} />
    </TileCard>
  );
}

export function Bento() {
  const count = getRegistryIndex().length;
  return (
    <Container className={gap}>
      <section aria-labelledby="library">
        <Head id="library" title="The library." rest={`${count} pieces in ${Object.keys(categories).length} categories. Every one runs live on its page.`} link={{ label: `See all ${count} pieces`, href: "/components" }} />
        <div className="flex flex-col gap-3">
          {BENTO.map(([a, b], r) => {
            const wideFirst = r % 2 === 0;
            return (
              <Reveal key={a.name} className={cn("grid gap-3", wideFirst ? "lg:grid-cols-[1.45fr_1fr]" : "lg:grid-cols-[1fr_1.45fr]")}>
                <BentoTile p={a} wide={wideFirst} />
                <BentoTile p={b} wide={!wideFirst} />
              </Reveal>
            );
          })}
        </div>
        <Shelves />
      </section>
    </Container>
  );
}

/** Four category tiles under the bento, each with one of its pieces whole in the panel and its count. */
const SHELVES = ["liquid-switch", "date-strip", "voice-recorder", "live-stat"];

function Shelves() {
  const all = getRegistryIndex();
  return (
    <Reveal className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {SHELVES.map((slug) => {
        const item = getRegistryItem(slug);
        if (!item) return null;
        const n = all.filter((e) => e.category === item.category).length;
        return (
          <TileCard
            key={slug}
            href={`/components/${categories[item.category].slug}`}
            panelClass="h-[150px] sm:h-[190px]"
            panel={<div className="size-full p-3 transition-transform duration-700 ease-[var(--ease-out)] group-hover:-translate-y-1 sm:p-4"><Piece slug={slug} alt="" /></div>}
          >
            <div className="flex items-center justify-between gap-3 px-3.5 pt-3.5 pb-2">
              <p className="min-w-0 truncate text-[14.5px]">{categoryTitle(item.category)} <span className="text-subtle">{n}</span></p>
              <span aria-hidden className="text-subtle transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </div>
          </TileCard>
        );
      })}
    </Reveal>
  );
}

/* ---------- Pro and Games ---------- */

/** Phones rising out of the panel's foot, the last one in front. */
function Phones({ srcs, width = 230 }: { srcs: { src: string; alt: string }[]; width?: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-5 transition-transform duration-700 ease-[var(--ease-out)] group-hover:-translate-y-2">
      {srcs.map((s, i) => {
        const w = i === srcs.length - 1 ? width : Math.round(width * 0.86);
        return (
          <div key={s.src} className={cn("overflow-hidden rounded-t-[40px] border-[7px] border-b-0 border-[#141414] bg-[#141414]", i < srcs.length - 1 && "max-sm:hidden")} style={{ width: w, height: Math.round(w * 1.5) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static stills */}
            <img src={s.src} alt={s.alt} loading="lazy" decoding="async" className="block w-full rounded-t-[33px]" />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Which template and game the two tiles show. Change an id to show another: `template` is a Pro
 * template id from lib/pro-cards.json (its still lives in public/landing/more/<id>-light|dark.webp,
 * captured from the template's page on pro.swiftpieces.com), `game` a game id from proGames
 * (public/pro-games/<id>.webp).
 */
export const MORE_SHOWN = { template: "shop-app", game: "drift" } as const;

/** A template's hero still, whole, on the panel's colour (light and dark captures). */
function TemplateStill({ id, alt }: { id: string; alt: string }) {
  const src = (t: string) => `/landing/more/${id}-${t}.webp`;
  const cls = "absolute inset-0 size-full object-contain p-4 transition-transform duration-700 ease-[var(--ease-out)] group-hover:-translate-y-1.5 sm:p-6";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static stills */}
      <img src={src("light")} alt={alt} width={1280} height={1040} loading="lazy" decoding="async" className={cn("hidden [html.light_&]:block", cls)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- static stills */}
      <img src={src("dark")} alt="" aria-hidden width={1280} height={1040} loading="lazy" decoding="async" className={cn("[html.light_&]:hidden", cls)} />
    </>
  );
}

export function MoreTiles() {
  const template = proCards.find((c) => c.id === MORE_SHOWN.template && c.type === "template");
  const game = proGames.list.find((g) => g.id === MORE_SHOWN.game);
  return (
    <Container className={gap}>
      <section aria-labelledby="more">
        <Head id="more" title="When you need more." rest="Pro and Games are one-off purchases on pro.swiftpieces.com." />
        <Reveal className="grid gap-3 lg:grid-cols-[1.45fr_1fr]">
          {template ? (
            <TileCard href={`${pro.templates}/${template.id}`} panelClass="h-[340px] sm:h-[420px]" panel={<TemplateStill id={template.id} alt={`${template.title}, a SwiftPieces Pro app template`} />}>
              <Caption
                meta={<><ProBadge size="sm" /> SwiftPieces Pro · {template.title} template</>}
                title="Building an app?"
                text="Whole screens, flows and app templates, themed by one design system."
                facts={[`${proCatalog.screens} screens`, `${proCatalog.flows.total} flows`, `${proCatalog.templates} templates`]}
              />
            </TileCard>
          ) : null}
          {game ? (
            <TileCard href={`${pro.games}/${game.id}`} panelClass="h-[340px] sm:h-[420px]" panel={<Phones srcs={[{ src: `/pro-games/${game.id}.webp`, alt: `${game.title}, a SwiftPieces game` }]} />}>
              <Caption
                meta={<><ProBadge tone="games" label="Games" size="sm" /> SwiftPieces Games · {game.title}</>}
                title="Building a game?"
                text="Finished iOS games in SwiftUI and Metal, with the full source."
                facts={[`${proGames.list.length} games`, "Game Center", "StoreKit shop"]}
              />
            </TileCard>
          ) : null}
        </Reveal>
      </section>
    </Container>
  );
}

/* ---------- App icon ---------- */

const ICONS = ["tiles", "camera", "umbrella", "moon", "scales", "donut", "grapefruit", "ripple", "tiles"];

/** "Need an app icon?": an arc of TinyPersonas logos in the panel, the caption under it. */
export function AppIconTile() {
  return (
    <Container className={gap}>
      <Reveal>
        <TileCard
          href="https://tinypersonas.com"
          panelClass="h-[220px] sm:h-[260px]"
          panel={
            <ul aria-label="Icons from TinyPersonas" className="absolute inset-x-0 top-12 flex justify-center gap-4 sm:gap-6">
              {ICONS.map((id, i) => {
                const d = i - 4;
                return (
                  <li key={i} className={cn("w-[64px] shrink-0 sm:w-[88px]", Math.abs(d) > 2 && "max-sm:hidden", Math.abs(d) > 3 && "max-lg:hidden")} style={{ transform: `translateY(${d * d * 6}px) rotate(${d * 4}deg)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/app-icons/${id}.webp`} alt="" loading="lazy" className="w-full rounded-[22.5%] shadow-[0_1px_2px_rgb(0_0_0/0.08),0_14px_30px_-12px_rgb(0_0_0/0.35)]" />
                  </li>
                );
              })}
            </ul>
          }
        >
          <Caption meta="TinyPersonas" title="Need an app icon?" text="TinyPersonas makes one-off logos for single apps." />
        </TileCard>
      </Reveal>
    </Container>
  );
}

/* ---------- Close ---------- */

/** The close, on the pricing card's ember (the Signature grain, its core rising from the panel's foot), white type over it. */
export function CloseTile() {
  return (
    <Container className={cn(gap, "pb-20 sm:pb-24")}>
      <Reveal className="tray">
        <div className="panel isolate px-6 py-20 text-center text-[#fff] sm:py-24">
          <EmberStage seed="landing-close" core="centre" />
          <h2 className={cn(heading, "text-[#fff] [text-shadow:0_1px_12px_rgb(0_0_0/0.18)]")}>Start with a piece.</h2>
          <p className="mx-auto mt-2 max-w-[420px] text-[15px] leading-[24px] text-[#fff]/85">Free and open source. Copy it, change it, ship it.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href="/components" className="inline-flex h-10 items-center rounded-[17px] bg-[#fff] px-[18px] text-[14px] font-medium text-[#141414] transition-colors hover:bg-[#fff]/90">Browse components</Link>
            <a href={pro.home} className="inline-flex h-10 items-center rounded-[17px] border border-[#fff]/55 px-[18px] text-[14px] font-medium text-[#fff] transition-colors hover:bg-[#fff]/10">Explore Pro</a>
          </div>
        </div>
      </Reveal>
    </Container>
  );
}
