import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The quiet "coming from the web?" entry point. One line, no card chrome to speak of: it
 * acknowledges where the reader is coming from and points at the app library, nothing more.
 */
export function WebBridgeNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-6 text-muted", className)}>
      <span className="font-semibold text-foreground">New to SwiftUI?</span>
      <span>If you know React, CSS or Tailwind, SwiftUI is easier to pick up than it looks.</span>
      <Link href="/apps" className="u-link font-semibold text-foreground">Try real app patterns first →</Link>
    </p>
  );
}
