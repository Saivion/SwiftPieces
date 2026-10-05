// Server side of the Playground's pages: the project built at build time (so the app starts from
// the finished project), an app's step titles for the sidebar, metadata and structured data. A Pro
// app has no build here (its screens are the Pro API's), so its page carries none of them.
import type { Metadata } from "next";
import { buildCatalogProject, createRegistry, FREE_LIMITS, freeDefinitions, type Project } from "@swiftpieces/builder";
import { JsonLd } from "@/components/seo/json-ld";
import { PlaygroundLoader } from "@/components/playground/playground-loader";
import { PlaygroundShell } from "@/components/playground/playground-shell";
import { APPS_PATH, appPath, isProApp, type LibraryEntry } from "@/lib/apps";
import { playgroundCatalog, playgroundPath, playgroundTitle } from "@/lib/playground";
import { breadcrumbJsonLd, pageMetadata, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";

const registry = createRegistry(freeDefinitions);

export async function buildApp(a: LibraryEntry): Promise<{ project: Project | null; stepTitles: string[] }> {
  const build = isProApp(a) ? null : await playgroundCatalog.load(a.pattern);
  const project = build ? buildCatalogProject(a.pattern, build, registry, FREE_LIMITS) : null;
  const names = project?.screens.map((s) => String(s.root.props.title ?? "").trim() || s.name.replace(/View$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2")) ?? [];
  const stepTitles = a.pattern.steps ? a.pattern.steps.map((s) => s.title) : names;
  return { project, stepTitles };
}

/** "Breathing App in SwiftUI: Try, Inspect and Build (Inspired by Lungy)". */
export function appPlaygroundMetadata(a: LibraryEntry): Metadata {
  return {
    ...pageMetadata({
      title: playgroundTitle(a),
      description: `${a.pattern.description} An original SwiftPieces remix: use it in the browser beside the App Store screens that inspired it, remix it, and open it in Xcode.${isProApp(a) ? " Part of SwiftPieces Pro." : ""}`,
      path: playgroundPath(a),
    }),
    keywords: a.pattern.keywords,
  };
}

export function AppPlaygroundPage({ app: a, project, stepTitles }: { app: LibraryEntry; project: Project | null; stepTitles: string[] }) {
  const path = playgroundPath(a);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${site.url}${path}#page`,
              url: `${site.url}${path}`,
              name: `${a.pattern.title} in SwiftUI`,
              description: a.pattern.description,
              isPartOf: { "@id": WEBSITE_ID },
              about: { "@type": "SoftwareSourceCode", programmingLanguage: "Swift", runtimePlatform: "iOS", name: a.pattern.title, description: a.pattern.summary },
              keywords: a.pattern.keywords?.join(", "),
            },
            breadcrumbJsonLd([["SwiftPieces", "/"], ["Apps", APPS_PATH], [a.name, appPath(a)], [a.pattern.title, path]]),
          ],
        }}
      />
      <PlaygroundLoader page={{ kind: "app", app: a, stepTitles }} project={project}>
        <PlaygroundShell page={{ kind: "app", app: a, stepTitles }} project={project} />
      </PlaygroundLoader>
    </>
  );
}
