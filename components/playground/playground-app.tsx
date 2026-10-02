"use client";
// The Free Playground's host: the app library's recreations, one at a time, with free limits and
// registry, this site's analytics beacon, sources for downloads from /r, and "Open in Xcode" from
// app/api/xcode. The Apps tab lists every app (the three free ones first) and opens one in place:
// the address and the page title follow, the page doesn't reload. A Pro app shows its screens
// blurred to anyone without Pro (locked-app.tsx), and for a Pro account its screens come from the
// Pro API (lib/pro-apps.ts). Until the visitor's plan is known a Pro app shows the loading phone,
// never its locked screens, so nothing flashes before a Pro owner's screens open. Pro owners also
// get Pro limits, saves to their account and AI remix. All of that goes to the Pro site's API
// through lib/pro-bridge (a Bearer token, no cookies), which decides on the server what anyone may do.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FREE_LIMITS, PRO_LIMITS, createCatalog, createRegistry, freeDefinitions, type CatalogEntry, type Project } from "@swiftpieces/builder";
import { patternsCatalogSource } from "@swiftpieces/builder/catalog";
import { Playground, beaconTracker, type PlaygroundHost, BuildArt } from "@swiftpieces/builder/react";
import type { SourceResolver } from "@swiftpieces/builder/export";
import { LogoMark } from "@/components/ui/logo";
import { CornerDither } from "@/components/visual/corner-dither";
import { apps, cdn, shotFor, type LibraryEntry } from "@/lib/apps";
import { SCREEN_TAGS } from "@/lib/apps/screen-tags";
import { appForEntry, playgroundPath, playgroundTitle } from "@/lib/playground";
import { proAppsSource } from "@/lib/pro-apps";
import { proFetch, proSignInUrl, proSignUpUrl, useProSession } from "@/lib/pro-bridge";
import { proCatalog } from "@/lib/pro-catalog";
import { site } from "@/lib/site";
import { AppBadge, AppSidebarFooter, AppsSidebar, sidebarItems } from "./app-sidebar";
import { LockedApp } from "./locked-app";

const registry = createRegistry(freeDefinitions);
const track = beaconTracker("/api/events");
/** The app library: the free apps' builds from this bundle, the Pro apps' from the Pro API (Pro accounts only). */
const catalog = createCatalog(patternsCatalogSource, proAppsSource(patternsCatalogSource.entries.filter((e) => e.availability === "pro")));

// The zip writer and Xcode template stay out of this chunk: the resolver loads with the export.
let resolver: Promise<SourceResolver> | null = null;
const resolveSource: SourceResolver = async (piece) => {
  resolver ??= import("@swiftpieces/builder/export").then((m) => m.registryResolver({ free: "/r" }));
  return (await resolver)(piece);
};

/** A Pro API reply as JSON, or an error carrying its message (the Build sheet and inspector show it). */
async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
  return body;
}

/** A saved remix named in the address (#cloud=bp_…), opened from the Pro account's Saved list. */
function cloudIdFromHash(): string | null {
  return /[#&]cloud=(bp_[a-z0-9]{8,32})(?:&|$)/.exec(window.location.hash)?.[1] ?? null;
}

/** An app's screens by name, in step order. */
const stepTitlesOf = (a: LibraryEntry) => (a.pattern.steps ?? []).map((s) => s.title);

/** The stage while the visitor's plan is being checked: the loading phone, as the Playground draws it. */
function StageLoading() {
  return (
    <div className="spp-fit">
      <div className="spp-device-skeleton" aria-busy="true" aria-label="Loading" />
    </div>
  );
}

/** Which page this is: an app's recreation. */
export type PlaygroundPage = { kind: "app"; app: LibraryEntry; stepTitles: string[] };

type Props = { page: PlaygroundPage; project: Project | null; onReady?: () => void };

export default function PlaygroundApp({ page, project, onReady }: Props) {
  const session = useProSession();
  const pro = session === "pro";
  // Any account saves (Pro keeps more); the Pro server enforces who, which plan and how many.
  const signedIn = session === "free" || pro;
  // The app open now: the page's at first, then whichever the Apps tab (or Back) opens in place.
  const [current, setCurrent] = useState<LibraryEntry>(page.app);
  const onEntry = useCallback((e: CatalogEntry | null) => {
    const a = appForEntry(e);
    if (a) setCurrent(a);
  }, []);
  // The saved project each remix updates (by catalog entry), so saving again doesn't make a copy.
  const saved = useRef(new Map<string, string>());
  const remember = useCallback((key: unknown, id: string) => {
    if (typeof key === "string") saved.current.set(key, id);
  }, []);
  // #cloud=<id>: open that saved remix. It waits for the project (a Pro request), then the address
  // is cleaned so a reload or a copied link doesn't carry the id.
  const [cloudId] = useState(cloudIdFromHash);
  const [cloud, setCloud] = useState<Project | null | undefined>(cloudId ? undefined : null);
  useEffect(() => {
    if (!cloudId) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    proFetch(`/api/builder/projects/${cloudId}`)
      .then((r) => (r.ok ? (r.json() as Promise<Project>) : null))
      .then((p) => {
        if (p) remember(p.entry, cloudId);
        setCloud(p);
      })
      .catch(() => setCloud(null));
  }, [cloudId, remember]);
  // ?shot= opens at one App Store screenshot (the app page links here with it); ?screen= at one
  // step of the remix (the App Library's Browse by screen); ?component= selects a component
  // (component pages link here with it).
  const [asked] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const n = Number(q.get("shot"));
    const s = Number(q.get("screen"));
    return { shot: q.has("shot") && Number.isInteger(n) ? n : null, screen: q.has("screen") && Number.isInteger(s) ? s : null, component: q.get("component") };
  });
  const items = useMemo(() => sidebarItems(page.app, page.stepTitles), [page]);
  // Without ?shot= the app opens on its first screen: screens no screenshot answers carry `shot: null`
  // too, so matching null would open the first of those instead.
  const opened = (asked.shot === null ? null : items.find((i) => i.shot === asked.shot)) ?? (asked.screen === null ? null : items.find((i) => i.step === asked.screen)) ?? null;
  // Sign in on the Pro site, then back to the app open now.
  const signInHere = useCallback(() => proSignInUrl(`${window.location.origin}${playgroundPath(current)}`), [current]);

  const host = useMemo<PlaygroundHost>(
    () => ({
      product: "Swift Pieces",
      // What the Playground offers follows the plan; what costs or keeps anything is the server's call.
      limits: pro ? PRO_LIMITS : FREE_LIMITS,
      session: session === "checking" ? null : { signedIn: session !== "signed-out", pro },
      registry,
      catalog,
      basePath: "/playground",
      resolveSource,
      track,
      storageKey: "sp:play",
      back: { href: `/apps/${current.slug}`, label: current.name },
      brand: { href: "/", name: "Swift Pieces", mark: <LogoMark /> },
      // The Build sheet shows the app itself, its screens in its own style, over Pro's animated halftone.
      art: <BuildArt backdrop={<CornerDither />} />,
      crumbs: [{ label: "Apps", href: "/apps" }, { label: current.name, href: `/apps/${current.slug}` }, { label: current.pattern.title }],
      // The site's navbar sits above (app/(builder)/layout.tsx), like the docs; one panel on the left.
      layout: "docked",
      // The screen bar under the phone and the inspiration card read the library through these; the
      // Apps tab replaces the library of screens to add (library: false).
      compose: {
        library: false,
        source: (e) => {
          const at = apps.findIndex((x) => x.pattern.kind === e.kind && x.pattern.slug === e.slug);
          const a = apps[at];
          return a ? { title: a.name, subtitle: a.pattern.title, icon: cdn(a.store.icon, 64), rank: at, href: playgroundPath(a), tags: SCREEN_TAGS[a.slug] } : null;
        },
        art: (e, step, width = 180) => {
          const a = appForEntry(e);
          const shot = a ? shotFor(a, step) : null;
          const img = shot !== null ? a!.store.screenshots[shot] : undefined;
          return img ? cdn(img.url, width) : null;
        },
      },
      sidebar: { label: "Apps", render: () => <AppsSidebar session={session} />, footer: () => <AppSidebarFooter app={current} /> },
      onEntry,
      // The open app, centered above its screens.
      stageBadge: (e) => {
        const a = appForEntry(e);
        return a ? <AppBadge app={a} /> : null;
      },
      // A Pro app before Pro opens it. While the plan is unknown, or a Pro account's screens are on
      // their way, the loading phone: the locked screens show only to someone who doesn't have Pro.
      lockedStage: (e) => {
        const a = appForEntry(e);
        if (!a) return null;
        if (session === "checking" || pro) return <StageLoading />;
        return (
          <LockedApp
            app={a}
            stepTitles={stepTitlesOf(a)}
            session={session}
            signIn={signInHere()}
            onView={() => track("pro_gate_viewed", { kind: e.kind, slug: e.slug, from: "stage" })}
            onPricing={() => track("pro_upgrade_clicked", { from: "locked_app", kind: e.kind, slug: e.slug })}
          />
        );
      },
      saveLimits: { free: 5, pro: 100 },
      ...(signedIn
        ? {
            cloudSave: async (p: Project) => {
              const id = saved.current.get(p.entry ?? "");
              const res = await proFetch("/api/builder/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id ? { ...p, id } : p }) });
              const out = await json<{ id: string }>(res);
              remember(p.entry, out.id);
              return { id: out.id };
            },
          }
        : {}),
      ...(pro
        ? {
            remixWithAI: async (prompt: string, screen: unknown) => {
              const res = await proFetch("/api/builder/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, current: screen }) });
              return (await json<{ root: unknown }>(res)).root;
            },
          }
        : {}),
      links: {
        pro: `${site.proUrl}/pro`,
        component: (def) => def.docs ?? null,
        install: "/docs/installation",
        // Every app has its own page: opening one in place puts it in the address bar.
        entryPath: (e) => {
          const a = appForEntry(e);
          return a ? playgroundPath(a) : playgroundPath(current);
        },
        entryTitle: (e) => {
          const a = appForEntry(e);
          return `${a ? playgroundTitle(a) : e.title} — ${site.name}`;
        },
        xcodeRepo: (blob, appName) => `${window.location.origin}/api/xcode/${blob}/${appName}.git`,
        signIn: (returnTo) => proSignInUrl(returnTo),
        signUp: (returnTo) => proSignUpUrl(returnTo),
        // Everyone without Pro sees what it adds (no prices here). Owners already have it all here.
        ...(pro ? {} : { handoff: { label: "Take it further with Pro", desc: `Unlock all ${proCatalog.remixing.apps} apps and every future app, keep up to ${proCatalog.remixing.saves} remixes and remix with AI, with every screen, template and the Build Kit.`, url: () => `${site.proUrl}/pro`, icon: "crown" as const, backdrop: <CornerDither /> } }),
      },
    }),
    [session, pro, signedIn, current, onEntry, signInHere, remember],
  );
  useEffect(() => {
    if (cloud !== undefined) onReady?.();
  }, [onReady, cloud]);
  if (cloud === undefined) return null;
  const entry = page.app.pattern;
  return <Playground host={host} initial={{ kind: entry.kind, slug: entry.slug, project, component: asked.component, step: opened ? opened.step : null, ...(cloud ? { remix: cloud } : {}) }} />;
}
