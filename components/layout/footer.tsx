import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { pro, site } from "@/lib/site";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Free", links: [{ label: "Components", href: "/components" }, { label: "Animations", href: "/components/animations" }, { label: "Liquid Glass", href: "/components/glass" }, { label: "Buttons", href: "/components/controls" }, { label: "Cards", href: "/components/cards" }, { label: "Inputs and forms", href: "/components/inputs" }, { label: "AI chat", href: "/components/ai" }] },
  { title: "Pro", links: [{ label: "Screens", href: pro.screens }, { label: "Templates", href: pro.templates }, { label: "MCP and agents", href: pro.mcpDocs }, { label: "Pricing", href: pro.pricing }, { label: "Account", href: pro.account }] },
  { title: "Docs", links: [{ label: "Introduction", href: "/docs/introduction" }, { label: "Installation", href: "/docs/installation" }, { label: "CLI", href: "/docs/cli" }, { label: "MCP & agents", href: "/docs/mcp" }, { label: "Registry", href: "/r/index.json" }, { label: "llms.txt", href: "/llms.txt" }] },
  { title: "Guides", links: [{ label: "SwiftUI animations", href: "/docs/guides/swiftui-animations" }, { label: "SwiftUI buttons", href: "/docs/guides/swiftui-buttons" }, { label: "SwiftUI cards", href: "/docs/guides/swiftui-cards" }, { label: "SwiftUI haptics", href: "/docs/guides/swiftui-haptics" }, { label: "Loading states", href: "/docs/guides/swiftui-loading-states" }, { label: "Liquid Glass", href: "/docs/liquid-glass" }] },
  { title: "Resources", links: [{ label: "About", href: "/about" }, { label: "Showcase", href: "/showcase" }, { label: "Changelog", href: "/changelog" }, { label: "Sponsors", href: "/sponsors" }, { label: "GitHub", href: site.github }, { label: "Contributing", href: `${site.github}/blob/main/CONTRIBUTING.md` }] },
  { title: "Legal", links: [{ label: "License", href: "/license" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }] },
];

export function Footer() {
  return (
    <footer className="relative pt-24 pb-10" data-tone="black">
      <div aria-hidden className="dots-wide pointer-events-none absolute inset-0 opacity-50" style={{ maskImage: "linear-gradient(to bottom, transparent, black 40%)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 40%)" }} />
      <Container className="relative">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(6,1fr)] lg:gap-6">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-5 text-sm leading-relaxed text-muted">A collection of beautifully animated SwiftUI components. Yours to use, always free.</p>
            <div className="mt-6 flex items-center gap-2">
              {[
                { href: site.github, label: "GitHub", d: "M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.7-.9-3.7-4a3 3 0 0 1 .8-2.1c-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1a3 3 0 0 1 .8 2.1c0 3.1-1.9 3.8-3.7 4 .3.3.6.8.6 1.5v2.3c0 .2.1.5.6.4A8 8 0 0 0 8 .2Z" },
                { href: site.twitter, label: "X", d: "M12.6 1h2.2L9.9 6.6 15.7 15h-4.5L7.7 10.4 3.6 15H1.4l5.3-6L1.1 1h4.6l3.2 4.2L12.6 1Zm-.8 12.7h1.2L4.9 2.2H3.6l8.2 11.5Z" },
              ].map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-foreground">
                  <svg viewBox="0 0 16 16" className="size-4" fill="currentColor"><path d={s.d} /></svg>
                </a>
              ))}
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="p-meta mb-5 text-subtle">{col.title}</p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[13px] text-muted transition-colors duration-300 hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-24 overflow-hidden" aria-hidden>
          <p className="select-none whitespace-nowrap text-center text-[clamp(2.3rem,9.1vw,9.2rem)] font-extrabold leading-[0.82] tracking-[-0.06em] text-[#0f0f0f]">SWIFTPIECES</p>
        </div>

        <div className="mt-10 flex flex-col gap-3 text-[11.5px] text-subtle md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Swift Pieces. Free pieces are MIT + Commons Clause.</p>
          <p className="inline-flex items-center gap-1.5">Curated with<svg aria-label="love" viewBox="0 0 16 16" className="size-3 text-accent" fill="currentColor"><path d="M8 14s-5.5-3.3-5.5-7.2A3 3 0 0 1 8 5.1a3 3 0 0 1 5.5 1.7C13.5 10.7 8 14 8 14z" /></svg>by <a href="https://x.com/saivion" target="_blank" rel="noreferrer" className="u-link text-foreground">Saivion</a></p>
        </div>
      </Container>
    </footer>
  );
}
