import type { CSSProperties, ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Navbar } from "@/components/layout/navbar";
import { GitHubStarLive } from "@/components/layout/github-star-live";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";
import { freshCount, getBlocks, getProBlocks, getRegistryIndex, piecePath } from "@/lib/registry";
import { blockCategoryTitle, blockPath } from "@/lib/blocks";
import { ProBadge } from "@/components/ui/pro-badge";
import type * as PageTree from "fumadocs-core/page-tree";
import { NewBadge } from "@/components/ui/new-badge";
import { SidebarFilter, CountedFolder } from "@/components/docs/sidebar";
import { WhatsNewButton } from "@/components/changelog/whats-new";
import { SectionIcon } from "@/components/docs/section-icons";
import { SidebarPreview, type SidebarPreviewEntry } from "@/components/docs/sidebar-preview";
import { categoryTitle } from "@/lib/categories";
import { proCards, type ProCardType } from "@/components/docs/pro-cards";
import { changelogPath } from "@/lib/changelog";

/** Explore Pro rows: the section's icon and a quiet count of what Pro holds. */
const exploreRows: Record<string, { kind: "screens" | "flows" | "templates"; type: ProCardType }> = {
  "/docs/components/screens": { kind: "screens", type: "screen" },
  "/docs/components/flows": { kind: "flows", type: "flow" },
  "/docs/components/templates": { kind: "templates", type: "template" },
};


/** A group heading in the sidebar: "Text  11". */
/** Which tier a row, folder or group is: the sidebar's All / Free / Pro pills hide the other tier (app/globals.css). */
type Tier = "free" | "pro";

function heading(label: string, count?: number | ReactNode, tier?: Tier): PageTree.Separator {
  return {
    type: "separator",
    name: (
      <span key={`sep-${label}`} data-sidebar-heading data-group-tier={tier} className="inline-flex items-baseline gap-1.5 text-[12px] font-medium text-subtle">
        {label}
        {count !== undefined ? <span className="text-[10.5px] font-normal tracking-normal tabular-nums text-subtle/70">{count}</span> : null}
      </span>
    ),
  };
}

/** A row whose name sits left and a quiet marker (count, "New") sits at the right edge. */
function withEnd(n: PageTree.Item, end: ReactNode, name: ReactNode = n.name): PageTree.Item {
  return {
    ...n,
    name: (
      <span key="row" className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate">{name}</span>
        {end}
      </span>
    ),
  };
}

/** Marks a row as free or Pro for the sidebar's All / Free / Pro pills, without changing how it looks. */
function tiered(n: PageTree.Item, tier: Tier): PageTree.Item {
  return { ...n, name: <span key="tier" data-tier={tier} className="contents">{n.name}</span> };
}

/** "swiftui-loading-states" -> "Loading states": guide titles are written for search, the sidebar wants the topic. */
const topic = (url: string) => {
  const slug = url.split("/").pop()!.replace(/^swiftui-/, "").replace(/-/g, " ");
  return slug[0].toUpperCase() + slug.slice(1);
};

/**
 * One flat sidebar instead of section roots and collapsible folders: Get Started, Browse, Explore Pro,
 * then every category as a heading with its count and its pieces listed underneath, then Guides.
 * Page URLs are unchanged; only the tree Fumadocs renders is reshaped.
 */
function flatSidebar(tree: PageTree.Root): PageTree.Root {
  const index = getRegistryIndex();
  const fresh = new Set(index.filter((e) => e.isNew).map((e) => piecePath(e)));
  const pages = tree.children.filter((n): n is PageTree.Item => n.type === "page");
  const folders = tree.children.filter((n): n is PageTree.Folder => n.type === "folder");
  // Each folder's landing page is either its `index` or its first child, depending on the loader.
  const landing = (f: PageTree.Folder | undefined, url: string) => (f?.index?.url === url ? f.index : f?.children.find((c): c is PageTree.Item => c.type === "page" && c.url === url));
  const holds = (url: string) => folders.find((f) => Boolean(landing(f, url)));
  const components = holds("/docs/components");
  const blocksRoot = holds("/docs/blocks");
  const guides = holds("/docs/guides");
  const componentsIndex = landing(components, "/docs/components");
  const guidesIndex = landing(guides, "/docs/guides");
  const page = (url: string) => pages.find((p) => p.url === url);
  const piece = (n: PageTree.Item) => tiered(fresh.has(n.url) ? withEnd(n, <NewBadge />) : n, "free");

  const out: PageTree.Node[] = [heading("Get Started")];
  for (const url of ["/docs/introduction", "/docs/installation", "/docs/cli", "/docs/mcp"]) {
    const p = page(url);
    if (p) out.push(p);
  }
  // The changelog is its own route (app/docs/changelog), not an MDX page, so its row is added by hand.
  out.push({ type: "page", name: "Changelog", url: changelogPath() });

  if (components && componentsIndex) {
    // Components, then blocks: each a heading with its count, its "All" row, then one collapsible folder per
    // category, closed until you are on one of its pages (or the filter is looking inside it).
    out.push(heading("Components", index.length, "free"), tiered(withEnd({ ...componentsIndex, name: "All Components" }, fresh.size ? <NewBadge>{`${fresh.size} New`}</NewBadge> : <span className="text-[11px] tabular-nums text-subtle">{index.length}</span>), "free"));
    for (const cat of components.children.filter((n): n is PageTree.Folder => n.type === "folder")) {
      const items = cat.children.filter((n): n is PageTree.Item => n.type === "page");
      const freshHere = items.filter((n) => fresh.has(n.url)).length;
      out.push({
        ...cat,
        defaultOpen: false,
        name: (
          <span key="folder" data-folder-tier="free" className="inline-flex items-center gap-2">
            {cat.name}
            {freshHere ? <span aria-label={`${freshHere} new`} className="size-1.5 rounded-full bg-[var(--new)]" /> : null}
          </span>
        ),
        children: items.map(piece),
      });
    }
    out.push(...blockSection(blocksRoot));
    const explore = components.children.filter((n): n is PageTree.Item => n.type === "page" && Boolean(exploreRows[n.url]));
    if (explore.length) {
      out.push(heading("Explore Pro", undefined, "pro"));
      for (const n of explore) {
        const row = exploreRows[n.url];
        const cards = proCards(row.type);
        const fresh = cards.filter((c) => c.isNew).length;
        out.push({ ...tiered(withEnd(n, fresh ? <NewBadge>{`${fresh} New`}</NewBadge> : <span className="text-[11px] tabular-nums text-subtle">{cards.length}</span>), "pro"), icon: <SectionIcon kind={row.kind} tone="text-current" /> });
      }
    }
  }

  const guidePages = [...(guides?.children.filter((n): n is PageTree.Item => n.type === "page" && n.url !== "/docs/guides") ?? []), ...[page("/docs/liquid-glass")].filter((p): p is PageTree.Item => Boolean(p))];
  if (guidesIndex || guidePages.length) {
    out.push(heading("Guides", guidePages.length));
    if (guidesIndex) out.push({ ...guidesIndex, name: "All Guides" });
    out.push(...guidePages.map((g) => ({ ...g, name: g.url === "/docs/liquid-glass" ? "Liquid Glass" : topic(g.url) })));
  }
  return { ...tree, children: out };
}

/**
 * Blocks: an "All Blocks" row, then one collapsible folder per category with its count, closed until you are on
 * one of its pages. A category holding Pro blocks wears the Pro badge, and so does each Pro block's row.
 */
function blockSection(root: PageTree.Folder | undefined): PageTree.Node[] {
  if (!root) return [];
  const free = getBlocks();
  const paid = getProBlocks();
  const proUrls = new Set(paid.map((p) => blockPath(p)));
  const freshUrls = new Set([...free.filter((b) => b.isNew).map((b) => blockPath(b)), ...paid.filter((p) => p.isNew).map((p) => blockPath(p))]);
  const index = root.index?.url === "/docs/blocks" ? root.index : root.children.find((c): c is PageTree.Item => c.type === "page" && c.url === "/docs/blocks");
  const total = free.length + paid.length;
  const out: PageTree.Node[] = [heading("Blocks", total)];
  if (index) out.push(withEnd({ ...index, name: "All Blocks" }, freshUrls.size ? <NewBadge>{`${freshUrls.size} New`}</NewBadge> : <span className="text-[11px] tabular-nums text-subtle">{total}</span>));
  for (const folder of root.children.filter((n): n is PageTree.Folder => n.type === "folder")) {
    const pages = folder.children.filter((n): n is PageTree.Item => n.type === "page");
    const hasPro = pages.some((p) => proUrls.has(p.url));
    const allPro = pages.every((p) => proUrls.has(p.url));
    out.push({
      ...folder,
      defaultOpen: false,
      name: (
        <span key="folder" data-folder-tier={allPro ? "pro" : hasPro ? undefined : "free"} className="inline-flex items-center gap-2">
          {folder.name}
          {hasPro ? <ProBadge size="sm" /> : null}
        </span>
      ),
      children: pages.map((p) => (proUrls.has(p.url) ? tiered(withEnd(p, <ProBadge size="sm" />), "pro") : tiered(freshUrls.has(p.url) ? withEnd(p, <NewBadge />) : p, "free"))),
    });
  }
  return out;
}

/** What each sidebar row previews on hover: a component's live preview, or a still of a Pro card. */
function previewItems(): Record<string, SidebarPreviewEntry> {
  const out: Record<string, SidebarPreviewEntry> = {};
  for (const e of getRegistryIndex()) {
    out[piecePath(e)] = { kind: "piece", name: e.name, title: e.title, label: categoryTitle(e.category), tone: e.category === "backgrounds" ? "black" : "dark" };
  }
  for (const b of getBlocks()) out[blockPath(b)] = { kind: "piece", name: b.name, title: b.title, label: `Block · ${blockCategoryTitle(b.category)}`, tone: "dark" };
  for (const p of getProBlocks()) out[blockPath(p)] = { kind: "image", src: `/pro-blocks/${p.id}.webp`, title: p.title, label: `Pro block · ${blockCategoryTitle(p.category)}` };
  const screen = proCards("screen")[0];
  const flow = proCards("flow")[0];
  const template = proCards("template")[0];
  if (screen) out["/docs/components/screens"] = { kind: "image", src: `/pro-cards/${screen.id}.webp`, title: "Screens", label: `${proCards("screen").length} in Pro` };
  if (flow) out["/docs/components/flows"] = { kind: "image", src: `/pro-cards/${flow.id}.webp`, title: "Flows", label: `${proCards("flow").length} in Pro` };
  if (template) out["/docs/components/templates"] = { kind: "image", src: `/pro-cards/${template.id}.webp`, title: "Templates", label: `${proCards("template").length} in Pro` };
  return out;
}

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* The site's own navbar sits on top; the sidebar and table of contents stick below it. */}
      <Navbar docked fresh={freshCount()} star={<GitHubStarLive className="hidden sm:inline-flex" />} starMobile={<GitHubStarLive className="h-12 justify-center text-[14px]" />} />
      <div style={{ "--fd-banner-height": "var(--nav-h)", "--fd-layout-width": "100vw" } as CSSProperties}>
    <DocsLayout
      tree={flatSidebar(source.getPageTree())}
      {...baseOptions()}
      // The brand lives in the navbar above, so the sidebar header drops it. The mobile sub-bar
      // (which opens the sidebar drawer) keeps a plain "Docs" label.
      nav={{ ...baseOptions().nav, title: <span className="text-[13px] font-medium text-muted md:hidden">Docs</span> }}
      // The sidebar body holds only the docs tree; What's new sits at its foot, search lives in the filter box.
      links={[]}
      githubUrl={undefined}
      searchToggle={{ enabled: false }}
      themeSwitch={{ enabled: false }}
      tabs={false}
      sidebar={{
        collapsible: false,
        // Off: with ~90 rows, prefetch-on-view sent dozens of Worker requests per docs visit. Rows are
        // prefetched on hover instead (components/docs/sidebar-preview.tsx).
        prefetch: false,
        banner: (
          <div key="sidebar-banner">
            <SidebarFilter meta={`${getRegistryIndex().length} components · ${getBlocks().length + getProBlocks().length} blocks`} />
            <SidebarPreview items={previewItems()} />
          </div>
        ),
        // The foot of the sidebar opens the changelog, on every docs page and in the phone drawer.
        footer: (
          <div key="sidebar-footer" className="border-t border-[var(--docs-line)] pt-3">
            <WhatsNewButton />
          </div>
        ),
        components: { Folder: CountedFolder },
        defaultOpenLevel: 0,
      }}
    >
      {children}
    </DocsLayout>
      </div>
    </>
  );
}
