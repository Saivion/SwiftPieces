import { ProsePage } from "@/components/ui/prose-page";
import { site } from "@/lib/site";
export const metadata = { title: "License" };
export default function LicensePage() {
  return (
    <ProsePage label="Legal" title="License." lead="Free pieces are MIT + Commons Clause. Pro is a single-developer commercial license. Both in plain English.">
      <h2>Free pieces</h2>
      <p>Every free piece is free for personal and commercial use as part of an application, website or product. Copy them, modify them, ship them in any number of products, including client work.</p>
      <p>You may not sell, sublicense, or redistribute the pieces themselves, whether alone, in a bundle, or as a ported version. That is the only restriction.</p>
      <p>The legal text is MIT + Commons Clause License Condition v1.0, in the <a href={`${site.github}/blob/main/LICENSE`}>LICENSE</a> file of the public repository.</p>
      <h2>Swift Pieces Pro</h2>
      <p>Swift Pieces Pro is a one-time purchase and a per-developer license. It covers the person who holds it across unlimited personal and commercial apps, including client work, with lifetime access to the complete library and everything added to it later.</p>
      <p>You cannot resell or redistribute the Pro pieces as a competing library, and you cannot share your license key with people who do not hold a license.</p>
      <h2>Teams</h2>
      <p>Each developer who installs or works with Pro pieces needs their own license. Contributors who only build, review or ship the app without touching the pieces themselves do not. Team and volume pricing is available by email, and the full text ships with the Pro launch.</p>
    </ProsePage>
  );
}
