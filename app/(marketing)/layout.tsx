import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageBackdrop } from "@/components/effects/page-backdrop";
import { getStarCount } from "@/lib/github";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const stars = await getStarCount();
  return (
    <>
      <Navbar stars={stars} />
      <main className="relative flex-1">
        <PageBackdrop />
        {children}
      </main>
      <Footer />
    </>
  );
}
