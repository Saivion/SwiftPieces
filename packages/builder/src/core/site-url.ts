// Where the text the Playground writes for coding agents (the copied prompt, the export's AGENTS.md)
// points them: the public site, or the local dev server when the Playground is running on one, so a
// prompt copied from localhost sends the agent's MCP calls, catalog reads and installs there too.

export const PUBLIC_SITE = "https://swiftpieces.com";

/** The site an agent should use: this page's origin on a local dev host, else the public site. */
export function agentSiteUrl(): string {
  if (typeof window === "undefined") return PUBLIC_SITE;
  const { hostname, origin } = window.location;
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".test");
  return local ? origin : PUBLIC_SITE;
}

/** `npx swiftpieces add <Name>`, pointed at `site`'s registry when that isn't the public one. */
export function addCommand(site: string): string {
  return site === PUBLIC_SITE ? "npx swiftpieces add <Name>" : `SWIFTPIECES_REGISTRY=${site}/r npx swiftpieces add <Name>`;
}
