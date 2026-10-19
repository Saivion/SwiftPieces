import { cdn, type AppStoreFacts } from "@/lib/apps";

/** "From the App Store · Reference only · © Developer": the label that sits on every piece of third-party material. */
export function ReferenceLabel({ app }: { app: AppStoreFacts }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-muted">
      <span className="text-foreground">From the App Store</span>
      <span aria-hidden className="text-subtle">·</span>
      <span>Reference only</span>
      <span aria-hidden className="text-subtle">·</span>
      <span>© {app.developer}</span>
    </p>
  );
}

/** The app's identity as the App Store lists it, with the link back to its page there. */
export function AppIdentity({ app, name, heading: Heading = "h1" }: { app: AppStoreFacts; name: string; heading?: "h1" | "h2" }) {
  return (
    <div className="flex items-center gap-4">
      <img src={cdn(app.icon, 160)} alt={`${name} app icon`} width={64} height={64} className="size-16 flex-none rounded-[15px] bg-[var(--surface-muted)]" />
      <div className="min-w-0">
        <Heading className="text-[30px] leading-[1.05] font-normal tracking-[-0.035em] text-balance text-foreground sm:text-[38px] sm:tracking-[-0.038em]">{app.name}</Heading>
        <p className="mt-1.5 text-[13.5px] text-muted">
          {app.developer} · {app.category}
          {app.rating ? <> · {app.rating.toFixed(1)} ★ ({app.ratingCount.toLocaleString("en-US")})</> : null} · {app.price}
        </p>
      </div>
    </div>
  );
}

export function AppStoreLink({ app }: { app: AppStoreFacts }) {
  return (
    <a href={app.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-[38px] items-center gap-1.5 px-1 text-[14px] font-semibold text-foreground">
      View on the App Store
      <svg aria-hidden viewBox="0 0 16 16" className="ai ai-out size-4 overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 10.5l5-5M6.5 5.5h4v4" />
      </svg>
    </a>
  );
}

