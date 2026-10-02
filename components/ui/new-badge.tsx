import { cn } from "@/lib/cn";

/**
 * Small pill for something that just launched (pieces shipped in the last 30 days, the Library's
 * New count) or is still in Beta. The 5px corner is Get Pro's 10px at half the height, so the two
 * read as the same shape.
 */
/**
 * Badge colours by label, one treatment for both: the label in its colour on the same colour at low
 * opacity. New is Pro pink (`--new`, deeper in light mode), Beta is #00a6fb (`--beta`).
 */
const tones: Record<string, string> = {
  New: "bg-[color-mix(in_srgb,var(--new)_15%,transparent)] text-[var(--new)]",
  Beta: "bg-[color-mix(in_srgb,var(--beta)_15%,transparent)] text-[var(--beta)]",
};

export function NewBadge({ className, children = "New" }: { className?: string; children?: string }) {
  return (
    <span className={cn("inline-flex h-[18px] shrink-0 items-center rounded-[5px] px-1.5 text-[10px] leading-none font-semibold", tones[children] ?? tones.New, className)}>
      {children}
    </span>
  );
}
