import { CopyButton } from "./copy-button.js";
import { cn } from "../cn.js";

/** Inline command with copy affordance. */
export function Command({ text, className, prompt = "$" }: { text: string; className?: string; prompt?: string }) {
  return (
    <div className={cn("flex h-11 items-center gap-3 rounded-[var(--radius)] bg-surface-2 pl-4 pr-1.5 font-mono text-[13px]", className)}>
      <span className="text-subtle">{prompt}</span>
      <span className="truncate text-foreground">{text}</span>
      <CopyButton text={text} className="ml-auto" />
    </div>
  );
}

/** Minimal code block for marketing pages. Docs use Shiki through Fumadocs. */
export function CodeBlock({ code, title, className }: { code: string; title?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] bg-surface", className)}>
      {title ? (
        <div className="hair-b flex h-10 items-center gap-2 px-4 text-xs text-muted">
          <span className="size-2 rounded-full bg-surface-muted" />
          <span className="size-2 rounded-full bg-surface-muted" />
          <span className="size-2 rounded-full bg-surface-muted" />
          <span className="ml-2 font-mono">{title}</span>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Kbd({ children }: { children: string }) {
  return <kbd className="rounded-[4px] bg-surface-3 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted">{children}</kbd>;
}
