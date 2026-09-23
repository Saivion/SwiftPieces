import type { Metadata } from "next";
import { SponsorHero, SponsorTiers, SponsorWall, SponsorUse, sponsorFaqs } from "@/components/sections/sponsors";
import { Questions } from "@/components/sections/questions";
import { getSponsors } from "@/lib/sponsors";
import { site } from "@/lib/site";

// Sponsorship funds the free, open-source library only; Pro is a product and is never sponsored.
// Same page rhythm as /pro, shorter: the ask, the tiers, who already sponsors, where it goes.
export const metadata: Metadata = {
  title: "Sponsor Swift Pieces",
  description: "Sponsor the open-source SwiftUI library. Monthly tiers for individuals and companies, with your logo on the homepage, the docs and the README.",
  alternates: { canonical: `${site.url}/sponsors` },
};

// The sponsor list and reach numbers are read live, then held for an hour.
export const revalidate = 3600;

export default async function SponsorsPage() {
  const sponsors = await getSponsors();
  return (
    <div className="pro-page">
      <SponsorHero />
      <SponsorTiers sponsors={sponsors} />
      <SponsorWall sponsors={sponsors} />
      <SponsorUse />
      {/* The FAQ closes this page (on /pro an offer card follows it), so it carries the bottom spacing itself. */}
      <div className="pb-24 sm:pb-32">
        <Questions items={sponsorFaqs} body="How sponsorship works, what each tier gets and how it relates to Pro." />
      </div>
    </div>
  );
}
