import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { GrainStage } from "@/components/visual/grain-stage";
import { MoreLink } from "@/components/landing/link";
import { Still, Tile } from "@/components/landing/wall";
import { still } from "@/components/landing/stills";
import { gap, ground, heading, raised, small } from "@/components/landing/type";
import type { GrainKind } from "@/lib/grain";
import { cn } from "@/lib/cn";

/**
 * One point, made by its visual. The copy sits in a narrow column (a heading whose second half is
 * muted, one link, sometimes a short list); the visual stands on its own grain stage, inset in the card.
 * `flip` puts the stage on the left, so the three points read right, left, right. Stacked on phones,
 * copy first.
 */
export function Feature({ title, rest, link, notes, kind, seed, flip, children }: {
  title: string;
  rest: string;
  link: { label: string; href: string };
  notes?: readonly { t: string; d: string }[];
  kind: GrainKind;
  seed: string;
  flip?: boolean;
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
      <div className="relative isolate min-h-[340px] overflow-hidden rounded-[19px] sm:min-h-[460px]">
        <GrainStage seed={seed} kind={kind} className="-z-10" />
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
        seed="feature-native"
      >
        <Annotated />
      </Feature>
      <Feature
        title="One command into Xcode."
        rest="The CLI writes the Swift file into your project. No package to add, no project settings to touch."
        link={{ label: "Read the CLI docs", href: "/docs/cli" }}
        kind="brand"
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

/** A window on the stage: three dots, a title, the body. */
function Window({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn(raised, "overflow-hidden rounded-[16px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.45)]", className)}>
      <div className="flex h-9 items-center border-b border-[var(--line)] px-3.5">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="size-[9px] rounded-full bg-[var(--line-strong)]" />)}</span>
        <span className="flex flex-1 items-center justify-center gap-1.5 text-[11.5px] text-subtle">{title}</span>
        <span className="w-8" />
      </div>
      {children}
    </div>
  );
}

/** The piece large and centred on its stage, with numbered pins on what it does for you (listed beside). */
function Annotated() {
  const s = still("SwipeDeck")!;
  const pins = [{ x: "36%", y: "26%" }, { x: "62%", y: "50%" }, { x: "40%", y: "78%" }, { x: "70%", y: "20%" }];
  return (
    <div className="absolute inset-0 grid place-items-center p-6 sm:p-10">
      <div className="relative w-full max-w-[460px]">
        <Tile s={s} className="shadow-[0_40px_80px_-30px_rgb(0_0_0/0.5)]" />
        {pins.map((p, i) => (
          <span key={i} aria-hidden className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgb(17_17_17)] text-[12px] font-medium text-[rgb(255_255_255)] shadow-[0_0_0_4px_rgb(255_255_255/0.75)]" style={{ left: p.x, top: p.y }}>{i + 1}</span>
        ))}
      </div>
    </div>
  );
}

/** The command in a terminal, and the file it wrote open beside it in Xcode's tab bar. */
function Terminal() {
  const s = still("SwipeDeck")!;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-10">
      <div className="relative w-full max-w-[540px]">
        <Window title="Terminal" className="w-[88%]">
          <pre className="px-4 py-4 font-mono text-[12px] leading-[22px] text-muted">
            <span className="text-subtle">$ </span><span className="text-foreground">npx swiftpieces add SwipeDeck</span>{"\n"}
            <span className="text-[#0f9d6b]">✓</span> Found MyApp.xcodeproj{"\n"}
            <span className="text-[#0f9d6b]">✓</span> Wrote SwipeDeck.swift to MyApp/Pieces{"\n"}
            <span className="text-[#0f9d6b]">✓</span> Added to target MyApp
          </pre>
        </Window>
        <Window title={<><SwiftIcon /> SwipeDeck.swift</>} className="relative -mt-2 ml-auto w-[62%]">
          <Still s={s} alt={false} className="aspect-[4/3] w-full object-cover" />
        </Window>
      </div>
    </div>
  );
}

/** The agent's change as a diff, the chat that asked for it, and the result over the corner. */
function AgentEditor() {
  const chart = still("ScrubChart")!;
  const diff = [
    { s: " ", t: "struct SpendingView: View {" },
    { s: " ", t: "  var body: some View {" },
    { s: " ", t: "    VStack(spacing: 16) {" },
    { s: "+", t: "      ScrubChart(series: [week])" },
    { s: "+", t: "        .frame(height: 220)" },
    { s: " ", t: "      TransactionsList(items)" },
    { s: " ", t: "    }" },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-10">
      <div className="relative w-full max-w-[600px] pb-10">
        <Window title={<><SwiftIcon /> SpendingView.swift</>}>
          <div className="grid sm:grid-cols-[1fr_200px]">
            <pre className="overflow-hidden py-4 font-mono text-[11.5px] leading-[21px]">
              {diff.map((d, i) => (
                <div key={i} className={cn("px-4 whitespace-pre", d.s === "+" && "bg-[#0f9d6b]/12 text-[#0b7a52] [html:not(.light)_&]:text-[#4fd6a3]")}><span className="mr-3 inline-block w-2 text-subtle">{d.s}</span>{d.t}</div>
              ))}
            </pre>
            <div className="hidden flex-col gap-2 border-l border-[var(--line)] p-3 sm:flex">
              <p className="ml-auto rounded-[12px] bg-surface px-3 py-2 text-[12px]">Add a chart I can scrub with my thumb</p>
              <p className="text-[11px] text-subtle">search_pieces → add_piece</p>
              <p className="text-[12px] text-foreground"><span className="text-[#0f9d6b]">✓</span> Added Scrub Chart</p>
            </div>
          </div>
        </Window>
        <div className="absolute right-[-12px] bottom-0 w-[44%] rotate-2 sm:right-[-24px]"><Tile s={chart} alt={false} tabIndex={-1} className="shadow-[0_30px_60px_-25px_rgb(0_0_0/0.5)]" /></div>
      </div>
    </div>
  );
}
