"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import type * as PageTree from "fumadocs-core/page-tree";
import { SidebarFolder, SidebarFolderContent, SidebarFolderLink, SidebarFolderTrigger, useFolder, useFolderDepth, useSidebar } from "fumadocs-ui/components/sidebar/base";

/**
 * Under 768px Fumadocs shows the sidebar as a drawer over the page (#nd-sidebar-mobile, styled in
 * app/globals.css). Its own close button sits in a row of its own, which the panel drops, so the head
 * carries this one. While it is open the drawer behaves like the navbar's menu sheet: the page under it
 * holds still, and Escape closes it (unless the search dialog over it took the key).
 */
function DrawerClose() {
  const { mode, open, setOpen } = useSidebar();
  const showing = mode === "drawer" && open;
  useEffect(() => {
    if (!showing) return;
    const root = document.documentElement;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && setOpen(false);
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [showing, setOpen]);
  if (mode !== "drawer") return null;
  return (
    <button type="button" onClick={() => setOpen(false)} aria-label="Close sidebar" className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] text-muted transition-colors hover:bg-[var(--docs-fill)] hover:text-foreground">
      <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
  );
}

/**
 * One box for both jobs: typing filters the sidebar links in place, and the ⌘K key (or a click on it)
 * opens full-text search. This replaces Fumadocs' separate search trigger so the header stays at two rows.
 */
export function SidebarFilter({ title = "Docs", meta }: { title?: string; meta?: string }) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const { setOpenSearch } = useSearchContext();
  useEffect(() => {
    const aside = ref.current?.closest("aside");
    if (!aside) return;
    const needle = q.trim().toLowerCase();
    aside.querySelectorAll<HTMLAnchorElement>("a[href^='/docs/']").forEach((a) => {
      const text = a.textContent?.toLowerCase() ?? "";
      const isIndexLike = /^(all |introduction|installation|mcp|liquid glass guide)/.test(text);
      a.hidden = Boolean(needle) && !text.includes(needle) && !isIndexLike;
    });
    // A group heading hides with its last visible row, so a filtered sidebar never shows empty groups.
    aside.querySelectorAll<HTMLElement>("[data-sidebar-heading]").forEach((h) => {
      const sep = h.parentElement;
      if (!sep) return;
      let any = false;
      for (let el = sep.nextElementSibling; el && !el.querySelector("[data-sidebar-heading]"); el = el.nextElementSibling) {
        if (el instanceof HTMLAnchorElement ? !el.hidden : Boolean(el.querySelector("a:not([hidden])"))) any = true;
      }
      sep.hidden = Boolean(needle) && !any;
    });
  }, [q]);
  return (
    <div>
      {/* The panel head, as on the Playground's panels: title left, a quiet note right, hairline under. */}
      <div className="flex h-12 items-center gap-2.5 border-b border-[var(--docs-line)] px-4">
        <p className="mr-auto text-[13px] font-semibold tracking-[-0.01em] text-foreground">{title}</p>
        {meta ? <span className="text-[11.5px] text-subtle">{meta}</span> : null}
        <DrawerClose />
      </div>
      <div className="px-3 pt-3">
    {/* max-md: is the phone drawer. The field takes 16px type there, under which iOS zooms the page
        in on focus, and the shortcut chip names what it does, since a phone has no ⌘K. */}
    <label className="flex h-8 items-center gap-2 rounded-[var(--radius)] bg-[var(--docs-fill)] pl-2.5 pr-1.5 text-[12.5px] text-muted ring-1 ring-transparent transition-shadow focus-within:ring-[var(--line-strong)] max-md:h-10">
      <svg aria-hidden viewBox="0 0 16 16" className="ai ai-search size-3.5 shrink-0 overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></svg>
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-subtle focus:outline-none max-md:text-[16px]" aria-label="Filter sidebar" />
      <button type="button" onClick={() => setOpenSearch(true)} title="Search docs" className="shrink-0 rounded-[3px] bg-white/[.06] px-1.5 py-0.5 font-mono text-[10px] text-subtle transition-colors hover:bg-white/[.12] hover:text-foreground max-md:px-2 max-md:py-1 max-md:font-sans max-md:text-[11.5px]">
        <span className="max-md:hidden">⌘K</span>
        <span className="md:hidden">Search</span>
      </button>
    </label>
      </div>
    </div>
  );
}

export type FooterLink = { label: string; href: string; external?: boolean };

/** Quiet site links at the foot of the sidebar, so the body of the sidebar holds only the docs tree. */
export function SidebarFooterLinks({ links }: { links: FooterLink[] }) {
  return (
    <nav aria-label="Site" className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--docs-line)] px-2 pt-3 text-[11.5px] text-subtle">
      {links.map((l) => (
        <a key={l.href} href={l.href} {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})} className="transition-colors hover:text-foreground">
          {l.label}
          {l.external ? <span aria-hidden className="ml-0.5">↗</span> : null}
        </a>
      ))}
    </nav>
  );
}

function countPages(node: PageTree.Folder): number {
  return node.children.reduce((n, c) => n + (c.type === "page" ? 1 : c.type === "folder" ? countPages(c) : 0), 0);
}
function containsUrl(node: PageTree.Folder, url: string): boolean {
  if (node.index?.url === url) return true;
  return node.children.some((c) => (c.type === "page" ? c.url === url : c.type === "folder" ? containsUrl(c, url) : false));
}

// Fumadocs does not export its styled folder parts, so these mirror its item variants and depth offsets.
const row = "relative flex w-full flex-row items-center gap-2 rounded-[6px] p-2 text-start text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary [&_svg]:size-4 [&_svg]:shrink-0";
const offset = (depth: number) => `calc(${2 + 3 * depth} * var(--spacing))`;

function Trigger({ children }: { children: ReactNode }) {
  const depth = useFolder()?.depth ?? 1;
  return <SidebarFolderTrigger className={row} style={{ paddingInlineStart: offset(depth - 1) }}>{children}</SidebarFolderTrigger>;
}
function FolderLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  const depth = useFolderDepth();
  return <SidebarFolderLink href={href} active={active} className={row} style={{ paddingInlineStart: offset(depth - 1) }}>{children}</SidebarFolderLink>;
}
function Content({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();
  return <SidebarFolderContent className={depth === 1 ? "relative before:absolute before:inset-y-1 before:inset-s-2.5 before:w-px before:bg-fd-border before:content-['']" : "relative"}><div className="flex flex-col gap-0.5 pt-0.5">{children}</div></SidebarFolderContent>;
}

/**
 * Folder row "Name ······ 24 ›". The name grows to fill the row so the count and Fumadocs' chevron
 * (which carries ms-auto) sit together at the right edge instead of splitting the free space.
 */
export function CountedFolder({ item, children }: { item: PageTree.Folder; children: ReactNode }) {
  const pathname = usePathname();
  const active = containsUrl(item, pathname);
  const label = (
    <>
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-subtle">{countPages(item)}</span>
    </>
  );
  return (
    <SidebarFolder defaultOpen={item.defaultOpen || active} collapsible={item.collapsible} active={active}>
      {item.index ? <FolderLink href={item.index.url} active={item.index.url === pathname}>{label}</FolderLink> : <Trigger>{label}</Trigger>}
      <Content>{children}</Content>
    </SidebarFolder>
  );
}
