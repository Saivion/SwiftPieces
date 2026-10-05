"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";

export type SidebarPreviewEntry =
  | { kind: "piece"; name: string; title: string; label: string; tone: "dark" | "black" }
  | { kind: "image"; src: string; title: string; label: string };

const CARD_W = 300;
const GAP = 12;

/**
 * Hovering a component, Screens or Templates row in the docs sidebar shows its preview in a card
 * beside the sidebar, level with the row. Components play their live preview; Pro rows show a still
 * of a Pro card. Rendered into <body>, because the sidebar's backdrop filter would otherwise become
 * the containing block of anything fixed inside it. Pointer devices only.
 */
export function SidebarPreview({ items }: { items: Record<string, SidebarPreviewEntry> }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<{ href: string; entry: SidebarPreviewEntry; left: number; rowMid: number } | null>(null);

  useEffect(() => setState(null), [pathname]);

  useEffect(() => {
    const aside = anchor.current?.closest("aside");
    // The phone drawer (#nd-sidebar-mobile) sits at the window's right edge, so a card beside it would land off-screen.
    if (!aside || aside.id === "nd-sidebar-mobile" || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const over = (e: PointerEvent) => {
      const a = (e.target as Element).closest?.("a[href]");
      const href = a?.getAttribute("href");
      // The sidebar's rows don't prefetch on view (app/docs/layout.tsx); a hovered one does, so the click is still instant.
      if (href?.startsWith("/")) router.prefetch(href);
      const entry = href ? items[href] : undefined;
      if (!a || !href || !entry) return setState(null);
      const row = a.getBoundingClientRect();
      const side = aside.getBoundingClientRect();
      setState((s) => (s?.href === href ? s : { href, entry, left: side.right + GAP, rowMid: row.top + row.height / 2 }));
    };
    const leave = () => setState(null);
    aside.addEventListener("pointerover", over);
    aside.addEventListener("pointerleave", leave);
    // The row moves under a still card while the list scrolls, so close it rather than let it drift.
    aside.addEventListener("scroll", leave, true);
    return () => {
      aside.removeEventListener("pointerover", over);
      aside.removeEventListener("pointerleave", leave);
      aside.removeEventListener("scroll", leave, true);
    };
  }, [items, router]);

  // Level with the row, kept inside the window.
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (!state || !card.current) return;
    const h = card.current.offsetHeight;
    setTop(Math.max(GAP, Math.min(window.innerHeight - h - GAP, state.rowMid - h / 2)));
  }, [state]);

  return (
    <>
      <span ref={anchor} hidden />
      {state
        ? createPortal(
            <div
              ref={card}
              role="presentation"
              className="docs-glass pointer-events-none fixed z-[60] rounded-[var(--radius)] p-1.5"
              style={{ left: state.left, top, width: CARD_W }}
            >
              {state.entry.kind === "piece" ? (
                <PreviewFrame key={state.entry.name} tone={state.entry.tone}>
                  <PiecePreview name={state.entry.name} />
                </PreviewFrame>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- a static still of a Pro card
                <img key={state.entry.src} src={state.entry.src} alt="" className="block aspect-[4/3] w-full rounded-[var(--radius)] object-cover" />
              )}
              <div className="flex items-center justify-between gap-3 px-1.5 pt-2.5 pb-1">
                <p className="truncate text-[12.5px] font-medium text-foreground">{state.entry.title}</p>
                <p className="shrink-0 text-[11.5px] text-subtle">{state.entry.label}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
