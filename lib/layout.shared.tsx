import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { LogoMark } from "@/components/ui/logo";
import { pro, site } from "@/lib/site";

export function baseOptions(): BaseLayoutProps {
  return {
    // Fumadocs wraps the title in its own link, so this must not be a <Link>.
    nav: {
      title: (
        <span className="inline-flex items-center gap-2.5 font-bold tracking-tight text-foreground">
          <LogoMark />
          <span className="text-[17px]">Swift Pieces</span>
          <span className="rounded-[4px] bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Free</span>
        </span>
      ),
      url: "/",
    },
    githubUrl: site.github,
    links: [
      { text: "Components", url: "/components", active: "url" },
      { text: "Pro library", url: "/blocks" },
      { text: "Pricing", url: pro.pricing, external: true },
    ],
  };
}
