import { cn } from "@/lib/cn";

/**
 * The Pro badge: the word in a pill with a 1px ring fading from the Pro palette's blue to its
 * orange over a faint wash of the two, as the Playground draws its Pro tag (.spp-pro-tag). No icon.
 * Styles: `.pro-badge` in app/globals.css, kept identical to Pro's. `size="sm"` sits beside a title
 * at the New and Beta badges' height.
 */
export function ProBadge({ label = "Pro", size = "md", className }: { label?: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span className={cn("pro-badge inline-flex shrink-0 items-center rounded-full leading-none font-semibold", size === "sm" ? "h-5 px-2 text-[11px]" : "h-[26px] px-2.5 text-[12.5px]", className)}>
      {label}
    </span>
  );
}
