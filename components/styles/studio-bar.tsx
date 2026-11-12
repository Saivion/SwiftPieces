import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ThemeButton } from "@/components/layout/theme-toggle";

/**
 * The top of the studio's sidebar, standing in for the site's navbar on this full-window page: the
 * mark (home), the site's light or dark switch, and the way back out to the components.
 */
export function StudioBar() {
  return (
    <div className="flex h-14 flex-none items-center gap-1.5 pr-3 pl-5">
      <Logo className="flex min-w-0 flex-1 items-center" />
      <ThemeButton className="size-[34px] rounded-[14.3px] hover:bg-surface" />
      <Link
        href="/components"
        className="flex h-[34px] items-center gap-1 rounded-[14.3px] bg-surface pr-3.5 pl-2.5 text-[13px] font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
        Components
      </Link>
    </div>
  );
}
