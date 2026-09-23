import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/badge";
import { Button, Arrow, TextLink } from "@/components/ui/button";
import { sectionTitle, sectionBody } from "@/components/sections/feature-row";
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
          <h1 className={cn("mt-6 max-w-2xl", sectionTitle)}>That page isn&apos;t here. The pieces are.</h1>
          <p className={cn("mt-4 max-w-md", sectionBody)}>It may have moved when the library was reorganized. Every free piece is one click away.</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Button href="/components">Browse the library <Arrow /></Button>
            <TextLink href="/">Home</TextLink>
          </div>
        </Container>
      </section>
    </main>
  );
}
