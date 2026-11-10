import Link from "next/link";
import { Arrow } from "@/components/ui/button";
import { NewBadge } from "@/components/ui/new-badge";
import { EmberStage } from "@/components/visual/ember-stage";
import { cn } from "@/lib/cn";

/**
 * A header's ways onward as stacked tiles (Graphite): a title, one quiet line and an arrow, each tile
 * its own link that lifts to the raised surface on hover. `tone: "ember"` stands a tile on the Signature
 * grain (the pricing card's ground), white type over it, for the one way onward into Pro.
 */
export function LinkCells({ links, className }: { links: ReadonlyArray<{ title: string; body: string; href: string; badge?: "New" | "Beta"; tone?: "ember"; seed?: string }>; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {links.map((l) => {
        const ember = l.tone === "ember";
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              className={cn(
                "group flex items-center gap-4 rounded-[20px] px-5 py-4 no-underline transition-colors duration-200 sm:px-6",
                ember ? "relative isolate overflow-hidden text-[#fff] [text-shadow:0_1px_8px_rgb(0_0_0/0.22)]" : "bg-surface hover:bg-surface-3",
              )}
            >
              {ember ? <EmberStage seed={l.seed ?? `link-${l.href}`} core="column" eager /> : null}
              <span className="min-w-0 flex-1">
                <span className={cn("flex items-center gap-2 text-[14.5px] font-medium", ember ? "text-[#fff]" : "text-foreground")}>
                  {l.title}
                  {l.badge ? <NewBadge>{l.badge}</NewBadge> : null}
                </span>
                <span className={cn("mt-1 block text-[13px] leading-relaxed", ember ? "text-[#fff]/85" : "text-muted")}>{l.body}</span>
              </span>
              <span
                className={cn(
                  "grid size-9 flex-none place-items-center rounded-full border",
                  ember ? "border-[#fff]/45 bg-[#fff]/10 text-[#fff] transition-colors duration-200 group-hover:bg-[#fff]/20" : "border-[var(--line-strong)] text-foreground",
                )}
              >
                <Arrow />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
