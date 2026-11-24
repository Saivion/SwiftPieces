import { LogoMark } from "@/components/ui/logo";
import { Live } from "@/components/landing/live";
import { Loop } from "@/components/landing/live";
import { IndexRows, Steps, Swap } from "@/components/directions/motion";
import { count, faqs, FOOT, GAMES, NAV, pro, proCatalog, proGames, SCREENS, stills, allStills } from "@/components/directions/shared";
import { summaries } from "@/registry/summaries";

export const metadata = { title: "A · Index" };

/* Direction A, "Index": a Swiss type specimen. Inter Tight, hairlines instead of cards, numbers in red,
   no shadows, no tilt. Motion is editorial: cells wipe to the next piece in a ripple, rows lift a preview. */

const SHEET = [
  ["SwipeDeck", "WalletStack", "FlipCard"],
  ["ScrubChart", "RingBreakdown", "LiveStat"],
  ["TimerDial", "ElasticButton", "LiquidSwitch"],
  ["ReactionToggle", "RatingScrub", "StatusMorph"],
  ["QRCode", "PictureHeadline", "TextReveal"],
  ["StatusTimeline", "TaskRow", "ReorderList"],
  ["AmountField", "DateStrip", "SwatchPicker"],
  ["ActivityHeatmap", "MotionCard", "NowPlaying"],
];

function Nav() {
  return (
    <header className="dx-a-nav">
      <div className="dx-a-wrap flex h-14 items-center gap-10">
        <a href="/directions/a" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]">
          <LogoMark className="size-[20px]" /> SwiftPieces
        </a>
        <nav className="flex gap-6 text-[14px] text-[#6b6b68] max-md:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-[#111]">
              {n.label}
              {n.label === "Components" ? <sup className="ml-0.5 text-[10px] text-[#f2361c]">{count}</sup> : null}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-6 text-[14px]">
          <a href="https://github.com/Saivion/SwiftPieces" className="text-[#6b6b68] hover:text-[#111] max-sm:hidden">GitHub <span className="tabular-nums">★ 320</span></a>
          <a href={pro.home} className="dx-a-link">Get Pro →</a>
        </div>
      </div>
    </header>
  );
}

function Label({ n, t }: { n: string; t: string }) {
  return (
    <div className="dx-a-label">
      <span className="text-[#f2361c]">{n}</span>
      <span>{t}</span>
    </div>
  );
}

export default function DirectionA() {
  const sheet = SHEET.map((names) => stills(names));
  const index = stills([
    "SwipeDeck", "ScrubChart", "TimerDial", "WalletStack", "ReactionToggle", "QRCode", "AmountField", "StatusTimeline",
    "ElasticButton", "PictureHeadline", "ActivityHeatmap", "FloatingDock", "AssistantOrb", "PermissionSheet",
  ]);
  const all = allStills();
  const no = (name: string) => String(all.findIndex((s) => s.name === name) + 1).padStart(3, "0");
  const games = proGames.list.filter((g) => GAMES.includes(g.id));

  return (
    <div className="dx-a">
      <Nav />

      {/* Hero */}
      <section className="dx-a-wrap pt-10 sm:pt-14">
        <ul className="dx-a-meta">
          <li>Free SwiftUI components</li>
          <li><span className="tabular-nums">{count}</span> pieces</li>
          <li>iOS 17+, Liquid Glass on 26</li>
          <li>One Swift file each</li>
          <li className="max-md:hidden">MIT + Commons Clause</li>
        </ul>
        <h1 className="dx-a-h1">
          Pieces for apps<br />worth featuring<span className="text-[#f2361c]">.</span>
        </h1>
        <div className="mt-8 grid gap-6 border-t border-[#111] pt-5 md:grid-cols-12">
          <p className="text-[17px] leading-[26px] text-[#55554f] md:col-span-5">
            A free library of SwiftUI components with the motion, haptics, states and accessibility already done. Copy the file, run one command, or let your agent add it.
          </p>
          <div className="flex flex-wrap items-start gap-3 md:col-span-7 md:justify-end">
            <a href="/components" className="dx-a-btn">Browse the index</a>
            <span className="dx-a-cmd">npx swiftpieces add SwipeDeck</span>
          </div>
        </div>
      </section>

      {/* Specimen sheet */}
      <section className="dx-a-wrap mt-12">
        <div className="dx-a-sheet">
          {sheet.map((col, c) => (
            <div key={c} className="dx-a-cell">
              <Swap
                ms={4200}
                delay={c * 380}
                enter="dx-wipe"
                className="aspect-[4/3]"
                panels={col.map((s) => (
                  <a key={s.name} href={s.href} className="block size-full">
                    <Live s={s} className="rounded-none" aspect="aspect-[4/3]" />
                    <span className="dx-a-cap">
                      <span className="text-[#f2361c] tabular-nums">{no(s.name)}</span> {s.title}
                      <span className="ml-auto text-[#8b8b85]">{s.category}</span>
                    </span>
                  </a>
                ))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="dx-a-wrap dx-a-sec">
        <Label n="01" t="Principles" />
        <div className="grid border-t border-[#111] md:grid-cols-3">
          <article className="dx-a-col">
            <p className="dx-a-num">01</p>
            <h3 className="dx-a-h3">Native by default.</h3>
            <p className="dx-a-p">Springs that start from your finger, haptics on the right beat, Dynamic Type and VoiceOver done.</p>
            <div className="mt-auto overflow-hidden border border-[#e2e1dc]">
              <Live s={stills(["SwipeDeck"])[0]} className="rounded-none" />
            </div>
          </article>
          <article className="dx-a-col">
            <p className="dx-a-num">02</p>
            <h3 className="dx-a-h3">One file, yours.</h3>
            <p className="dx-a-p">Every piece is a single Swift file on Apple frameworks only. Nothing to update, nothing to wrap.</p>
            <Steps ms={[700, 900, 500, 500, 500, 2600]} className="dx-a-term mt-auto">
              <p>$ npx swiftpieces add TimerDial</p>
              <p className="s1">  resolving TimerDial ……… cards/controls</p>
              <p className="s2">  <span className="text-[#f2361c]">+</span> Brew/Pieces/TimerDial.swift   612 lines</p>
              <p className="s3">  <span className="text-[#f2361c]">+</span> added to target Brew</p>
              <p className="s4">  0 dependencies. done in 0.8s</p>
              <p className="s5 text-[#111]">  ▍</p>
            </Steps>
          </article>
          <article className="dx-a-col">
            <p className="dx-a-num">03</p>
            <h3 className="dx-a-h3">Ready for agents.</h3>
            <p className="dx-a-p">Claude Code, Cursor and Xcode read the library through the MCP server and add the right piece for you.</p>
            <Steps ms={[900, 1200, 900, 2600]} className="dx-a-term mt-auto">
              <p className="text-[#111]">› add a countdown to the brew screen</p>
              <p className="s1">  search_pieces “countdown” → TimerDial</p>
              <p className="s2">  add_piece TimerDial → BrewView.swift</p>
              <p className="s3"><span className="text-[#f2361c]">  ✓</span> TimerDial(seconds: $brew, isRunning: $on)</p>
            </Steps>
          </article>
        </div>
      </section>

      {/* Index */}
      <section className="dx-a-wrap dx-a-sec">
        <Label n="02" t="Index" />
        <div className="border-t border-[#111]">
          <IndexRows
            rows={index.map((s) => (
              <a key={s.name} href={s.href} className="grid grid-cols-[56px_1fr_auto] items-baseline gap-4 py-3.5 md:grid-cols-[72px_260px_150px_1fr_24px]">
                <span className="text-[13px] text-[#f2361c] tabular-nums">{no(s.name)}</span>
                <span className="text-[22px] tracking-[-0.02em] md:text-[26px]">{s.title}</span>
                <span className="text-[13px] text-[#8b8b85] max-md:hidden">{s.category}</span>
                <span className="truncate text-[14px] text-[#6b6b68] max-md:hidden">{summaries[s.name]}</span>
                <span className="dx-a-arrow text-right">→</span>
              </a>
            ))}
            previews={index.map((s) => (
              <div key={s.name} className="overflow-hidden border border-[#111] bg-[#fff]"><Live s={s} className="rounded-none" /></div>
            ))}
          />
        </div>
        <a href="/components" className="dx-a-link mt-6 inline-block text-[15px]">All {count} pieces →</a>
      </section>

      {/* Beyond free */}
      <section className="dx-a-wrap dx-a-sec">
        <Label n="03" t="Beyond free" />
        <div className="grid border-t border-[#111] md:grid-cols-2">
          {[
            { k: "Pro", t: "Building an app?", d: `${proCatalog.screens} screens, ${proCatalog.flows.total} flows and ${proCatalog.templates} templates on one design system.`, href: pro.library, src: `/pro-screens/${SCREENS[0]}`, l: "Explore Pro →" },
            { k: "Games", t: "Building a game?", d: `${proGames.list.length} finished games in SwiftUI and Metal, ready to make your own.`, href: pro.games, src: `/pro-games/play/${games[0]?.id ?? "cairn"}`, l: "See the games →" },
          ].map((x, i) => (
            <article key={x.k} className={i === 0 ? "dx-a-col md:border-r md:border-[#e2e1dc]" : "dx-a-col"}>
              <p className="text-[13px] text-[#8b8b85]">SwiftPieces {x.k}</p>
              <h3 className="dx-a-h3 mt-3 text-[34px]">{x.t}</h3>
              <p className="dx-a-p">{x.d}</p>
              <a href={x.href} className="dx-a-link mt-3 text-[15px]">{x.l}</a>
              <div className="mt-8 grid h-[420px] place-items-center bg-[#fff]">
                <div className="h-[380px] w-[176px] overflow-hidden rounded-[26px] ring-1 ring-[#111]">
                  <Loop src={`${x.src}.mp4`} poster={`${x.src}.webp`} label={x.t} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Questions */}
      <section className="dx-a-wrap dx-a-sec">
        <Label n="04" t="Questions" />
        <div className="border-t border-[#111]">
          {faqs.map((f, i) => (
            <details key={f.q} className="group border-b border-[#e2e1dc]">
              <summary className="grid cursor-pointer list-none grid-cols-[56px_1fr_24px] items-baseline py-5 md:grid-cols-[72px_1fr_24px] [&::-webkit-details-marker]:hidden">
                <span className="text-[13px] text-[#f2361c] tabular-nums">Q{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[20px] tracking-[-0.015em]">{f.q}</span>
                <span className="text-[#8b8b85] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-[64ch] pb-6 pl-[56px] text-[15px] leading-[24px] text-[#6b6b68] md:pl-[72px]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="dx-a-wrap mt-24 border-t border-[#111] pt-8">
        <div className="grid gap-8 md:grid-cols-12">
          <p className="text-[15px] leading-[24px] text-[#6b6b68] md:col-span-4">Start with a piece. Spend the week on your idea, not on rebuilding another picker.</p>
          {FOOT.map((c) => (
            <div key={c.h} className="md:col-span-2">
              <p className="text-[13px] text-[#8b8b85]">{c.h}</p>
              <ul className="mt-3 space-y-1.5 text-[14px]">{c.l.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="dx-a-word" aria-hidden>SwiftPieces</p>
      </footer>
    </div>
  );
}
