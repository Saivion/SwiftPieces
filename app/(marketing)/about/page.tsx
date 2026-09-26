import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({
  title: "About",
  description: "Why Swift Pieces exists: native SwiftUI you own, Liquid Glass first, and pieces your coding agent can install. The free library is the product; Pro funds it.",
  path: "/about",
});
// TODO(content): this page is thin (about 70 words). Expand it with real detail, such as who builds
// Swift Pieces, how pieces are verified, and the release cadence, before relying on it to rank.
export default function AboutPage() {
  return (
    <ProsePage label="About" title="The central place for Swift pieces." lead="Swift Pieces exists because iOS developers rebuild the same effects every year, and the good ones never end up in one place.">
      <p>The library is built around three ideas: native, not a port; Liquid Glass first; and agent-native delivery. Every piece is idiomatic SwiftUI you own, verified against the SDK, and installable by you or by your coding agent.</p>
      <p>The free library is the product. Pro funds the maintenance and the monthly cadence of new pieces.</p>
    </ProsePage>
  );
}
