import type { Metadata } from "next";
import { ProHero, ProGallery, WhatYouGet, Compare, TryFirst, ProCTA, proFaqs } from "@/components/sections/pro-landing";
import { FAQ } from "@/components/sections/faq";
import { pro } from "@/lib/site";
import { proCountsLabel } from "@/lib/pro-catalog";

// Pro overview on the free site, modeled on reactbits.dev/pro. It never shows a price: every CTA
// leads to pro.swiftpieces.com, where pricing and the plan live.
export const metadata: Metadata = {
  title: "Swift Pieces Pro",
  description: `${proCountsLabel} for SwiftUI, production-ready and delivered as source. See the plan and pricing on pro.swiftpieces.com.`,
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
      <FAQ items={proFaqs} label="Before you ask" title="Straight answers on licensing, updates and how Pro fits with the free library." />
      <ProCTA />
    </div>
  );
}
