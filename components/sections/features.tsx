import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { FeatureRow, Panel, Floating, ListRow } from "@/components/sections/feature-row";
import { PieceCarousel } from "@/components/sections/piece-carousel";
import { AgentDemo } from "@/components/sections/agent-demo";

/**
 * Everything between the ticker and the questions: three rows, each one thing Swift Pieces does,
 * each shown rather than described. The visuals use the real web previews, the CLI's real
 * output and the MCP server's real tool names, so nothing on the page is a mock of a feature
 * that does not exist.
 */
export function Features() {
  return (
    // Full-width clip: the visuals' glow reaches past the container, never past the viewport.
    // Top clearance so the first row's raised floating card never reaches up into the hero art.
    <div className="overflow-x-clip">
    <Container className="pt-10 sm:pt-16">
      <FeatureRow
        tags={[{ label: "Gestures", icon: <I.hand /> }, { label: "Motion", icon: <I.spark /> }, { label: "Haptics", icon: <I.wave /> }, { label: "Glass", icon: <I.layers /> }]}
        title="Interactions that feel native"
        body="Swipe decks, glass menus, floating docks and scrubbable charts, with the motion, haptics and states already done."
        cta={{ label: "Browse components", href: "/components" }}
      >
        <PiecesVisual />
      </FeatureRow>

      <FeatureRow
        tags={[{ label: "CLI", icon: <I.terminal /> }, { label: "Xcode 16", icon: <I.hammer /> }, { label: "Copy and paste", icon: <I.copy /> }]}
        title="One command into Xcode"
        body="The CLI writes each piece into a SwiftPieces folder in your app. No packages, no project-file surgery."
        cta={{ label: "Read the CLI docs", href: "/docs/cli" }}
        reverse
      >
        <CliVisual />
      </FeatureRow>

      <FeatureRow
        tags={[{ label: "MCP", icon: <I.plug /> }, { label: "llms.txt", icon: <I.doc /> }, { label: "Registry", icon: <I.braces /> }]}
        title="Your agent knows every piece"
        body="Describe what you want in plain English. Claude Code, Cursor and Xcode find the right piece and install it."
        cta={{ label: "Connect your agent", href: "/docs/mcp" }}
      >
        <AgentVisual />
      </FeatureRow>
    </Container>
    </div>
  );
}

/* ---------- Visuals ---------- */

/** The flagship piece running live, with a second piece and the details it ships with. */
function PiecesVisual() {
  return (
    <div className="relative md:mb-14 md:ml-10">
      <Panel>
        {/* Previews scale with the stage's width, so the stage is held narrow and square: the top card
            has headroom to lift and swing without meeting the edge. No ground: the deck sits straight
            on the dashed frame. */}
        <div className="flex justify-center">
          <PreviewFrame tone="clear" aspect="aspect-square" className="w-full max-w-[400px] overflow-visible! rounded-none!">
            <PiecePreview name="SwipeDeck" />
          </PreviewFrame>
        </div>
      </Panel>
      <Floating className="hidden w-full md:-top-10 md:right-12 md:block md:w-[220px]">
        <PreviewFrame tone="clear" aspect="aspect-[4/3]" className="m-2 rounded-[4px]!">
          <PiecePreview name="ReactionToggle" />
        </PreviewFrame>
      </Floating>
      {/* Straight from SwipeDeck.swift: the spring, the two haptics and the accessibility work. */}
      <Floating className="w-full md:-bottom-14 md:-left-10 md:w-[300px]">
        <ListRow icon={<I.spark />} label="Spring" value="0.4s · 0.2 bounce" />
        <ListRow icon={<I.wave />} label="Haptics" value="selection · impact" />
        <ListRow icon={<I.eye />} label="Reduce Motion" value="respected" />
      </Floating>
    </div>
  );
}

/** Piece after piece, each installed with one command. */
function CliVisual() {
  return <PieceCarousel />;
}

/** The agent at work on a piece: a plain-English change, sent, applied to the running chart. */
function AgentVisual() {
  return <AgentDemo />;
}

/* ---------- Glyphs: 24px grid, 2px stroke, drawn to sit inside a 16px tile ---------- */

function G({ children, fill }: { children: ReactNode; fill?: boolean }) {
  return <svg viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

const I = {
  hand: () => <G><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12" /><path d="M14 10.5a1.5 1.5 0 0 1 3 0V12" /><path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4.3 15a1.6 1.6 0 0 1 2.6-1.8L8 14.5" /></G>,
  spark: () => <G fill><path d="M12 2c.4 4.8 2.2 7.6 8 10-5.8 2.4-7.6 5.2-8 10-.4-4.8-2.2-7.6-8-10 5.8-2.4 7.6-5.2 8-10Z" /></G>,
  wave: () => <G><path d="M3 12h2l2-6 4 12 4-12 2 6h4" /></G>,
  layers: () => <G><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></G>,
  terminal: () => <G><path d="m5 7 5 5-5 5" /><path d="M12 18h7" /></G>,
  hammer: () => <G><path d="m14 7-9.5 9.5a2.1 2.1 0 0 0 3 3L17 10" /><path d="M13 4h4l4 4-3 3-5-5V4Z" /></G>,
  copy: () => <G><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></G>,
  plug: () => <G><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" /><path d="M12 17v4" /></G>,
  doc: () => <G><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></G>,
  braces: () => <G><path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1" /><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1" /></G>,
  eye: () => <G><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></G>,
  folder: () => <G fill><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6l2 2.5h7.4A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z" /></G>,
  swift: () => <G fill><path d="M20.5 15.6c.1-.3 1.3-4.5-3-9.1 0 0 1.5 3.6-.4 6.5 0 0-4.6-3-8.8-7.6 0 0 3.2 4.2 5.3 6.2 0 0-5.1-3-9.1-7.3 0 0 3.6 5.8 8.6 9.6-3.4 1.6-7.4.3-9.4-1 1.8 2.5 5.4 5.4 10 5.4 3.8 0 5.5-2 6.9-1.1.9.6 1.2 1.6 1.2 1.6s.6-1.5-1.3-3.2Z" /></G>,
};
