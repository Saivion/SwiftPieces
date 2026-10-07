import { defineConfig } from "fumadocs-mdx/config";
import { rehypeCompactCode } from "./lib/compact-code";

// MDX options for the docs collection in lib/source.ts. Fumadocs keeps its defaults (shiki with
// github-light and github-dark, headings, the table of contents), and rehypeCompactCode runs right
// after the highlighter to shrink each code block (lib/compact-code.ts).
export default defineConfig({
  mdxOptions: { rehypePlugins: [rehypeCompactCode] },
});
