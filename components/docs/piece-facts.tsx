import { getRegistryItem } from "@/lib/registry";
import { Badge } from "@/components/ui/badge";
import { proScreens, proScreenUrl } from "@/lib/pro-screens";
import { playgroundComponentId } from "@swiftpieces/builder";
import { playgroundComponentHref } from "@/lib/playground";
import { cn } from "@/lib/cn";

/**
 * A piece's facts, under its Preview and Code panel (components/docs/showcase.tsx): the Playground hand-off, the
 * badges, the type, files, dependencies and version, and the Pro screen it grows into. The registry build places
 * it in the page with `<PieceFacts name="..." />`.
 */
export function PieceFacts({ name }: { name: string }) {
  const item = getRegistryItem(name);
  if (!item) return null;
  const playground = playgroundComponentHref(playgroundComponentId(item.name));
  const details = [
    { label: "Type", value: item.name, mono: true },
    { label: "Files", value: [...item.files, ...item.shaders].map((f) => f.target.split("/").pop()).join(", "), mono: true },
    { label: "Depends on", value: item.registryDependencies.length ? item.registryDependencies.join(", ") : "Nothing (Apple frameworks only)" },
    { label: "Version", value: item.version, mono: true },
  ];
  return (
    <div className="not-prose mb-10 flex flex-col gap-3">
      {playground ? (
        <div className="flex flex-wrap items-center gap-2">
          <a href={playground.href} className="btn-solid inline-flex h-9 items-center gap-2 rounded-[4px] px-4 text-[12.5px] font-semibold">
            {playground.pro ? "See it in a Pro app" : "Try it in the Playground"} <span aria-hidden>→</span>
          </a>
          <span className="text-[12px] text-muted">
            {playground.pro
              ? "On a real screen in one of the Pro apps: open it with Pro, take it apart, remix it, and copy the SwiftUI."
              : "Use it on a real screen, take it apart, remix it, and copy the SwiftUI. No account needed."}
          </span>
        </div>
      ) : null}

      <div className="rounded-[var(--radius)] bg-surface p-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">Free · MIT + Commons Clause</Badge>
          <Badge tone="outline">iOS {item.minIOSVersion}+</Badge>
          {item.liquidGlass ? <Badge tone="outline">Liquid Glass</Badge> : null}
          {item.metal ? <Badge tone="outline">Metal</Badge> : null}
          {item.tags.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--line)] pt-5 text-[12.5px] md:grid-cols-4">
          {details.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="text-subtle">{d.label}</dt>
              <dd className={cn("mt-1 break-words text-foreground", d.mono && "font-mono")}>{d.value}</dd>
            </div>
          ))}
        </dl>
        {item.requiredCapabilities.length || Object.keys(item.infoPlist).length ? (
          <ul className="mt-4 list-disc pl-5 text-[12.5px] text-muted">
            {item.requiredCapabilities.map((c) => <li key={c}>Capability <code>{c}</code></li>)}
            {Object.entries(item.infoPlist).map(([k, v]) => <li key={k}>Info.plist <code>{k}</code>: {v}</li>)}
          </ul>
        ) : null}
        {item.pro && proScreens[item.pro] ? (
          <a href={proScreenUrl(item.pro)} className="group mt-5 flex items-center justify-between gap-4 rounded-[var(--radius-sm)] bg-surface-2 p-4 transition-colors hover:bg-surface-3">
            <span className="min-w-0">
              <span className="t-meta block text-[10px] text-subtle">In a full screen · SwiftPieces Pro</span>
              <span className="mt-1.5 block text-[13px] font-semibold text-foreground">{proScreens[item.pro].title}</span>
              <span className="mt-1 block text-[12px] leading-snug text-muted">{proScreens[item.pro].summary}</span>
            </span>
            <span aria-hidden className="shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
