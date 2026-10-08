import { LogoMark } from "@/components/ui/logo";
import { Button, Arrow } from "@/components/ui/button";
import { CornerDither } from "@/components/visual/corner-dither";
import { proCatalog } from "@/lib/pro-catalog";
import { pro } from "@/lib/site";

/**
 * Get Pro: the Pro corner halftone moving behind the mark, then the pitch and one button. The docs
 * show the library pitch; the playground passes its template's own title, copy and link, so both
 * places use the same card.
 */
export function ProCard({
  title = "Build the whole app with one library.",
  body = "Production-ready screens, whole flows, complete app templates, a Build Kit your agent follows and Pro remixing.",
  meta = `${proCatalog.screens} screens · ${proCatalog.flows.total} flows · ${proCatalog.templates} templates · ${proCatalog.buildKit.total} Build Kit skills`,
  cta = { label: "Explore Pro", href: pro.home },
}: { title?: string; body?: string; meta?: string; cta?: { label: string; href: string } }) {
  return (
    <div className="docs-glass overflow-hidden rounded-[var(--radius)] p-1.5">
      {/* Always dark, like every Pro visual, so the halftone's colours read in both themes. */}
      <div className="theme-dark relative isolate flex h-28 items-center justify-center overflow-hidden rounded-[var(--radius)] bg-[#070708]">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle,rgba(255,255,255,.07)_.8px,transparent_1px)] [background-size:12px_12px]" />
        <CornerDither className="pointer-events-none absolute inset-0 -z-10 h-full w-full [mask-image:radial-gradient(130%_130%_at_100%_100%,black_30%,transparent_80%)]" />
        {/* Fixed colours, not text-white / bg-white: light mode swaps those tokens to black, and this
            header stays dark in both themes. */}
        <span className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-[-0.02em] text-[#fff]">
          <LogoMark className="size-5" />
          SwiftPieces
          <span className="rounded-[3px] bg-[rgb(255_255_255/0.12)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#fff] uppercase">Pro</span>
        </span>
      </div>
      <div className="px-2.5 pt-3.5 pb-2.5">
        <p className="text-[13.5px] leading-snug font-semibold tracking-[-0.01em] text-foreground">{title}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{body}</p>
        {meta ? <p className="mt-3 text-[11px] text-subtle">{meta}</p> : null}
        <Button href={cta.href} size="sm" className="mt-3.5 w-full">{cta.label} <Arrow className="size-3.5" /></Button>
      </div>
    </div>
  );
}
