import { gitUploadPack } from "@/lib/xcode-repo";

// Git's second request in a clone: every object, as one packfile. See lib/xcode-repo.ts.
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ blob: string; repo: string }> }) {
  const { blob, repo } = await ctx.params;
  // A fresh clone wants everything, so the request body (its "want" lines) is never read: it is
  // cancelled, so an oversized or endless body costs nothing.
  await req.body?.cancel().catch(() => {});
  return gitUploadPack(blob, repo);
}
