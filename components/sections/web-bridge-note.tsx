import Link from "next/link";
import { Arrow } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The quiet "coming from the web?" entry point. One line, no card chrome: it acknowledges where the
 * reader is coming from and points at the app library with a Graphite text link, nothing more.
 */
export function WebBridgeNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] leading-6 text-muted", className)}>
      <span className="font-medium text-foreground">New to SwiftUI?</span>
      <span>If you know React, CSS or Tailwind, SwiftUI is easier to pick up than it looks.</span>
      <Link href="/apps" className="group inline-flex items-center gap-1.5 font-semibold text-foreground no-underline">Try real app patterns first <Arrow className="size-3.5" /></Link>
    </p>
  );
}
