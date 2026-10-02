"use client";
// What a Pro app's Playground shows a visitor without Pro: every screen of its remix, blurred, and
// the way in. The stills come from scripts/app-remixes/capture.ts --locked, blurred past reading, so
// nothing sharp of a Pro remix is ever published. Shown only once the visitor's plan is known not to
// include Pro (until then the stage shows the loading phone), so a Pro owner never sees it flash
// before their screens open. The app's badge sits above it (the Playground's stageBadge). No prices
// here: pricing is the Pro site's.
import { useEffect, useRef } from "react";
import { UI } from "@swiftpieces/builder/react";
import { TextLink } from "@/components/ui/button";
import { apps, isProApp, lockedStill, type LibraryEntry } from "@/lib/apps";
import type { ProSession } from "@/lib/pro-bridge";
import { pro } from "@/lib/site";

/** How many apps are Pro's, for the line on what Pro opens. */
const proApps = apps.filter(isProApp).length;

type Props = {
  app: LibraryEntry;
  stepTitles: string[];
  /** The visitor's plan: signed out, or an account without Pro. */
  session: ProSession;
  /** Where Sign in goes (the Pro site, then back here). */
  signIn?: string;
  /** Analytics: seen, and the way to pricing taken. */
  onView?: () => void;
  onPricing?: () => void;
};

export function LockedApp({ app: a, stepTitles, session, signIn, onView, onPricing }: Props) {
  // Counted once for each app seen locked.
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if ((session === "signed-out" || session === "free") && seen.current !== a.slug) {
      seen.current = a.slug;
      onView?.();
    }
  }, [session, a.slug, onView]);
  return (
    <div className="spl" key={a.slug}>
      <ul className="spl-wall" aria-label={`${a.pattern.title}: ${stepTitles.length} screens, part of Pro`}>
        {stepTitles.map((title, i) => (
          <li key={i} className="spl-screen" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
            <span className="spl-phone">
              <img src={lockedStill(a.slug, i)} alt="" width={300} height={650} loading={i < 5 ? "eager" : "lazy"} decoding="async" draggable={false} />
              <span className="spl-lock" aria-hidden>
                <UI name="lock" size={13} />
              </span>
            </span>
            <span className="spl-title">{title}</span>
          </li>
        ))}
      </ul>
      <div className="spl-card">
        <h2>Unlock {a.pattern.title}</h2>
        <p>
          All {stepTitles.length} screens, to use, take apart, remix and open in Xcode. Pro opens the {proApps - 1} other Pro apps and every future app too, with every Pro screen, template and the Build Kit.
        </p>
        <div className="spl-actions">
          <a className="spp-btn spp-btn-primary spp-btn-lg" href={pro.pricing} onClick={onPricing}>
            View pricing
          </a>
          {session === "signed-out" && signIn ? (
            // The site's text link: the underline draws in and the arrow nudges on hover.
            <TextLink href={signIn}>Sign in</TextLink>
          ) : null}
        </div>
        {session === "signed-out" ? <p className="spl-note">Already have Pro? Sign in and it opens right here.</p> : null}
      </div>
    </div>
  );
}
