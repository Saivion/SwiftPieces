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
import { cn } from "@/lib/cn";
import { pro } from "@/lib/site";

const links: { label: string; href: string; badge?: string; wide?: boolean }[] = [
  { label: "Components", href: "/components" },
  { label: "Screens", href: "/screens" },
  { label: "Playground", href: "/playground", badge: "New" },
  { label: "Docs", href: "/docs/introduction" },
  { label: "Pro", href: "/pro" },
  // Only where the bar has room for it; always in the mobile sheet.
  { label: "Sponsors", href: "/sponsors", wide: true },
];



/**
 * `star` and `starMobile` arrive already rendered from the server layout, inside their own
 * Suspense boundaries. The bar used to take a `stars: number`, which meant the layout had to
 * await a GitHub API call before it could render any navigation at all.
 */
export function Navbar({ star, starMobile }: { star?: ReactNode; starMobile?: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
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

  // Docs links straight to its first page, but the tab stays lit anywhere under /docs.
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.startsWith("/docs/") ? "/docs" : href));
  // Scrolled, the whole bar condenses into one floating liquid-glass pill. The mobile sheet keeps
  // the full bar, so it opens flush under it.
  const condensed = scrolled && !open;

  return (
    <>
    {/* Fixed, with a constant-height spacer below. When the header was sticky its shrink on
        scroll changed the page layout; scroll anchoring then moved the page back under the
        threshold and the bar grew again, so it oscillated on its own near the top. */}
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-500 ease-[var(--ease-out)]", open ? "bg-background" : "bg-transparent")}>
      <Container>
        <nav
          data-condensed={condensed}
          className={cn(
            "nav-glass group/nav relative mx-auto flex items-center justify-between transition-[max-width,height,margin,padding,border-radius,background-color,border-color,box-shadow] duration-500 ease-[var(--ease-out)]",
            condensed ? "mt-3 h-14 max-w-[880px] rounded-[6px] pr-2.5 pl-5" : "h-[var(--nav-h)] max-w-full rounded-none px-0",
          )}
          aria-label="Primary"
        >
          <Logo className="flex shrink-0 items-center" />
            <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex">
              {links.map((l) => (
                <li key={l.href} className={l.wide ? "hidden 2xl:block" : undefined}>
                  <Link href={l.href} className={cn("group/n relative flex h-9 items-center gap-2 px-3 text-[12.5px] font-medium transition-colors duration-300", isActive(l.href) ? "text-foreground" : "text-muted hover:text-foreground")}>
                    <NavGlyph className={cn("transition-colors", isActive(l.href) ? "text-accent" : "group-hover/n:text-accent")} />
                    {l.label}
                    {l.badge ? <NewBadge>{l.badge}</NewBadge> : null}
                    {isActive(l.href) ? <span className="absolute inset-x-3 -bottom-px h-px bg-accent" /> : null}
                  </Link>
                </li>
              ))}
          </ul>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpenSearch(true)}
              className="hidden h-9 items-center gap-2 rounded-[4px] bg-surface-2 pl-3 pr-2 text-sm text-muted transition-colors hover:text-foreground group-data-[condensed=true]/nav:bg-white/[0.07] md:flex"
              aria-label="Search"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></svg>
              <span className="hidden w-28 text-left group-data-[condensed=true]/nav:hidden! xl:inline">Search</span>
              <kbd className="rounded-[4px] bg-surface-3 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted">⌘K</kbd>
            </button>
            {star}
            <Button href={pro.buy} size="sm" className="hidden sm:inline-flex">Get Pro</Button>
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex size-9 items-center justify-center rounded-[4px] bg-surface-2 lg:hidden" aria-expanded={open} aria-label="Menu">
              {/* Crisp SVG glyphs: three bars closed, an X open. Both are 16px and drawn from the button's centre. */}
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {open ? <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /> : <path d="M2 4h12M2 8h12M2 12h12" />}
              </svg>
            </button>
          </div>
        </nav>
      </Container>
    </header>
    <div aria-hidden className="h-[var(--nav-h)] shrink-0" />

      {/* Mobile sheet: sibling of the header, never a descendant of a backdrop-filter element. */}
      <div className={cn("fixed inset-x-0 top-14 bottom-0 z-40 bg-background transition-opacity duration-300 lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!open} inert={!open}>
        <Container className="flex h-full flex-col justify-between py-6">
          <ul className="flex flex-col">
            {[{ label: "Home", href: "/" } as (typeof links)[number], ...links].map((l, i) => (
              <li key={l.href} className="hair-b">
                <Link href={l.href} className={cn("flex items-center justify-between py-3.5 text-[14px] font-medium transition-transform duration-500", open ? "translate-y-0" : "translate-y-3")} style={{ transitionDelay: `${i * 40}ms` }}>
                  <span className="flex items-center gap-2">{l.label}{l.badge ? <NewBadge>{l.badge}</NewBadge> : null}</span>
                  {isActive(l.href) ? <span className="size-2 rounded-full bg-accent" /> : null}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            {starMobile}
            <Button href={pro.buy} size="lg">Get Pro</Button>
            <Button href="/components" variant="ghost" size="lg">Browse free pieces</Button>
          </div>
        </Container>
      </div>
    </>
  );
}
