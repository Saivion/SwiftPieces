import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { Badge } from "@/components/ui/badge";
import { proScreens, proScreenUrl } from "@/lib/pro-screens";

export function PieceHeader({ item }: { item: RegistryIndexEntry }) {
  return (
    <div className="not-prose mb-10 grid gap-4 md:grid-cols-[1.3fr_1fr]">
      {item.preview.video || item.preview.videoMp4 ? (
        <video className="aspect-[4/3] w-full rounded-[var(--radius)] bg-black object-cover" poster={item.preview.poster} muted loop playsInline autoPlay preload="metadata" aria-label={`${item.title} preview`}>
          {item.preview.video ? <source src={item.preview.video} type="video/webm" /> : null}
          {item.preview.videoMp4 ? <source src={item.preview.videoMp4} type="video/mp4" /> : null}
        </video>
      ) : (
        <PreviewFrame tone={item.category === "backgrounds" ? "black" : "dark"} className="w-full">
          <PiecePreview name={item.name} />
        </PreviewFrame>
      )}
      <div className="flex flex-col justify-between rounded-[var(--radius)] bg-surface p-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">Free · MIT + Commons Clause</Badge>
          <Badge tone="outline">iOS {item.minIOSVersion}+</Badge>
          {item.liquidGlass ? <Badge tone="outline">Liquid Glass</Badge> : null}
          {item.metal ? <Badge tone="outline">Metal</Badge> : null}
          {item.tags.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
          <dt className="text-subtle">Type</dt><dd className="font-mono">{item.name}</dd>
          <dt className="text-subtle">Files</dt><dd className="font-mono">{[...item.files, ...item.shaders].map((f) => f.target.split("/").pop()).join(", ")}</dd>
          <dt className="text-subtle">Depends on</dt><dd>{item.registryDependencies.length ? item.registryDependencies.join(", ") : "Nothing (Apple frameworks only)"}</dd>
          <dt className="text-subtle">Version</dt><dd className="font-mono">{item.version}</dd>
        </dl>
        {item.requiredCapabilities.length || Object.keys(item.infoPlist).length ? (
          <ul className="mt-4 list-disc pl-5 text-[13px] text-muted">
            {item.requiredCapabilities.map((c) => <li key={c}>Capability <code>{c}</code></li>)}
            {Object.entries(item.infoPlist).map(([k, v]) => <li key={k}>Info.plist <code>{k}</code>: {v}</li>)}
          </ul>
        ) : null}
        {item.pro && proScreens[item.pro] ? (
          <a href={proScreenUrl(item.pro)} className="group mt-6 block rounded-[var(--radius-sm)] bg-surface-2 p-4 transition-colors hover:bg-surface-3">
            <p className="t-meta text-[10px] text-subtle">In a full screen · Swift Pieces Pro</p>
            <p className="mt-2 flex items-center justify-between gap-3 text-[14px] font-semibold text-foreground">
              {proScreens[item.pro].title}
              <span aria-hidden className="text-subtle transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">{proScreens[item.pro].summary}</p>
          </a>
        ) : null}
      </div>
    </div>
  );
}
