import type { CSSProperties, ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { MoreLink } from "@/components/landing/link";
import { Still, Tile } from "@/components/landing/wall";
import { still, stills } from "@/components/landing/stills";
import { gap, ground, heading, raised } from "@/components/landing/type";
import { cn } from "@/lib/cn";

/**
 * One point, made by its visual. The copy sits in a narrow column on the left (a heading whose second
 * half is muted, one link); the visual takes the rest of the ground and runs off its edges.
 * Stacked on phones, copy first.
 */
export function Feature({ title, rest, link, children, className }: { title: string; rest: string; link: { label: string; href: string }; children: ReactNode; className?: string }) {
  return (
    <Reveal className={cn(ground, "grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]", className)}>
      <div className="flex flex-col p-6 sm:p-8 lg:p-10">
        <h3 className={heading}>
          {title} <span className="text-muted">{rest}</span>
        </h3>
        <MoreLink href={link.href} className="mt-5">{link.label}</MoreLink>
      </div>
      <div className="relative flex min-h-[360px] sm:min-h-[440px] [&>*]:w-full">{children}</div>
    </Reveal>
  );
}

/** The three things the library does, each shown, one after another. */
export function Features() {
  return (
    <Container className={cn(gap, "flex flex-col gap-4")}>
      <Feature
        title="Pieces that feel native."
        rest="Gestures, springs, haptics and Dynamic Type are done before the file reaches Xcode."
        link={{ label: "See how a piece is built", href: "/docs/introduction" }}
      >
        <Annotated />
      </Feature>
      <Feature
        title="One command into Xcode."
        rest="The CLI writes the Swift file into your project. No package to add, no project settings to touch."
        link={{ label: "Read the CLI docs", href: "/docs/cli" }}
      >
        <FileStack />
      </Feature>
      <Feature
        title="Your agent knows every piece."
        rest="Ask in plain words. Claude Code, Cursor and Xcode find the right piece over MCP and install it."
        link={{ label: "Connect your agent", href: "/docs/mcp" }}
      >
        <AgentEditor />
      </Feature>
    </Container>
  );
}

/* ---------- Visuals ---------- */

const swift = <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden><path d="M20.5 15.6c.1-.3 1.3-4.5-3-9.1 0 0 1.5 3.6-.4 6.5 0 0-4.6-3-8.8-7.6 0 0 3.2 4.2 5.3 6.2 0 0-5.1-3-9.1-7.3 0 0 3.6 5.8 8.6 9.6-3.4 1.6-7.4.3-9.4-1 1.8 2.5 5.4 5.4 10 5.4 3.8 0 5.5-2 6.9-1.1.9.6 1.2 1.6 1.2 1.6s.6-1.5-1.3-3.2Z" /></svg>;

/** One piece large, with numbered pins on what it does for you and the notes beside it. */
function Annotated() {
  const s = still("SwipeDeck")!;
  const pins = [
    { x: "36%", y: "26%", t: "Follows your finger", d: "and swings from where you grabbed it" },
    { x: "62%", y: "50%", t: "Settles on a spring", d: "the same tuned springs in every piece" },
    { x: "40%", y: "78%", t: "A haptic on each swipe", d: "lift as it leaves, settle as the next lands" },
    { x: "70%", y: "20%", t: "VoiceOver actions", d: "like and skip, named and reachable" },
  ];
  return (
    <div className="grid h-full content-center gap-6 px-6 pb-8 md:grid-cols-[1.4fr_1fr] md:px-10 md:py-8">
      <div className="relative">
        <Tile s={s} className="shadow-[0_30px_60px_-30px_rgb(0_0_0/0.35)]" />
        {pins.map((p, i) => (
          <span key={i} aria-hidden className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-foreground text-[12px] font-medium text-background shadow-[0_0_0_5px_rgb(255_255_255/0.6)]" style={{ left: p.x, top: p.y }}>{i + 1}</span>
        ))}
      </div>
      <ol className="flex flex-col justify-center gap-4">
        {pins.map((p, i) => (
          <li key={i} className="flex gap-3 text-[13px]">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-[11px] text-background">{i + 1}</span>
            <span><span className="text-foreground">{p.t}</span><br /><span className="text-muted">{p.d}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The files the CLI writes, as sheets laid back in a fan, each headed by the piece it draws. */
function FileStack() {
  const s = stills(["SwipeDeck", "ScrubChart", "CommitButton", "ReactionToggle", "TimerDial"]);
  return (
    <div className="relative h-full min-h-[420px] overflow-hidden">
      <code className={cn(raised, "absolute top-8 left-6 z-10 max-w-[calc(100%-48px)] truncate rounded-[12px] px-4 py-2.5 font-mono text-[12.5px] text-foreground md:left-10")}><span className="text-subtle">$ </span>npx swiftpieces add SwipeDeck</code>
      <div aria-hidden className="absolute top-24 left-1/2 flex gap-4" style={{ transform: "translateX(-30%) perspective(1800px) rotateX(38deg) rotateZ(-14deg)", transformOrigin: "50% 0" }}>
        {s.map((p, i) => (
          <div key={p.name} className={cn(raised, "w-[230px] shrink-0 overflow-hidden rounded-[16px]")} style={{ marginTop: i * 26 } as CSSProperties}>
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-[12px] text-foreground">
              <span className="grid size-5 place-items-center rounded-[5px] bg-[#f05138] text-[rgb(255_255_255)]">{swift}</span>
              {p.name}.swift
              {i === 0 ? <span className="ml-auto text-[11px] text-[var(--new)]">new</span> : null}
            </div>
            <Still s={p} alt={false} className="aspect-[4/3] w-full object-cover" />
            <div className="space-y-1.5 px-3 py-3">
              {[80, 64, 72, 40].map((w, j) => <span key={j} className="block h-[5px] rounded-full bg-[var(--line-strong)]" style={{ width: `${w}%` }} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The agent's change as a diff, the chat that asked for it, and the result floating over the corner. */
function AgentEditor() {
  const chart = still("ScrubChart")!;
  const diff = [
    { s: " ", t: "struct SpendingView: View {" },
    { s: " ", t: "    var body: some View {" },
    { s: " ", t: "        VStack(spacing: 16) {" },
    { s: "+", t: "            ScrubChart(series: [week], format: .currency)" },
    { s: "+", t: "                .frame(height: 220)" },
    { s: " ", t: "            TransactionsList(items)" },
    { s: " ", t: "        }" },
  ];
  return (
    <div className="relative h-full px-5 pt-2 sm:px-8 lg:pt-8">
      <div className={cn(raised, "overflow-hidden rounded-b-none border-b-0")}>
        <div className="flex h-9 items-center border-b border-[var(--line)] px-3.5">
          <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="size-[9px] rounded-full bg-[var(--line-strong)]" />)}</span>
          <span className="flex-1 text-center text-[11.5px] text-subtle">SpendingView.swift</span>
          <span className="w-8" />
        </div>
        <div className="grid min-h-[200px] md:min-h-[330px] md:grid-cols-[1fr_250px]">
          <pre className="overflow-hidden py-4 font-mono text-[12px] leading-[22px]">
            {diff.map((d, i) => (
              <div key={i} className={cn("px-4", d.s === "+" && "bg-[#0f9d6b]/10 text-[#0b7a52]")}><span className="mr-3 inline-block w-2 text-subtle">{d.s}</span>{d.t}</div>
            ))}
          </pre>
          <div className="hidden flex-col gap-2 border-l border-[var(--line)] p-3 md:flex">
            <p className="ml-auto max-w-[90%] rounded-[12px] bg-surface px-3 py-2 text-[12.5px]">Add a chart I can scrub with my thumb</p>
            <p className="text-[11.5px] text-subtle">search_pieces → add_piece ScrubChart</p>
            <p className="text-[12.5px] text-foreground"><span className="text-[#0f9d6b]">✓</span> Added Scrub Chart and wired it to your week.</p>
          </div>
        </div>
      </div>
      <div className="absolute right-8 -bottom-4 hidden w-[280px] rotate-2 md:block"><Tile s={chart} alt={false} tabIndex={-1} className="shadow-[0_30px_60px_-25px_rgb(0_0_0/0.4)]" /></div>
    </div>
  );
}
