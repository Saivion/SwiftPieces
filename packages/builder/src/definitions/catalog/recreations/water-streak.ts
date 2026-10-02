// The water-streak remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in water-streak.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "water-streak", title: "Water and Streaks", category: "Health",
    summary: "A drink tracker in the Swift Pieces look: a shape that fills in bands, widgets, a streak calendar, challenges you join with a tap, and the day's mascot with the week collected.",
    description: "A water tracker in six screens, in the Swift Pieces look, light or dark. Today opens on a two-weight header with round buttons to the streak and widgets: the day's blob filling in bands, one colour per drink, with a shelf to log another and a way into the day's summary. Pushed screens take the navigation title and back: widgets where the medium one has its own shelf, over a rolling total; the month as streak capsules under a streak ring, with logged drinks you swipe away and a trophy to the challenges; challenges as filling mascots over swipeable pages of tiles you tap to join, with a finished page that is honestly empty so far; and the day's grinning mascot under 'Goal met', the week's mascots below. A sheet shares a tilting card with a button that loads, checks and closes. Actions are pills, cards 24, tiles 16. Built from Screen Header, Layer Fill, Elastic Button, Live Stat, Streak Calendar, Swipe Action Row, Mascot, Tracking Tabs, Color Block List, Text Reveal, Motion Card and Commit Button.",
    try: ["Tap a drink on the shelf, then tap the blob to undo", "Log a drink on the medium widget", "Tap a day, then swipe a drink away", "Tap a tile to join it, then swipe to Finished", "Tap the day's mascot", "Tilt the share card and press Share"],
    interactions: ["tap", "press", "select", "swipe", "drag", "push", "sheet", "spring", "haptic"],
    components: ["screen-header", "layer-fill", "elastic-button", "live-stat", "streak-calendar", "swipe-action-row", "mascot", "tracking-tabs", "color-block-list", "text-reveal", "motion-card", "commit-button"],
    keywords: ["swiftui water tracker", "swiftui streak calendar", "swiftui fill animation", "swiftui habit streak"],
    steps: [
      { title: "Today", transition: "start" },
      { title: "Widgets", transition: "push" },
      { title: "Streak", transition: "push" },
      { title: "Challenges", transition: "push" },
      { title: "Day summary", transition: "push" },
      { title: "Share", transition: "sheet" },
    ],
  },
  moves: [
    ["The blob is the progress bar: each drink is a band in its own colour, so the day reads at a glance.", "One tap on the shelf logs a serving with a spring and a rising haptic; tapping the blob takes it back."],
    ["Widgets reuse the same fill small; the medium one carries its own shelf, so logging never opens the app.", "The day's total rolls up digit by digit under the widgets, with the change against yesterday beside it."],
    ["Runs of kept days join into one capsule, so the streak is a shape you see before you count it.", "The ring winds up as it appears; the day's drinks sit below as rows you swipe away to undo, and a trophy leads to challenges."],
    ["Challenges you've started sit as filling mascots up top, each with its own face; the ones to start are tiles you tap to join.", "Kinds of challenge are pages under a sliding block, and the finished page says when the first one lands instead of sitting blank."],
    ["'Goal met' rises in over one big mascot with its total; tap it and it squashes and grins.", "Past days line up below as smaller mascots, each as full as it got, with a face to match."],
    ["The share card tilts under your finger like a real card, with the day's fill and total on it.", "Share shows loading, then a check, then closes the sheet, so the result is never in doubt."],
  ],
};
