import { ProsePage } from "@/components/ui/prose-page";
export const metadata = { title: "About" };
export default function AboutPage() {
  return (
    <ProsePage label="About" title="The central place for Swift pieces." lead="Swift Pieces exists because iOS developers rebuild the same effects every year, and the good ones never end up in one place.">
      <p>The library is built around three ideas: native, not a port; Liquid Glass first; and agent-native delivery. Every piece is idiomatic SwiftUI you own, verified against the SDK, and installable by you or by your coding agent.</p>
      <p>The free library is the product. Pro funds the maintenance and the monthly cadence of new pieces.</p>
    </ProsePage>
  );
}
