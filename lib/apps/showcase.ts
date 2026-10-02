// The App Library header's before and after: an App Store screenshot (the developer's, labeled as
// such) and the screen we remixed from it (ours). The stills of our screens live in
// public/app-remixes and come from scripts/app-remixes/capture.ts; re-run it after a remix changes.
// A pick from a Pro app shows its screen blurred, as Free shows every Pro screen.
import { apps, isProApp, lockedStill, type LibraryEntry } from "./index";

/** The three free apps, each at a screen with clean App Store art and a remix that reads at a glance. */
const PICKS = [
  { slug: "pocket-casts", shot: 2 },
  { slug: "waterllama", shot: 2 },
  { slug: "timepage", shot: 7 },
] as const;

export type ShowcasePair = { app: LibraryEntry; shot: number; step: number; title: string; still: string; pro: boolean };

export const remixStill = (slug: string, shot: number) => `/app-remixes/${slug}-${shot}.webp`;

export const showcase: ShowcasePair[] = PICKS.flatMap(({ slug, shot }) => {
  const app = apps.find((a) => a.slug === slug);
  const screen = app?.screens.find((s) => s.shot === shot);
  if (!app || !screen) return [];
  const pro = isProApp(app);
  return [{ app, shot, step: screen.step, title: screen.title, still: pro ? lockedStill(slug, screen.step) : remixStill(slug, shot), pro }];
});

/** For the capture script: what to photograph. */
export const SHOWCASE_PICKS = PICKS;
