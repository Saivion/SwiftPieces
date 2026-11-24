import { ProMark } from "@/components/ui/pro-mark";
import { cn } from "@/lib/cn";

/**
 * The Pro badge (2026-11-24): a die-cut sticker chip, the Pro mark and the word on the white pearl pill,
 * with a white die-cut edge and a small tilt, as if slapped on. The pearl keeps the Signature grain's
 * clouds and wine type. Styles: `.pro-badge` in app/globals.css, kept identical to Pro's. `size="sm"`
 * sits beside a title at the New and Beta badges' height. `tone="games"` wears the Games colourway
 * (`.games-badge`, Iris) on the same pearl, kept identical to Pro's.
 */
export function ProBadge({ label = "Pro", size = "md", tone = "pro", className }: { label?: string; size?: "sm" | "md"; tone?: "pro" | "games"; className?: string }) {
  return (
    <span className={cn("pro-badge inline-flex shrink-0 items-center rounded-full leading-none font-semibold", size === "sm" ? "h-5 gap-1 pr-2 pl-1 text-[11px]" : "h-[26px] gap-[5px] pr-2.5 pl-[5px] text-[12.5px]", tone === "games" && "games-badge", className)}>
      <ProMark tone={tone} className={size === "sm" ? "size-[13px]" : "size-4"} />
      {label}
    </span>
  );
}
