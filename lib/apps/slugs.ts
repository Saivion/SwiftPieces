// Which apps the pages answer: the app library joined with the App Store facts app-store.json holds.
// An app missing from the App Store data is left out, so no /apps/<slug> page is built without one.
//
// This is the only definition of that join. lib/apps/index.ts builds its pages from appSlugs and
// scripts/build-registry.ts writes it into the manifest middleware.ts reads, so a page and the
// allowlist that lets it through can't disagree. Slugs only, so neither has to load the Playground
// code or the builder.
import store from "./app-store.json";
import { LIBRARY } from "./library";

const facts = store.apps as Record<string, unknown>;

export const appSlugs: string[] = LIBRARY.filter((a) => facts[a.slug]).map((a) => a.slug);
