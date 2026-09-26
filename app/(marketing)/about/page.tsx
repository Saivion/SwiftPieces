import Link from "next/link";
import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";
import { pro } from "@/lib/site";

export const metadata = pageMetadata({
  title: "About",
  description: "Why Swift Pieces exists, what earns a place in the free SwiftUI component library, how every piece is built and verified, and how it is funded.",
  path: "/about",
});

/**
 * Every statement here is one the site already makes elsewhere: the docs introduction (what earns a
 * place, what a piece is, the three ways to install, verified APIs), the license page and the footer
 * credit. Keep it in step with those pages rather than adding claims of its own.
 */
export default function AboutPage() {
  return (
    <ProsePage label="About" title="The central place for Swift pieces." lead="Swift Pieces exists because iOS developers rebuild the same effects every year, and the good ones never end up in one place.">
      <p>The library is built around three ideas: native, not a port; Liquid Glass first; and agent-native delivery. Every piece is idiomatic SwiftUI you own, verified against the SDK, and installable by you or by your coding agent.</p>

      <h2>What earns a place</h2>
      <p>A piece is here because it saves an afternoon: the design, the motion, the gesture physics, the haptics and the states are already done. If a coding agent could produce it from a one-sentence prompt, it is not in the library. Every piece passes four tests: it is hard to recreate, it looks designed before it moves, a good developer would ship it, and its interaction is iPhone-first.</p>

      <h2>What you get</h2>
      <ul>
        <li>One self-contained <code>.swift</code> file per piece, named after its primary type, with a <code>#Preview</code>.</li>
        <li>Apple frameworks only, with no third-party dependencies.</li>
        <li>An iOS 17 baseline. Liquid Glass pieces target iOS 26 and fall back to Material on earlier versions.</li>
        <li>Customization through parameters with sensible defaults, not forks.</li>
        <li>Accessibility by default: Dynamic Type, semantic colors, and respect for Reduce Motion and Reduce Transparency.</li>
      </ul>

      <h2>How pieces are verified</h2>
      <p>Every Apple API in the library is checked against developer.apple.com and type-checked against the iOS 26 SDK in CI. Modifiers that only exist in tutorials never make it in.</p>

      <h2>Three ways to install</h2>
      <p>Copy a piece&apos;s source into your app, add it with the <Link href="/docs/cli">swiftpieces CLI</Link>, or ask your coding agent through the <Link href="/docs/mcp">MCP server</Link>. The <Link href="/docs/installation">installation guide</Link> covers each one.</p>

      <h2>Who builds it and how it is funded</h2>
      <p>Swift Pieces is curated by Saivion. The free library is the product, available under <Link href="/license">MIT + Commons Clause</Link>: use the pieces in any app, including client work. <a href={pro.home}>Swift Pieces Pro</a>, with production-ready screens and complete app templates, funds the maintenance and the new pieces.</p>
    </ProsePage>
  );
}
