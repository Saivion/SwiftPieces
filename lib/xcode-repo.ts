// "Open in Xcode": the playground turns the project into a link, and these routes serve that link
// as a Git repository Xcode can clone (`xcode://clone?repo=…`). Nothing is stored: the project
// travels inside the URL, and every request rebuilds the same Xcode project from it, with the free
// pieces' sources read from this site's own registry.
import { createRegistry, decodeProject, FREE_LIMITS, freeDefinitions, validateProject } from "@swiftpieces/builder";
import { advertiseRefs, uploadPack, xcodeRepo, type GitRepo } from "@swiftpieces/builder/export";
import { loadFullRegistryItem } from "@/lib/registry";

const registry = createRegistry(freeDefinitions);

/** Recently built repositories, so the two requests of one clone build the project once. */
const cache = new Map<string, Promise<GitRepo>>();
const CACHE_SIZE = 16;

async function resolveSource(piece: { registry: "free" | "pro"; name: string }) {
  if (piece.registry !== "free") throw new Error("Pro sources are not served here");
  const item = await loadFullRegistryItem(piece.name);
  if (!item) throw new Error(`Unknown piece ${piece.name}`);
  return [...item.files, ...item.shaders, ...item.assets]
    .filter((f): f is typeof f & { content: string } => typeof f.content === "string")
    .map((f) => ({ target: f.target, content: f.content }));
}

async function build(blob: string): Promise<GitRepo> {
  const { value } = validateProject(await decodeProject(blob), registry, FREE_LIMITS);
  return (await xcodeRepo(value, registry, resolveSource)).repo;
}

function repoFor(blob: string): Promise<GitRepo> {
  let job = cache.get(blob);
  if (!job) {
    job = build(blob);
    cache.set(blob, job);
    job.catch(() => cache.delete(blob));
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  }
  return job;
}

const NO_CACHE = { "Cache-Control": "no-cache, max-age=0, must-revalidate", "X-Robots-Tag": "noindex" };

function bad(message: string, status = 400) {
  return new Response(`${message}\n`, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_CACHE } });
}

/** `[repo]` is "<AppName>.git": the name Xcode gives the folder it clones into. */
const validRepo = (repo: string) => /^[A-Za-z][A-Za-z0-9]{0,31}\.git$/.test(repo);

export async function infoRefs(req: Request, blob: string, repo: string): Promise<Response> {
  if (!validRepo(repo)) return bad("Not a repository", 404);
  if (new URL(req.url).searchParams.get("service") !== "git-upload-pack") return bad("Only cloning is supported", 403);
  try {
    const body = advertiseRefs(await repoFor(blob));
    return new Response(body.slice().buffer as ArrayBuffer, { headers: { "Content-Type": "application/x-git-upload-pack-advertisement", ...NO_CACHE } });
  } catch {
    return bad("This project link is not valid", 404);
  }
}

export async function gitUploadPack(blob: string, repo: string): Promise<Response> {
  if (!validRepo(repo)) return bad("Not a repository", 404);
  try {
    const body = await uploadPack(await repoFor(blob));
    return new Response(body.slice().buffer as ArrayBuffer, { headers: { "Content-Type": "application/x-git-upload-pack-result", ...NO_CACHE } });
  } catch {
    return bad("This project link is not valid", 404);
  }
}
