import { GrainStage } from "@/components/visual/grain-stage";
import { EMBER_CORES, type EmberCore } from "@/lib/grain";
import type { GrainStill } from "@/lib/plan-cover";
import { cn } from "@/lib/cn";

/**
 * The ember ground, as on SwiftPieces Pro (components/previews/ember-stage.tsx): the Signature grain, a
 * radial ember from a pink edge through orange and red to a wine core, white type over the core. Fills
 * its positioned parent, under the content. `core` places the wine core per surface (EMBER_CORES);
 * `still` shows a pre-painted copy at once (the pricing card, lib/plan-cover.ts); `eager` paints a
 * small stage that is on screen from the start before the first frame (GrainStage).
 */
export function EmberStage({ seed, core = "copy", still, eager, className }: { seed: string; core?: EmberCore; still?: GrainStill; eager?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("ember-stage", className)}>
      <GrainStage seed={seed} kind="brand" core={EMBER_CORES[core]} still={still} eager={eager} />
    </div>
  );
}
