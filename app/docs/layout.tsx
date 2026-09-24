import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import { getRegistryIndex, piecePath } from "@/lib/registry";
import type * as PageTree from "fumadocs-core/page-tree";
import { NewBadge } from "@/components/ui/new-badge";
import { SidebarFilter, SidebarFooterLinks, CountedFolder } from "@/components/docs/sidebar";
import { SectionIcon, TabTitle } from "@/components/docs/section-icons";
import { pro, site } from "@/lib/site";
import { DocsSponsors } from "@/components/sections/sponsors";
import { getSponsorsFrom } from "@/lib/sponsors";

/**
 * New pieces (registry `isNew`, the last 30 days) get two things in the sidebar: a "Just added" list
 * right under "All components", so they are visible without opening a category, and the pink pill
 * on their row inside their own category.
 */
function markNew(tree: PageTree.Root): PageTree.Root {
  const fresh = getRegistryIndex().filter((e) => e.isNew);
  if (!fresh.length) return tree;
  const urls = new Set(fresh.map((e) => piecePath(e)));
  const pages = new Map<string, PageTree.Item>();
  const badge = (n: PageTree.Item): PageTree.Item => ({
    ...n,
    // Keyed: Fumadocs renders the name inside an array of children next to the icon.
    name: (
      <span key="new-name" className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate">{n.name}</span>
        <NewBadge />
      </span>
    ),
  });
  const walk = (nodes: PageTree.Node[]): PageTree.Node[] => {
    const out: PageTree.Node[] = [];
    for (const n of nodes) {
      if (n.type === "folder") out.push({ ...n, children: walk(n.children) });
      else if (n.type === "page" && urls.has(n.url)) {
        pages.set(n.url, n);
        out.push(badge(n));
      } else out.push(n);
    }
    return out;
  };
  const children = walk(tree.children);
  // The "New" list goes before the first separator ("Categories · 14") in whichever list holds it.
  const newest = fresh.map((e) => pages.get(piecePath(e))).filter((n): n is PageTree.Item => Boolean(n));
  const insert = (nodes: PageTree.Node[]): boolean => {
    const at = nodes.findIndex((n) => n.type === "separator");
    if (at >= 0) {
      const heading = (
        <span key="just-added" className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2">Just added <NewBadge /></span>
          <span className="text-[11px] tabular-nums text-subtle">{newest.length}</span>
        </span>
      );
      nodes.splice(at, 0, { type: "separator", name: heading }, ...newest);
      return true;
    }
    return nodes.some((n) => n.type === "folder" && insert(n.children));
  };
  insert(children);
  return { ...tree, children };
}

export default async function Layout({ children }: { children: ReactNode }) {
  const n = getRegistryIndex().length;
  // Silver and Gold sponsors sit above the footer links on every docs page.
  const sidebarSponsors = await getSponsorsFrom("silver");
  return (
    <DocsLayout
      tree={markNew(source.getPageTree())}
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
          <div key="sidebar-footer">
          <DocsSponsors sponsors={sidebarSponsors} />
          <SidebarFooterLinks
            links={[
              { label: "Components", href: "/components" },
              { label: "Pro", href: "/pro" },
              { label: "Pricing", href: pro.pricing, external: true },
              { label: "Sponsors", href: "/sponsors" },
              { label: "GitHub", href: site.github, external: true },
            ]}
          />
          </div>
        ),
        components: { Folder: CountedFolder },
        defaultOpenLevel: 0,
      }}
    >
      {children}
    </DocsLayout>
  );
}
