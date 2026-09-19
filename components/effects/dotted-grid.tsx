import { cn } from "@/lib/cn";

/** Subtle dot canvas. Place inside a `relative` parent; it fills and sits behind content. */
export function DottedGrid({ className, fade = true }: { className?: string; fade?: boolean }) {
  return <div aria-hidden className={cn("dots pointer-events-none absolute inset-0 -z-10", fade && "dots-fade", className)} />;
}
