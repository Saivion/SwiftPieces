import { cn } from "../cn.js";

/**
 * Brand mark from `/logo-mark.png`, a 96px copy of `/logo.png` (hosts must serve it from their
 * public root). The mark shows at 24px, so the 1024px original cost ~19 KB for nothing.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden
      width={24}
      height={24}
      className={cn("size-6 object-cover", className)}
    />
  );
}

/** Wordmark without a link, so hosts can wrap it in their own router link. */
export function Wordmark({ tag, className }: { tag?: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap font-bold tracking-tight text-foreground", className)}>
      <LogoMark />
      <span className="text-[17px]">Swift Pieces</span>
      {tag ? <span className="wordmark-tag text-pop">{tag}</span> : null}
    </span>
  );
}
