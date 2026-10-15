// The running-plan remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in running-plan.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "running-plan", title: "Running Plan", category: "Health",
    summary: "A running coach in the SwiftPieces look: a plan counting down to race day with this week's workouts, a session's structure, the live run with your current rep and pace, the saved run on its map, your activities and records, and a plan for any goal.",
    description: "A running plan in seven screens over a floating dock, in the SwiftPieces look; actions are pills, cards 20, tiles 12, and every workout kind keeps one colour: long runs violet, easy azure, intervals ember, tempo blush, mobility lavender, pilates green. The Plan tab counts down to race day on split-flap tiles, marks the training phase on a trail, and lists the week on a day strip and as rows you tick off. A workout shows its paces as cards, the coach's note as a bubble and the session as steps in focus, with Outdoor or Treadmill on a glass pill. Starting it brings up the live run on a charcoal ground: the rep and its target as the header, a ring of the rep left, your current pace in mint, lap figures, what's next and the coach's cue. Finishing pushes the saved run: its route with numbered markers, four coloured tiles, splits with the fastest marked and the coach's verdict, then Save lands on Activities, with weekly distance, personal bests and your shoes' mileage. Plans for any goal come up as a sheet of cards, and building one ends on the plan, ready. Built from Screen Header, Countdown Card, Step Trail, Stat Grid, Day Picker, Plan Row, Elastic Button, Glass Segments, Chat Bubble, Focus Steps, Toast, Tint Panel, Timer Dial, Mini Map, Place Map, Chart, Commit Button, Goal Ring, Media Row, Filter Rail, Choice and Text Reveal.",
    try: ["Tick off Monday's long run", "Open today's intervals and step through the session", "Start the workout and read your pace", "Finish, then tap the fastest split", "Save the run and read your personal bests", "Tap + and pick a half marathon plan"],
    interactions: ["tabs", "push", "sheet", "tap", "select", "toggle", "swipe", "scrub", "spring", "loading", "haptic"],
    components: ["screen-header", "countdown-card", "step-trail", "stat-grid", "day-picker", "plan-row", "elastic-button", "tag", "glass-segments", "chat-bubble", "focus-steps", "toast", "tint-panel", "timer-dial", "mini-map", "place-map", "chart", "toggle", "commit-button", "goal-ring", "media-row", "filter-rail", "choice", "text-reveal", "image", "row"],
    keywords: ["swiftui running app", "swiftui training plan", "swiftui workout coach", "swiftui run tracker"],
    steps: [
      { title: "This week's plan", transition: "start" },
      { title: "A workout", transition: "push" },
      { title: "Running it", transition: "sheet" },
      { title: "The saved run", transition: "push" },
      { title: "Activities", transition: "tab" },
      { title: "Plans for any goal", transition: "sheet" },
      { title: "Your plan is ready", transition: "push" },
    ],
  },
  moves: [
    ["Race day counts down on split-flap tiles and the phase you're in sits on a trail, so the long plan reads as one place on a road.", "The week is a day strip and a row per workout, each kind in its own colour, ticked off with a spring."],
    ["The paces lead as three cards; the coach's note writes itself in, and the session's four parts are steps with the hard one in focus."],
    ["Mid-run only the rep matters: its distance and target are the header, a ring shows what's left of it and your pace is one mint figure.", "What's next and the coach's cue sit underneath, and Finish is the one coral pill."],
    ["The saved run opens on its route with numbered markers, then four coloured tiles.", "Splits mark the fastest kilometre, and the coach says what it means before you save."],
    ["A week reads as three figures over the bars of the last eight, this one marked.", "Personal bests are soft squares, and your shoes wear a ring toward their mileage."],
    ["Every goal is a card with its length and its distance as a badge; picking one unpicks the others, and the current plan says so."],
    ["The plan arrives in words first, then its race, the figures it trains for and the choices it was built on."],
  ],
};
