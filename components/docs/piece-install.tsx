import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { cliCommand, mcpPrompt } from "@/lib/registry-paths";
import { Command } from "@/components/ui/code";
import { pro } from "@/lib/site";
import { WebBridgeNote } from "@/components/sections/web-bridge-note";

/**
 * Two ways to install, not two steps: the terminal command, or a prompt for a coding agent that is
 * connected to the MCP server. The raw registry JSON is documented in the Installation guide, not here.
 */
export function PieceInstall({ item }: { item: Pick<RegistryIndexEntry, "name" | "title" | "registryDependencies"> & { type?: string } }) {
  const block = item.type === "registry:block";
  return (
    <section className="not-prose mt-12" aria-labelledby="install-heading">
      <h2 id="install-heading" className="t-h3">Install</h2>
      <p className="mt-2 text-[13px] text-muted">Pick one. Run it from the folder that contains your <code className="font-mono text-foreground">.xcodeproj</code> and the files land inside your app.</p>
      {block ? (
        <p className="mt-2 text-[13px] text-muted">
          A block installs with the pieces it is built from: <span className="text-foreground">{item.name}</span> goes to <code className="font-mono text-foreground">SwiftPieces/Blocks/</code>, and {listOf(item.registryDependencies)} land beside your other pieces. A piece you already have is skipped, never overwritten.
        </p>
      ) : null}

      <div className="mt-5 grid gap-5">
        <div className="grid gap-2">
          <p className="text-[12px] font-semibold text-foreground">Terminal</p>
          <Command text={cliCommand(item)} />
        </div>
        <div className="grid gap-2">
          <p className="text-[12px] font-semibold text-foreground">
            Or ask your coding agent <span className="font-normal text-muted">· Claude Code, Cursor or Xcode, once the <a href="/docs/mcp" className="u-link text-foreground">MCP server</a> is connected</span>
          </p>
          <Command text={mcpPrompt(item)} prompt=">" />
        </div>
      </div>

      <p className="mt-5 text-[12.5px] text-muted">{block ? "Or copy the source above into your app, with the source of each piece it is built from." : "Or copy the source above into your app."}</p>
      <WebBridgeNote className="mt-6" />
      <p className="mt-6 flex items-center gap-2 rounded-full bg-surface px-4 py-3 text-[13px] text-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
        Building a whole app?{" "}
        <a href={pro.library} className="u-link font-semibold text-foreground">See SwiftPieces Pro →</a>
      </p>
    </section>
  );
}

/** "FormField, SecureEntry and CommitButton". */
function listOf(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
