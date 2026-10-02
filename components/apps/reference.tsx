import { cdn, type AppStoreFacts } from "@/lib/apps";

/** "From the App Store · Reference only · © Developer": the label that sits on every piece of third-party material. */
export function ReferenceLabel({ app }: { app: AppStoreFacts }) {
  return (
    <p className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1 uppercase tracking-[0.1em] text-muted">
      <span className="font-semibold">From the App Store</span>
      <span aria-hidden>·</span>
      <span>Reference only</span>
      <span aria-hidden>·</span>
      <span className="normal-case tracking-normal">© {app.developer}</span>
    </p>
  );
}

/** The app's identity as the App Store lists it, with the link back to its page there. */
export function AppIdentity({ app, name, heading: Heading = "h1" }: { app: AppStoreFacts; name: string; heading?: "h1" | "h2" }) {
  return (
    <div className="flex items-center gap-4">
      <img src={cdn(app.icon, 160)} alt={`${name} app icon`} width={64} height={64} className="size-16 flex-none rounded-[15px] bg-[var(--surface-muted)]" />
      <div className="min-w-0">
        <Heading className="text-[20px] leading-tight font-semibold text-balance text-foreground sm:text-[24px]">{app.name}</Heading>
        <p className="mt-1 text-[13px] text-muted">
          {app.developer} · {app.category}
          {app.rating ? <> · {app.rating.toFixed(1)} ★ ({app.ratingCount.toLocaleString("en-US")})</> : null} · {app.price}
        </p>
      </div>
    </div>
  );
}

export function AppStoreLink({ app }: { app: AppStoreFacts }) {
  return (
    <a href={app.url} target="_blank" rel="noopener noreferrer" className="u-link inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
      View on the App Store
      <svg aria-hidden viewBox="0 0 16 16" className="ai ai-out size-3.5 overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 10.5l5-5M6.5 5.5h4v4" />
      </svg>
    </a>
  );
}

