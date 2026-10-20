"use client";

// The root layout is gone when this renders (it replaces it), so it brings the site's stylesheet itself.
import "./globals.css";
import { useEffect } from "react";
import { captureException } from "@/lib/analytics";
import { Arrow, Button } from "@/components/ui/button";

/**
 * The last-resort error page, shown when the root layout itself fails. It used to render Next's built-in
 * error screen, white and styled inline; this is the site's own ground and type instead (Graphite), with
 * the same way out: try again. next-themes is not running here, so the remembered light/dark choice is
 * read back by hand.
 */
export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const light = saved === "light" || (saved !== "dark" && matchMedia("(prefers-color-scheme: light)").matches);
      document.documentElement.classList.toggle("light", light);
    } catch {
      // Storage blocked: stay on the dark ground.
    }
  }, []);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col justify-center antialiased">
        <main className="mx-auto w-full max-w-[var(--container)] px-5 py-24 sm:px-8 lg:px-12">
          <h1 className="max-w-[760px] text-[44px] leading-none font-normal tracking-[-0.04em] text-balance sm:text-[60px] lg:text-[74px] lg:tracking-[-0.047em]">Something went wrong.</h1>
          <p className="mt-[26px] max-w-[480px] text-[16.5px] leading-[27px] text-pretty text-muted sm:text-[18px] sm:leading-[30px]">The page hit an error it could not recover from. Try again, or start over from the home page.</p>
          <div className="mt-[38px] flex flex-wrap items-center gap-2.5">
            <Button onClick={reset}>Try again</Button>
            {/* A full page load, not a client navigation: the app that failed is the one that would route it. */}
            <a href="/" className="group inline-flex h-[46px] items-center gap-2 px-2 text-[15px] font-semibold text-foreground">Home <Arrow /></a>
          </div>
        </main>
      </body>
    </html>
  );
}
