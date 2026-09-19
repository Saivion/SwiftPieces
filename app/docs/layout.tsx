import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import { getRegistryIndex } from "@/lib/registry";
import { SidebarFilter, SidebarFooterLinks, CountedFolder } from "@/components/docs/sidebar";
import { SectionIcon, TabTitle } from "@/components/docs/section-icons";
import { pro, site } from "@/lib/site";

export default function Layout({ children }: { children: ReactNode }) {
  const n = getRegistryIndex().length;
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      // The sidebar body holds only the docs tree; site links live in the footer row, search lives in the filter box.
      links={[]}
      githubUrl={undefined}
      searchToggle={{ enabled: false }}
      themeSwitch={{ enabled: false }}
      tabMode="auto"
      tabs={[
        { title: <TabTitle label="Components" count={n} />, description: "Animated SwiftUI pieces", url: "/docs/components", icon: <SectionIcon kind="components" /> },
        { title: <TabTitle label="Screens" count="Pro" />, description: "Production-ready screens", url: pro.screens, icon: <SectionIcon kind="screens" /> },
        { title: <TabTitle label="Templates" count="Pro" />, description: "Complete Xcode projects", url: pro.templates, icon: <SectionIcon kind="templates" /> },
        { title: <TabTitle label="MCP and agents" count="Pro" />, description: "Install with your agent", url: pro.mcpDocs, icon: <SectionIcon kind="agent" /> },
      ]}
      sidebar={{
        banner: <SidebarFilter key="sidebar-filter" />,
        footer: (
          <SidebarFooterLinks
            key="sidebar-footer"
            links={[
              { label: "Components", href: "/components" },
              { label: "Pro", href: "/pro" },
              { label: "Pricing", href: pro.pricing, external: true },
              { label: "GitHub", href: site.github, external: true },
            ]}
          />
        ),
        components: { Folder: CountedFolder },
        defaultOpenLevel: 0,
      }}
    >
      {children}
    </DocsLayout>
  );
}
