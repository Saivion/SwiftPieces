// The gentle-activity remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in gentle-activity.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "gentle-activity", title: "Activity in Range", category: "Health",
    summary: "A kind fitness app in the SwiftPieces look: a verdict over your own range, a step count in a halo, recovery signals, last night's stages and the month in review.",
    description: "A gentle fitness app in five screens on a floating dock, in the SwiftPieces look, light or dark. Tab screens open on a two-weight header; pushed screens take the navigation title and back. Today puts a grinning mascot over a verdict that rises in word by word and a 30-day effort line through your usual-range band, with the walk as a row that opens its steps; Steps counts up in a signal halo over a through-the-day comparison; Body reads recovery signals as range tiles with last night as a row; Last night leads with a one-word verdict over a scrubbable stage timeline; History swipes between week, month and a year that hasn't filled in yet. Actions are pills, cards 24, tiles 16. Built from Screen Header, Mascot, Text Reveal, Band Trend, Media Row, Glow Number, Compare Line, Stat Grid, Metric Strip, Stage Timeline and Tracking Tabs.",
    try: ["Tap the mascot, then drag across the range band", "Press the walk row or the header button to open steps", "Tap a recovery tile, then open last night", "Scrub the sleep stages", "Swipe from Month to Week, then to Year"],
    interactions: ["scrub", "tap", "press", "drag", "select", "swipe", "push", "tabs", "spring", "haptic"],
    components: ["screen-header", "mascot", "text-reveal", "band-trend", "media-row", "glow-number", "compare-line", "stat-grid", "metric-strip", "stage-timeline", "tracking-tabs"],
    keywords: ["swiftui fitness app", "swiftui sleep stages chart", "swiftui step counter", "swiftui activity chart"],
    steps: [
      { title: "Today", transition: "start" },
      { title: "Steps", transition: "push" },
      { title: "Body", transition: "tab" },
      { title: "Sleep", transition: "push" },
      { title: "History", transition: "tab" },
    ],
  },
  moves: [
    ["The band is your own normal, so the line reads as under, inside or over it without a single number.", "The mascot and the verdict sit on the centre line under the header, and the day's walk is a row that opens its steps."],
    ["One figure in a halo, with the comparison right under it, and a count-up when it appears.", "The day's line runs against your usual day's line, so you see the hour you pulled ahead."],
    ["Narrow tiles fit a whole recovery check in one row; the end dot's colour says which one needs a look.", "Last night is a check-in row under the signals, one tap from the full night."],
    ["A one-word verdict leads, the stages follow, and each figure carries a quiet check against your usual night.", "The stage timeline scrubs, so exact times appear only when you ask for them."],
    ["Week, month and year are swipeable pages under a sliding block, so the switch really changes the view.", "The year that hasn't filled in yet says when it will, instead of showing an empty chart."],
  ],
};
