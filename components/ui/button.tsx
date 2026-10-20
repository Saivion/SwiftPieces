import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "dark";
type Size = "sm" | "md" | "lg";

// Graphite: every control is a pill. Primary is the ink pill (brand `.btn-solid`); red is never a button colour.
const base = "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-[-0.01em] select-none transition-[background-color,color,opacity,transform,border-color] duration-300 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:scale-[0.985]";
const variants: Record<Variant, string> = {
  primary: "btn-solid",
  // The soft pill: a panel with a hairline, for the second action beside a primary.
  secondary: "border border-[var(--line-strong)] bg-surface-2 text-foreground hover:bg-surface-3",
  ghost: "bg-surface text-foreground hover:bg-surface-3",
  outline: "border border-[var(--line-strong)] bg-transparent text-foreground hover:bg-surface",
  dark: "btn-dark",
};
const sizes: Record<Size, string> = { sm: "h-[38px] px-4 text-[13.5px]", md: "h-[46px] px-[22px] text-[15px]", lg: "h-12 px-6 text-[15px]" };

type Props = { variant?: Variant; size?: Size; href?: string; children: ReactNode; className?: string } & Omit<ComponentProps<"button">, "children">;

export function Button({ variant = "primary", size = "md", href, className, children, ...rest }: Props) {
  const cls = cn(base, variants[variant], sizes[size], className);
  const inner = <>{children}</>;
  if (href) return href.startsWith("http") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" className={cls} {...rest}>{inner}</button>;
}

/**
 * A forward arrow. It slides on its host's hover; with `motion` it plays the animated-icon nudge
 * instead (globals.css .ai-nudge), like the icons around it.
 */
export function Arrow({ className, motion = false }: { className?: string; motion?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn("size-4", motion ? "ai ai-nudge overflow-visible" : "transition-transform duration-300 ease-out group-hover:translate-x-0.5", className)} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const cls = cn("group/l inline-flex items-center gap-2 text-sm font-semibold text-foreground", className);
  const inner = (<><span className="u-link">{children}</span><Arrow className="group-hover/l:translate-x-1" /></>);
  return href.startsWith("http") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}
