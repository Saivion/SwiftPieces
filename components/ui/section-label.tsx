import { cn } from "@/lib/cn";

export function SectionLabel({ children, className }: { children: string; className?: string }) {
  return <span className={cn("t-meta text-muted", className)}>{children}</span>;
}
