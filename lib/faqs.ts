/** The shared FAQ answers: the landing page's Questions and the Pro page's FAQ both read these. Plain data, so server components can import it. */
export const faqs = [
  { q: "What is a piece, exactly?", a: "One self-contained .swift file named after its primary type, plus a .metal file when a shader is involved. Public struct, init parameters with defaults, a #Preview, Apple frameworks only." },
  { q: "Do I need iOS 26?", a: "No. The baseline is iOS 17. Liquid Glass pieces use glass on iOS 26 and gate it with #available, falling back to a Material below. MeshGradient pieces need iOS 18." },
  { q: "How does the CLI add files without editing my project?", a: "Xcode 16 treats folders as file-system synchronized groups. The CLI writes into a SwiftPieces folder inside your app's group, so the files appear in the target automatically. Legacy projects add the folder once by hand." },
  { q: "Can my AI agent use this?", a: "Yes. The registry is public JSON, llms.txt describes every piece, and the MCP server lets Claude Code, Cursor and Xcode search and install in plain English. Pro tools require a license key." },
  { q: "What does the free license allow?", a: "MIT + Commons Clause. Use the pieces in any personal or commercial app. Do not sell, sublicense or redistribute the pieces themselves, alone, bundled or ported." },
  { q: "Is Pro a subscription?", a: "No. Swift Pieces Pro is one plan with lifetime access to the complete library, including everything added later, across unlimited projects. See the plan and pricing on pro.swiftpieces.com." },
];
