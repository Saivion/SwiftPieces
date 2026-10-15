// The sobriety-counter remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in sobriety-counter.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "sobriety-counter", title: "Sobriety Counter", category: "Health",
    summary: "A sobriety tracker in the SwiftPieces look: days, hours, minutes and seconds as colour tiles on a deep teal ground, the next milestone, money saved, a daily pledge you hold to make, an evening review and a private group.",
    description: "A sobriety tracker in seven screens across three tabs on a floating dock, in the SwiftPieces look; actions are pills, cards 16, counter tiles 12. The counter stands on a deep teal ground with an azure glow: days, hours, minutes and seconds as four colour tiles, two by two, each tapping to its running total, the next milestone with how far along, what you've saved as figures and one red pill for today's pledge. Milestones fill a ring toward one month over the road so far as a timeline, the last one you reached and a note to your supporters that confirms as a toast; money saved rolls up on an odometer over calories, time and drinks, with a projection a year out and the daily cost you can change. Today leads with the pledge and the review, a seven-day challenge and the month's pledges as streak capsules under a ring. The pledge is a sheet on the teal ground: the promise in large, your reasons as a photo and two cards that tilt, and a hold to make it. The evening review asks yes or no, how hard it was on five filled discs, what came up as round toggles, the strongest urge on a bar you drag and a note. The group shows who pledged as fanned avatars over posts with sober-time chips and reactions, and a thought for the day. Built from Screen Header, Tint Panel, Progress, Stat Grid, Elastic Button, Goal Ring, Status Timeline, Media Row, Toast, Odometer, Chart, Amount Field, Glass Segments, Streak Calendar, Image, Motion Card, Hold to Confirm, Mood Faces, Icon Toggles, Expanding Track, Form Field, Commit Button, Fan Stack, Tag, Avatar and Reaction Toggle.",
    try: ["Tap a counter tile for its running total", "Open Savings and change the daily cost", "Make today's pledge: hold until it fills", "Tilt a reason card in the pledge", "Review today: pick a disc and drag the urge bar", "Fan out who pledged in the group"],
    interactions: ["tabs", "sheet", "push", "tap", "hold", "drag", "select", "toggle", "type", "loading", "haptic"],
    components: ["screen-header", "tint-panel", "progress", "stat-grid", "elastic-button", "goal-ring", "status-timeline", "media-row", "toast", "odometer", "chart", "amount-field", "glass-segments", "streak-calendar", "image", "motion-card", "hold-to-confirm", "mood-faces", "icon-toggles", "expanding-track", "form-field", "commit-button", "fan-stack", "tag", "avatar", "reaction-toggle"],
    keywords: ["swiftui sobriety tracker", "swiftui day counter", "swiftui daily pledge", "swiftui milestone tracker"],
    steps: [
      { title: "The counter", transition: "start" },
      { title: "Milestones", transition: "push" },
      { title: "Money saved", transition: "push" },
      { title: "Today", transition: "tab" },
      { title: "The daily pledge", transition: "sheet" },
      { title: "Evening review", transition: "sheet" },
      { title: "The group", transition: "tab" },
    ],
  },
  moves: [
    ["Sober time is four colour tiles on a deep teal ground, days to seconds, numbers set huge, so the count reads as one thing that keeps growing; tap one for its running total.", "The next milestone and what you've saved sit right under it, and the pledge is the one red pill."],
    ["The month fills as a ring with the days done, so a milestone is a shape you're closing, not a date.", "The road so far marks every milestone passed and the one in progress; telling your supporters is a tap with an undo."],
    ["Money saved rolls up on an odometer, then calories, time and drinks as tiles you tap for the note.", "A year at this pace is the bar that grows last, and the daily cost is a field that recounts it all."],
    ["The pledge and the review are the day's two actions, morning and night, one above the other.", "Kept days run as capsules under a ring that counts the streak, with today waiting to be pledged."],
    ["The promise is set in large on the teal ground, with your own reasons under it as a photo and cards that tilt.", "Pledging takes a deliberate hold that fills, then confirms with the day you're on."],
    ["Five filled discs say how hard the day was, and what came up is round toggles you tap in any number.", "The strongest urge is a bar you drag; saving confirms in place and closes the sheet."],
    ["Who pledged today fans out from a stack of avatars beside the group's streak.", "Posts carry each person's sober time as a chip, and reactions flood with colour when you tap them."],
  ],
};
