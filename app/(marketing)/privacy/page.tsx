import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";

const CONTACT = "saivion@swiftpieces.com";

// Legal: reachable from the footer, not meant to rank.
export const metadata = {
  ...pageMetadata({
    title: "Privacy",
    description: "swiftpieces.com has no accounts and sets no cookies. Playground remixes stay in your browser, and analytics keep only a random visitor ID there. Accounts and purchases are handled on pro.swiftpieces.com under its own policy.",
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
      <p>We measure page views, clicks and Playground usage, such as which step of a recreation people reach, with PostHog, so we can see what people use and improve it. It sets no cookies and keeps nothing in your browser. PostHog turns your IP address into a hash that changes every day, so it can tell visits apart without keeping the address, and records general details such as your browser and device type. Playground events never include anything you build or type. If your browser sends Do Not Track or Global Privacy Control, nothing is recorded.</p>
      <p>We also use Databuddy to measure page views, how fast pages load, errors, and clicks on links that leave the site. It sets no cookies either, but it keeps a random visitor ID in your browser&apos;s local storage and the current visit in session storage, so it can tell visits apart. Clearing your browser data removes both. Databuddy hashes that ID with a value that changes every day, doesn&apos;t keep your IP address, and records general details such as your browser, device type and approximate location. It also honors Do Not Track and Global Privacy Control. When an AI crawler reads the site, our server tells Databuddy which page it read and which crawler it was; requests from ordinary browsers are never part of that.</p>

      <h2>The Playground</h2>
      <p>Your remixes are saved in your own browser&apos;s storage and never reach our servers. Clearing your browser data removes them.</p>
      <p>&quot;Open in Xcode&quot; puts your project inside the link Xcode opens. Our server reads it to build the Xcode project and doesn&apos;t keep it.</p>

      <h2>SwiftPieces Pro</h2>
      <p>If you&apos;re signed in to pro.swiftpieces.com, the Playground asks it whether you own Pro, so it can offer Pro features. Your browser sends your Pro session to pro.swiftpieces.com for that check; swiftpieces.com never sees or stores it.</p>
      <p>pro.swiftpieces.com uses Databuddy the same way, and also records when an account is created, checkout is opened, Pro is bought, a license key is created or a template is downloaded, without any details of the account or the payment. While you&apos;re signed in there, Databuddy links your visits to your account&apos;s ID, never your name or email, so visits from your devices count as one person; signing out unlinks them.</p>

      <h2>App Store content</h2>
      <p>The Playground shows public App Store listings. Screenshots and icons load from Apple&apos;s servers, so your browser requests them from Apple as it would on the App Store.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </ProsePage>
  );
}
