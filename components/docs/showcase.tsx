"use client";
import { useState, type ReactNode } from "react";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { Command } from "@/components/ui/code";
import { cliCommand } from "@/lib/registry-paths";
import { cn } from "@/lib/cn";

/**
 * The top of a piece's or block's page: Preview and Code, one tab at a time, on one soft panel. The panel is the
 * stage's own ground (`--pv-bg`), so a preview's ground disappears into it and the piece or block stands on its own,
 * centred, with nothing around it. Code holds the source the registry build put here (the children: highlighted at
 * build time, so nothing is highlighted twice). A Pro block shows a still and keeps its source with Pro. The install
 * command sits right under the panel; a Pro block's needs a Pro license, which the CLI checks with the Pro registry.
 */
export function Showcase({
  name,
  kind = "piece",
  tone = "dark",
  still,
  note,
  proHref,
  children,
}: {
  /** The Swift type: the preview to play. */
  name: string;
  kind?: "piece" | "block";
  /** "black" for the full-bleed backgrounds, which paint their own night sky. */
  tone?: "dark" | "black";
  /** A Pro block's still, shown instead of a live preview. */
  still?: string;
  /** What the preview is, beside the tabs. */
  note?: string;
  /** A Pro block: where its source is, shown in the Code tab instead of code. */
  proHref?: string;
  children?: ReactNode;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const block = kind === "block";
  // A Pro block: shown as a still, its source with Pro.
  const pro = Boolean(still || proHref);
  return (
    <section id="preview" className="not-prose mb-10 scroll-mt-28" aria-label={`${name} preview and code`}>
      <div className="flex items-center justify-between gap-4">
        <div role="tablist" aria-label="View" className="flex gap-0.5 rounded-full bg-surface p-[3px]">
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<EyeIcon />}>Preview</TabButton>
          <TabButton active={tab === "code"} onClick={() => setTab("code")} icon={<CodeIcon />}>Code</TabButton>
        </div>
        <p className="hidden text-[12.5px] text-subtle sm:block">{note ?? (still ? "Pro block · still" : block ? "Live block · sample data" : "Live preview")}</p>
      </div>

      {/* The preview sits on a tray, its own ground (--pv-bg) the panel inside it. */}
      <div role="tabpanel" hidden={tab !== "preview"} className="mt-3 rounded-[30px] bg-surface p-2">
        <div className={cn("overflow-hidden rounded-[23px] px-4 py-6 sm:px-10 sm:py-10", tone === "black" ? "bg-black" : "bg-[var(--pv-bg)]")}>
          <div className={cn("mx-auto w-full", block ? "max-w-[560px]" : "max-w-[600px]")}>
            <PreviewFrame aspect={block ? "aspect-square" : "aspect-[4/3]"} tone={tone} className="w-full">
              {still ? (
                // eslint-disable-next-line @next/next/no-img-element -- a static still of a Pro block
                <img src={still} alt={`${name}, a SwiftPieces Pro block`} className="absolute inset-0 size-full object-contain" />
              ) : (
                <PiecePreview name={name} />
              )}
            </PreviewFrame>
          </div>
        </div>
      </div>

      <div role="tabpanel" hidden={tab !== "code"} className="mt-3 rounded-[30px] bg-surface p-2">
        {children ? (
          <div className="showcase-code max-h-[680px] overflow-auto rounded-[23px] bg-surface-2 p-2 [&_figure]:my-0">{children}</div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[23px] bg-surface-2 px-6 text-center">
            <p className="text-[14px] font-semibold text-foreground">The SwiftUI source comes with SwiftPieces Pro.</p>
            <p className="max-w-sm text-[12.5px] text-muted">Every Pro block installs with one command once your license is signed in, and re-skins with Pro&apos;s design system.</p>
            {proHref ? <a href={proHref} className="u-link mt-1 text-[13px] font-semibold text-foreground">Open it in the Pro library ↗</a> : null}
          </div>
        )}
      </div>

      {/* How to install it, right under what it is. A Pro block's source comes only with a Pro license. */}
      <div className="mt-4 max-w-xl">
        <Command text={cliCommand({ name })} />
        {pro ? <p className="mt-2 text-[12px] text-subtle">Needs a SwiftPieces Pro license: <code className="font-mono">npx swiftpieces login</code> first.</p> : null}
      </div>
    </section>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
        active ? "bg-surface-3 text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.15)]" : "text-muted hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />
    </svg>
  );
}
