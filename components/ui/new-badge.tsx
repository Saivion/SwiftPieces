import { cn } from "@/lib/cn";

/**
 * Small pill for something that just launched (pieces shipped in the last 30 days, the Library's
 * New count) or is still in Beta. Graphite: a full pill, the label in its colour on the same colour
 * at 15%. New is Pro pink (`--new`, deeper in light mode), Beta is blue (`--beta`).
 */
const tones: Record<string, string> = {
  New: "bg-[color-mix(in_srgb,var(--new)_15%,transparent)] text-[var(--new)]",
  Beta: "bg-[color-mix(in_srgb,var(--beta)_15%,transparent)] text-[var(--beta)]",
};

/** `solid` fills New with its pink and dark ink, for a badge laid over a preview where the soft tint would get lost. */
const solid = "bg-[var(--new)] text-[#2a0714] shadow-[0_2px_8px_rgb(0_0_0/0.18)]";

export function NewBadge({ className, children = "New", solid: isSolid = false }: { className?: string; children?: string; solid?: boolean }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] leading-none font-semibold", isSolid ? solid : (tones[children] ?? tones.New), className)}>
      {children}
    </span>
  );
}
