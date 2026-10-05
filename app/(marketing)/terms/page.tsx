import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

const CONTACT = "saivion@swiftpieces.com";

// Legal: reachable from the footer and the App Library, not meant to rank.
export const metadata = {
  ...pageMetadata({
    title: "Terms",
    description: "Use the pieces in your apps, don't resell the library. How the App Library shows third-party apps, who is responsible for what you build, and how to ask for removal.",
    path: "/terms",
  }),
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <ProsePage label="Legal" title="Terms." lead="Short version: use the pieces in your apps, don't resell the library, and build your own app, not a copy of someone else's.">
      <p>These terms cover swiftpieces.com, its App Library and Playground, and the free SwiftPieces library. By using the site you agree to them. SwiftPieces Pro, sold on pro.swiftpieces.com, is covered by these terms and by any terms on that site.</p>

      <h2>The free library</h2>
      <p>
        The free pieces are provided as-is under MIT + Commons Clause. Use them in any app, including client work; don't sell or redistribute the pieces themselves. The <a href="/license">License</a> page explains it in plain English, and the legal text is in the{" "}
        <a href={`${site.github}/blob/main/LICENSE`}>LICENSE</a> file of the public repository.
      </p>

      <h2>SwiftPieces Pro</h2>
      <p>SwiftPieces Pro is a one-time purchase and a per-developer license with lifetime access. Each developer using Pro pieces needs their own license. Refunds are available within 14 days if you have not downloaded Pro content.</p>

      <h2 id="third-party-apps">The App Library and third-party apps</h2>
      <p>The App Library shows apps that are publicly listed on Apple&apos;s App Store. Each app&apos;s name, icon, screenshots and listing details come from its public App Store listing, are credited to its developer, and link to the app&apos;s App Store page. Screenshots are shown as the App Store serves them; we don&apos;t copy, host or sell them, and none of them sit behind SwiftPieces Pro.</p>
      <p>The apps shown belong to their developers. Their names, icons, screenshots, trademarks and designs remain the property of their respective owners. SwiftPieces is not affiliated with, sponsored by or endorsed by any app shown, or by Apple. An app&apos;s name appears only to identify it.</p>

      <h2 id="recreations">Recreations and what you build</h2>
      <p>Each recreation in the App Library and the Playground is original SwiftUI written by SwiftPieces, with our own names, copy and colors. It shows how a kind of screen or interaction can be built. It is not the app&apos;s code, assets or design files, and it is not presented as the app&apos;s interface.</p>
      <p>You are responsible for what you build and ship with the Playground, the recreations, your remixes and the SwiftPieces library. Use them to learn and to build your own app. Don&apos;t use them to reproduce another app&apos;s protected name, branding, artwork, content or overall look, and follow the App Store Review Guidelines, including the rule against copycat apps. SwiftPieces is not responsible for how you use what you build.</p>
      <p>The SwiftPieces license covers SwiftPieces code only. It grants no rights to any third-party app, screenshot or trademark.</p>

      <h2 id="removal">Removal requests</h2>
      <p>
        If you develop an app shown in the App Library, or hold rights in anything shown, you can ask us to remove it. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with the app, the pages concerned, and a statement that you own the material or act for its owner. We reply promptly, and where a request is valid we remove the material; an app can be taken out of the library entirely the same day.
      </p>

      <h2>No warranty</h2>
      <p>The site, the Playground, the recreations and the free library are provided as-is, without warranties of any kind. We don&apos;t promise they are complete, accurate, error-free or always available, and App Store details can be out of date.</p>

      <h2>Limitation of liability</h2>
      <p>To the extent the law allows, SwiftPieces is not liable for any indirect, incidental or consequential damages, or for any loss arising from your use of the site, the Playground, the recreations or the library, or from what you build with them.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The current version is always on this page, and continuing to use the site means you accept it.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the United States.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </ProsePage>
  );
}
