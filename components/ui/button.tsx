import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "dark";
type Size = "sm" | "md" | "lg";

// Pills everywhere, shared with Pro. Primary is the glossy accent pill.
const base = "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold select-none transition-[background-color,color,transform,border-color] duration-300 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:scale-[0.985]";
const variants: Record<Variant, string> = {
  primary: "btn-solid",
  secondary: "bg-foreground text-background hover:bg-[#e8e8e8]",
  ghost: "bg-surface-2 text-foreground hover:bg-surface-3",
  outline: "pill bg-transparent text-foreground hover:border-[var(--card-border-hover)] hover:bg-surface-2",
  dark: "btn-dark",
};
const sizes: Record<Size, string> = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" };

type Props = { variant?: Variant; size?: Size; href?: string; children: ReactNode; className?: string } & Omit<ComponentProps<"button">, "children">;

export function Button({ variant = "primary", size = "md", href, className, children, ...rest }: Props) {
  const cls = cn(base, variants[variant], sizes[size], className);
  const inner = <>{children}</>;
  if (href) return href.startsWith("http") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" className={cls} {...rest}>{inner}</button>;
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn("size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5", className)} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const cls = cn("group/l inline-flex items-center gap-2 text-sm font-semibold text-foreground", className);
  const inner = (<><span className="u-link">{children}</span><Arrow className="group-hover/l:translate-x-1" /></>);
  return href.startsWith("http") ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}
