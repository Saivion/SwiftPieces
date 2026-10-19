import { LogoMark } from "@/components/ui/logo";
import { Button, Arrow } from "@/components/ui/button";
import { ProBadge } from "@/components/ui/pro-badge";
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
  meta = `${proCatalog.screens} screens · ${proCatalog.blocks} blocks · ${proCatalog.flows.total} flows · ${proCatalog.templates} templates · ${proCatalog.buildKit.total} Build Kit skills`,
  cta = { label: "Explore Pro", href: pro.home },
}: { title?: string; body?: string; meta?: string; cta?: { label: string; href: string } }) {
  return (
    <div className="docs-glass overflow-hidden rounded-[22px] p-2">
      {/* The mark and the Pro badge on a panel: Graphite keeps the head of the card flat and quiet. */}
      <div className="flex h-24 items-center justify-center rounded-[16px] bg-surface-2">
        <span className="inline-flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.02em] text-foreground">
          <LogoMark className="size-5" />
          SwiftPieces
          <ProBadge size="sm" />
        </span>
      </div>
      <div className="px-2 pt-3.5 pb-1.5">
        <p className="text-[14px] leading-snug font-medium tracking-[-0.01em] text-foreground">{title}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{body}</p>
        {meta ? <p className="mt-3 text-[11.5px] text-subtle">{meta}</p> : null}
        <Button href={cta.href} size="sm" className="mt-3.5 w-full">{cta.label} <Arrow className="size-3.5" /></Button>
      </div>
    </div>
  );
}
