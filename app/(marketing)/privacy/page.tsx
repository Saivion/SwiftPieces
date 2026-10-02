import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";

const CONTACT = "saivion@swiftpieces.com";

// Legal: reachable from the footer, not meant to rank.
export const metadata = {
  ...pageMetadata({
    title: "Privacy",
    description: "swiftpieces.com has no accounts and sets no cookies. Playground remixes stay in your browser; analytics store no identifiers. Accounts and purchases are handled on pro.swiftpieces.com under its own policy.",
    path: "/privacy",
  }),
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <ProsePage label="Legal" title="Privacy." lead="We collect what is needed to run the site, and nothing for its own sake.">
      <h2>No accounts, no cookies</h2>
      <p>swiftpieces.com has no accounts and sets no cookies. Accounts, purchases and license handling happen on pro.swiftpieces.com under its own privacy policy.</p>

      <h2>Analytics</h2>
      <p>Page views are counted with Cloudflare Web Analytics, which sets no cookies and stores no visitor ID. The Playground also records anonymous usage events, such as which step of a recreation people reach, so we can improve it. Those events store no IP address, no browser details, no identifiers and nothing you build.</p>

      <h2>The Playground</h2>
      <p>Your remixes are saved in your own browser&apos;s storage and never reach our servers. Clearing your browser data removes them.</p>
      <p>&quot;Open in Xcode&quot; puts your project inside the link Xcode opens. Our server reads it to build the Xcode project and doesn&apos;t keep it.</p>

      <h2>Swift Pieces Pro</h2>
      <p>If you&apos;re signed in to pro.swiftpieces.com, the Playground asks it whether you own Pro, so it can offer Pro features. Your browser sends your Pro session to pro.swiftpieces.com for that check; swiftpieces.com never sees or stores it.</p>

      <h2>App Store content</h2>
      <p>The App Library shows public App Store listings. Screenshots and icons load from Apple&apos;s servers, so your browser requests them from Apple as it would on the App Store.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </ProsePage>
  );
}
