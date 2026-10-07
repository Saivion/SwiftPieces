// The site's features and apps as search entries, beside the docs pages, so search finds "playground",
// "styles", "pricing" or an app's name as well as the docs. Plain data only: the search route must stay
// small (see app/api/search/route.ts), so this never imports the builder or lib/apps (which pulls in the
// pattern catalog); the app names come straight from the two JSON-ish sources lib/apps reads.
import store from "@/lib/apps/app-store.json";
import { LIBRARY } from "@/lib/apps/library";
import { pro } from "@/lib/site";

export type SearchEntry = {
  url: string;
  title: string;
  description: string;
  breadcrumbs: string[];
  structuredData: { headings: Array<{ id: string; content: string }>; contents: Array<{ heading?: string; content: string }> };
};

/**
 * One entry. Fumadocs shows every indexed line as a result, so `more` is a readable sentence holding
 * the words people search for (the description is indexed and shown on its own).
 */
const entry = (url: string, title: string, description: string, area: string, more: string): SearchEntry => ({
  url,
  title,
  description,
  breadcrumbs: [area],
  structuredData: { headings: [], contents: [{ content: more }] },
});

const FEATURES: SearchEntry[] = [
  entry("/apps", "Apps and the Playground", "Remix real app screens in SwiftUI in the browser: inspect, restyle, edit the layout and open it in Xcode.", "Create", "The Playground: try an app in the browser, inspect it on the Map, shuffle its style, drag to edit the layout, and build it for Xcode."),
  entry("/styles", "Styles", "Make one theme for every screen and app: color, type, shape and motion, carried by one code.", "Create", "The style studio: theming with colors, fonts and typography, light and dark mode, shuffle in a mood, then copy a style code, Theme.swift or an AI prompt."),
  entry("/components", "Components", "Every free SwiftUI piece with a live preview, by category.", "Library", "The free library: animations, buttons, cards, inputs, Liquid Glass, AI and charts, each a single SwiftUI file."),
  entry(pro.screens, "Pro screens", "Finished SwiftUI screens, themed by one design system.", "Library", "Paywall, onboarding, dashboard, settings and more, in SwiftPieces Pro."),
  entry(pro.templates, "Pro app templates", "Complete apps as Xcode projects.", "Library", "Starter apps for finance, fitness, travel, AI and more, in SwiftPieces Pro."),
  entry(pro.kit, "Build Kit", "Skills that teach your coding agent to build the rest of the app in the same design.", "Pro", "Agent skills for Claude Code, Codex and Cursor: styles, briefs and recipes."),
  entry(pro.pricing, "SwiftPieces Pro", "Screens, app templates and the Build Kit in one purchase.", "Pro", "Pricing: one purchase, lifetime access, to buy or upgrade."),
  entry("/docs/changelog", "Changelog", "Every new piece, feature and fix, newest first.", "Resources", "What's new: updates, releases and news."),
  entry("/sponsors", "Sponsors", "The people and companies who keep SwiftPieces free.", "Resources", "Sponsor or support the project through GitHub Sponsors."),
  entry("/showcase", "Showcase", "Apps built with SwiftPieces.", "Resources", "Examples of apps made with SwiftPieces."),
  entry("/about", "About", "Who makes SwiftPieces and why.", "Resources", "The story and the people behind it."),
  entry("/license", "License", "What you can do with the pieces.", "Resources", "The license: MIT with the Commons Clause, and commercial use."),
];

type Facts = { name: string };
const facts = (store as unknown as { apps: Record<string, Facts> }).apps;
const shortName = (name: string) => name.split(/\s[:\-–—|]\s|:\s/)[0].trim();

/** Each app in the App Library, found by its name ("timepage", "waterllama"). */
const APPS: SearchEntry[] = LIBRARY.filter((a) => facts[a.slug]).map((a) => {
  const name = a.name ?? shortName(facts[a.slug].name);
  return entry(`/apps/${a.slug}`, name, `${name} in the App Library: our SwiftUI remix of its screens, live in the Playground.`, "Apps", `Open the ${name} remix in the Playground.`);
});

export const searchFeatures: SearchEntry[] = [...FEATURES, ...APPS];
