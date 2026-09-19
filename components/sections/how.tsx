import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal } from "@/components/effects/reveal";
import { Arrow } from "@/components/ui/button";
import { Cell, Divided } from "@/components/ui/panel";

const ways = [
  { t: "Copy the file", b: "Open a piece, take the Swift source, paste it into your target. A .metal file copied beside it compiles into your default library." },
  { t: "Run the CLI", b: "npx swiftpieces add writes into a SwiftPieces folder in your app's synchronized group. No project-file surgery." },
  { t: "Ask your agent", b: "The registry, llms.txt and the MCP server teach Claude Code, Cursor and Xcode which piece to use and how to install it." },
];

/**
 * The bridge between the free pieces and Pro: how a piece gets into your app, in three lines.
 * Four tiles on a 2×2 so the grid has a corner to land on; the fourth carries the section's action,
 * which is why the heading has none. The ways are alternatives, not steps, so each one after the first
 * opens with `or` instead of an index — numbering them read as a sequence you work through.
 */
export function How() {
  return (
    <section className="relative border-t border-[var(--line)] py-20 md:py-28">
      <Container>
        <SectionHeader label="Three ways in" title="However you work, it is one file." />
        <Reveal className="mt-14">
          <Divided cols="md:grid-cols-2">
            {ways.map((w, i) => (
              <Cell key={w.t} className="p-8 lg:p-10">
                <p className="flex items-baseline gap-2.5 text-balance">
                  {i > 0 ? <span className="p-item font-normal text-accent lowercase">or</span> : null}
                  <span className="p-item">{w.t}</span>
                </p>
                <p className="p-body mt-3 max-w-[34ch] text-[14px] leading-relaxed">{w.b}</p>
              </Cell>
            ))}
            <Cell className="group p-8 transition-colors duration-500 hover:bg-surface lg:p-10">
              <Link href="/docs/installation" className="flex h-full min-h-32 flex-col justify-between gap-8">
                <p className="p-item max-w-[18ch] text-balance">Every path, in the installation docs.</p>
                <span className="inline-flex items-center gap-2 self-start text-sm font-semibold text-foreground">
                  <span className="u-link">Installation docs</span>
                  <Arrow className="transition-transform duration-500 group-hover:translate-x-1" />
                </span>
              </Link>
            </Cell>
          </Divided>
        </Reveal>
      </Container>
    </section>
  );
}
