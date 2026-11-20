import type { CSSProperties, ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { GrainStage } from "@/components/visual/grain-stage";
import { MoreLink } from "@/components/landing/link";
import { Live } from "@/components/landing/live";
import { Seq } from "@/components/landing/cycle";
import { still } from "@/components/landing/stills";
import { gap, ground, heading, small } from "@/components/landing/type";
import type { GrainKind } from "@/lib/grain";
import { cn } from "@/lib/cn";

/**
 * One point, made by its visual. The copy sits in a narrow column (a heading whose second half is
 * muted, one link, sometimes a short list); the visual stands on its own grain stage, inset in the card.
 * `flip` puts the stage on the left, so the three points read right, left, right. Stacked on phones,
 * copy first.
 */
export function Feature({ title, rest, link, notes, kind, motif, seed, flip, paper, children }: {
  title: string;
  rest: string;
  link: { label: string; href: string };
  notes?: readonly { t: string; d: string }[];
  kind: GrainKind;
  /** The stage's line motif, so each point has its own pattern on the same red. */
  motif?: GrainKind;
  seed: string;
  flip?: boolean;
  /** A white stage instead of the red grain. */
  paper?: boolean;
  children: ReactNode;
}) {
  return (
    <Reveal className={cn(ground, "grid gap-1.5 overflow-hidden p-1.5 lg:grid-cols-2")}>
      <div className={cn("flex flex-col p-5 sm:p-7 lg:p-9", flip && "lg:order-2")}>
        <h3 className={heading}>
          {title} <span className="text-muted">{rest}</span>
        </h3>
        <MoreLink href={link.href} className="mt-5">{link.label}</MoreLink>
        {notes ? (
          <ol className="mt-8 flex flex-col gap-3.5 lg:mt-auto lg:pt-8">
            {notes.map((n, i) => (
              <li key={n.t} className="flex gap-3">
                <span aria-hidden className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[10.5px] font-medium text-background tabular-nums">{i + 1}</span>
                <span className={small}><span className="text-foreground">{n.t}</span>, {n.d}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
      <div className={cn("relative isolate min-h-[340px] overflow-hidden rounded-[19px] sm:min-h-[460px]", paper && "bg-surface-2 ring-1 ring-[var(--line)]")}>
        {paper ? null : <GrainStage seed={seed} kind={kind} motif={motif} className="-z-10" />}
        {children}
      </div>
    </Reveal>
  );
}

const native = [
  { t: "Follows your finger", d: "and swings from where you grabbed it" },
  { t: "Settles on a spring", d: "the same tuned springs in every piece" },
  { t: "A haptic on each swipe", d: "lift as it leaves, settle as the next lands" },
  { t: "VoiceOver actions", d: "like and skip, named and reachable" },
];

/** The three things the library does, each shown on its own stage, alternating sides. */
export function Features() {
  return (
    <Container className={cn(gap, "flex flex-col gap-4")}>
      <Feature
        title="Pieces that feel native."
        rest="Gestures, springs, haptics and Dynamic Type are done before the file reaches Xcode."
        link={{ label: "See how a piece is built", href: "/docs/introduction" }}
        notes={native}
        kind="brand"
        motif="template"
        seed="feature-native"
      >
        <Annotated />
      </Feature>
      <Feature
        title="One command into Xcode."
        rest="The CLI writes the Swift file into your project. No package to add, no project settings to touch."
        link={{ label: "Read the CLI docs", href: "/docs/cli" }}
        kind="brand"
        motif="flow"
        seed="feature-cli"
        flip
      >
        <Terminal />
      </Feature>
      <Feature
        title="Your agent knows every piece."
        rest="Ask in plain words. Claude Code, Cursor and Xcode find the right piece over MCP and install it."
        link={{ label: "Connect your agent", href: "/docs/mcp" }}
        kind="brand"
        motif="kit"
        seed="feature-agent"
      >
        <AgentEditor />
      </Feature>
    </Container>
  );
}

/* ---------- Visuals ---------- */

const swift = <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden><path d="M20.5 15.6c.1-.3 1.3-4.5-3-9.1 0 0 1.5 3.6-.4 6.5 0 0-4.6-3-8.8-7.6 0 0 3.2 4.2 5.3 6.2 0 0-5.1-3-9.1-7.3 0 0 3.6 5.8 8.6 9.6-3.4 1.6-7.4.3-9.4-1 1.8 2.5 5.4 5.4 10 5.4 3.8 0 5.5-2 6.9-1.1.9.6 1.2 1.6 1.2 1.6s.6-1.5-1.3-3.2Z" /></svg>;
const SwiftIcon = () => <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-[#f05138] text-[rgb(255_255_255)]">{swift}</span>;

const CMD = "npx swiftpieces add SwipeDeck";
const ASK = "Add a chart I can scrub with my thumb";

/** The piece playing large on the red, its four promises lighting up in turn around it. */
function Annotated() {
  const s = still("SwipeDeck")!;
  const tags = [
    { t: "Follows your finger", x: "-4%", y: "16%", left: true },
    { t: "Settles on a spring", x: "-4%", y: "66%", left: true },
    { t: "Haptic on each swipe", x: "104%", y: "30%", left: false },
    { t: "VoiceOver actions", x: "104%", y: "80%", left: false },
  ];
  return (
    <div className="absolute inset-0 grid place-items-center p-6 sm:p-10">
      <div className="relative w-[64%] sm:w-[50%]">
        <div className="rounded-[22px] bg-surface-2/80 p-1.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.5)] backdrop-blur"><Live s={s} className="rounded-[17px]" /></div>
        {tags.map((g, i) => (
          <span key={g.t} aria-hidden className={cn("feature-tag absolute hidden -translate-y-1/2 items-center gap-2 rounded-[11px] bg-[rgb(255_255_255/0.92)] px-2.5 py-1.5 text-[11.5px] whitespace-nowrap text-[rgb(17_17_17)] shadow-[0_10px_24px_-12px_rgb(0_0_0/0.5)] sm:flex", g.left && "-translate-x-full")} style={{ left: g.x, top: g.y, animationDelay: `${i * 1.5}s` }}>
            <span className="grid size-4 place-items-center rounded-full bg-[rgb(17_17_17)] text-[9.5px] text-[rgb(255_255_255)]">{i + 1}</span>{g.t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Centred on the red: the ask set large as it is typed, the two MCP calls, then the chart playing in its slot. */
function AgentEditor() {
  const s = still("ScrubChart")!;
  const chip = "rounded-[8px] bg-[rgb(255_255_255/0.16)] px-2 py-0.5 ring-1 ring-[rgb(255_255_255/0.28)] backdrop-blur";
  return (
    <Seq ms={[600, 2200, 900, 5600]} className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center sm:p-10">
      <p className="text-[20px] leading-[1.2] tracking-[-0.02em] text-[rgb(255_255_255)] sm:text-[26px]"><span className="type" style={{ "--ch": ASK.length } as CSSProperties}>{ASK}</span></p>
      <div className="s2 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-[rgb(255_255_255/0.85)]">
        <span className={chip}>search_pieces</span>→<span className={chip}>add_piece ScrubChart</span><span>✓</span>
      </div>
      <div className="relative w-[86%] max-w-[400px]">
        <div className="slot absolute inset-0 grid place-items-center rounded-[22px] border-[1.5px] border-dashed border-[rgb(255_255_255/0.5)] font-mono text-[11px] text-[rgb(255_255_255/0.8)]">SpendingView</div>
        <div className="s3 pop relative rounded-[22px] bg-surface-2/80 p-1.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.5)] backdrop-blur"><Live s={s} className="rounded-[17px]" /></div>
      </div>
    </Seq>
  );
}

const K = ({ children }: { children: ReactNode }) => <span className="text-[#c2337a] dark:text-[#ff7ab2]">{children}</span>;
const T = ({ children }: { children: ReactNode }) => <span className="text-[#2f7f8c] dark:text-[#7fd3e0]">{children}</span>;
const C = ({ children }: { children: ReactNode }) => <span className="text-subtle">{children}</span>;
const CODE: ReactNode[] = [
  <><K>import</K> SwiftUI</>,
  "",
  <><C>// Follows your finger, swings on a spring.</C></>,
  <><K>public struct</K> <T>SwipeDeck</T>&lt;Item, Card: <T>View</T>&gt;: <T>View</T> {"{"}</>,
  <>    <K>@State private var</K> translation: <T>CGSize</T> = .zero</>,
  <>    <K>@State private var</K> throwTick = 0</>,
  "",
  <>    <K>public var</K> body: <K>some</K> <T>View</T> {"{"}</>,
  <>        <T>ZStack</T> {"{"} cards {"}"}</>,
  <>            .gesture(drag)</>,
  <>            .sensoryFeedback(.impact, trigger: throwTick)</>,
  <>    {"}"}</>,
  <>{"}"}</>,
];
function Code({ from = 0, className }: { from?: number; className?: string }) {
  return (
    <pre className={cn("font-mono text-[10px] leading-[19px] whitespace-pre text-foreground sm:text-[10.5px]", className)}>
      {CODE.map((l, i) => <span key={i} className="ln block" style={{ "--i": i + from } as CSSProperties}><span className="mr-3 inline-block w-4 text-right text-[var(--line-strong)] select-none">{i + 1}</span>{l}</span>)}
    </pre>
  );
}
const Pill = ({ big }: { big?: boolean }) => (
  <div className={cn("inline-flex items-center gap-2 rounded-[14px] bg-[rgb(17_17_17)] font-mono text-[rgb(255_255_255)] shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)]", big ? "px-4 py-3 text-[12px] sm:text-[14px]" : "px-3 py-2 text-[11px] sm:text-[12px]")}>
    <span className="text-[rgb(255_255_255/0.45)]">$</span><span className="type" style={{ "--ch": CMD.length } as CSSProperties}>{CMD}</span><span className="s2 text-[#4cd69a]">✓</span>
  </div>
);

/** The command and what it makes: a big command pill; the Swift file drops out of it, then the piece it draws lands beside it. No window. */
function Terminal() {
  const s = still("SwipeDeck")!;
  return (
    <Seq ms={[700, 1900, 700, 1000, 6000]} className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-5 sm:p-8">
      <Pill big />
      <div className="relative flex w-full max-w-[560px] items-center justify-center">
        <div className="s3 pop w-[66%] -rotate-[2.5deg] overflow-hidden rounded-[16px] bg-surface-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.5)] ring-1 ring-[var(--line)]">
          <div className="flex items-center gap-1.5 border-b border-[var(--line)] px-3 py-2 text-[11px] text-muted"><SwiftIcon /> <span className="text-foreground">SwipeDeck.swift</span><span className="ml-auto text-subtle">MyApp</span></div>
          <Code className="code-x p-3" />
        </div>
        <div className="s4 pop -ml-[12%] w-[40%] translate-y-6 rotate-[3deg] rounded-[20px] bg-surface-2/85 p-1.5 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.55)] backdrop-blur"><Live s={s} className="rounded-[15px]" /></div>
      </div>
    </Seq>
  );
}
