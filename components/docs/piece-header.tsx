import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { Badge } from "@/components/ui/badge";
import { proScreens, proScreenUrl } from "@/lib/pro-screens";
import { cn } from "@/lib/cn";

/**
 * Full-width stage on top, details strip below. The stage spans the column, but the preview inside
 * stays at its usual ~600px: previews scale with their frame, so a full-width frame would blow them
 * up and crop them. The stage ground matches the preview's own, so the two read as one surface.
 */
export function PieceHeader({ item }: { item: RegistryIndexEntry }) {
  const video = item.preview.video || item.preview.videoMp4;
  const black = video || item.category === "backgrounds";
  const details = [
    { label: "Type", value: item.name, mono: true },
    { label: "Files", value: [...item.files, ...item.shaders].map((f) => f.target.split("/").pop()).join(", "), mono: true },
    { label: "Depends on", value: item.registryDependencies.length ? item.registryDependencies.join(", ") : "Nothing (Apple frameworks only)" },
    { label: "Version", value: item.version, mono: true },
  ];
  return (
    <div className="not-prose mb-10 flex flex-col gap-3">
      <div className={cn("flex justify-center overflow-hidden rounded-[var(--radius)] px-4 py-6 sm:py-8", black ? "bg-black" : "stage-ground")}>
        <div className="w-full max-w-[600px]">
          {video ? (
            <video className="aspect-[4/3] w-full rounded-[var(--radius)] bg-black object-cover" poster={item.preview.poster} muted loop playsInline autoPlay preload="metadata" aria-label={`${item.title} preview`}>
              {item.preview.video ? <source src={item.preview.video} type="video/webm" /> : null}
              {item.preview.videoMp4 ? <source src={item.preview.videoMp4} type="video/mp4" /> : null}
            </video>
          ) : (
            <PreviewFrame tone={item.category === "backgrounds" ? "black" : "dark"} className="w-full">
              <PiecePreview name={item.name} />
            </PreviewFrame>
          )}
        </div>
      </div>

      <div className="rounded-[var(--radius)] bg-surface p-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">Free · MIT + Commons Clause</Badge>
          <Badge tone="outline">iOS {item.minIOSVersion}+</Badge>
          {item.liquidGlass ? <Badge tone="outline">Liquid Glass</Badge> : null}
          {item.metal ? <Badge tone="outline">Metal</Badge> : null}
          {item.tags.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--line)] pt-5 text-[13px] md:grid-cols-4">
          {details.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="text-subtle">{d.label}</dt>
              <dd className={cn("mt-1 break-words text-foreground", d.mono && "font-mono")}>{d.value}</dd>
            </div>
          ))}
        </dl>
        {item.requiredCapabilities.length || Object.keys(item.infoPlist).length ? (
          <ul className="mt-4 list-disc pl-5 text-[13px] text-muted">
            {item.requiredCapabilities.map((c) => <li key={c}>Capability <code>{c}</code></li>)}
            {Object.entries(item.infoPlist).map(([k, v]) => <li key={k}>Info.plist <code>{k}</code>: {v}</li>)}
          </ul>
        ) : null}
        {item.pro && proScreens[item.pro] ? (
          <a href={proScreenUrl(item.pro)} className="group mt-5 flex items-center justify-between gap-4 rounded-[var(--radius-sm)] bg-surface-2 p-4 transition-colors hover:bg-surface-3">
            <span className="min-w-0">
              <span className="t-meta block text-[10px] text-subtle">In a full screen · Swift Pieces Pro</span>
              <span className="mt-1.5 block text-[14px] font-semibold text-foreground">{proScreens[item.pro].title}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-muted">{proScreens[item.pro].summary}</span>
            </span>
            <span aria-hidden className="shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
