// Export entry point, loaded on demand when someone opens Export: the zip writer and the Xcode
// project template never ship with the builder's first load.
import { generateProject, type GeneratedProject } from "../core/generate.js";
import type { ComponentRegistry } from "../core/registry.js";
import type { Project } from "../core/schema.js";
import { xcodeProjectFiles, type SourceFile } from "./xcode.js";
import { zip } from "./zip.js";

export { zip, crc32 } from "./zip.js";
export { xcodeProjectFiles } from "./xcode.js";

export type PieceRef = { registry: "free" | "pro"; name: string };
/** Fetches a SwiftPieces component's source files, with install paths such as "SwiftPieces/Controls/X.swift". */
export type SourceResolver = (piece: PieceRef) => Promise<Array<{ target: string; content: string }>>;

export type ExportResult = {
  generated: GeneratedProject;
  files: SourceFile[];
  archive: Uint8Array;
  /** Components whose source could not be fetched; the archive's README says how to add them. */
  missing: PieceRef[];
};

/** Capability notes for the README, from what the generated code imports. */
function notesFor(generated: GeneratedProject): string[] {
  const imports = new Set(generated.screens.flatMap((s) => s.imports));
  const notes: string[] = [];
  if (imports.has("AuthenticationServices")) {
    notes.push("Sign in with Apple: in Xcode select the app target, open Signing & Capabilities, press + Capability and add Sign in with Apple. The button builds without it, but sign-in only completes once it is enabled.");
  }
  return notes;
}

export async function exportXcodeProject(project: Project, registry: ComponentRegistry, resolve: SourceResolver): Promise<ExportResult> {
  const generated = generateProject(project, registry);
  const missing: PieceRef[] = [];
  const pieceFiles = new Map<string, string>();
  await Promise.all(
    generated.pieces.map(async (p) => {
      try {
        for (const f of await resolve(p)) pieceFiles.set(f.target, f.content);
      } catch {
        missing.push(p);
      }
    }),
  );
  const notes = notesFor(generated);
  if (missing.length) {
    notes.push(`Some component sources could not be downloaded. From the project folder, run: npx swiftpieces add ${missing.map((m) => m.name).join(" ")}`);
  }
  const sources: SourceFile[] = [
    ...generated.files,
    ...[...pieceFiles.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({ path, content })),
  ];
  const files = xcodeProjectFiles({ appName: generated.appName, sources, notes });
  return { generated, files, archive: zip(files), missing };
}

/** Screen files plus component sources, flat, for "Download Swift files" (no Xcode project). */
export async function exportSwiftFiles(project: Project, registry: ComponentRegistry, resolve: SourceResolver): Promise<{ archive: Uint8Array; missing: PieceRef[] }> {
  const generated = generateProject(project, registry);
  const missing: PieceRef[] = [];
  const entries: SourceFile[] = generated.files.map((f) => ({ path: `${generated.appName}/${f.path}`, content: f.content }));
  await Promise.all(
    generated.pieces.map(async (p) => {
      try {
        for (const f of await resolve(p)) entries.push({ path: `${generated.appName}/${f.target}`, content: f.content });
      } catch {
        missing.push(p);
      }
    }),
  );
  return { archive: zip(entries), missing };
}

/**
 * A resolver over SwiftPieces registry endpoints. `free` and `pro` are base URLs such as
 * "https://swiftpieces.com/r". Pro items list `dependencies` (the design system), fetched too.
 */
export function registryResolver(bases: { free: string; pro?: string }, init?: RequestInit): SourceResolver {
  const cache = new Map<string, Promise<Array<{ target: string; content: string }>>>();
  const fetchItem = (registry: "free" | "pro", name: string): Promise<Array<{ target: string; content: string }>> => {
    const key = `${registry}:${name}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const base = registry === "pro" ? bases.pro : bases.free;
    const job = (async () => {
      if (!base) throw new Error(`No ${registry} registry`);
      const res = await fetch(`${base}/${encodeURIComponent(name)}.json`, registry === "pro" ? { credentials: "include", ...init } : init);
      if (!res.ok) throw new Error(`${name}: ${res.status}`);
      const item = (await res.json()) as {
        files?: Array<{ target: string; content?: string }>;
        shaders?: Array<{ target: string; content?: string }>;
        dependencies?: string[];
        registryDependencies?: string[];
        entitled?: boolean;
      };
      if (item.entitled === false) throw new Error(`${name}: not entitled`);
      const files = [...(item.files ?? []), ...(item.shaders ?? [])].filter((f): f is { target: string; content: string } => typeof f.content === "string");
      if (!files.length) throw new Error(`${name}: no files`);
      const deps = registry === "pro" ? (item.dependencies ?? []) : (item.registryDependencies ?? []);
      const nested = await Promise.all(deps.map((d) => fetchItem(registry, d)));
      return [...files, ...nested.flat()];
    })();
    cache.set(key, job);
    job.catch(() => cache.delete(key));
    return job;
  };
  return (p) => fetchItem(p.registry, p.name);
}
