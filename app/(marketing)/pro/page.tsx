import type { Metadata } from "next";
import { ProHero, ProGallery, WhatYouGet, Compare, TryFirst, proFaqs } from "@/components/sections/pro-landing";
import { Plans } from "@/components/sections/plans";
import { GamesTeaser } from "@/components/sections/games-teaser";
import { Questions } from "@/components/sections/questions";
import { pro } from "@/lib/site";
import { proCountsLabel } from "@/lib/pro-catalog";

// Pro overview on the free site, modeled on reactbits.dev/pro. It never shows a price: every CTA
// leads to pro.swiftpieces.com, where pricing and the plan live.
export const metadata: Metadata = {
  title: "SwiftPieces Pro",
  description: `SwiftPieces Pro: ${proCountsLabel} for SwiftUI, production-ready and delivered as source. See the plan and pricing on pro.swiftpieces.com.`,
  alternates: { canonical: pro.pricing },
};

export default function ProPage() {
  return (
    <div className="pro-page">
      <ProHero />
      <ProGallery />
      <WhatYouGet />
      <Compare />
      <TryFirst />
      <GamesTeaser />
      <Plans />
      <Questions items={proFaqs} spacing="pb-24 sm:pb-32" stacked title="Questions before you buy" body="Licensing, updates and how Pro fits with Free." />
    </div>
  );
}
