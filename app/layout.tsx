import "./globals.css";
import { MotionGate } from "@/components/motion-gate";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Figtree } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Analytics } from "@/components/analytics";
import { site } from "@/lib/site";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-figtree", display: "swap" });

const ICON_VERSION = 4;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s — ${site.name}` },
  description: site.description,
  // Every icon comes from public/ (favicon.ico and logo.png, the official marks). Bump ICON_VERSION
  // when either file changes: browsers cache tab icons hard, and a new URL forces them to refetch.
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: "16x16 32x32 48x48" },
      { url: `/logo.png?v=${ICON_VERSION}`, type: "image/png", sizes: "1024x1024" },
    ],
    apple: [{ url: `/logo.png?v=${ICON_VERSION}`, sizes: "1024x1024" }],
  },
  openGraph: { siteName: site.name, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark" };

// Free carries no auth. A signed-in user reaching pro.swiftpieces.com is already
// authenticated because Clerk's session cookie lives on the shared root domain (Rev 3 §6).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${figtree.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        {/* The first screen's endless loops hold still until the visitor first interacts (components/motion-gate.tsx). */}
        <MotionGate />
        <RootProvider
          theme={{ defaultTheme: "dark", forcedTheme: "dark", enabled: false }}
          // Shown before anyone types: the places people search for most.
          search={{ links: [["Introduction", "/docs/introduction"], ["Installation", "/docs/installation"], ["All components", "/docs/components"], ["Playground", "/playground"], ["Liquid Glass guide", "/docs/liquid-glass"], ["MCP Server", "/docs/mcp"], ["Swift Pieces Pro", "/pro"]] }}
        >
          {children}
        </RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
