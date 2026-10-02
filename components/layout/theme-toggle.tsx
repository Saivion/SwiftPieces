"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";

// Same component in swiftpieces.com and pro.swiftpieces.com (components/layout/theme-toggle.tsx): keep them in step.

// Each glyph moves when pointed at and once as it is picked (.ai-* in app/globals.css): the
// screen bobs on its stand, the sun's rays turn an eighth, the moon rocks.
const options = [
  { value: "system", label: "System", parts: <><path className="ai-bob" d="M2.5 3.5h11v7.5h-11z" /><path d="M6 13.5h4M8 11v2.5" /></> },
  { value: "light", label: "Light", parts: <><path d="M8 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5z" /><path className="ai-spin" style={{ "--ai-turn": "45deg" } as CSSProperties} d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" /></> },
  { value: "dark", label: "Dark", parts: <path className="ai-tilt" d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6z" /> },
] as const;

/**
 * Light / dark / system, as three small icon buttons in one pill. next-themes stores the choice
 * and sets the class on <html>. The pressed state waits for mount, because the server cannot know
 * the stored choice and a guess would flash the wrong one.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn("inline-flex items-center gap-0.5 rounded-[4px] bg-white/[.05] p-0.5", className)}>
      {options.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex size-8 items-center justify-center rounded-[3px] transition-colors duration-200",
              active ? "bg-white/[.1] text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="ai size-4 overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{o.parts}</svg>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The navbar's one-tap switch between light and dark (System stays in the footer's ThemeToggle).
 * It shows the mode a tap moves to: a sun while dark, a moon while light. Both glyphs render and
 * html.light picks one in CSS, so the server markup is already right and nothing flashes on mount.
 */
export function ThemeButton({ className }: { className?: string }) {
  const { setTheme } = useTheme();
  const toggle = () => setTheme(document.documentElement.classList.contains("light") ? "dark" : "light");
  return (
    <button type="button" onClick={toggle} aria-label="Switch light or dark mode" title="Light or dark" className={cn("flex size-9 items-center justify-center rounded-[4px] text-muted transition-colors hover:text-foreground", className)}>
      <svg aria-hidden viewBox="0 0 16 16" className="ai size-4 overflow-visible [html.light_&]:hidden" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{options[1].parts}</svg>
      <svg aria-hidden viewBox="0 0 16 16" className="ai hidden size-4 overflow-visible [html.light_&]:block" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{options[2].parts}</svg>
    </button>
  );
}
