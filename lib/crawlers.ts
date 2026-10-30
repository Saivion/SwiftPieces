/**
 * AI crawlers named in robots.txt.
 *
 * A `User-agent: *` allow already covers them. Naming each one is an explicit allow, so an answer
 * engine does not have to guess whether the site wants to be read. The same disallow as the star
 * rule applies: `/api/` is the CLI and MCP protocol, not a page. `/llms.txt` stays allowed.
 *
 * Tokens below are the published crawler names (OpenAI, Perplexity, Anthropic, Google, Apple,
 * Amazon, Common Crawl, ByteDance, Meta, Cohere, You.com).
 */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "CCBot",
  "Bytespider",
  "Meta-ExternalAgent",
  "cohere-ai",
  "YouBot",
] as const;
