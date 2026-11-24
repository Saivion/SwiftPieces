import { LogoMark } from "@/components/ui/logo";
import { EmberStage } from "@/components/visual/ember-stage";
import { Live, Loop } from "@/components/landing/live";
import { Carousel, CountUp, Steps, Tabs, Typed } from "@/components/directions/motion";
import { categoryLeads, count, faqs, FOOT, NAV, pro, proCatalog, proGames, stills, allStills } from "@/components/directions/shared";

export const metadata = { title: "B · Stage" };

/* Direction B, "Stage": a keynote. The house face (Allo) set big and centred, the Signature grain as the
   one hero stage, then one point per screen on white. Motion is presentational: a carousel that brings
   one piece forward at a time, callouts that point at what makes it feel native, numbers that count. */

const HERO = ["SwipeDeck", "ScrubChart", "WalletStack", "TimerDial", "ReactionToggle", "PictureHeadline", "AmountField", "QRCode", "StatusTimeline"];

function Nav() {
  return (
    <header className="relative z-20 flex items-center justify-between px-5 pt-5 sm:px-8">
      <a href="/directions/b" className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.03em] text-[#fff]">
        <LogoMark className="size-[24px]" /> SwiftPieces
      </a>
      <nav className="dx-b-glass absolute left-1/2 flex -translate-x-1/2 gap-1 p-1 max-md:hidden">
        {NAV.map((n) => <a key={n.href} href={n.href} className="dx-b-navlink">{n.label}</a>)}
      </nav>
      <div className="flex items-center gap-2">
        <a href="https://github.com/Saivion/SwiftPieces" className="dx-b-glass dx-b-pill max-sm:hidden">★ 320</a>
        <a href={pro.home} className="dx-b-pill bg-[#fff] text-[#1a0806]">Get Pro</a>
      </div>
    </header>
  );
}

function Head({ k, t, rest }: { k: string; t: string; rest: string }) {
  return (
    <div className="mx-auto max-w-[760px] text-center">
      <p className="text-[14px] font-medium text-[#f2361c]">{k}</p>
      <h2 className="dx-b-h2 mt-3">{t}</h2>
      <p className="mx-auto mt-4 max-w-[520px] text-[18px] leading-[28px] text-[#6b6b68]">{rest}</p>
    </div>
  );
}

export default function DirectionB() {
  const hero = stills(HERO);
  const leads = categoryLeads();
  const all = allStills();
  const shelf = leads.slice(0, 7).map((c) => ({ title: c.title, items: [c.lead, ...all.filter((s) => s.category === c.title && s.name !== c.lead.name)].slice(0, 3) }));
  const [deck, dial, agent] = stills(["SwipeDeck", "TimerDial", "ActivityHeatmap"]);

  return (
    <div className="dx-b">
      {/* Hero on the Signature grain */}
      <div className="p-2">
        <section className="relative isolate overflow-hidden rounded-[34px] pb-16 text-[#fff]">
          <EmberStage seed="dx-b-hero" core="centre" />
          <Nav />
          <div className="mx-auto max-w-[900px] px-5 pt-20 text-center sm:pt-24">
            <p className="dx-b-glass mx-auto inline-flex items-center gap-2 px-3 py-1 text-[13px]">
              <span className="size-1.5 rounded-full bg-[#fff]" /> {count} free SwiftUI components
            </p>
            <h1 className="dx-b-h1 mt-6">Every piece of your app,<br className="max-sm:hidden" /> already built.</h1>
            <p className="mx-auto mt-5 max-w-[540px] text-[18px] leading-[28px] text-[#fff]/85">
              The motion, haptics, states and accessibility done, one Swift file each. Copy it, run one command, or ask your agent.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              <a href="/components" className="dx-b-pill h-12 bg-[#fff] px-6 text-[15px] text-[#1a0806]">Browse components</a>
              <a href="/docs/installation" className="dx-b-glass dx-b-pill h-12 px-6 text-[15px]">Install the CLI</a>
            </div>
          </div>
          <Carousel
            ms={3200}
            className="mt-16 h-[470px] sm:h-[480px]"
            panels={hero.map((s) => (
              <div key={s.name} className="dx-b-card w-[min(78vw,520px)]">
                <Live s={s} className="rounded-[22px]" />
              </div>
            ))}
            captions={hero.map((s) => (
              <span key={s.name} className="dx-b-glass inline-flex items-center gap-2 px-4 py-1.5 text-[14px]">
                {s.title} <span className="opacity-70">· {s.category}</span>
              </span>
            ))}
          />
        </section>
      </div>

      {/* Numbers */}
      <section className="mx-auto grid max-w-[1100px] grid-cols-2 gap-y-10 px-5 py-24 text-center md:grid-cols-4">
        {[
          { n: count, l: "pieces, free" },
          { n: leads.length, l: "categories" },
          { n: 1, l: "Swift file each" },
          { n: 0, l: "dependencies" },
        ].map((x) => (
          <div key={x.l}>
            <CountUp to={x.n} className="dx-b-num" />
            <p className="mt-1 text-[15px] text-[#6b6b68]">{x.l}</p>
          </div>
        ))}
      </section>

      {/* Native */}
      <section className="px-2 py-16 sm:px-5">
        <Head k="Native" t="Feels like Apple made it." rest="Springs that start from your finger, a haptic on the right beat, VoiceOver and Dynamic Type already done." />
        <div className="dx-b-white relative mx-auto mt-12 grid h-[560px] max-w-[1180px] place-items-center overflow-hidden">
          <Steps ms={[900, 1100, 1100, 2800]} className="dx-b-callouts relative w-[min(86vw,460px)]">
            <div className="dx-b-card"><Live s={deck} className="rounded-[22px]" /></div>
            <span className="dx-b-call s1" style={{ left: "-46%", top: "18%" }}>Follows your finger<i /></span>
            <span className="dx-b-call dx-b-call-r s2" style={{ right: "-48%", top: "42%" }}><i />Haptic at the threshold</span>
            <span className="dx-b-call s3" style={{ left: "-40%", top: "72%" }}>Flick to throw it away<i /></span>
          </Steps>
        </div>
      </section>

      {/* CLI */}
      <section className="px-2 py-16 sm:px-5">
        <Head k="Install" t="One command. One file." rest="Run it in the folder with your .xcodeproj. The piece lands in your target, ready to edit. Nothing to update, nothing to wrap." />
        <div className="dx-b-white mx-auto mt-12 grid max-w-[1180px] items-center gap-10 p-8 sm:p-14 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="dx-b-cmd"><span className="text-[#f2361c]">$</span> <Typed text="npx swiftpieces add TimerDial" speed={55} /></p>
            <Steps ms={[1800, 700, 700, 3000]} className="mt-6 space-y-2">
              <p className="dx-b-file s1">TimerDial.swift <span>612 lines</span></p>
              <p className="dx-b-file s2">Added to target Brew <span>iOS 17+</span></p>
              <p className="dx-b-file s3">Dependencies <span>none</span></p>
            </Steps>
          </div>
          <div className="dx-b-card mx-auto w-full max-w-[420px]"><Live s={dial} className="rounded-[22px]" /></div>
        </div>
      </section>

      {/* Agent */}
      <section className="px-2 py-16 sm:px-5">
        <Head k="Agents" t="Your agent knows every piece." rest="Claude Code, Cursor and Xcode read the whole library through the MCP server, then add the right piece with your data in it." />
        <div className="dx-b-white mx-auto mt-12 max-w-[1180px] p-6 sm:p-14">
          <Steps ms={[900, 1200, 1200, 3200]} className="mx-auto flex max-w-[640px] flex-col gap-3">
            <p className="dx-b-bubble self-end bg-[#111] text-[#fff]">Add a streak calendar to the profile, red like the app icon.</p>
            <p className="dx-b-tool s1">search_pieces “streak” → ActivityHeatmap</p>
            <p className="dx-b-tool s2">add_piece ActivityHeatmap → ProfileView.swift</p>
            <div className="dx-b-card mt-2 w-full"><Live s={agent} className="rounded-[22px]" /></div>
          </Steps>
        </div>
      </section>

      {/* Library */}
      <section className="py-16">
        <Head k="Library" t="Every kind of piece." rest={`${count} pieces across ${leads.length} categories, each running live with its source one tap away.`} />
        <Tabs
          ms={4200}
          className="mx-auto mt-10 max-w-[1240px] px-4"
          tabClass="dx-b-tab"
          labels={shelf.map((s) => s.title)}
          panels={shelf.map((s) => (
            <div key={s.title} className="mt-8 grid gap-4 md:grid-cols-3">
              {s.items.map((p) => (
                <a key={p.name} href={p.href} className="block">
                  <div className="dx-b-card"><Live s={p} className="rounded-[22px]" /></div>
                  <p className="mt-3 text-center text-[15px]">{p.title}</p>
                </a>
              ))}
            </div>
          ))}
        />
      </section>

      {/* Pro and Games */}
      <section className="mx-auto grid max-w-[1240px] gap-4 px-2 py-16 sm:px-5 md:grid-cols-2">
        {[
          { t: "Building an app?", d: `SwiftPieces Pro: ${proCatalog.screens} screens, ${proCatalog.flows.total} flows and ${proCatalog.templates} app templates on one design system.`, src: "/pro-screens/wallet-stack", href: pro.library, l: "Explore Pro", ember: true },
          { t: "Building a game?", d: `SwiftPieces Games: ${proGames.list.length} finished games in SwiftUI and Metal to make your own.`, src: "/pro-games/play/drift", href: pro.games, l: "See the games", ember: false },
        ].map((x) => (
          <a key={x.t} href={x.href} className={x.ember ? "relative isolate overflow-hidden rounded-[34px] p-10 text-center text-[#fff]" : "dx-b-white overflow-hidden p-10 text-center"}>
            {x.ember ? <EmberStage seed="dx-b-pro" core="centre" /> : null}
            <h3 className="text-[34px] leading-[1.1] font-medium tracking-[-0.035em]">{x.t}</h3>
            <p className={x.ember ? "mx-auto mt-3 max-w-[380px] text-[16px] text-[#fff]/85" : "mx-auto mt-3 max-w-[380px] text-[16px] text-[#6b6b68]"}>{x.d}</p>
            <span className="mt-5 inline-block text-[15px] font-semibold">{x.l} →</span>
            <div className="mx-auto mt-10 -mb-24 h-[440px] w-[204px] overflow-hidden rounded-[30px] bg-[#0b0b0b] p-[5px] shadow-[0_40px_70px_-28px_rgb(0_0_0/0.6)]">
              <div className="size-full overflow-hidden rounded-[25px]"><Loop src={`${x.src}.mp4`} poster={`${x.src}.webp`} label={x.t} /></div>
            </div>
          </a>
        ))}
      </section>

      {/* Questions */}
      <section className="mx-auto max-w-[760px] px-5 py-20">
        <h2 className="dx-b-h2 text-center">Questions.</h2>
        <div className="mt-10 space-y-2">
          {faqs.map((f) => (
            <details key={f.q} className="dx-b-white group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
                {f.q}<span className="text-[22px] text-[#8b8b85] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-[24px] text-[#6b6b68]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Close */}
      <div className="p-2">
        <section className="relative isolate overflow-hidden rounded-[34px] px-5 pt-24 pb-28 text-center text-[#fff]">
          <EmberStage seed="dx-b-close" core="centre" />
          <h2 className="dx-b-h1 text-[clamp(40px,6vw,76px)]">Start with a piece.</h2>
          <p className="mx-auto mt-4 max-w-[420px] text-[18px] text-[#fff]/85">Spend the week on your idea, not on rebuilding another picker.</p>
          <a href="/components" className="dx-b-pill mt-8 h-12 bg-[#fff] px-6 text-[15px] text-[#1a0806]">Browse components</a>
        </section>
      </div>
      <footer className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-8 px-5 py-14 text-[14px] text-[#6b6b68]">
        <p className="flex items-center gap-2 font-semibold text-[#111]"><LogoMark className="size-[20px]" /> SwiftPieces</p>
        {FOOT.map((c) => (
          <div key={c.h}><p className="text-[#111]">{c.h}</p><ul className="mt-2 space-y-1">{c.l.map((l) => <li key={l}>{l}</li>)}</ul></div>
        ))}
      </footer>
    </div>
  );
}
