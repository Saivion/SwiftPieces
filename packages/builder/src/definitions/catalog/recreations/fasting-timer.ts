// The fasting-timer remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in fasting-timer.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "fasting-timer", title: "Fasting Timer", category: "Health",
    summary: "A fasting tracker in the SwiftPieces look: a ring that fills toward your goal on a charcoal ground, the zone you're in, fasts to choose from, a summary when you finish, meals scored for protein, water and challenges.",
    description: "An intermittent fasting tracker in seven screens across three tabs on a floating dock, in the SwiftPieces look; actions are pills, cards 28, chips and tiles 14. The fast stands on a charcoal ground with an ember glow: a thick tangerine ring filling toward the goal with the hours inside, the plan as a chip, the zone you're in as a button that opens the zones, when it started and when it ends, and one red End fast pill. Fasts to choose from are a sheet of colour tiles, two by two, with your own length on a scrub stepper. The zones run as a timeline from anabolic to deep ketosis with the hours you spend in each as coloured bars. Ending a fast pushes its summary: the line rises in word by word over a glowing count of hours, three tiles, faces to say how it felt and a note. Food scores protein on a ring beside the day's grams, lists meals with their macros and fills a glass with water by the tap; snapping a meal frames the plate in a camera sheet with Snap, Type and Scan modes and the estimate as chips. Me charts the last seven fasts over totals, a challenge ring and the other challenges on contour cards. Built from Screen Header, Tint Panel, Timer Dial, Tag, Elastic Button, Stat Grid, Colour Block List, Scrub Stepper, Commit Button, Text Reveal, Status Timeline, Category Bars, Disclosure, Glow Number, Mood Faces, Form Field, Media Row, Layer Fill, Camera Viewfinder, Chart and Goal Ring.",
    try: ["Tap the zone button under the ring", "Open the fasts sheet and scrub your own length", "End the fast, pick a face and save it", "Tap Water and Tea to fill the glass", "Snap a meal and swipe to Scan it", "Tap the challenge ring on Me"],
    interactions: ["tabs", "sheet", "push", "tap", "scrub", "swipe", "select", "type", "loading", "haptic"],
    components: ["screen-header", "tint-panel", "timer-dial", "tag", "elastic-button", "stat-grid", "color-block-list", "scrub-stepper", "commit-button", "text-reveal", "status-timeline", "category-bars", "disclosure", "glow-number", "mood-faces", "form-field", "media-row", "layer-fill", "camera-viewfinder", "chart", "goal-ring"],
    keywords: ["swiftui fasting tracker", "swiftui progress ring", "swiftui meal logging", "swiftui water tracker"],
    steps: [
      { title: "The fast", transition: "start" },
      { title: "Choose a fast", transition: "sheet" },
      { title: "Fasting zones", transition: "push" },
      { title: "Fast complete", transition: "push" },
      { title: "Food and water", transition: "tab" },
      { title: "Log a meal", transition: "sheet", note: ".sheet(isPresented:) with a camera view" },
      { title: "Me and challenges", transition: "tab" },
    ],
  },
  moves: [
    ["The ring is the screen: a thick tangerine arc filling toward the goal on a charcoal ground, so how far in you are reads before the numbers do.", "The zone you're in sits under it as a button with the time to the next, and End fast is the one red pill."],
    ["Fasts are colour tiles two by two, each with its hours large, so the choice is about length, not names.", "Your own fast is a scrub stepper up to seven days, and Start confirms in place before the sheet closes."],
    ["The zones read top to bottom as a timeline with the current one marked, so the next milestone is always the line below.", "Hours per zone keep one colour each, from cool anabolic to ember fat burning."],
    ["The summary leads with the result in words, then the hours as one glowing number that counts up against your average.", "How it felt is one tap on a face, and saving lands on your history."],
    ["Protein is a ring of the day's score beside the grams, so a good meal shows as a full arc.", "Meals keep their macros in one line, and water fills a glass in coloured bands with a tap per serving."],
    ["The camera fills the sheet with the plate in its corners; Snap, Type and Scan each bring their own hint.", "The estimate comes back as chips, protein first in green, and Log meal confirms with the new score."],
    ["The last seven fasts are bars against the goal over four totals.", "The month's challenge is one ring that sweeps up, with the others as quiet contour cards."],
  ],
};
