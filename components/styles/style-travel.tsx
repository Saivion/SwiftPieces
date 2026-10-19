"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { decodeStyle, encodeStyle, resolveTheme, styleSwift, themeFromLook, type Theme } from "@swiftpieces/builder";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/effects/reveal";
import { sectionBody, sectionTitle } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";
import type { StyleApp } from "./studio-actions";
import { STYLE_EVENT } from "./studio-state";

/**
 * Where a style goes, as three cards that follow the style the studio above is showing: keep its
 * code (its colours as swatches), open a free app wearing it (the stacked app icons are the links),
 * and bring it to your own app (an AI prompt with its Theme.swift, or the Theme.swift alone). Before
 * the studio has said anything (server render, no script), they show the SwiftPieces look.
 */
export function StyleTravel({ apps, className }: { apps: StyleApp[]; className?: string }) {
  const house = useMemo(() => encodeStyle(themeFromLook("pieces")), []);
  const [code, setCode] = useState(house);
  useEffect(() => {
    const now = (window as Window & { __spStyle?: string }).__spStyle;
    if (now) setCode(now);
    const on = (e: Event) => setCode((e as CustomEvent<string>).detail);
    window.addEventListener(STYLE_EVENT, on);
    return () => window.removeEventListener(STYLE_EVENT, on);
  }, []);
  const theme: Theme = useMemo(() => decodeStyle(code) ?? themeFromLook("pieces"), [code]);
  const resolved = resolveTheme(theme);
  const swatches = [resolved.accent, resolved.accentInk, resolved.background, resolved.surface];
  // The style as it's meant to be seen: its own appearance (system reads as light here).
  const scheme = resolved.appearance === "dark" ? "dark" : "light";
  const accent = resolved.accent[scheme];
  const themeSwift = useMemo(() => styleSwift(theme).theme, [theme]);

  return (
    <Container className={className}>
      <section aria-labelledby="travel-title">
        <Reveal className="max-w-2xl">
          <h2 id="travel-title" className={sectionTitle}>
            Your style, everywhere.
          </h2>
          <p className={cn("mt-4", sectionBody)}>One code carries it into the Playground, and out of it into your own app. These follow the style you&apos;re making above.</p>
        </Reveal>

        {/* Three trays, as the landing's feature cards: each visual on a panel, its words under it. */}
        <Reveal className="mt-10">
          <ul className="grid gap-3 md:grid-cols-3 lg:gap-4">
            <Cell
              title="Keep the code"
              body="The whole style in one line. Click the card to copy it, then paste it into any app's Style tab, or back here."
            >
              <CopyArea text={code} label="Copy this style's code">
                <StyleCard theme={resolved} />
              </CopyArea>
            </Cell>

            <Cell
              title="Open it in the Playground"
              body="Every screen of a free app, restyled and ready to tune. Pick an app to open it wearing your style."
            >
              {/* The apps fanned like a hand of cards over a soft wash of the accent; they spread on
                  hover, and the one you point at lifts and straightens. */}
              <div className="relative flex items-center justify-center">
                <span aria-hidden className="absolute size-44 rounded-full opacity-40 blur-2xl" style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />
                <div className="relative flex -space-x-4 transition-all duration-300 ease-out group-hover:-space-x-1">
                  {apps.map((a, i) => {
                    const turn = (i - (apps.length - 1) / 2) * 8;
                    return (
                      <a
                        key={a.slug}
                        href={`${a.href}?style=${encodeURIComponent(code)}`}
                        aria-label={`Open ${a.name} with this style`}
                        title={`Open ${a.name}`}
                        className="relative block rounded-[19px] transition-transform duration-300 ease-out hover:z-10 hover:!-translate-y-2 hover:!rotate-0"
                        style={{ rotate: `${turn}deg`, translate: `0 ${Math.abs(turn) * 0.5}px` }}
                      >
                        <img src={a.icon} alt="" width={76} height={76} decoding="async" className="size-[76px] rounded-[19px] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_18px_32px_-14px_rgb(0_0_0/0.7)]" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </Cell>

            <Cell
              title="Bring it to your app"
              body="Click the window to copy a prompt for your coding agent, with the color scheme and how to apply it."
            >
              <CopyArea text={aiPrompt(code, themeSwift)} label="Copy an AI prompt for this style">
                <AgentWindow accent={accent} swatches={swatches.map((c) => c[scheme])} />
              </CopyArea>
            </Cell>
          </ul>
        </Reveal>
      </section>
    </Container>
  );
}

/** What the agent gets: the style's Theme.swift and plain rules for using it, plus the code to come back to. */
function aiPrompt(code: string, themeSwift: string): string {
  const link = typeof window === "undefined" ? `https://swiftpieces.com/styles?style=${code}` : `${window.location.origin}/styles?style=${code}`;
  return [
    "Apply this SwiftPieces style to my SwiftUI app.",
    "",
    "1. Add this file to the app target as Theme.swift:",
    "",
    "```swift",
    themeSwift.trim(),
    "```",
    "",
    "2. Use it everywhere colour is set: Theme.accent for the tint and primary actions, Theme.accentInk for text and icons on the accent, Theme.background for screen backgrounds, Theme.surface for cards and sheets. Set `.tint(Theme.accent)` at the app root.",
    "3. Where Theme defines fonts or corner radii, use those instead of hard-coded values.",
    "4. Keep every layout and behaviour as it is: restyle only. Check light and dark mode, and that text on the accent stays readable.",
    "",
    `The style's code is ${code}. To see or change it: ${link}`,
  ].join("\n");
}

/**
 * The style itself, drawn small: its ground, a card on its surface with an "Aa" in its heading font,
 * a button in its accent with its ink and corners, and its colours in a row.
 */
function StyleCard({ theme }: { theme: ReturnType<typeof resolveTheme> }) {
  const scheme = theme.appearance === "dark" ? "dark" : "light";
  const r = (n: number) => Math.round(n * theme.cornerScale);
  const ink = scheme === "dark" ? "#f4f3ef" : "#141414";
  return (
    <div className="flex w-full max-w-[260px] flex-col items-center gap-3">
      <div
        className="w-full p-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06),0_22px_40px_-22px_rgb(0_0_0/0.65)] transition-transform duration-300 ease-out group-hover:-translate-y-1"
        style={{ background: theme.background[scheme], borderRadius: r(16) }}
      >
        <div className="flex items-center gap-3 p-3" style={{ background: theme.surface[scheme], borderRadius: r(12), color: ink }}>
          <span className="text-[30px] leading-none" style={{ fontFamily: theme.heading.css, fontWeight: 700 }}>
            Aa
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold">{theme.heading.name}</span>
            <span className="block truncate text-[10.5px] opacity-60">{theme.body.name === theme.heading.name ? "Headings and text" : `Text in ${theme.body.name}`}</span>
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="px-3 py-1.5 text-[11px] font-semibold" style={{ background: theme.accent[scheme], color: theme.accentInk[scheme], borderRadius: r(9) }}>
            Continue
          </span>
          <span className="flex gap-1">
            {[theme.accent, theme.accentInk, theme.surface].map((c, i) => (
              <span key={i} aria-hidden className="size-3 rounded-full ring-1 ring-black/10" style={{ background: c[scheme] }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

/** A coding agent's chat, small: your request, with Theme.swift attached, its colours on the file. */
function AgentWindow({ accent, swatches }: { accent: string; swatches: string[] }) {
  return (
    <div className="stage-dark w-full max-w-[270px] overflow-hidden rounded-[12px] border border-white/10 bg-[#0e0e10] text-white shadow-[0_22px_40px_-22px_rgb(0_0_0/0.7)] transition-transform duration-300 ease-out group-hover:-translate-y-1">
      <div className="flex items-center gap-1.5 border-b border-white/[.07] px-3 py-2">
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="ml-2 text-[10.5px] text-white/45">Coding agent</span>
      </div>
      <div className="flex flex-col items-end gap-2 p-3">
        <p className="max-w-[90%] rounded-[12px] rounded-br-[4px] bg-white/[.09] px-3 py-2 text-[11.5px] leading-[16px] text-white/85">Apply my SwiftPieces style to this app.</p>
        <div className="flex max-w-[90%] items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/[.04] px-2.5 py-2">
          <span className="grid size-7 place-items-center rounded-[7px] text-[10px] font-bold" style={{ background: accent, color: "#fff" }}>
            {"{}"}
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-white/90">Theme.swift</span>
            <span className="mt-1 flex gap-1">
              {swatches.map((c, i) => (
                <span key={i} aria-hidden className="size-2 rounded-full ring-1 ring-white/15" style={{ background: c }} />
              ))}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** One card: a tray holding the visual on its panel, the title and sentence under it. */
function Cell({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <li className="tray group flex flex-col">
      <div className="panel flex h-[232px] items-center justify-center px-6">{children}</div>
      <div className="px-3.5 pt-5 pb-4 sm:px-4">
        <h3 className="text-[22px] leading-[1.15] font-normal tracking-[-0.025em] text-foreground">{title}</h3>
        <p className="mt-2 text-[14.5px] leading-[23px] text-pretty text-muted">{body}</p>
      </div>
    </li>
  );
}

/** A visual that copies `text` when clicked, with a small "Copied" chip that rises over it. */
function CopyArea({ text, label, children }: { text: string; label: string; children: ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        } catch {
          setDone(false);
        }
      }}
      className="relative flex w-full cursor-pointer justify-center rounded-[16px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      {children}
      <span
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background shadow-lg transition-all duration-200",
          done ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {done ? "Copied" : ""}
      </span>
    </button>
  );
}
