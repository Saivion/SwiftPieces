import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";

const CONTACT = "saivion@swiftpieces.com";

// Legal: reachable from the footer, not meant to rank.
export const metadata = {
  ...pageMetadata({
    title: "Privacy",
    description: "swiftpieces.com has no accounts and sets no cookies. Playground remixes stay in your browser, and analytics keep nothing on your device. Accounts and purchases are handled on pro.swiftpieces.com under its own policy.",
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
      <p>We measure page views, clicks and Playground usage, such as which step of a recreation people reach, with PostHog, so we can see what people use and improve it. It sets no cookies and keeps nothing in your browser. PostHog uses your IP address to estimate your country and to tell visits apart with a hash that changes every day, and records general details such as your browser and device type. Playground events never include anything you build or type. If your browser sends Do Not Track or Global Privacy Control, nothing is recorded.</p>

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
