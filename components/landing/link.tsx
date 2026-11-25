import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** A small text link with an arrow that nudges: the one action a section offers. */
export function MoreLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const cls = cn("group inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground", className);
  const inner = <>{children} <Arrow className="size-3.5" /></>;
  return href.startsWith("http") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}
