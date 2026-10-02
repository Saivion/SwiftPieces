// Just enough of Git to let Xcode clone a generated project over HTTPS, with no repository on disk.
//
// Xcode's "Clone Git Repository" (and GitHub's "Open with Xcode", `xcode://clone?repo=…`) speak
// Git's smart HTTP protocol. A clone needs exactly two responses from the server:
//
//   GET  <repo>/info/refs?service=git-upload-pack   the branch list (one branch, one commit)
//   POST <repo>/git-upload-pack                      "NAK" and a packfile holding every object
//
// A fresh clone has nothing to negotiate, so the server never needs to read what the client wants
// beyond "everything". Objects are loose (no deltas): blobs, one tree per folder, one commit. The
// commit is deterministic (fixed author and time), so both requests agree on the same commit id.
//
// Web platform APIs only (SubtleCrypto SHA-1 and CompressionStream), so this runs unchanged in a
// Cloudflare Worker, in Node 18+ and in a browser.

export type GitFile = { path: string; content: string | Uint8Array };
type GitObject = { type: "commit" | "tree" | "blob"; body: Uint8Array; id: string };
export type GitRepo = { head: string; objects: GitObject[] };

const enc = new TextEncoder();
const TYPE_CODE = { commit: 1, tree: 2, blob: 3 } as const;

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-1", data.slice().buffer as ArrayBuffer));
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

/** zlib-wrapped deflate, the format Git stores object data in. */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.slice().buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream("deflate") as unknown as TransformStream<Uint8Array, Uint8Array>);
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concat(chunks);
}

async function object(type: GitObject["type"], body: Uint8Array): Promise<GitObject> {
  const header = enc.encode(`${type} ${body.length}\0`);
  return { type, body, id: hex(await sha1(concat([header, body]))) };
}

type Dir = { files: Map<string, Uint8Array>; dirs: Map<string, Dir> };

/** Writes a folder's tree (children first) and returns its object. */
async function writeTree(dir: Dir, out: GitObject[]): Promise<GitObject> {
  const entries: Array<{ name: string; sortKey: string; mode: string; id: string }> = [];
  for (const [name, content] of dir.files) {
    const blob = await object("blob", content);
    out.push(blob);
    entries.push({ name, sortKey: name, mode: "100644", id: blob.id });
  }
  for (const [name, sub] of dir.dirs) {
    const tree = await writeTree(sub, out);
    // Git orders a folder as if its name ended in "/".
    entries.push({ name, sortKey: `${name}/`, mode: "40000", id: tree.id });
  }
  entries.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  const body = concat(entries.flatMap((e) => [enc.encode(`${e.mode} ${e.name}\0`), unhex(e.id)]));
  const tree = await object("tree", body);
  out.push(tree);
  return tree;
}

/** Builds every object for a one-commit repository holding `files`. */
export async function buildGitRepo(files: GitFile[], opts: { message: string; author?: string; email?: string; time?: number }): Promise<GitRepo> {
  const root: Dir = { files: new Map(), dirs: new Map() };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    if (!parts.length || parts.some((p) => p === "." || p === ".." || p === ".git")) throw new Error(`Bad path ${f.path}`);
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.dirs.get(part);
      if (!next) dir.dirs.set(part, (next = { files: new Map(), dirs: new Map() }));
      dir = next;
    }
    dir.files.set(parts[parts.length - 1], typeof f.content === "string" ? enc.encode(f.content) : f.content);
  }
  const objects: GitObject[] = [];
  const tree = await writeTree(root, objects);
  const who = `${opts.author ?? "Swift Pieces"} <${opts.email ?? "noreply@swiftpieces.com"}> ${Math.floor(opts.time ?? 0)} +0000`;
  const commit = await object("commit", enc.encode(`tree ${tree.id}\nauthor ${who}\ncommitter ${who}\n\n${opts.message.trim()}\n`));
  objects.push(commit);
  return { head: commit.id, objects };
}

/** One pkt-line: four hex digits of total length, then the payload. */
function pkt(line: string): Uint8Array {
  const body = enc.encode(line);
  return concat([enc.encode((body.length + 4).toString(16).padStart(4, "0")), body]);
}
const FLUSH = enc.encode("0000");

/** Body for `GET info/refs?service=git-upload-pack`: one branch, main, which HEAD points to. */
export function advertiseRefs(repo: GitRepo): Uint8Array {
  const caps = "symref=HEAD:refs/heads/main agent=git/swiftpieces";
  return concat([
    pkt("# service=git-upload-pack\n"),
    FLUSH,
    pkt(`${repo.head} HEAD\0${caps}\n`),
    pkt(`${repo.head} refs/heads/main\n`),
    FLUSH,
  ]);
}

/** Pack entry header: type and inflated size as Git's little-endian varint. */
function entryHeader(type: GitObject["type"], size: number): Uint8Array {
  const bytes: number[] = [];
  let byte = (TYPE_CODE[type] << 4) | (size & 0x0f);
  let rest = Math.floor(size / 16);
  while (rest > 0) {
    bytes.push(byte | 0x80);
    byte = rest & 0x7f;
    rest = Math.floor(rest / 128);
  }
  bytes.push(byte);
  return Uint8Array.from(bytes);
}

/** Body for `POST git-upload-pack`: NAK (nothing in common), then a packfile of every object. */
export async function uploadPack(repo: GitRepo): Promise<Uint8Array> {
  const header = new Uint8Array(12);
  header.set(enc.encode("PACK"), 0);
  const view = new DataView(header.buffer);
  view.setUint32(4, 2);
  view.setUint32(8, repo.objects.length);
  const entries = await Promise.all(repo.objects.map(async (o) => concat([entryHeader(o.type, o.body.length), await deflate(o.body)])));
  const pack = concat([header, ...entries]);
  return concat([pkt("NAK\n"), pack, await sha1(pack)]);
}

/** A standard ignore file for Xcode projects, so a clone never commits build products. */
export const XCODE_GITIGNORE = ["# Xcode", "xcuserdata/", "DerivedData/", "build/", "*.xcuserstate", ".DS_Store", ""].join("\n");
