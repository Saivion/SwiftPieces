import { ProsePage } from "@/components/ui/prose-page";
export const metadata = { title: "Terms" };
export default function TermsPage() {
  return (
    <ProsePage label="Legal" title="Terms." lead="Short version: use the pieces in your apps, don't resell the library.">
      <p>The free library is provided as-is under MIT + Commons Clause. Swift Pieces Pro is a one-time, per-developer purchase with lifetime access. Each developer using Pro pieces needs their own. Refunds within 14 days if you have not downloaded Pro content.</p>
      <p>Full terms ship with the Pro launch.</p>
    </ProsePage>
  );
}
