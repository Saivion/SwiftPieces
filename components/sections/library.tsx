import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { getRegistryIndex } from "@/lib/registry";

/** Eight pieces that show the range: shader, gesture, depth, lists, feedback, card, data, ring. */
const FEATURED = ["AssistantOrb", "SwipeDeck", "DepthCarousel", "StatusTimeline", "ReactionToggle", "MotionCard", "ScrubChart", "RingBreakdown"];

/** The free library: what the site is for. Eight pieces, and one link to the rest. */
export function LibrarySection() {
  const items = getRegistryIndex();
  const picks = FEATURED.map((n) => items.find((i) => i.name === n)!).filter(Boolean);
  return (
    <section className="relative border-t border-[var(--line)] py-20 md:py-28">
      <Container>
        <SectionHeader
          label="The free library"
          title="Pieces you copy once and own."
          description="Every one is a designed interaction with its motion, haptics and states already done. One Swift file each, iOS 17 and up, MIT + Commons Clause."
          action={{ label: `All ${items.length} pieces`, href: "/components" }}
        />
        <div className="mt-14">
          <ShowcaseGrid items={picks} filters={false} />
        </div>
      </Container>
    </section>
  );
}
