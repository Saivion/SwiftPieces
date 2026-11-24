import type { CSSProperties } from "react";
import { LogoMark } from "@/components/ui/logo";
import { EmberStage } from "@/components/visual/ember-stage";
import { Live, Loop, Scaled } from "@/components/landing/live";
import { Assemble, Steps, Typed } from "@/components/directions/motion";
import { categoryLeads, count, faqs, FOOT, NAV, pro, proCatalog, proGames, stills, type StillPiece } from "@/components/directions/shared";

export const metadata = { title: "D · Pieces" };

/* Direction D, "Pieces": the name taken literally. Bricolage Grotesque, chunky but soft. The hero is a
   table of pieces that fly into a phone and become an app, then scatter and build the next one.
   Sections are a bento of the library and three plain cards; the Signature grain marks only Pro. */

type Slot = { name: string; sx: number; sy: number; sr: number };
const APPS: { title: string; sub: string; slots: [Slot, Slot, Slot] }[] = [
  { title: "Brew", sub: "Morning pour-over", slots: [{ name: "TimerDial", sx: -390, sy: 40, sr: -9 }, { name: "ActivityHeatmap", sx: 400, sy: -150, sr: 7 }, { name: "CommitButton", sx: -330, sy: -20, sr: 6 }] },
  { title: "Wallet", sub: "Lisbon trip", slots: [{ name: "WalletStack", sx: 410, sy: 70, sr: 8 }, { name: "ScrubChart", sx: -420, sy: -120, sr: -6 }, { name: "AmountField", sx: 360, sy: -10, sr: -5 }] },
  { title: "Dinner", sub: "Tonight's picks", slots: [{ name: "SwipeDeck", sx: -400, sy: 110, sr: -7 }, { name: "RatingScrub", sx: 390, sy: -60, sr: 9 }, { name: "ReactionToggle", sx: -340, sy: -60, sr: 4 }] },
];

function Nav() {
  return (
    <header className="dx-d-wrap pt-4">
      <div className="dx-d-nav">
        <a href="/directions/d" className="flex items-center gap-2 pl-2 text-[17px] font-bold tracking-[-0.03em]">
          <LogoMark className="size-[26px]" /> SwiftPieces
        </a>
        <nav className="flex gap-1 max-md:hidden">
          {NAV.map((n) => <a key={n.href} href={n.href} className="dx-d-navlink">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <a href="https://github.com/Saivion/SwiftPieces" className="dx-d-btn dx-d-btn-2 max-sm:hidden">★ 320</a>
          <a href={pro.home} className="dx-d-btn">Get Pro</a>
        </div>
      </div>
    </header>
  );
}

function AppScreen({ app, pieces }: { app: (typeof APPS)[number]; pieces: StillPiece[] }) {
  const [a, b, c] = pieces;
  const tile = (s: Slot, k: number) => ({ "--sx": `${s.sx}px`, "--sy": `${s.sy}px`, "--sr": `${s.sr}deg`, "--k": k } as CSSProperties);
  return (
    <>
      <div className="dx-d-apptitle">
        <p className="text-[12px] font-semibold text-[#8b8b85]">{app.sub}</p>
        <p className="text-[30px] leading-none font-bold tracking-[-0.03em]">{app.title}</p>
      </div>
      <div className="dx-d-piece" style={{ ...tile(app.slots[0], 0), top: 112, height: 206 }}><Live s={a} className="rounded-[18px]" /></div>
      <div className="dx-d-piece" style={{ ...tile(app.slots[1], 1), top: 328, height: 206 }}><Live s={b} className="rounded-[18px]" /></div>
      <div className="dx-d-piece dx-d-piece-s" style={{ ...tile(app.slots[2], 2), top: 544, height: 74 }}><Scaled s={c} w={274} h={74} zoom={1.25} className="rounded-[18px]" /></div>
    </>
  );
}

const SPANS = ["md:col-span-2 md:row-span-2", "", "", "md:col-span-2", "", "", "md:row-span-2", "", "md:col-span-2", ""];

export default function DirectionD() {
  const leads = categoryLeads().slice(0, 10);
  const [deck, , heat] = stills(["SwipeDeck", "TimerDial", "ActivityHeatmap"]);
  const fan = stills(["TimerDial", "SwipeDeck", "ScrubChart", "WalletStack", "QRCode"]);
  return (
    <div className="dx-d">
      <Nav />

      {/* Hero */}
      <section className="dx-d-wrap pt-10 text-center sm:pt-12">
        <p className="dx-d-chip mx-auto">{count} free SwiftUI pieces</p>
        <h1 className="dx-d-h1 mt-6">Apps, piece<br className="sm:hidden" /> by piece.</h1>
        <p className="mx-auto mt-5 max-w-[540px] text-[18px] leading-[28px] text-[#6b6b68]">
          Drop in the parts every app needs, with the motion, haptics and accessibility done. Each one a Swift file you own.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <a href="/components" className="dx-d-btn h-[50px] px-6 text-[16px]">Browse pieces</a>
          <a href="/docs/installation" className="dx-d-btn dx-d-btn-2 h-[50px] px-6 text-[16px]">Install the CLI</a>
        </div>
        <div className="dx-d-table">
          <div className="dx-d-stage">
            <div className="dx-d-phone" aria-hidden />
            <Assemble ms={5000} className="absolute inset-0" apps={APPS.map((app) => <AppScreen key={app.title} app={app} pieces={stills(app.slots.map((s) => s.name))} />)} />
          </div>
        </div>
      </section>

      {/* Bento */}
      <section className="dx-d-wrap dx-d-sec">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="dx-d-h2">Every kind of piece.</h2>
          <a href="/components" className="dx-d-btn dx-d-btn-2">All {count} pieces →</a>
        </div>
        <div className="mt-8 grid auto-rows-[260px] grid-cols-2 gap-3 md:grid-cols-4">
          {leads.map((c, i) => (
            <a key={c.slug} href={`/components/${c.slug}`} className={`dx-d-tile ${SPANS[i] ?? ""}`}>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[20px]">
                <div className="absolute inset-0 grid place-items-center"><div className="w-full"><Live s={c.lead} className="rounded-[20px]" /></div></div>
              </div>
              <p className="flex items-center justify-between px-2 pt-2.5 pb-1 text-[16px] font-bold tracking-[-0.02em]">
                {c.title}<span className="dx-d-count">{c.count}</span>
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* Three cards */}
      <section className="dx-d-wrap dx-d-sec">
        <h2 className="dx-d-h2">Three ways in.</h2>
        <div className="mt-8 grid gap-3 lg:grid-cols-3">
          <article className="dx-d-card">
            <div className="dx-d-vis"><div className="w-[86%]"><Live s={deck} className="rounded-[20px]" /></div></div>
            <h3 className="dx-d-h3">Copy the file.</h3>
            <p className="dx-d-p">Every page has the source. One Swift file, Apple frameworks only, nothing to install.</p>
          </article>
          <article className="dx-d-card">
            <div className="dx-d-vis flex-col gap-3">
              <p className="dx-d-cmd"><span className="text-[#ff6b52]">$</span> <Typed text="npx swiftpieces add SwipeDeck" speed={60} /></p>
              <Steps ms={[2200, 800, 3000]} className="flex flex-col items-center gap-2">
                <span className="dx-d-file s1">＋ SwipeDeck.swift</span>
                <span className="dx-d-file s2">✓ added to target</span>
              </Steps>
            </div>
            <h3 className="dx-d-h3">Run one command.</h3>
            <p className="dx-d-p">The CLI drops the piece straight into your Xcode target. No package, no wrapper.</p>
          </article>
          <article className="dx-d-card">
            <div className="dx-d-vis flex-col gap-3 px-6">
              <p className="dx-d-bubble">Add a streak calendar to the profile</p>
              <div className="w-[78%] self-start"><Live s={heat} className="rounded-[18px]" /></div>
            </div>
            <h3 className="dx-d-h3">Ask your agent.</h3>
            <p className="dx-d-p">Claude Code, Cursor and Xcode find and add the right piece through the MCP server.</p>
          </article>
        </div>
      </section>

      {/* Pro and Games */}
      <section className="dx-d-wrap dx-d-sec grid gap-3 lg:grid-cols-2">
        {[
          { t: "Building an app?", d: `Pro: ${proCatalog.screens} screens, ${proCatalog.flows.total} flows and ${proCatalog.templates} templates.`, srcs: ["/pro-screens/ai-chat-screen", "/pro-screens/wallet-stack", "/pro-screens/focus-timer"], href: pro.library, l: "Explore Pro", ember: true },
          { t: "Building a game?", d: `Games: ${proGames.list.length} finished games in SwiftUI and Metal.`, srcs: ["/pro-games/play/pane", "/pro-games/play/cairn", "/pro-games/play/thrum"], href: pro.games, l: "See the games", ember: false },
        ].map((x) => (
          <a key={x.t} href={x.href} className={x.ember ? "relative isolate overflow-hidden rounded-[32px] p-8 text-[#fff] sm:p-10" : "dx-d-card overflow-hidden p-8 sm:p-10"}>
            {x.ember ? <EmberStage seed="dx-d-pro" core="centre" /> : null}
            <h3 className="dx-d-h2 text-[36px]">{x.t}</h3>
            <p className={x.ember ? "mt-2 text-[16px] text-[#fff]/85" : "mt-2 text-[16px] text-[#6b6b68]"}>{x.d}</p>
            <span className={x.ember ? "dx-d-btn mt-6 bg-[#fff] text-[#1a0806]" : "dx-d-btn mt-6"}>{x.l} →</span>
            <div className="dx-d-fan">
              {x.srcs.map((src, i) => (
                <div key={src} className="dx-d-fphone" style={{ "--f": i - 1 } as CSSProperties}>
                  <div className="size-full overflow-hidden rounded-[24px]"><Loop src={`${src}.mp4`} poster={`${src}.webp`} label={x.t} /></div>
                </div>
              ))}
            </div>
          </a>
        ))}
      </section>

      {/* Questions */}
      <section className="dx-d-wrap dx-d-sec">
        <h2 className="dx-d-h2">Questions.</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {faqs.map((f) => (
            <details key={f.q} className="dx-d-card group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-bold tracking-[-0.02em] [&::-webkit-details-marker]:hidden">
                {f.q}<span className="dx-d-plus group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-[24px] text-[#6b6b68]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Close */}
      <section className="dx-d-wrap dx-d-sec text-center">
        <div className="dx-d-close">
          {fan.map((s, i) => (
            <div key={s.name} className="dx-d-closetile" style={{ "--f": i - 2 } as CSSProperties}><Live s={s} className="rounded-[18px]" /></div>
          ))}
        </div>
        <h2 className="dx-d-h1 mt-10 text-[clamp(44px,6vw,80px)]">Grab a piece.</h2>
        <p className="mx-auto mt-3 max-w-[420px] text-[18px] text-[#6b6b68]">Spend the week on your idea, not on rebuilding another picker.</p>
        <a href="/components" className="dx-d-btn mt-7 h-[50px] px-6 text-[16px]">Browse pieces</a>
      </section>

      <footer className="dx-d-wrap dx-d-sec pb-10">
        <div className="dx-d-card flex flex-wrap justify-between gap-8 p-8">
          <p className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.03em]"><LogoMark className="size-[24px]" /> SwiftPieces</p>
          {FOOT.map((c) => (
            <div key={c.h}><p className="font-bold">{c.h}</p><ul className="mt-2 space-y-1 text-[14px] text-[#6b6b68]">{c.l.map((l) => <li key={l}>{l}</li>)}</ul></div>
          ))}
        </div>
      </footer>
    </div>
  );
}
