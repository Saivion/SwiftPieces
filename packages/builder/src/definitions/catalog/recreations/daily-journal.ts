// The daily-journal remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in daily-journal.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "daily-journal", title: "Daily Journal", category: "Health",
    summary: "A calm morning home, an evening wind-down, a prompt to write in a sheet, a check-in with week and month insights, a ring breathing guide and guided paths.",
    description: "A self-care journal in six screens and three tabs, in the Swift Pieces look: a morning home under a two-weight greeting with a thought to start on, three small practices to tick off and the week in rolling figures; an evening wind-down led by the mascot; tonight's prompt in a composer sheet you save and close; insights with a face check-in, a week and a month you swipe between and a pattern still gathering data; a ring breathing guide with three paces; and guided paths. Actions and chips are pills, cards 24, rows 20. Built from Screen Header, Text Reveal, Elastic Button, Plan Row, Odometer, Mascot, Glass Segments, Form Field, Commit Button, Swipe Action Row, Mood Faces, Tracking Tabs, Compare Line, Progress, Breath Scene, Progress Ring Row and Colour Block List.",
    try: ["Tick off a morning practice", "Write about the thought, save and close", "Pick a face, then swipe to the month", "Tap the rings to breathe, swipe for a slower pace"],
    interactions: ["tap", "push", "sheet", "select", "type", "scrub", "swipe", "tabs", "haptic"],
    components: ["screen-header", "text-reveal", "elastic-button", "plan-row", "odometer", "mascot", "glass-segments", "form-field", "commit-button", "swipe-action-row", "mood-faces", "tracking-tabs", "compare-line", "progress", "breath-scene", "progress-ring-row", "color-block-list"],
    keywords: ["swiftui journal app", "swiftui mood check-in", "swiftui breathing rings", "swiftui mood chart"],
    steps: [
      { title: "Morning", transition: "start" },
      { title: "Wind down", transition: "push" },
      { title: "New entry", transition: "sheet" },
      { title: "Insights", transition: "tab" },
      { title: "Breathe", transition: "push" },
      { title: "Guided paths", transition: "tab" },
    ],
  },
  moves: [
    ["A two-weight greeting, then one thought that rises in with the only red button on the screen, so the morning always has a first step.", "Three small practices tick off with a drawn check, and the week's figures roll up underneath."],
    ["A pushed screen keeps the system title and back; the sleepy mascot sets the tone, and each practice says how long it takes before you commit."],
    ["Writing is a sheet over whatever you were doing: the prompt carries its own field and a save that loads, confirms and closes it.", "Recent entries slide aside to pin or delete."],
    ["The check-in leads: five faces make it one tap with a soft haptic.", "Week and Month are real pages you swipe between, each a calm figure over this period's line against the last; a pattern still gathering data says how far it has to go."],
    ["Concentric rings breathe with you and the phase sits inside the disc; three paces are pages you swipe, each its own rhythm. Tap to start."],
    ["The path in progress sits in a ring you can tick, with one wide button to carry on; the rest are grouped by what you want, in two tabs you swipe between."],
  ],
};
