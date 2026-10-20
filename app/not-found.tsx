import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow } from "@/components/ui/button";
import { heroTitle } from "@/components/sections/feature-row";
import { pageLede } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/**
 * The site's 404. Without it every unknown URL fell through to Next's built-in white page, which is
 * off-brand here and styles itself with an inline <style>.
 *
 * Deliberately lean: Next serialises the root not-found tree into every page's payload, so the full
 * navbar and footer here added ~36 KB of HTML to every page (measured 2026-09-23). The mark, the
 * message and two ways back are enough.
 */
export default function NotFound() {
  return (
    <main className="relative flex flex-1 flex-col">
      <Container className="py-6">
        <Logo className="flex w-fit items-center" />
      </Container>
      <section className="flex flex-1 items-center py-24">
        <Container>
          <Eyebrow>404</Eyebrow>
          <h1 className={cn("mt-[30px] max-w-[760px]", heroTitle)}>That page isn&apos;t here. The pieces are.</h1>
          <p className={cn("mt-[26px] max-w-[480px]", pageLede)}>It may have moved when the library was reorganized. Every free piece is one click away.</p>
          {/* The landing hero's pair: the ink pill, then the quiet way back as words and an arrow. */}
          <div className="mt-[38px] flex flex-wrap items-center gap-2.5">
            <Button href="/components">Browse the library <Arrow /></Button>
            <Link href="/" className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">Home <Arrow /></Link>
          </div>
        </Container>
      </section>
    </main>
  );
}
