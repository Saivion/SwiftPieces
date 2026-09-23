"use client";
import { useState } from "react";
import { cn } from "../cn.js";

export function CopyButton({ text, className, label = "Copy" }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {}
      }}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 font-sans text-xs font-semibold transition-colors", copied ? "bg-accent text-accent-foreground" : "bg-surface-3 text-foreground hover:bg-surface-muted", className)}
      aria-live="polite"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        {copied ? <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /> : <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></>}
      </svg>
      {copied ? "Copied" : label}
    </button>
  );
}
