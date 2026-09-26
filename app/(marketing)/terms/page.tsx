import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";
// Legal boilerplate: reachable from the footer, not meant to rank.
export const metadata = {
  ...pageMetadata({
    title: "Terms",
    description: "Use the pieces in your apps, don't resell the library. Free pieces are provided as-is; Pro is a one-time, per-developer purchase.",
    path: "/terms",
  }),
  robots: { index: false, follow: true },
};
export default function TermsPage() {
  return (
    <ProsePage label="Legal" title="Terms." lead="Short version: use the pieces in your apps, don't resell the library.">
      <p>The free library is provided as-is under MIT + Commons Clause. Swift Pieces Pro is a one-time, per-developer purchase with lifetime access. Each developer using Pro pieces needs their own. Refunds within 14 days if you have not downloaded Pro content.</p>
      <p>Full terms ship with the Pro launch.</p>
    </ProsePage>
  );
}
