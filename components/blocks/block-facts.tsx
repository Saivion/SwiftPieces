import Link from "next/link";
import { getBlock, getProBlock, getRegistryItem } from "@/lib/registry";
import { piecePath } from "@/lib/registry-paths";
import { blockCategories, proBlockUrl } from "@/lib/blocks";
import { Badge } from "@/components/ui/badge";
import { ProBadge } from "@/components/ui/pro-badge";
import { pro } from "@/lib/site";
import { cn } from "@/lib/cn";

/** The pieces a block is built from, each a link to its own page. */
function Pieces({ names }: { names: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {names.map((name) => {
        const piece = getRegistryItem(name);
        return piece ? (
          <Link key={name} href={piecePath(piece)} className="inline-flex h-6 items-center rounded-[5px] bg-surface-2 px-2 font-mono text-[11.5px] text-foreground transition-colors hover:bg-surface-3">
            {name}
          </Link>
        ) : (
          <span key={name} className="font-mono">{name}</span>
        );
      })}
    </span>
  );
}

function Details({ rows }: { rows: { label: string; value: React.ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-[var(--line)] pt-5 text-[12.5px] sm:grid-cols-2">
      {rows.map((d) => (
        <div key={d.label} className="min-w-0">
          <dt className="text-subtle">{d.label}</dt>
          <dd className={cn("mt-1 break-words text-foreground", d.mono && "font-mono")}>{d.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A free block's facts, under its Preview and Code panel (components/docs/showcase.tsx). The pieces it is built from
 * link to their own pages, since that is where each one's parameters and source live. The registry build places it
 * with `<BlockFacts name="..." />`.
 */
export function BlockFacts({ name }: { name: string }) {
  const block = getBlock(name);
  if (!block) return null;
  return (
    <div className="not-prose mb-10 rounded-[var(--radius)] bg-surface p-5">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="accent">Free · MIT + Commons Clause</Badge>
        <Badge tone="outline">Block · {blockCategories[block.category].title}</Badge>
        <Badge tone="outline">iOS {block.minIOSVersion}+</Badge>
        {block.liquidGlass ? <Badge tone="outline">Liquid Glass</Badge> : null}
        {block.tags.map((t) => <Badge key={t}>{t}</Badge>)}
      </div>
      <Details
        rows={[
          { label: "Type", value: block.name, mono: true },
          { label: "Built from", value: <Pieces names={block.registryDependencies} /> },
          { label: "Files", value: `${block.files.map((f) => f.target.split("/").pop()).join(", ")}, plus the pieces' own` },
          { label: "Version", value: block.version, mono: true },
        ]}
      />
    </div>
  );
}

/**
 * A Pro block's facts on the free site: what is inside it, how it installs and where to get it. Its Swift source is
 * never on this site. The registry build places it with `<ProBlockFacts id="..." />`.
 */
export function ProBlockFacts({ id }: { id: string }) {
  const block = getProBlock(id);
  if (!block) return null;
  return (
    <div className="not-prose mb-10 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={proBlockUrl(block.id)} className="btn-solid inline-flex h-9 items-center gap-2 rounded-[4px] px-4 text-[12.5px] font-semibold">
          Open in the Pro library <span aria-hidden>↗</span>
        </a>
        <a href={pro.pricing} className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-surface-2 px-4 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-surface-3">
          View pricing <span aria-hidden>↗</span>
        </a>
        <span className="text-[12px] text-muted">Live preview in every Pro style, and its source with SwiftPieces Pro.</span>
      </div>
      <div className="rounded-[var(--radius)] bg-surface p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ProBadge size="sm" />
          <Badge tone="outline">Block · {blockCategories[block.category].title}</Badge>
          <Badge tone="outline">iOS 17+</Badge>
          <Badge tone="outline">Themed by Pro&apos;s design system</Badge>
        </div>
        <Details
          rows={[
            { label: "Type", value: block.name, mono: true },
            { label: "Inside", value: block.parts.join(", ") },
            { label: "Install, with a Pro license", value: `npx swiftpieces add ${block.name}`, mono: true },
            { label: "Depends on", value: "Pro's Design System, which installs with it" },
          ]}
        />
      </div>
    </div>
  );
}
