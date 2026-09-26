import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { cliCommand, mcpPrompt } from "@/lib/registry-paths";
import { Command } from "@/components/ui/code";
import { pro } from "@/lib/site";

/**
 * Two ways to install, not two steps: the terminal command, or a prompt for a coding agent that is
 * connected to the MCP server. The raw registry JSON is documented in the Installation guide, not here.
 */
export function PieceInstall({ item }: { item: RegistryIndexEntry }) {
  return (
    <section className="not-prose mt-12" aria-labelledby="install-heading">
      <h2 id="install-heading" className="t-h3">Install</h2>
      <p className="mt-2 text-[13px] text-muted">Pick one. Run it from the folder that contains your <code className="font-mono text-foreground">.xcodeproj</code> and the files land inside your app.</p>

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

      <p className="mt-5 text-[12.5px] text-muted">Or copy the source above into your app.</p>
      <p className="mt-6 flex items-center gap-2 rounded-[var(--radius)] bg-surface px-4 py-3 text-[12.5px] text-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
        Building a whole app?{" "}
        <a href={pro.library} className="u-link font-semibold text-foreground">See Swift Pieces Pro →</a>
      </p>
    </section>
  );
}
