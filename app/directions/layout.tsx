import type { ReactNode } from "react";
import "./directions.css";

export const metadata = { title: "Brand directions (lab)", robots: { index: false } };

/** Dev-only lab: each direction is a whole landing, nav to footer. Fonts come from Google here only; a pick gets self-hosted. */
export default function DirectionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Serif:ital@0;1&display=swap"
      />
      <main className="relative flex-1">{children}</main>
    </>
  );
}
