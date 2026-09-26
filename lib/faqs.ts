/** The shared FAQ answers: the landing page's Questions and the Pro page's FAQ both read these. Plain data, so server components can import it. */
export const faqs = [
  { q: "What is a piece, exactly?", a: "One self-contained .swift file named after its primary type, plus a .metal file when a shader is involved. Public struct, init parameters with defaults, a #Preview, Apple frameworks only." },
  { q: "Do I need iOS 26?", a: "No. The baseline is iOS 17. Liquid Glass pieces use glass on iOS 26 and gate it with #available, falling back to a Material below." },
  { q: "How does the CLI add files without editing my project?", a: "Xcode 16 treats folders as file-system synchronized groups. The CLI writes into a SwiftPieces folder inside your app's group, so the files appear in the target automatically. Legacy projects add the folder once by hand." },
  { q: "Can my AI agent use this?", a: "Yes. The registry is public JSON, llms.txt describes every piece, and the MCP server lets Claude Code, Cursor and Xcode search and install in plain English. Pro tools require a license key." },
  { q: "What does the free license allow?", a: "MIT + Commons Clause. Use the pieces in any personal or commercial app. Do not sell, sublicense or redistribute the pieces themselves, alone, bundled or ported." },
  { q: "Is Pro a subscription?", a: "No. Swift Pieces Pro is one plan with lifetime access to the complete library, including everything added later, across unlimited projects. See the plan and pricing on pro.swiftpieces.com." },
];

/**
 * The home page's questions: what people ask a search engine or an assistant before they pick a
 * SwiftUI library. Each answer stands on its own (answer engines quote one at a time) and says only
 * what the rest of the site already says. No prices: pricing lives on pro.swiftpieces.com.
 */
export function homeFaqs(count: number, pro: { screens: number; templates: number }) {
  return [
    { q: "What is Swift Pieces?", a: `Swift Pieces is a free library of ${count} SwiftUI components for iOS, such as a swipeable card stack, Liquid Glass menus, a floating tab bar, interactive charts, form inputs and AI chat surfaces. Each piece is one self-contained Swift file with the motion, haptics, states and accessibility already done.` },
    { q: "Is Swift Pieces free?", a: "Yes. Every piece on swiftpieces.com is free to use in personal and commercial apps, including client work, under MIT + Commons Clause. Swift Pieces Pro is a separate paid library of full screens and app templates." },
    { q: "Is Swift Pieces open source?", a: "The source of every free piece is public on GitHub, and you can read, change and ship it in any app. The license is MIT + Commons Clause, which makes it source-available rather than open source in the OSI sense: the one thing you cannot do is sell or redistribute the pieces themselves." },
    { q: "How do I add a component to my Xcode project?", a: "Three ways. Copy the Swift file from the piece's page into your app target; run npx swiftpieces add SwipeDeck in the folder that holds your .xcodeproj; or ask Claude Code, Cursor or Xcode to add it through the Swift Pieces MCP server." },
    ...faqs.filter((f) => f.q === "What is a piece, exactly?" || f.q === "Do I need iOS 26?"),
    { q: "Is Swift Pieces a Swift package?", a: "No. There is no package to add, pin or update, and nothing runs at app launch. The CLI copies source files into a SwiftPieces folder in your project, and from then on they are your code." },
    { q: "How is Swift Pieces different?", a: "Swift Pieces is not a package you depend on and configure: you copy the file, own the source and change it freely. The pieces are designed interactions rather than primitives, each passing four tests: hard to recreate, designed before it moves, worth shipping, and iPhone-first." },
    ...faqs.filter((f) => f.q === "Can my AI agent use this?"),
    { q: "What is Swift Pieces Pro?", a: `A separate paid library for building whole apps: ${pro.screens} production-ready SwiftUI screens, ${pro.templates} complete app templates and a Build Kit of agent skills, in one plan with lifetime access. The plan and pricing are on pro.swiftpieces.com.` },
  ];
}
