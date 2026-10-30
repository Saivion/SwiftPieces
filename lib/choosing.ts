/**
 * Questions on /docs/choosing. The page prints these strings, and the FAQ structured data is built
 * from this same list, so a result can only quote a question the page shows.
 *
 * No prices: Pro's plan and price stay on pro.swiftpieces.com. No ratings or download counts.
 */
export const choosingFaqs = [
  {
    q: "Is SwiftPieces the shadcn for SwiftUI?",
    a: "SwiftPieces uses the same distribution idea as shadcn/ui: you copy the source into your project and own it, instead of depending on a package. It is SwiftUI for iOS, installed with npx swiftpieces add or by pasting a Swift file. shadcn/ui is React.",
  },
  {
    q: "Is SwiftPieces a Swift package?",
    a: "No. SwiftPieces copies Swift source into your Xcode project. Paste the file from a component page, or run npx swiftpieces add Name from the folder that holds your .xcodeproj. There is no package dependency to add or update.",
  },
  {
    q: "Can I use SwiftPieces in a commercial app?",
    a: "Yes. Free components are MIT + Commons Clause. You can use, copy, modify and ship them in any personal or commercial app, including client work. You may not sell, sublicense or redistribute the components themselves.",
  },
  {
    q: "Does SwiftPieces support iOS 26 Liquid Glass?",
    a: "Yes. The library builds for iOS 17. Liquid Glass components call the real iOS 26 APIs only when the system is iOS 26 or newer, and fall back to Material on earlier systems. The rules are in the Liquid Glass guide.",
  },
  {
    q: "Can Cursor or Claude Code install SwiftPieces?",
    a: "Yes. The free MCP server at https://swiftpieces.com/api/mcp needs no account. Claude Code, Cursor and other MCP clients can search the library and install a component. SwiftPieces Pro uses a separate server and a license key.",
  },
  {
    q: "What is the difference between SwiftPieces and SwiftPieces Pro?",
    a: "SwiftPieces on swiftpieces.com is the free component library: single Swift files under MIT + Commons Clause. SwiftPieces Pro is a separate paid product at pro.swiftpieces.com with screens, flows, app templates and agent skills. Pro is closed source. Pricing is on the Pro site.",
  },
  {
    q: "Should I use a SwiftUI library or a UIKit library?",
    a: "For a new SwiftUI app, use SwiftUI components so the code matches the rest of the app. SwiftPieces is SwiftUI on Apple frameworks only. A UIKit library wraps UIKit views, which you then bridge. Pick SwiftUI unless the screen must stay in UIKit.",
  },
] as const;
