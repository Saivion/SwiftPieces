import { ProsePage } from "@/components/ui/prose-page";
export const metadata = { title: "Showcase" };
export default function ShowcasePage() {
  return (
    <ProsePage label="Showcase" title="Built with Swift Pieces." lead="Apps shipping with pieces from the library. Submissions open after launch.">
      <p>Send a link, a screenshot and the pieces you used to <a href="mailto:saivion@swiftpieces.com">saivion@swiftpieces.com</a>. We feature a handful each month.</p>
    </ProsePage>
  );
}
