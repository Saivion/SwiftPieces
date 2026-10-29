import { Button, Arrow } from "@/components/ui/button";
import { ProBadge } from "@/components/ui/pro-badge";
import { GrainStage } from "@/components/visual/grain-stage";
import { proCatalog } from "@/lib/pro-catalog";
import { pro } from "@/lib/site";

/**
 * Get Pro: SwiftPieces Pro's lockup, then the pitch and one button. The docs
 * show the library pitch; the playground passes its template's own title, copy and link, so both
 * places use the same card.
 */
export function ProCard({
  title = "Build the whole app with one library.",
  body = "Production-ready screens, whole flows, complete app templates, a Build Kit your agent follows and Pro remixing.",
  meta = `${proCatalog.screens} screens · ${proCatalog.blocks} patterns · ${proCatalog.flows.total} flows · ${proCatalog.templates} templates · ${proCatalog.buildKit.total} Build Kit skills`,
  cta = { label: "Explore Pro", href: pro.home },
  seed = "docs",
}: { title?: string; body?: string; meta?: string; cta?: { label: string; href: string }; seed?: string }) {
  return (
    <div className="docs-glass overflow-hidden rounded-[22px] p-2">
      {/* SwiftPieces Pro's own lockup, as pro.swiftpieces.com's navbar draws it (Pro
          components/layout/pro-logo.tsx): Pro's mark, red blocks on white (public/pro-logo-mark.png,
          a copy of Pro's logo-mark.png), the name and the Pro badge. It stands on the pricing card's
          Signature grain, seeded per page so no two panels match; the name is fixed white in both
          themes, and the mark sits on a small white tile so its red blocks hold on the red ground. */}
      <div className="relative isolate flex h-24 items-center justify-center overflow-hidden rounded-[16px]">
        <GrainStage seed={`pro-card-${seed}`} eager className="-z-10" />
        <span className="inline-flex items-center gap-2.5 whitespace-nowrap text-[#fff] [text-shadow:0_1px_8px_rgb(0_0_0/0.25)]">
          <span className="grid size-[30px] place-items-center rounded-[9px] bg-[#fff] shadow-[0_2px_10px_-2px_rgb(0_0_0/0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a 96px brand mark shown at 20px, like the brand LogoMark */}
            <img src="/pro-logo-mark.png" alt="" aria-hidden width={20} height={20} className="size-[20px] object-cover" />
          </span>
          <span className="text-[15.5px] leading-none font-semibold tracking-[-0.03em]">SwiftPieces</span>
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
