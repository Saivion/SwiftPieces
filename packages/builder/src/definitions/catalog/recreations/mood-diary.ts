// The mood-diary remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in mood-diary.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "mood-diary", title: "Mood Diary", category: "Lifestyle",
    summary: "Tap a level, tick what filled the day, write three good things, read your entries, then the month as a mood line and a count of days per mood, and the year a dot a day.",
    description: "A micro diary in six screens, in the SwiftPieces look: five level discs under the mascot and the date for how the day is going, pushed screens of round activity toggles and three good things you save, entries that replace the logging flow once saved, led by their level with a nudge for a day you missed, then the month: rolling figures, a mood line with faces up its edge and every day a dot in its mood's colour (a gap where a day went unlogged) that you scrub to read, and a half ring of how many days each mood got, faces under it wearing their counts; and the year so far as dots with a live count. Actions and chips are pills, cards 24. Built from Screen Header, Mascot, Mood Faces, Icon Toggles, Elastic Button, Plan Row, Commit Button, Odometer, Mood Line, Mood Count, Mood Calendar and Live Stat.",
    try: ["Tap a disc to log the day", "Toggle a few activities", "Save the note", "Drag across the month's line", "Tap a face under the mood count", "Tap a dot in the year"],
    interactions: ["tap", "toggle", "push", "scrub", "select", "type", "loading", "haptic"],
    components: ["screen-header", "mascot", "mood-faces", "icon-toggles", "elastic-button", "plan-row", "commit-button", "odometer", "mood-line", "mood-count", "mood-calendar", "live-stat"],
    keywords: ["swiftui mood tracker", "swiftui diary app", "swiftui mood chart", "swiftui mood year grid", "swiftui activity toggles"],
    steps: [
      { title: "Log the day", transition: "start" },
      { title: "Activities", transition: "push" },
      { title: "Note", transition: "push" },
      { title: "Entries", transition: "replace" },
      { title: "The month", transition: "push" },
      { title: "The year", transition: "push" },
    ],
  },
  moves: [
    ["Five discs filled to their level, cool to warm, make the whole check-in one tap, and the tap itself moves you on to the next step."],
    ["Activities are round icon toggles grouped by part of life, all in the one accent, under a badge of the level you just picked, so tagging a day is a few taps, never typing."],
    ["Three good things, each with when it happened, and a line for one more: the note is a minute's work, and one button saves it with a loading and success state.", "Saving is a one-way door: your entries replace the logging flow, so back never re-opens a saved day."],
    ["Each entry leads with its level disc and word, then tags and the note, so the list reads by feeling first, and a missed day asks to be logged."],
    ["The month reads as a line of moods: faces up the edge, each day a dot in its mood's colour, each stretch blending its two days and a gap where one went unlogged; drag across to read any day.", "How many days each mood got is a half ring of blocks in the same colours, the total in its middle; tap a face to single a mood out."],
    ["A dot per day, a column per month: the year so far pops in month by month, the days still to come wait as empty dots, and a tap lifts a day out."],
  ],
};
