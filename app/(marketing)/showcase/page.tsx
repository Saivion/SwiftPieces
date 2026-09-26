import { ProsePage } from "@/components/ui/prose-page";
import { pageMetadata } from "@/lib/seo";
// Not indexed while it is a placeholder: no apps are featured yet ("Submissions open after launch").
// TODO(content): remove `robots` and add the page back to app/sitemap.ts once apps are featured here.
export const metadata = {
  ...pageMetadata({
    title: "Showcase",
    description: "Apps shipping with pieces from the Swift Pieces library, and how to submit yours.",
    path: "/showcase",
  }),
  robots: { index: false, follow: true },
};
export default function ShowcasePage() {
  return (
    <ProsePage label="Showcase" title="Built with Swift Pieces." lead="Apps shipping with pieces from the library. Submissions open after launch.">
      <p>Send a link, a screenshot and the pieces you used to <a href="mailto:saivion@swiftpieces.com">saivion@swiftpieces.com</a>. We feature a handful each month.</p>
    </ProsePage>
  );
}
