import type { ReactNode } from "react";
import { ProCard } from "@/components/docs/pro-card";

/**
 * The foot of every docs page's right column, under "On this page": what Pro adds. Pinned to the
 * bottom of the column (mt-auto), in the same glass as the sidebar and navbar. Sponsors live on
 * /sponsors and in the footer, not here.
 */
export function DocsAside() {
  return (
    <div className="mt-auto flex flex-col gap-3 pt-8 pb-3">
      <ProCard />
    </div>
  );
}

/**
 * The right column without a table of contents. The classes are Fumadocs' own TOC column
 * (fumadocs-ui layouts/docs/page/slots/toc.js), so it takes the same grid area, width and stickiness.
 */
export function DocsAsideColumn({ children }: { children: ReactNode }) {
  return (
    <div id="nd-toc" className="sticky top-(--fd-docs-row-1) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] flex flex-col [grid-area:toc] w-(--fd-toc-width) pt-12 pe-4 pb-2 xl:layout:[--fd-toc-width:268px] max-xl:hidden">
      {children}
    </div>
  );
}
