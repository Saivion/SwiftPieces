import { Fragment } from "react";
import { LogoMark } from "@/components/ui/logo";
import { Live, Loop } from "@/components/landing/live";
import { SourceHero, Steps, Tree } from "@/components/directions/motion";
import { categoryLeads, count, faqs, FOOT, NAV, pro, proCatalog, proGames, SNIPPETS, stills, allStills, tokens } from "@/components/directions/shared";

export const metadata = { title: "C · Source" };

/* Direction C, "Source": the library as a developer tool. Geist and Geist Mono, white windows on paper,
   red only for the caret, keywords and what changed. Motion follows the work: a command types a piece's
   name, its code streams in and the piece runs beside it; a file tree walks itself. */

const HERO = ["SwipeDeck", "TimerDial", "ScrubChart", "WalletStack"];

function Code({ lines, mark = [] }: { lines: string[]; mark?: number[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className={mark.includes(i) ? "dx-c-ln dx-c-mark" : "dx-c-ln"} style={{ "--i": i } as React.CSSProperties}>
          <span className="dx-c-no">{i + 1}</span>
          <span>{tokens(l).map((t, k) => <span key={k} className={t.k ? `dx-c-${t.k}` : undefined}>{t.t}</span>)}</span>
        </div>
      ))}
    </>
  );
}

function Nav() {
  return (
    <header className="dx-c-nav">
      <div className="dx-c-wrap flex h-14 items-center gap-8">
        <a href="/directions/c" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]">
          <LogoMark className="size-[20px]" /> swiftpieces
        </a>
        <nav className="flex gap-5 font-mono text-[13px] text-[#6b6b68] max-md:hidden">
          {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-[#111]">{n.label.toLowerCase()}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="dx-c-search max-sm:hidden">Search pieces <kbd>⌘K</kbd></span>
          <a href="https://github.com/Saivion/SwiftPieces" className="dx-c-btn dx-c-btn-2 max-sm:hidden">★ 320</a>
          <a href={pro.home} className="dx-c-btn">Get Pro</a>
        </div>
      </div>
    </header>
  );
}

function Section({ cmd, title, rest, children }: { cmd: string; title: string; rest: string; children: React.ReactNode }) {
  return (
    <section className="dx-c-wrap dx-c-sec">
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-end">
        <div>
          <p className="dx-c-kick">{cmd}</p>
          <h2 className="dx-c-h2 mt-3">{title}</h2>
        </div>
        <p className="max-w-[520px] text-[16px] leading-[26px] text-[#6b6b68] md:justify-self-end">{rest}</p>
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export default function DirectionC() {
  const hero = stills(HERO);
  const all = allStills();
  const leads = categoryLeads();
  const groups = leads.slice(0, 6).map((c) => ({ title: c.title, items: all.filter((s) => s.category === c.title).slice(0, 3) }));
  let n = 0;
  const treeGroups = groups.map((g) => ({ title: g.title, files: g.items.map((s) => ({ name: s.name, i: n++ })) }));
  const treePreviews = groups.flatMap((g) => g.items.map((s) => (
    <div key={s.name} className="flex size-full flex-col">
      <div className="dx-c-bar"><span>{s.name}.swift</span><span className="text-[#8b8b85]">{s.category}</span></div>
      <div className="flex-1 p-4"><Live s={s} className="rounded-[14px]" /></div>
    </div>
  )));
  const [heat] = stills(["ActivityHeatmap"]);

  return (
    <div className="dx-c">
      <Nav />

      {/* Hero */}
      <section className="dx-c-wrap pt-16 sm:pt-20">
        <p className="dx-c-kick">{`// ${count} free SwiftUI components`}</p>
        <h1 className="dx-c-h1 mt-5">Drop a piece in.<br />Ship the screen.</h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-[520px] text-[17px] leading-[27px] text-[#6b6b68]">
            Production SwiftUI with the motion, haptics, states and accessibility done. One Swift file each, Apple frameworks only, yours to edit.
          </p>
          <div className="flex gap-2">
            <a href="/components" className="dx-c-btn h-11 px-5 text-[14.5px]">Browse components</a>
            <a href="/docs/introduction" className="dx-c-btn dx-c-btn-2 h-11 px-5 text-[14.5px]">Read the docs</a>
          </div>
        </div>
        <div className="mt-10">
          <SourceHero
            ms={5600}
            names={HERO}
            codes={HERO.map((h) => <Code key={h} lines={SNIPPETS[h].code} mark={[5, 6]} />)}
            previews={hero.map((s) => <Live key={s.name} s={s} className="rounded-[16px]" aspect="aspect-[4/3]" />)}
          />
        </div>
        <p className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[12.5px] text-[#8b8b85]">
          <span>works with</span><span className="text-[#111]">Xcode</span><span className="text-[#111]">Claude Code</span><span className="text-[#111]">Cursor</span><span className="text-[#111]">Codex</span><span className="text-[#111]">Windsurf</span>
        </p>
      </section>

      {/* add */}
      <Section cmd="01 · add" title="One command, one file." rest="Run it next to your .xcodeproj. The CLI writes the Swift file into your target and nothing else: no package, no wrapper, no version to keep up with.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="dx-c-win">
            <div className="dx-c-bar"><span>Terminal — Brew</span><span className="text-[#8b8b85]">zsh</span></div>
            <Steps ms={[900, 600, 600, 600, 3200]} className="dx-c-term">
              <p><span className="text-[#f2361c]">~/Brew</span> $ npx swiftpieces add TimerDial</p>
              <p className="s1 text-[#8b8b85]">→ fetching TimerDial (controls) from swiftpieces.com</p>
              <p className="s2"><span className="text-[#1f9d55]">+</span> Brew/Pieces/TimerDial.swift <span className="text-[#8b8b85]">612 lines</span></p>
              <p className="s3"><span className="text-[#1f9d55]">✓</span> added to target <span className="text-[#111]">Brew</span></p>
              <p className="s4 text-[#8b8b85]">0 dependencies · iOS 17+ · done in 0.8s</p>
            </Steps>
          </div>
          <div className="dx-c-win">
            <div className="dx-c-bar"><span>TimerDial.swift</span><span className="text-[#8b8b85]">Preview</span></div>
            <div className="p-4"><Live s={stills(["TimerDial"])[0]} className="rounded-[14px]" /></div>
          </div>
        </div>
      </Section>

      {/* ask */}
      <Section cmd="02 · ask" title="Or ask your agent." rest="The MCP server hands Claude Code, Cursor and Xcode the whole library: what each piece does, its API and its source. Your agent picks the piece and wires your data in.">
        <div className="dx-c-win grid lg:grid-cols-[1fr_1.1fr]">
          <Steps ms={[900, 900, 900, 3600]} className="dx-c-term border-[#ecebe6] lg:border-r">
            <p className="text-[#111]">› add a streak calendar to ProfileView</p>
            <p className="s1 text-[#8b8b85]">  ⏺ swiftpieces.search_pieces(&quot;streak&quot;)</p>
            <p className="s1 text-[#8b8b85]">    → ActivityHeatmap · data</p>
            <p className="s2 text-[#8b8b85]">  ⏺ swiftpieces.add_piece(&quot;ActivityHeatmap&quot;)</p>
            <div className="s3 mt-3 rounded-[10px] bg-[#f7f7f4] p-3">
              <p className="text-[#8b8b85]">ProfileView.swift</p>
              <p className="dx-c-del">-     Text(&quot;Streak: \(days)&quot;)</p>
              <p className="dx-c-add">+     ActivityHeatmap(days: user.activity,</p>
              <p className="dx-c-add">+                     tint: .red)</p>
            </div>
          </Steps>
          <div className="p-4"><Live s={heat} className="rounded-[14px]" /></div>
        </div>
      </Section>

      {/* own */}
      <Section cmd="03 · own" title="Then it is your code." rest="Every piece is readable, commented SwiftUI. Change a colour, a spring or a layout in the file itself; nothing upstream will overwrite it.">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            ["Frameworks", "SwiftUI, Apple only"],
            ["Baseline", "iOS 17, Liquid Glass on 26"],
            ["Accessibility", "VoiceOver, Dynamic Type, Reduce Motion"],
            ["Motion", "One spring language across pieces"],
            ["License", "MIT + Commons Clause"],
            ["Price", "Free, for client work too"],
          ].map(([k, v]) => (
            <div key={k} className="dx-c-win flex items-baseline justify-between gap-4 px-5 py-4">
              <span className="font-mono text-[12.5px] text-[#8b8b85]">{k}</span>
              <span className="text-right text-[15px]">{v}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Library */}
      <Section cmd={`ls pieces/ · ${count}`} title="The whole library." rest={`${leads.length} folders, ${count} files. Every one runs live on its page, with the source a tap away.`}>
        <Tree groups={treeGroups} previews={treePreviews} ms={2600} />
        <a href="/components" className="dx-c-btn dx-c-btn-2 mt-5 h-11 px-5 text-[14.5px]">Browse all {count} →</a>
      </Section>

      {/* Packages */}
      <Section cmd="more" title="Bigger pieces." rest="When a component is not enough: whole screens, flows and app templates in Pro, and finished games to make your own.">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { pkg: "swiftpieces-pro", meta: `${proCatalog.screens} screens · ${proCatalog.flows.total} flows · ${proCatalog.templates} templates`, t: "Building an app?", src: "/pro-screens/ai-chat-screen", href: pro.library },
            { pkg: "swiftpieces-games", meta: `${proGames.list.length} games · SwiftUI + Metal`, t: "Building a game?", src: "/pro-games/play/cairn", href: pro.games },
          ].map((x) => (
            <a key={x.pkg} href={x.href} className="dx-c-win block overflow-hidden">
              <div className="dx-c-bar"><span>{x.pkg}</span><span className="text-[#8b8b85]">{x.meta}</span></div>
              <div className="flex items-end justify-between gap-6 p-6 pb-0">
                <div className="pb-8">
                  <h3 className="text-[26px] font-medium tracking-[-0.03em]">{x.t}</h3>
                  <p className="mt-2 font-mono text-[13px] text-[#f2361c]">open {x.pkg} →</p>
                </div>
                <div className="h-[340px] w-[168px] shrink-0 overflow-hidden rounded-t-[26px] bg-[#0b0b0b] p-[5px] pb-0">
                  <div className="h-[380px] overflow-hidden rounded-[22px]"><Loop src={`${x.src}.mp4`} poster={`${x.src}.webp`} label={x.t} /></div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </Section>

      {/* Questions */}
      <Section cmd="--help" title="Questions." rest="The rest are in the docs.">
        <div className="dx-c-win divide-y divide-[#ecebe6]">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-4 text-[16px] [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-[13px] text-[#f2361c] transition-transform group-open:rotate-90">›</span>{f.q}
              </summary>
              <p className="mt-2 max-w-[70ch] pl-7 text-[15px] leading-[24px] text-[#6b6b68]">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <footer className="dx-c-wrap dx-c-sec border-t border-[#e6e5e0] py-12">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-semibold"><LogoMark className="size-[20px]" /> swiftpieces</p>
            <p className="mt-4 font-mono text-[13px] text-[#8b8b85]">$ npx swiftpieces add <span className="dx-caret text-[#f2361c]" /></p>
          </div>
          {FOOT.map((c) => (
            <Fragment key={c.h}>
              <div>
                <p className="font-mono text-[12.5px] text-[#8b8b85]">{c.h.toLowerCase()}/</p>
                <ul className="mt-3 space-y-1.5 text-[14px]">{c.l.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            </Fragment>
          ))}
        </div>
      </footer>
    </div>
  );
}
