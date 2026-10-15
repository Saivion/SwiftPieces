// The workout-log remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in workout-log.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "workout-log", title: "Workout Log", category: "Health",
    summary: "A gym log in the SwiftPieces look: routines to start, a set table you check off with a rest timer, the records you beat, a feed of friends' workouts and your progress.",
    description: "A strength training log in seven screens across three tabs, in the SwiftPieces look with a floating dock; actions are pills, cards 20, tiles and cells 14. The Workout tab opens on routines you start with one red pill. Logging a workout is a full sheet under a glass bar with Finish: duration, volume and sets as tiles, then each exercise as a set table of last time, weight and reps, where checking a set tints the row green, starts a rest timer beside the exercise's name and Add Set copies the last row; discarding takes a hold. Finish pushes the summary: the line rises in word by word over a glowing volume total, with the records you beat. Home is a feed of friends' workouts with figures and likes; Profile charts the weeks with Duration, Volume and Reps on glass segments over four dashboard tiles, which lead to an exercise's one rep max line with its records, and to statistics: the month's training days and sets per muscle. Built from Screen Header, Set Table, Glass Bar, Stat Grid, Elastic Button, Hold to Confirm, Text Reveal, Glow Number, Commit Button, Reaction Toggle, Glass Segments, Chart, Compare Line, Filter Rail, Activity Grid and Category Bars.",
    try: ["Start Push Day", "Check a set and watch the rest timer", "Tap Add Set", "Finish, then save the workout", "Like a friend's workout", "Open Exercises and read the one rep max line"],
    interactions: ["tabs", "sheet", "push", "tap", "hold", "select", "scrub", "toggle", "haptic"],
    components: ["screen-header", "set-table", "glass-bar", "stat-grid", "elastic-button", "hold-to-confirm", "text-reveal", "glow-number", "commit-button", "reaction-toggle", "glass-segments", "chart", "compare-line", "filter-rail", "activity-grid", "category-bars", "card", "avatar", "row", "tag"],
    keywords: ["swiftui workout tracker", "swiftui gym log", "swiftui rest timer", "swiftui set tracker"],
    steps: [
      { title: "Routines", transition: "start" },
      { title: "Logging a workout", transition: "sheet" },
      { title: "Workout done", transition: "push" },
      { title: "Friends' workouts", transition: "tab" },
      { title: "Profile", transition: "tab" },
      { title: "An exercise's progress", transition: "push" },
      { title: "Statistics", transition: "push" },
    ],
  },
  moves: [
    ["Starting is one tap: each routine is a card with what's in it and a red Start pill, so the plan is never more than a glance away.", "An empty workout sits above them as a quieter raised button for days off the plan."],
    ["Every set is a row of what you did last time beside what you're doing now, so beating it is the obvious move.", "Checking a set tints the row green with a success tap and starts the rest timer beside the exercise's name; Add Set copies the last row, and discarding takes a deliberate hold."],
    ["The summary leads with the result in words, then the volume as one glowing number that counts up against last time.", "Records beaten get their own rows with a trophy, and saving confirms in place before landing on the feed."],
    ["A friend's workout is a card of three figures and the lifts, so you read the session, not just that it happened.", "The heart floods with colour and bounces when you like it."],
    ["The weeks are one bar chart you switch between duration, volume and reps on a glass pill.", "Four tiles below lead deeper: records and graphs, statistics, measures and the calendar."],
    ["An exercise opens on its one rep max, the change as a green chip, then the line through the months you drag to read.", "Records sit below as a grid, one figure each."],
    ["The month shows which days you trained at a glance, with today marked.", "Sets per muscle keep one colour each, so a neglected group stands out; drag across to read a bar."],
  ],
};
