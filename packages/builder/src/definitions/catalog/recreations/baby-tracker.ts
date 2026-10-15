// The baby-tracker remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in baby-tracker.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "baby-tracker", title: "Baby Tracker", category: "Lifestyle",
    summary: "A baby tracker in the SwiftPieces look: colour-coded cards for sleep, feeds, bottles, diapers and pumping with a running nap timer, left and right nursing timers, the week's sleep as a grid, sleep trends, an assistant that reads the logs and a gentle plan.",
    description: "A baby tracking app in seven screens across three tabs on a floating dock, in the SwiftPieces look, light or dark; actions are pills, cards 22, chips are capsules. Home opens on the next nap, predicted, on a sage card with a 2-nap or 3-nap switch, then a card per thing you log on its own house pastel, each with when it last happened and a Log pill: sleep in sky with the nap running as a timer ring you start and pause, nursing in peach, bottles in blush, diapers in butter and pumping in lilac, over today's totals. Feeding is a sheet you swipe between nursing, with a timer for each side and the last side marked, and a bottle with ounces on a scrub stepper and what was in it. A diaper takes a time, pee, poo, mixed or dry as round toggles, a size and a colour. Reports swipes between the week as a grid of sleep by the hour, the days as an agenda and a summary; sleep trends compare this week with last, bars and a rule for the average, over four tiles. Ask is an assistant that answers from the logs, offers a plan and suggests the next question; the plan walks tonight's steps one at a time along a trail of nights. Built from Screen Header, Tag, Glass Segments, Button, Progress Ring Row, Stat Grid, Tracking Tabs, Scrub Stepper, Icon Toggles, Row, Form Field, Commit Button, Filter Rail, Activity Grid, Agenda Day, Elastic Button, Compare Line, Disclosure, Chat Bubble, Media Row, Prompt Chips, Step Trail and Focus Steps.",
    try: ["Start the nap timer on the Sleep card", "Log a feed and run the left side", "Swipe the feed sheet to Bottle and scrub the ounces", "Log a diaper: poo, medium, save", "Swipe Reports from Calendar to List", "Open the plan from Ask and step through tonight"],
    interactions: ["tabs", "sheet", "push", "tap", "swipe", "scrub", "select", "toggle", "type", "loading", "haptic"],
    components: ["screen-header", "tag", "glass-segments", "button", "progress-ring-row", "stat-grid", "tracking-tabs", "scrub-stepper", "icon-toggles", "row", "form-field", "commit-button", "filter-rail", "activity-grid", "agenda-day", "elastic-button", "compare-line", "disclosure", "chat-bubble", "media-row", "prompt-chips", "step-trail", "focus-steps"],
    keywords: ["swiftui baby tracker", "swiftui feeding timer", "swiftui sleep log", "swiftui parenting app"],
    steps: [
      { title: "Home", transition: "start" },
      { title: "A feed", transition: "sheet" },
      { title: "A diaper", transition: "sheet" },
      { title: "The week", transition: "tab" },
      { title: "Sleep trends", transition: "push" },
      { title: "Ask the assistant", transition: "tab" },
      { title: "A gentle plan", transition: "push" },
    ],
  },
  moves: [
    ["Every kind of log keeps its own pastel, so sleep, feeds and diapers are found by colour before they're read.", "Each card leads with how long ago, the one figure a tired parent needs; the nap runs as a ring you start and pause right on the card.", "The next nap sits on top on sage, with a switch for a 3-nap day."],
    ["Nursing gives each side its own timer and marks the last side, so the next feed starts on the right one.", "Bottle is the next page, ounces on a scrub stepper; saving shows loading, then a check."],
    ["A diaper is four round toggles, a size and a colour, each one tap, so logging takes seconds at 3 AM."],
    ["The week reads as a grid of sleep by the hour, a row a day, so a drifting bedtime shows as a shifted edge.", "Swipe for the days as an agenda, each sleep and feed on a coloured capsule, or a summary of averages."],
    ["This week's sleep runs against last week's as a line over daily bars, with the average as a rule.", "The change sits on a chip up top; four tiles break the total into night, naps and wakes."],
    ["The assistant answers in a bubble that writes itself from Milo's own logs, not general advice.", "A plan it suggests is a row you open, and the next questions wait as chips above the field."],
    ["Tonight's steps come one at a time with the rest faded back, so it can be followed with a baby in your arms.", "The nights sit on a trail above, and marking tonight done confirms in place."],
  ],
};
