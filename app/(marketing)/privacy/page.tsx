import { ProsePage } from "@/components/ui/prose-page";
export const metadata = { title: "Privacy" };
export default function PrivacyPage() {
  return (
    <ProsePage label="Legal" title="Privacy." lead="We collect what is needed to run accounts and licenses, and nothing for its own sake.">
      <p>This site has no accounts and sets no cookies. Site analytics are privacy-preserving. Accounts, purchases and license handling happen on pro.swiftpieces.com under its own privacy policy.</p>
      <p>Questions: <a href="mailto:saivion@swiftpieces.com">saivion@swiftpieces.com</a>.</p>
    </ProsePage>
  );
}
