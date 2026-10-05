import { interactionById, type Project } from "@swiftpieces/builder";
import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import type { LibraryEntry } from "@/lib/apps";
import { AppBadge, AppSidebarFooter, AppsList } from "./app-sidebar";

/** The page the shell stands in for: an app's recreation. */
export type ShellPage = { kind: "app"; app: LibraryEntry; stepTitles: string[] };

/**
 * A Playground page as the server renders it: the same docked layout and classes as the running
 * app (its own top bar panel included), the Apps tab (every app, as plain links), the app's badge
 * over the loading phone, and the page's real content for crawlers (what to try, how it behaves).
 * A Pro app paints the loading phone too: whether it opens or shows its locked screens depends on
 * the visitor's plan, known only in the browser. The app replaces this in place when its chunk
 * arrives.
 */
export function PlaygroundShell({ page }: { page: ShellPage; project?: Project | null }) {
  const { app } = page;
  const entry = app.pattern;
  const back = { href: `/apps/${app.slug}`, label: `Back to ${app.name}` };
  const crumbs = [{ label: "Apps", href: "/apps" }, { label: app.name, href: `/apps/${app.slug}` }];
  return (
    <div className="spp" data-layout="docked" aria-busy="true">
      <header className="spp-top spp-dockbar">
        <div className="spp-top-lead">
          <Link className="spp-back" href={back.href} aria-label={back.label}>
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="ai ai-nudge" style={{ display: "block", overflow: "visible", ["--ai-x" as string]: "-2.5px" }}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          </Link>
          <Link className="spp-exit" href="/" aria-label="SwiftPieces home">
            <LogoMark />
          </Link>
          <nav className="spp-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={c.href} style={{ display: "contents" }}>
                {i ? <span aria-hidden>/</span> : null}
                <Link href={c.href}>{c.label}</Link>
              </span>
            ))}
            <span style={{ display: "contents" }}><span aria-hidden>/</span><strong>{entry.title}</strong></span>
          </nav>
        </div>
        <div className="spp-seg spp-mode spp-dock-mode" role="radiogroup" aria-label="Mode">
          <button type="button" role="radio" aria-checked="true"><span>Interact</span></button>
          <button type="button" role="radio" aria-checked="false"><span>Inspect</span></button>
        </div>
      </header>
      <aside className="spp-panel spp-left" aria-label="Apps">
        <div className="spp-inspector">
          <div className="spp-panel-head">
            {/* The same tabs as the running Playground, on Apps. */}
            <div className="spp-seg spp-seg-fill" role="tablist" aria-label="Panel" data-count="3">
              <button type="button" role="tab" aria-selected="true">Apps</button>
              <button type="button" role="tab" aria-selected="false">Style</button>
              <button type="button" role="tab" aria-selected="false">Map</button>
            </div>
          </div>
          <div className="spp-inspector-body">
            <div className="spp-screens-tab">
              <AppsList current={app} locked={null} />
              <AppSidebarFooter app={app} />
            </div>
            {/* For readers without the app running: what to try and how it behaves. */}
            <section className="sr-only">
              <h1>{`${entry.title}: a SwiftPieces remix in SwiftUI, inspired by ${app.name}`}</h1>
              <p>{entry.description}</p>
              {entry.try.length ? <ol>{entry.try.map((t) => <li key={t}>{t}</li>)}</ol> : null}
              <ul>
                {entry.interactions.map((id) => {
                  const x = interactionById(id);
                  return x ? <li key={id}>{x.name}: {x.feel}</li> : null;
                })}
              </ul>
            </section>
          </div>
        </div>
      </aside>

      <main className="spp-center">
        <div className="spp-stage">
          <div className="spp-stage-body" data-badge="">
            <div className="spp-stage-badge">
              <AppBadge app={app} />
            </div>
            <div className="spp-fit">
              <div className="spp-device-skeleton" aria-label="Loading the preview" />
            </div>
          </div>
          <div className="spp-stage-foot" />
        </div>
      </main>
    </div>
  );
}
