// A project as one URL-safe string, so a project can travel inside a link without being stored
// anywhere: "Open in Xcode" hands Xcode a Git URL that carries the project, and the server rebuilds
// the exact same Xcode project from it on each request. Props equal to their defaults are left out
// (validation fills them back in), then the JSON is deflated and base64url-encoded.
//
// Uses CompressionStream/DecompressionStream, which browsers, Node 18+ and Cloudflare Workers all
// provide, so the same code encodes in the playground and decodes on the server.
import { defaultProps, type ComponentRegistry } from "./registry.js";
import type { Project, ScreenNode } from "./schema.js";
import { MAX_DEPTH } from "./validate.js";

/** Longest encoded project accepted. Keeps the Git URL well inside every server's URL limit. */
export const MAX_SHARE_LENGTH = 12_000;
/** Largest decoded JSON accepted, so a tiny blob can never inflate into something huge. */
const MAX_JSON_BYTES = 512 * 1024;

function compactNode(node: ScreenNode, registry: ComponentRegistry): unknown {
  const def = registry.get(node.component);
  const defaults = def ? defaultProps(def) : {};
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.props)) if (defaults[k] !== v) props[k] = v;
  return {
    id: node.id,
    c: node.component,
    ...(Object.keys(props).length ? { p: props } : {}),
    ...(node.children?.length ? { k: node.children.map((c) => compactNode(c, registry)) } : {}),
  };
}

/** Deeper than validation keeps anyway, so a link nested thousands deep stops here, not in a stack overflow. */
const EXPAND_DEPTH = MAX_DEPTH + 2;

function expandNode(raw: unknown, depth = 0): unknown {
  if (!raw || typeof raw !== "object" || depth > EXPAND_DEPTH) return null;
  const n = raw as { id?: unknown; c?: unknown; p?: unknown; k?: unknown };
  return { id: n.id, component: n.c, props: n.p ?? {}, children: Array.isArray(n.k) ? n.k.map((c) => expandNode(c, depth + 1)) : [] };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function readAll(stream: ReadableStream<Uint8Array>, limit = Infinity): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error("Project is too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function transform(data: Uint8Array, stream: CompressionStream | DecompressionStream, limit?: number): Promise<Uint8Array> {
  const source = new Blob([data.slice().buffer as ArrayBuffer]).stream().pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>);
  return readAll(source, limit);
}

/** The project as a URL-safe string. The id and timestamps are not included. */
export async function encodeProject(project: Project, registry: ComponentRegistry): Promise<string> {
  const compact = {
    n: project.name,
    sh: project.shell,
    t: Math.floor(project.updatedAt / 1000),
    ...(project.tabBar ? { tbar: project.tabBar } : {}),
    ...(project.theme ? { th: project.theme } : {}),
    ...(project.entry ? { e: project.entry } : {}),
    // A tabs app's tab items travel with their screens, so the link opens with the same tab bar.
    s: project.screens.map((s) => ({ id: s.id, n: s.name, r: compactNode(s.root, registry), ...(s.tab ? { tb: s.tab } : {}) })),
  };
  const json = new TextEncoder().encode(JSON.stringify(compact));
  return toBase64Url(await transform(json, new CompressionStream("deflate-raw")));
}

/**
 * Decodes a string made by `encodeProject` into raw project data. The result is untrusted: always
 * pass it through `validateProject` before using it. Throws on anything malformed or oversized.
 */
export async function decodeProject(text: string): Promise<unknown> {
  if (!text || text.length > MAX_SHARE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("Not a project link");
  const json = await transform(fromBase64Url(text), new DecompressionStream("deflate-raw"), MAX_JSON_BYTES);
  const raw = JSON.parse(new TextDecoder().decode(json)) as { n?: unknown; sh?: unknown; t?: unknown; tbar?: unknown; th?: unknown; e?: unknown; s?: unknown };
  const screens = Array.isArray(raw.s) ? raw.s : [];
  return {
    name: raw.n,
    shell: raw.sh,
    tabBar: raw.tbar,
    theme: raw.th,
    // The catalog entry it came from, so a remix handed to another Playground reopens on it.
    entry: raw.e,
    // The time travels in the link, so the same link always rebuilds the same Git commit.
    // Clamped to what a Git commit time can hold, so an absurd value can't break the clone.
    updatedAt: typeof raw.t === "number" && Number.isFinite(raw.t) ? Math.min(Math.max(0, Math.floor(raw.t)), 2 ** 32 - 1) * 1000 : 0,
    screens: screens.slice(0, 64).map((s: { id?: unknown; n?: unknown; r?: unknown; tb?: unknown }) => ({ id: s?.id, name: s?.n, root: expandNode(s?.r), ...(s?.tb ? { tab: s.tb } : {}) })),
  };
}
