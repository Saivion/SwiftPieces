import type { ChangelogEntry } from "@/components/changelog/changelog-grid";

/**
 * What shipped in the free library, newest first. The changelog lives inside the docs: the first
 * entry leads /docs/changelog as What's new, the rest follow as cards, and each has a page at
 * /docs/changelog/<slug>. Dates are the day it shipped where it is known, else the month.
 */
export const changelog: ChangelogEntry[] = [
  {
    slug: "liquid-motion",
    date: "Oct 2026",
    title: "Liquid Glass, Motion and Flows",
    summary: "Every free piece is now liquid glass and moves with one motion language: controls are glass that melts together through a liquid neck, anything that appears buds out of what made it and melts back in, presses land under your finger and releases keep its speed. And SwiftPieces Pro now has Flows: 48 complete journeys through its app templates.",
    points: [
      "Every piece is liquid glass: buttons, chips, pills, toolbars, badges and indicators are glass shapes that merge through a neck when they come close, on Liquid Glass in iOS 26 and a frosted fallback from iOS 17.",
      "Anything that appears buds out of the shape that caused it and melts back in when it goes: a stop button out of a download pill, menu actions out of their trigger, a stepper's minus into its count at zero.",
      "Labels change letter by letter, glyphs blur from old to new and numbers roll.",
      "One font weight, semibold, across every piece, with size setting the hierarchy.",
      "One red: the brand red tints primary actions and selections, sage marks success and butter marks warnings.",
      "One motion language across every piece: five spring tiers and named roles for every moment something moves (press, release, settle, snap, rebound, morph, reveal, dismiss, success, error, ambient).",
      "More bounce everywhere: releases, landings, selections and reveals spring past their mark and settle, so nothing feels stiff. Presses still land firmly under your finger, and numbers and charts never overshoot.",
      "Drags track your finger with no lag, and a flick carries its speed into the release instead of starting from rest.",
      "Limits feel elastic: past an edge, cards, sheets, sliders and indicators move against the same resistance a scroll view has, then spring back.",
      "Presses sink by a few points rather than a fixed percentage, so an icon gives visibly and a card only slightly, and they lean toward where you touched.",
      "State changes play in order: the container changes shape first, the content swaps inside it, then the outcome lands with its haptic.",
      "Reduce Motion now substitutes rather than switching feedback off: settles lose their bounce, moving transitions become fades, presses dim, and loaders still show they are working.",
      "Each piece is still one Swift file. It carries a private copy of just the motion parts it uses, so installing one piece is still one file and two pieces never collide.",
      "The previews on every component page and in the docs now move the way the pieces do, on the same springs.",
      "New: Glass Mode Bar, one glass capsule of mode icons that turns into the mode you pick: a signal anchor buds out of its end carrying the mode while the capsule trades its icons for that mode's own controls, and the body keeps its footprint.",
      "New: Glass Quick Add, a Quick add pill that folds up into a card of capture kinds, then re-forms in place into the one you pick, with Save budding out of its corner only once there is something to save.",
      "New: Source Stack, the sources behind an AI answer. A pill of site badges opens into numbered source cards, the badges flying out of the stack into their cards. It replaces Code Block, which is retired.",
      "A new guide, SwiftUI motion, explains the springs, rubber banding, momentum, squash and stretch, and follow-through with code you can paste.",
      "Flows in SwiftPieces Pro: 48 complete journeys through its 12 app templates, screen by screen, from first run with sign-in and the paywall to the core of each app, profile and settings. Find them in the navbar's Library menu; the first three steps of every flow are open to everyone (see Flows in Pro below).",
    ],
    visual: "spark",
    tint: "orange",
  },
  {
    slug: "flows",
    date: "Oct 7, 2026",
    title: "Flows in Pro",
    summary: "SwiftPieces Pro now has Flows: 48 complete journeys through its 12 app templates, played screen by screen from first run to sign out.",
    points: [
      "A flow is a whole journey through an app, not one screen: first run with sign-in and the paywall, the core of the app, then profile and settings, from 6 to 14 steps.",
      "Four flows for every Pro template: 12 first runs, 24 core journeys and 12 profile and settings flows, through 205 app screens.",
      "Each step is a real SwiftUI screen from the template's Xcode project, in the template's own styles, light and dark.",
      "Find Flows in the navbar's Library menu, next to Pro's screens and templates, and in the Pro section of the home page.",
      "The first three steps of every flow are open to everyone on pro.swiftpieces.com.",
    ],
    visual: "phones",
    tint: "blue",
  },
  {
    slug: "styles",
    date: "Oct 7, 2026",
    title: "Styles",
    summary: "Make one style for every screen you build. Pick its color, type, shape and motion on live SwiftUI components and real app screens, then take it to the Playground or your own app with one code.",
    points: [
      "Styles, a new page: shape a style on live components and three app screens side by side, from 12 looks, 31 iOS fonts and 9 moods to shuffle in. Lock the parts you like and shuffle the rest, in light and dark.",
      "One code carries a style everywhere: it opens any free app in the Playground wearing it, comes back to Styles from the Playground, and copies as a prompt for your coding agent with the Theme.swift it needs.",
      "Styles reach further into the screens: Waterllama's liquid now pours in a palette drawn from your style's color, a new mix with every shuffle, and the same in the SwiftUI you take to Xcode.",
      "Cleaner layouts under any style: centered headers move their buttons to their own row, and a title too wide for a bold display font shrinks to fit instead of running under the buttons.",
      "Edit a screen's layout in the Playground: move, swap, duplicate, delete or add a component from the bar on the canvas, or drag one to reorder it.",
      "New navigation: Library holds what you install, Create the tools you use in the browser (Apps and Styles), and Resources the docs, guides, MCP, this changelog and our sponsors.",
      "Every piece builds in new Xcode 26 projects, which run code on the main actor by default.",
      "Faster docs: highlighted code ships at about half the size, so pages load quicker.",
      "The name is now written as one word: SwiftPieces.",
    ],
    visual: "palette",
    tint: "purple",
  },
  {
    slug: "apps-and-playground",
    date: "Sep 29, 2026",
    title: "Apps and the Playground",
    summary: "Try an app before you build it. Twenty app remixes run live in a browser Playground you can restyle, mix and open in Xcode, alongside 12 new pieces, redesigned docs and light mode.",
    points: [
      "Apps: 20 remixes inspired by independent App Store apps. Each app page puts its App Store screenshots next to our own take on the screens, built only from SwiftPieces with our own names, copy and colours.",
      "The Playground: every remix runs on an interactive iPhone in the browser. Tap, swipe and scrub with the real motion, then Inspect any part to see its properties and the SwiftUI it becomes.",
      "Inspiration on every screen: the App Store screenshot it started from (reference only) and a short note on what makes the screen work.",
      "Remix across apps: add or replace screens from any app, up to 10, and reorder them. Style keeps them one app, with the same colour, fonts, corners, cards, spacing, size and weight on every screen.",
      "Shuffle Style rolls a fresh look while you keep the parts you like, and a style code shares the exact look.",
      "Map shows every screen and component as a tree. Click one to go into it, and step back to the map in one tap.",
      "Build: open the whole app in Xcode straight from the browser, download the Xcode project, copy a screen's SwiftUI, copy a prompt for your coding agent, or copy a link to your remix. Nothing is stored on our servers.",
      "Sign in to save remixes and come back to them later.",
      "12 new pieces: Index Scrubber, Drag Select Grid, Attachment Tray, Follow Scroll, Address Field, Signature Pad, Link Preview, Photo Cropper, Location Picker, Spotlight Tour, Activity Heatmap and Picture Headline. Each handles the hard cases: cancelled requests, gestures that share the screen with scrolling, VoiceOver, Dynamic Type and right-to-left languages.",
      "Photo Cropper crops a picked photo at full resolution with pinch, pan, aspect presets and quarter turns. Location Picker sets an exact spot by dragging a map under a pin and finds its address. Spotlight Tour walks people through a screen, dimming everything but the control it introduces. Activity Heatmap shows a streak calendar you can scrub day by day. Picture Headline sticks living pictures between a headline's words like a hand-placed collage: each lands as a tilted sticker with crop marks flashing at its corners, the sun is our red mascot, and you can press any sticker to lift it.",
      "The new pieces run in the app remixes too, each on the screen it suits: Split Bills drag-selects the weekend's photos and attaches receipts; Habit Journal opens with a tour, reads a streak heatmap and signs a new habit as a promise; Feelings Journal crops your profile photo; Sun Path and Daylight Times picks a spot on a map; Calendar Planner finds an event's address; Trip Organizer follows the group chat; Word Practice jumps through liked words A to Z; and Downtime Lists keeps saved links as cards. Each new piece's page opens its screen in the Playground.",
      "Redesigned docs: a floating sidebar with a filter, every category with its piece count, New badges on recent pieces, guides that teach a technique, and a page for every category.",
      "Light mode: the whole site follows your system, or the choice you make in the footer. Component previews sit on a paper-coloured stage so the pieces read the way they would in an app.",
      "Icons across the site now move a little when you hover them, and hold still if you prefer reduced motion.",
      "The library is now 67 pieces across 14 categories, and 58 of them run in the Playground.",
    ],
    visual: "phones",
    tint: "red",
  },
  {
    slug: "everyday-pieces",
    date: "Sep 23, 2026",
    title: "Everyday Pieces",
    summary: "Seven pieces for the parts SwiftUI still leaves hard: Range Slider, Date Range Picker, Token Field, Amount Field, Form Field, Expandable Text and Paged List.",
    points: [
      "7 new pieces for the parts of an app SwiftUI still leaves hard: Range Slider, Date Range Picker, Token Field, Amount Field, Form Field, Expandable Text and Paged List.",
      "5 decorative pieces were removed: Ambient Mesh, Aurora, Grain, Pull to Refresh and Weight Wave.",
      "The library is now 55 pieces across 14 categories.",
    ],
    visual: "slider",
    tint: "blue",
  },
  {
    slug: "0-3",
    date: "Sep 15, 2026",
    title: "A Premium Standard",
    summary: "Version 0.3. Every piece was re-audited: hard to recreate, designed before it moves, iPhone-first. 48 generic pieces left, 47 were redesigned and 7 signature pieces arrived.",
    points: [
      "The library was re-audited against a premium standard: hard to recreate, designed before it moves, iPhone-first. 48 generic pieces were removed, 47 were redesigned and renamed for the experience they deliver, and 7 signature pieces were added: Swipe Deck, Floating Dock, Hold to Confirm, Task Row, Confirm Sheet, Weight Wave and Photo Viewer.",
      "51 pieces across 14 categories that describe interaction value: Text, Backgrounds, Glass, Controls, Inputs, Cards, Lists, Navigation, Sheets, Feedback, Motion, Data, AI and Media.",
      "Every interactive piece now designs its states (pressed, dragging, loading, success, error, expanded) and its haptics; every background ships quiet named palettes.",
    ],
    visual: "cards",
    tint: "pink",
  },
  {
    slug: "0-2",
    date: "Sep 2026",
    title: "Liquid Glass Helpers",
    summary: "Version 0.2. 73 new pieces take the library to 98 across 17 categories, with GlassSurface and ConcentricCorners for iOS 26's Liquid Glass.",
    points: [
      "73 new free pieces, taking the library to 98 across 17 categories: buttons, inputs, cards, lists, navigation, overlays, loading, feedback, motion, charts, AI, foundations and states join text, backgrounds, effects and Liquid Glass.",
      "New Liquid Glass helpers: `GlassSurface`, one modifier that renders real glass on iOS 26 and a Material fallback below it, and `ConcentricCorners` for container-relative corner radii.",
      "The old \"Components\" category is gone; Confetti now lives in Feedback. Category metadata has one source of truth, so the docs sidebar, filters, MCP and CLI stay in sync.",
      "Every piece still type-checks alone against the iOS 26 SDK in Swift 6 mode and compiles together in the preview app.",
    ],
    visual: "grid",
    tint: "purple",
  },
  {
    slug: "0-1",
    date: "Sep 2026",
    title: "The First Release",
    summary: "Version 0.1. 25 free pieces across text, backgrounds, effects, components and Liquid Glass, a registry, llms.txt and the swiftpieces CLI.",
    points: [
      "25 free pieces across text, backgrounds, effects, components and Liquid Glass.",
      "Registry protocol at `/r/[name].json`, `llms.txt`, and the `swiftpieces` CLI with `init`, `add`, `list`.",
      "Every piece type-checked against the iOS 26 SDK in CI.",
    ],
    visual: "terminal",
    tint: "red",
  },
];

/** The changelog's docs page, or one update's page under it. */
export const changelogPath = (slug?: string) => (slug ? `/docs/changelog/${slug}` : "/docs/changelog");

export const changelogEntry = (slug: string) => changelog.find((e) => e.slug === slug) ?? null;

/**
 * Where an update sits: its drawing's seed (so its card and its page draw the same strokes) and the
 * updates either side of it, for the Newer and Older links under its page.
 */
export function changelogPlace(slug: string) {
  const i = changelog.findIndex((e) => e.slug === slug);
  return { seed: i + 1, newer: i > 0 ? changelog[i - 1] : null, older: i >= 0 && i < changelog.length - 1 ? changelog[i + 1] : null };
}
