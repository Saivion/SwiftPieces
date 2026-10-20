// The focus-timer remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in focus-timer.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "focus-timer", title: "Focus Timer", category: "Productivity",
    summary: "A focus timer in the SwiftPieces look: a dial you drag in your category's colour under an intention, the session counting down, a reflection with how it felt, a weekly report, the log and the day's calendar.",
    description: "A focus timer in seven screens across three tabs on a floating dock, in the SwiftPieces look; actions are capsules, cards 20, chips 12. The category is the accent: each keeps one colour everywhere, and the timer wears the current one. Focus asks what you're working on, with the category as a capsule that opens a sheet of colour blocks and past intentions, an intention field, and a thick analog dial you drag round to set the length, with the end time beside it and Start in red. The session counts down on a soft ring with +5 and pause, the block's focus and breaks as a timeline, and abandoning takes a hold. Reflecting asks how it felt on five faces, shows the session's figures and what you learned, and submits into the report: the week's total and average as tiles, the days as bars, categories as a ring you scrub and the feelings counted on a half ring. The log reads a day's sessions behind their colours with a learning note, and the calendar sets them on the day's hours. Built from Screen Header, Button, Form Field, Timer Dial, Tag, Filter Rail, Elastic Button, Colour Block List, Focus Ring, Stat Grid, Status Timeline, Hold to Confirm, Mood Faces, Commit Button, Glass Segments, Chart, Ring Breakdown, Mood Count, Day Picker, Event Line, Expandable Text and Hour Timeline.",
    try: ["Drag the dial round to 50 minutes", "Open the Deep work capsule and pick another category", "Start the session, then tap +5", "Finish, pick a face and submit", "Scrub the categories ring in the report", "Read Thursday's sessions in the log"],
    interactions: ["tabs", "push", "sheet", "drag", "tap", "hold", "select", "scrub", "type", "swipe", "haptic"],
    components: ["screen-header", "button", "form-field", "timer-dial", "tag", "filter-rail", "elastic-button", "color-block-list", "focus-ring", "stat-grid", "status-timeline", "hold-to-confirm", "mood-faces", "commit-button", "glass-segments", "chart", "ring-breakdown", "mood-count", "day-picker", "event-line", "expandable-text", "hour-timeline"],
    keywords: ["swiftui pomodoro timer", "swiftui focus timer", "swiftui timer dial", "swiftui productivity report"],
    steps: [
      { title: "What's your focus?", transition: "start" },
      { title: "Category", transition: "sheet" },
      { title: "In session", transition: "push" },
      { title: "Reflect", transition: "sheet" },
      { title: "Weekly report", transition: "tab" },
      { title: "Session log", transition: "push" },
      { title: "Calendar", transition: "tab" },
    ],
  },
  moves: [
    ["One question leads: what's your focus, with the category as a capsule and the intention in a field, so every session starts with a reason.", "The dial is thick and drags like a kitchen timer, ticking each minute, in the category's own colour; the end time sits beside it and Start is the only red."],
    ["Categories are colour blocks, so picking one is picking the timer's colour.", "Past intentions sit below as chips, because the same work comes back."],
    ["The running session is one soft ring of time left with +5 and pause, the intention under it.", "The block's focus and breaks read as a timeline, and abandoning takes a deliberate hold."],
    ["Reflecting is quick: one face for how it felt, the figures already filled in, one line for what you learned.", "Submit confirms in place and lands on the report; left alone, it submits itself."],
    ["The week leads with its total and the change as tiles, then the days as bars.", "Categories keep their colours in a ring you scrub, and how sessions felt is counted on faces."],
    ["A day's sessions sit behind capsules in their category's colours, so the day's mix reads at a glance.", "Learnings are kept as notes that open in place."],
    ["Sessions sit on the day's hours beside the calendar's events, with a line at now.", "A tap on a free hour plans the next one."],
  ],
};
