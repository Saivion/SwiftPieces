import { cn } from "@/lib/cn";

/**
 * What a page or section is, as one outlined pill above its heading (Graphite): the same pill as the
 * landing's tags (feature-row.tsx `Tags`), so a page head and a landing section open the same way.
 */
export function SectionLabel({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-[26px] w-fit items-center rounded-full border border-[var(--line-strong)] px-2.5 text-[12.5px] text-muted", className)}>
      {children}
    </span>
  );
}
