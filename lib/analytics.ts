import type { PostHog } from "posthog-js";
import { createScript, isScriptInjected, track } from "@databuddy/sdk";
import { site } from "@/lib/site";

/**
 * PostHog: page views, visits and clicks, the Playground's product events, uncaught errors, and the
 * page views behind "Explored N times" (lib/views.ts).
 *
 * It starts on the visitor's first interaction (instrumentation-client.ts), or with the first event a
 * page captures (the Playground's, as it opens), never during first paint. A bounce with no pointer,
 * key, touch or scroll goes uncounted, which suits a count meant as a floor anyway.
 *
 * No cookies: cookieless mode keeps nothing in the browser, and PostHog tells visits apart with a
 * daily-rotating hash on its own servers. The project needs Cookieless tracking switched on in its
 * PostHog settings, or PostHog ignores these events. They carry no country: PostHog hashes the IP
 * address before GeoIP runs. Do Not Track and Global Privacy Control are honored: nothing is sent.
 *
 * Only swiftpieces.com reports. Local dev, preview deploys and forks never start PostHog, so their
 * page views stay out of the numbers, and a fork without the variables has nothing to configure.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let client: Promise<PostHog | null> | null = null;

/** On swiftpieces.com itself. Local dev, preview deploys and forks never report to either tool. */
function onSite(): boolean {
  return typeof window !== "undefined" && window.location.hostname === new URL(site.url).hostname;
}

function enabled(): boolean {
  return Boolean(token && host) && onSite();
}

/** Loads and starts PostHog, once. Resolves to null where analytics are off. */
export function startAnalytics(): Promise<PostHog | null> {
  if (!token || !host || !enabled()) return Promise.resolve(null);
  client ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(token, {
        api_host: host,
        defaults: "2026-01-30",
        cookieless_mode: "always",
        person_profiles: "never",
        respect_dnt: true,
        capture_exceptions: true,
        logs: { serviceName: "swiftpieces-web", environment: process.env.NODE_ENV },
      });
      return posthog;
    })
    // Blocked or offline: analytics never surface an error.
    .catch(() => null);
  return client;
}

type Properties = Record<string, string | number | boolean | null | undefined>;

/**
 * One event. Starts PostHog if it hasn't yet; does nothing where analytics are off. The few that
 * Databuddy's goals and funnels are built on go to Databuddy as well (DATABUDDY_EVENTS).
 */
export function capture(event: string, properties?: Properties): void {
  void startAnalytics().then((posthog) => posthog?.capture(event, properties));
  if (DATABUDDY_EVENTS.has(event) && databuddyEnabled()) {
    startDatabuddy();
    track(event, properties);
  }
}

/** An error nothing recovered from (app/global-error.tsx). */
export function captureException(error: unknown): void {
  void startAnalytics().then((posthog) => posthog?.captureException(error));
}

/** Structured lines for PostHog Logs. */
export const log = {
  info(body: string, attributes: Record<string, string | number>): void {
    void startAnalytics().then((posthog) => posthog?.logger.info(body, attributes));
  },
  warn(body: string, attributes: Record<string, string | number>): void {
    void startAnalytics().then((posthog) => posthog?.logger.warn(body, attributes));
  },
};

/**
 * Databuddy, beside PostHog: page views and visits, Core Web Vitals (LCP, INP, CLS, TTFB), uncaught
 * errors, clicks on links that leave the site (GitHub, Pro, the App Store), rage and dead clicks, and
 * the Playground moments below. The AI crawlers that read the site without running scripts are
 * reported from middleware.ts.
 *
 * Its script (about 14 KB, from cdn.databuddy.cc) loads once the page has loaded and the browser is
 * idle (instrumentation-client.ts), or with the first of those events, so it never competes with first
 * paint or hydration and still counts a visit that leaves without interacting.
 *
 * It sets no cookies but isn't storage-free: a random visitor ID lives in localStorage and the session
 * in sessionStorage, which the privacy page says. Databuddy hashes visitor IDs with a daily salt and
 * keeps no raw IP address. Do Not Track and Global Privacy Control are honored: nothing is sent.
 * Only swiftpieces.com reports, as with PostHog.
 */
const databuddyClientId = process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID;

/** The Playground's moments that matter: opened, code taken out of it, and the step toward Pro. */
const DATABUDDY_EVENTS = new Set(["playground_opened", "code_copied", "project_downloaded", "xcode_opened", "pro_upgrade_clicked"]);

function databuddyEnabled(): boolean {
  return Boolean(databuddyClientId) && onSite();
}

/** Adds Databuddy's script, once. Does nothing where analytics are off. */
export function startDatabuddy(): void {
  if (!databuddyClientId || !databuddyEnabled() || isScriptInjected()) return;
  document.head.appendChild(createScript({ clientId: databuddyClientId, trackWebVitals: true, trackErrors: true, trackOutgoingLinks: true }));
}
