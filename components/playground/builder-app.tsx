"use client";
import "@swiftpieces/builder/builder.css";
import { useMemo } from "react";
import { FREE_LIMITS, createRegistry, createTemplateRegistry, freeDefinitions, freeTemplates } from "@swiftpieces/builder";
import { Builder, beaconTracker, type BuilderEntry, type BuilderHost } from "@swiftpieces/builder/react";
import type { SourceResolver } from "@swiftpieces/builder/export";
import { lockedComponents, lockedTemplates, proBuilderUrl } from "@/lib/playground";

const registry = createRegistry(freeDefinitions);
const templates = createTemplateRegistry(freeTemplates, lockedTemplates);

// The zip writer and Xcode template stay out of this chunk: the resolver loads with the export.
let resolver: Promise<SourceResolver> | null = null;
const resolveSource: SourceResolver = async (piece) => {
  resolver ??= import("@swiftpieces/builder/export").then((m) => m.registryResolver({ free: "/r" }));
  return (await resolver)(piece);
};

/** Reads ?component= and ?template= once. Accepts a builder id, a piece slug or a Swift type name. */
function readEntry(): BuilderEntry {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get("component");
  const component = raw ? (registry.get(raw)?.id ?? registry.all.find((d) => d.source?.name === raw)?.id ?? raw) : null;
  return { component, template: q.get("template") };
}

export default function BuilderApp() {
  const host = useMemo<BuilderHost>(
    () => ({
      product: "SwiftPieces",
      limits: FREE_LIMITS,
      registry,
      templates,
      locked: lockedComponents,
      resolveSource,
      track: beaconTracker("/api/events"),
      storageKey: "sp:playground",
      links: {
        pro: proBuilderUrl,
        docs: (path) => path,
        install: "/docs/installation",
      },
    }),
    [],
  );
  const entry = useMemo(readEntry, []);
  return <Builder host={host} entry={entry} />;
}
