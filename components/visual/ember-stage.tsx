import { GrainStage } from "@/components/visual/grain-stage";
import { cn } from "@/lib/cn";

/**
 * The ember ground of SwiftPieces Pro's pricing card: the Signature grain's deep half, wine to red to
 * orange. The field is drawn about two and a half times as tall and flipped, so only its deep end
 * shows and white type always holds (.ember-stage in globals.css). Fills its positioned parent, under
 * the content; pass a seed so no two ember stages match. Ported from SwiftPiecesPro
 * (components/previews/ember-stage.tsx).
 */
export function EmberStage({ seed, eager, className }: { seed: string; eager?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("ember-stage", className)}>
      <div><GrainStage seed={seed} kind="brand" eager={eager} /></div>
    </div>
  );
}
