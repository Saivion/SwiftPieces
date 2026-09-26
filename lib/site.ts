// Centralized origins. Never hardcode the Pro URL anywhere else (Rev 3 §3.4).
export const site = {
  name: "Swift Pieces",
  /** The home page title: the name, then the plain category, inside ~55 characters. */
  title: "Swift Pieces: Free SwiftUI Component Library for iOS",
  description:
    "A free SwiftUI component library for iOS. Production-ready pieces with motion, haptics and accessibility, added with one CLI command or your AI agent.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://swiftpieces.com",
  proUrl: process.env.NEXT_PUBLIC_PRO_URL ?? "https://pro.swiftpieces.com",
  mediaUrl: process.env.NEXT_PUBLIC_MEDIA_URL ?? "https://media.swiftpieces.com",
  github: "https://github.com/Saivion/SwiftPieces",
  twitter: "https://x.com/saivion",
} as const;

/** Pro destinations, kept in one place so every CTA resolves the same way. */
export const pro = {
  home: site.proUrl,
  /** "View pricing" and "Pricing" links. The Pro homepage, like every Pro CTA on this site. */
  pricing: site.proUrl,
  /** Every "Get Pro" button resolves here: the Pro homepage. */
  buy: site.proUrl,
  library: `${site.proUrl}/library`,
  screens: `${site.proUrl}/library/screens`,
  templates: `${site.proUrl}/library/templates`,
  kit: `${site.proUrl}/docs/build-kit`,
  docs: `${site.proUrl}/docs/introduction`,
  mcpDocs: `${site.proUrl}/docs/mcp`,
  account: `${site.proUrl}/account`,
  mcp: `${site.proUrl}/api/mcp`,
} as const;
