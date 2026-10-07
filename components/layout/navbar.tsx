"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { NavGlyph } from "@swiftpieces/brand";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { NewBadge } from "@/components/ui/new-badge";
import { ProBadge } from "@/components/ui/pro-badge";
import { SectionIcon } from "@/components/docs/section-icons";
import { ThemeButton, ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/cn";
import { pro } from "@/lib/site";

type NavLink = { label: string; href: string; badge?: string };
type MenuItem = NavLink & { desc: string; icon: Parameters<typeof SectionIcon>[0]["kind"]; /** The icon's colour, when it isn't the text's. */ tone?: string };
type Menu = { label: string; href: string; items: MenuItem[]; /** Paths that light the menu up besides its items' own. */ also?: string[] };

/**
 * The bar is split by what you came to do. Library is what you take and install (free pieces, and
 * Pro's screens and templates); Create is the tools you use in the browser, where new features land;
 * Resources is how to learn it and who backs it. Pro stays a direct link. At most five items a menu.
 */
const menus: Menu[] = [
  {
    label: "Library",
    href: "/components",
    items: [
      { label: "Components", href: "/components", desc: "Single-file SwiftUI pieces with live previews", icon: "components" },
      { label: "Screens", href: pro.screens, desc: "Finished screens, themed by one design system", icon: "screens", badge: "Pro" },
      { label: "Templates", href: pro.templates, desc: "Complete apps as Xcode projects", icon: "templates", badge: "Pro" },
    ],
  },
  {
    label: "Create",
    href: "/apps",
    also: ["/playground"],
    items: [
      { label: "Apps", href: "/apps", desc: "Remix real app screens in the Playground", icon: "playground", badge: "Beta" },
      { label: "Styles", href: "/styles", desc: "Make one theme for every screen and app", icon: "style", badge: "New" },
    ],
  },
  {
    label: "Resources",
    href: "/docs/introduction",
    also: ["/docs"],
    items: [
      { label: "Docs", href: "/docs/introduction", desc: "Install, the CLI and every piece's API", icon: "docs" },
      { label: "Guides", href: "/docs/guides", desc: "SwiftUI techniques, step by step", icon: "guides" },
      { label: "MCP and agents", href: "/docs/mcp", desc: "Let your coding agent add pieces", icon: "mcp" },
      { label: "Changelog", href: "/docs/changelog", desc: "Every new piece and fix", icon: "changelog" },
      { label: "Sponsors", href: "/sponsors", desc: "The people who keep it free", icon: "sponsors", tone: "text-accent" },
    ],
  },
];

const links: NavLink[] = [{ label: "Pro", href: "/pro" }];

/** A menu item's badge: Pro items wear Pro's own badge (crown, gradient ring), the rest New or Beta. */
function Badge({ label }: { label?: string }) {
  if (!label) return null;
  return label === "Pro" ? <ProBadge size="sm" /> : <NewBadge>{label}</NewBadge>;
}

/**
 * `star` and `starMobile` arrive already rendered from the server layout, inside their own
 * Suspense boundaries. The bar used to take a `stars: number`, which meant the layout had to
 * await a GitHub API call before it could render any navigation at all.
 */
/**
 * `docked` is the docs variant: a solid full-width bar with a hairline under it that never condenses
 * into the floating pill, because the docs sidebar sits directly beneath it.
 */
/**
 * `fresh` is how many pieces carry the New badge right now (the registry's latest wave, 0 when it has
 * aged out). The layouts read it on the server, so the registry never reaches this client chunk.
 */
export function Navbar({ star, starMobile, docked = false, fresh = 0 }: { star?: ReactNode; starMobile?: ReactNode; docked?: boolean; fresh?: number }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // The menu just picked from, so it closes under the pointer; cleared the next time one is hovered or focused.
  const [held, setHeld] = useState<string | null>(null);
  const { setOpenSearch } = useSearchContext();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : !href.startsWith("http") && pathname.startsWith(href));
  // Components carries a New badge while a wave of pieces is fresh (the docs sidebar shows the count).
  const sections = menus.map((m) => ({ ...m, items: m.items.map((l) => (l.href === "/components" && fresh > 0 ? { ...l, badge: "New" } : l)) }));
  const menuActive = (m: Menu) => m.items.some((l) => isActive(l.href)) || (m.also ?? []).some((p) => pathname.startsWith(p));
  const pick = (label: string) => {
    setHeld(label);
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  };
  // Scrolled, the whole bar condenses into one floating liquid-glass pill. The mobile sheet keeps
  // the full bar, so it opens flush under it.
  const condensed = !docked && scrolled && !open;

  return (
    <>
    {/* Fixed, with a constant-height spacer below. When the header was sticky its shrink on
        scroll changed the page layout; scroll anchoring then moved the page back under the
        threshold and the bar grew again, so it oscillated on its own near the top. */}
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-500 ease-[var(--ease-out)]", open ? "bg-background" : "bg-transparent")}>
      <Shell docked={docked}>
        <nav
          data-condensed={condensed}
          className={cn(
            "nav-glass group/nav relative mx-auto flex items-center justify-between transition-[max-width,height,margin,padding,border-radius,background-color,border-color,box-shadow] duration-500 ease-[var(--ease-out)]",
            condensed ? "mt-3 h-14 max-w-[880px] rounded-[6px] pr-2.5 pl-5" : docked ? DOCKED : "h-[var(--nav-h)] max-w-full rounded-none px-0",
          )}
          aria-label="Primary"
        >
          <Logo className="flex shrink-0 items-center" />
            <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex">
              {sections.map((m) => {
                const active = menuActive(m);
                const isHeld = held === m.label;
                return (
                  <li key={m.label} className="group relative" onMouseEnter={() => setHeld(null)} onFocus={() => setHeld(null)}>
                    <Link href={m.href} aria-haspopup="true" className={cn("group/n relative flex h-9 items-center gap-2 px-3 text-[12.5px] font-medium transition-colors duration-300", active ? "text-foreground" : "text-muted hover:text-foreground")}>
                      <NavGlyph className={cn("transition-colors", active ? "text-accent" : "group-hover/n:text-accent")} />
                      {m.label}
                      <svg aria-hidden viewBox="0 0 16 16" className={cn("-ml-0.5 size-3 transition-transform duration-300", !isHeld && "group-hover:rotate-180 group-focus-within:rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {active ? <span className="absolute inset-x-3 -bottom-px h-px bg-accent" /> : null}
                    </Link>
                    <div className={cn("absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-300 ease-[var(--ease-out)]", isHeld ? "pointer-events-none invisible translate-y-1 opacity-0" : "invisible translate-y-1 opacity-0 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100")}>
                      <div className="card w-[340px] p-1.5 shadow-[0_24px_64px_-24px_rgba(0,0,0,.9)]">
                        {m.items.map((l) => (
                          <Link key={l.href} href={l.href} onClick={() => pick(m.label)} className={cn("flex items-start gap-3 rounded-[4px] px-3 py-2.5 transition-colors hover:bg-white/[.05]", isActive(l.href) && "bg-white/[.04]")}>
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-white/[.06] text-foreground"><SectionIcon kind={l.icon} tone={l.tone} /></span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="flex items-center justify-between gap-3 text-[13px] font-semibold text-foreground">{l.label}<Badge label={l.badge} /></span>
                              <span className="text-[11.5px] text-muted">{l.desc}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={cn("group/n relative flex h-9 items-center gap-2 px-3 text-[12.5px] font-medium transition-colors duration-300", isActive(l.href) ? "text-foreground" : "text-muted hover:text-foreground")}>
                    <NavGlyph className={cn("transition-colors", isActive(l.href) ? "text-accent" : "group-hover/n:text-accent")} />
                    {l.label}
                    <Badge label={l.badge} />
                    {isActive(l.href) ? <span className="absolute inset-x-3 -bottom-px h-px bg-accent" /> : null}
                  </Link>
                </li>
              ))}
          </ul>

          <div className="flex items-center gap-1.5">
            {/* Search and theme are square icon buttons, so the bar has room for both. Only the full,
                wide bar has space to spell search out as a field with its shortcut. */}
            <button
              type="button"
              onClick={() => setOpenSearch(true)}
              // Hidden on the condensed (scrolled) bar, which is too tight for it; ⌘K still opens search.
              className={cn(NAV_ICON, "hidden xl:w-auto xl:px-2.5", condensed ? "md:hidden" : "md:flex")}
              aria-label="Search"
              title="Search (⌘K)"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="ai ai-search size-4 overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></svg>
              {/* Grows and folds with the bar, on its easing, so it never runs over the links mid-way. */}
              <span className={cn("hidden items-center gap-2 overflow-hidden whitespace-nowrap transition-[max-width,padding,opacity] duration-500 ease-[var(--ease-out)] xl:flex", condensed ? "max-w-0 opacity-0" : "max-w-48 pl-2 opacity-100")}>
                <span className="w-28 text-left text-sm">Search</span>
                <kbd className="rounded-[4px] bg-surface-3 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted">⌘K</kbd>
              </span>
            </button>
            <ThemeButton className={cn(NAV_ICON, "hidden md:flex")} />
            {star}
            <Button href={pro.buy} size="sm" className="hidden sm:inline-flex">Get Pro</Button>
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex size-9 items-center justify-center rounded-[4px] bg-surface-2 lg:hidden" aria-expanded={open} aria-label="Menu">
              {/* Three bars that fold into a cross and back (.ai-menu in app/globals.css), drawn from the button's centre. */}
              <svg aria-hidden viewBox="0 0 16 16" className="ai ai-menu size-4 overflow-visible" data-open={open || undefined} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h12" /><path d="M2 8h12" /><path d="M2 12h12" />
              </svg>
            </button>
          </div>
        </nav>
      </Shell>
    </header>
    <div aria-hidden className="h-[var(--nav-h)] shrink-0" />

      {/* Mobile sheet: sibling of the header, never a descendant of a backdrop-filter element. */}
      <div className={cn("fixed inset-x-0 top-14 bottom-0 z-40 bg-background transition-opacity duration-300 lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!open} inert={!open}>
        <Container className="flex h-full flex-col gap-8 overflow-y-auto overscroll-contain py-6">
          {/* The phone sheet has no hover, so each menu is a headed group of its items. */}
          <div className="flex flex-col gap-6">
            {sections.map((m, gi) => (
              <div key={m.label}>
                <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-subtle uppercase">{m.label}</p>
                <ul className="flex flex-col">
                  {m.items.map((l, i) => (
                    <li key={l.href} className="hair-b">
                      <Link href={l.href} className={cn("flex items-center justify-between py-3 text-[14px] font-medium transition-transform duration-500", open ? "translate-y-0" : "translate-y-3")} style={{ transitionDelay: `${(gi * 3 + i) * 30}ms` }}>
                        <span className="flex items-center gap-2">{l.label}<Badge label={l.badge} /></span>
                        {isActive(l.href) ? <span className="size-2 rounded-full bg-accent" /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href} className="hair-b">
                  <Link href={l.href} className="flex items-center justify-between py-3 text-[14px] font-medium">
                    {l.label}
                    {isActive(l.href) ? <span className="size-2 rounded-full bg-accent" /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 text-[13px] font-medium text-muted">Theme<ThemeToggle /></div>
            {starMobile}
            <Button href={pro.buy} size="lg">Get Pro</Button>
            <Button href="/components" variant="ghost" size="lg">Browse free pieces</Button>
          </div>
        </Container>
      </div>
    </>
  );
}

/**
 * The docked bar is a panel like the docs sidebar under it: the same 12px inset from the page, the
 * same 4px radius and the landing bar's scrolled glass (.docs-glass), with the page scrolling beneath. It keeps the total height of the
 * normal bar (12px margin + the rest), so the sidebar still starts 12px below it, and its contents
 * sit 12px + 1px + 12px in, exactly where the sidebar's filter and rows start, so nothing moves.
 */
/** The bar's square icon buttons (search, theme), matched to the GitHub star beside them. */
const NAV_ICON = "size-9 items-center justify-center rounded-[4px] bg-surface-2 text-muted transition-colors hover:text-foreground group-data-[condensed=true]/nav:bg-white/[0.07]";

const DOCKED = "mt-3 h-[calc(var(--nav-h)-12px)] max-w-full rounded-[var(--radius)] docs-glass px-2 md:px-3";

/**
 * The page container, or for the docked bar the full window width, like the docs grid below it
 * (docs layout sets --fd-layout-width to 100vw), so the bar spans the sidebar, page and right column.
 */
function Shell({ docked, children }: { docked: boolean; children: ReactNode }) {
  return docked ? <div className="w-full px-2 md:px-3">{children}</div> : <Container>{children}</Container>;
}
