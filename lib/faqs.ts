import { proCatalog } from "@/lib/pro-catalog";
/** The shared FAQ answers: the landing page's Questions and the Pro page's FAQ both read these. Plain data, so server components can import it. */
export const faqs = [
  { q: "What is a piece, exactly?", a: "One self-contained .swift file named after its primary type, plus a .metal file when a shader is involved. Public struct, init parameters with defaults, a #Preview, Apple frameworks only." },
  { q: "Do I need iOS 26?", a: "No. The baseline is iOS 17. Liquid Glass pieces use glass on iOS 26 and gate it with #available, falling back to a Material below." },
  { q: "How does the CLI add files without editing my project?", a: "Xcode 16 treats folders as file-system synchronized groups. The CLI writes into a SwiftPieces folder inside your app's group, so the files appear in the target automatically. Legacy projects add the folder once by hand." },
  { q: "Can my AI agent use this?", a: "Yes. The registry is public JSON, llms.txt describes every piece, and the MCP server lets Claude Code, Cursor and Xcode search and install in plain English. Pro tools require a license key." },
  { q: "What does the free license allow?", a: "MIT + Commons Clause. Use the pieces in any personal or commercial app. Do not sell, sublicense or redistribute the pieces themselves, alone, bundled or ported." },
  { q: "Is Pro a subscription?", a: "No. SwiftPieces Pro is one plan with lifetime access to the complete library, including everything added later, across unlimited projects. See the plan and pricing on pro.swiftpieces.com." },
];

/**
 * The home page's questions, six at most: what people ask a search engine or an assistant before they
 * pick a SwiftUI library. Each answer stands on its own (answer engines quote one at a time) and says
 * only what the rest of the site already says. No prices: pricing lives on pro.swiftpieces.com. The
 * page's FAQ structured data is built from this same list, so it only ever names questions on screen.
 */
export function homeFaqs(count: number, pro: { screens: number; templates: number; flows: { total: number } }) {
  return [
    { q: "What is SwiftPieces?", a: `SwiftPieces is a free library of ${count} SwiftUI components for iOS, such as a swipeable card stack, Liquid Glass menus, a floating tab bar, interactive charts, form inputs and AI chat surfaces. Each piece is one self-contained Swift file with the motion, haptics, states and accessibility already done.` },
    { q: "Is SwiftPieces free?", a: "Yes. Every piece on swiftpieces.com is free to use in personal and commercial apps, including client work, under MIT + Commons Clause. SwiftPieces Pro is a separate paid library of full screens, flows and app templates." },
    { q: "How do I add a component to my Xcode project?", a: "Three ways, and none of them is a Swift package. Copy the Swift file from the piece's page into your app target; run npx swiftpieces add SwipeDeck in the folder that holds your .xcodeproj; or ask Claude Code, Cursor or Xcode to add it through the SwiftPieces MCP server." },
    ...faqs.filter((f) => f.q === "Do I need iOS 26?" || f.q === "Can my AI agent use this?"),
    { q: "What is SwiftPieces Pro?", a: `SwiftPieces Pro is a separate paid library, and it is closed source. It is for building whole apps: ${pro.screens} production-ready SwiftUI screens, ${pro.flows.total} flows that string them into whole journeys, ${pro.templates} complete app templates, a Build Kit of agent skills and Pro remixing in the Playground (all ${proCatalog.remixing.apps} apps, remix with AI, keep up to ${proCatalog.remixing.saves} remixes), in one plan with lifetime access. The plan and pricing are on pro.swiftpieces.com.` },
  ];
}
