import { cn } from "@/lib/cn";

/**
 * Small pink pill for something that just launched: the Sponsor nav link and pieces shipped in the
 * last 30 days. Solid Pro pink (`--pro-pink`) with dark ink, kept apart from the red accent. The
 * 5px corner is Get Pro's 10px at half the height, so the two read as the same shape.
 */
export function NewBadge({ className, children = "New" }: { className?: string; children?: string }) {
  return (
    <span className={cn("inline-flex h-[18px] shrink-0 items-center rounded-[5px] bg-[#ff8fb8] px-1.5 text-[10px] leading-none font-semibold text-[#2a0714]", className)}>
      {children}
    </span>
  );
}
