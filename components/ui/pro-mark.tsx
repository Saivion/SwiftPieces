import { cn } from "@/lib/cn";

/**
 * The Pro mark (2026-11-24): a ring with a rounded bar standing inside it, filled with the badge's
 * colours as a slow conic sweep (`.pro-mark` in app/globals.css, the glyph is its mask). Sized by
 * font-size or a size-* class. `sticker` sets it on a white die-cut disc that lifts off the page, for
 * the big moments; plain, it is the icon that sits in a line or inside the Pro badge. `tone="games"`
 * wears the Games colourway. Server-safe, kept identical to Pro's components/layout/pro-mark.tsx.
 */
export function ProMark({ sticker, tone = "pro", className }: { sticker?: boolean; tone?: "pro" | "games"; className?: string }) {
  const mark = <span aria-hidden className={cn("pro-mark", tone === "games" && "games-mark", !sticker && className)} />;
  return sticker ? <span aria-hidden className={cn("pro-sticker", tone === "games" && "games-mark", className)}>{mark}</span> : mark;
}
