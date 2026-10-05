// The habit-journal remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in habit-journal.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "habit-journal", title: "Habit Journal", category: "Health",
    summary: "A habit tracker in the SwiftPieces look: a first-run tour of today's habits as rings you fill and a goal ring, consistency by range, synced readings with a sync problem to fix, one habit's heatmap and a new habit you sign.",
    description: "A habit tracker in five screens on a floating dock, in the SwiftPieces look, light or dark. Tab screens open on a two-weight header: today's habits grouped by morning and evening, each a ring that fills as you add a step, run a timer or mark it done, with a round + that opens a new-habit sheet and a goal ring that sweeps up, the morning and evening habits introduced once by a tour that spotlights each in turn; consistency as a rolling score on swipeable week, four-week and year pages over a calendar grid you tap; and readings synced from other apps as tilting colour tiles, under an inline notice when one source stops syncing, with a Reconnect that confirms. One habit pushes in under its own navigation title: today's ring and its +4 first, the week with kept days marked, twenty weeks as a heatmap you scrub day by day beside the streak, the average daily score with its trend and how the days split, then quiet record cards; and the new-habit sheet counts by taps, a timer or a check on swipeable pages, takes a signature as a promise to keep it up, and confirms with an Add button in place. Actions are pills, cards 24, tiles 16. Built from Screen Header, Spotlight Tour, Progress Ring Row, Goal Ring, Tracking Tabs, Live Stat, Day Picker, Activity Grid, Activity Heatmap, Toast, Motion Card, Stat Grid, Form Field, Glass Segments, Scrub Stepper, Signature Pad and Commit Button.",
    try: ["Follow the tour with Next, or tap +1 km while it points at the walk", "Tap +1 km until the walk's ring is full", "Press +, sign the promise, then Add habit", "Swipe from 4 weeks to Year, then tap days on the calendar", "Press Reconnect, then tilt a reading tile", "Open Language cards and scrub the heatmap"],
    interactions: ["tap", "hold", "drag", "scrub", "select", "swipe", "push", "sheet", "tabs", "type", "spring", "transition", "haptic"],
    components: ["screen-header", "spotlight-tour", "progress-ring-row", "goal-ring", "tracking-tabs", "live-stat", "day-picker", "activity-grid", "activity-heatmap", "toast", "motion-card", "stat-grid", "form-field", "glass-segments", "scrub-stepper", "signature-pad", "commit-button"],
    keywords: ["swiftui habit tracker", "swiftui progress ring", "swiftui heatmap", "swiftui onboarding tour", "swiftui signature", "swiftui calendar grid"],
    steps: [
      { title: "Today", transition: "start" },
      { title: "Consistency", transition: "tab" },
      { title: "Sources", transition: "tab" },
      { title: "Habit", transition: "push" },
      { title: "New habit", transition: "sheet" },
    ],
  },
  moves: [
    ["Each habit's symbol sits in a ring that fills toward its own goal, so 2 of 4 km reads at a glance.", "The pill adds a step, runs a timer or marks it done in place; the header + opens a new habit, and the goal ring sweeps up.", "On the first visit a tour dims around the morning, then the evening habits, ringed in the accent; taps on a stop still log."],
    ["The score for each range is its own page under a sliding block, so switching range really changes the figure.", "A calendar grid shades each day by how fully it was kept; rest days carry their own mark, never a miss."],
    ["Connected sources sit on top; each reading is a colour tile with today's figure that tilts under your finger.", "A source that stopped syncing says what it breaks and offers one fix, which confirms with a toast."],
    ["Today's ring and its one action lead, so logging is the first thing on the page; the week strip marks the days kept.", "Twenty weeks shade from pale to full red beside the streak; drag across them and each day lifts with its date and count.", "The average score with its trend and how the days split follow; records sit last as quiet cards."],
    ["A short form in one sheet: a name, when, and how it counts, each way of counting its own page with its own goal.", "A signature makes it a promise: ink thins on quick strokes, Undo takes back a stroke, and Type instead sets your name.", "Add habit shows loading then a check in place, and the sheet closes itself."],
  ],
};
