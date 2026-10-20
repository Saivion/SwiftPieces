// The task-manager remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in task-manager.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "task-manager", title: "Task Manager", category: "Productivity",
    summary: "A to-do app in the SwiftPieces look: lists with coloured glyphs and areas of projects with progress pies, Today with its events and This Evening, Upcoming by day, a new to-do with a checklist, a project in headings and the logbook.",
    description: "A calm to-do app in six screens, in the SwiftPieces look; actions are circles and pills, cards and tiles 14, and colour is kept for meaning. Lists opens on Quick Find and the smart lists, each with its own glyph and colour, then areas whose projects show as progress pies and rows, with a plus that blooms into a to-do, a project or a heading. Today puts the day's calendar events on top behind coloured capsules, then to-dos with their project under each title, a deadline flagged in red, and This Evening under a moon; a round check strikes a to-do off. Upcoming runs day by day under big date numbers, each day's events in a card and its to-dos below, then what repeats. A new to-do is a sheet with its notes, a checklist you tick, tags as chips, when as Today, This Evening, Someday or a date, and a deadline. A project leads with its pie and notes and groups to-dos under blue headings. The logbook shows the month's done days and what was finished by area. Built from Screen Header, Search Field, Row, Progress, Glass Action Menu, Event Line, Task Row, Tag, Elastic Button, Day Picker, Form Field, Expandable Text, Token Field, Glass Segments, Commit Button, Activity Grid and Category Bars.",
    try: ["Open Today and tick off a to-do", "Swipe a to-do right to complete it", "Press the plus and pick To-Do", "Open Upcoming and tick off a to-do for Saturday", "Add a tag and tick Party hats in a new to-do", "Open Prepare presentation from the Work area"],
    interactions: ["push", "sheet", "tap", "swipe", "press", "select", "type", "expand", "spring", "haptic"],
    components: ["screen-header", "search-field", "row", "progress", "glass-action-menu", "event-line", "task-row", "tag", "elastic-button", "day-picker", "form-field", "expandable-text", "token-field", "glass-segments", "commit-button", "activity-grid", "category-bars"],
    keywords: ["swiftui todo app", "swiftui task manager", "swiftui checklist", "swiftui projects list"],
    steps: [
      { title: "Lists", transition: "start" },
      { title: "Today", transition: "push" },
      { title: "Upcoming", transition: "push" },
      { title: "New to-do", transition: "sheet" },
      { title: "A project", transition: "push" },
      { title: "Logbook", transition: "push" },
    ],
  },
  moves: [
    ["Every list keeps one glyph and one colour, so Today's yellow star is found before it's read; counts sit quietly on the right.", "Areas group their projects, each with a pie of how much is done, and the plus blooms into a to-do, a project or a heading."],
    ["The day's events sit on top behind coloured capsules, so the to-dos below fit around them.", "Each to-do carries its project under the title and a deadline in red; This Evening keeps the night's to-dos apart under a moon."],
    ["Each day opens on its date set large beside its name, its events in one card and its to-dos below, so the week reads in a scroll.", "What repeats sits apart, with when it comes next."],
    ["A new to-do opens as one card: the title, notes that open in place, and a checklist you tick as you go.", "When is a choice of Today, This Evening or Someday, or a date on the month; the deadline is its own red flag."],
    ["A project leads with its pie and its notes, then splits its to-dos under blue headings over hairlines.", "Done to-dos stay struck through in place until they move to the logbook."],
    ["The logbook shows the days things got done as a month of cells, and which area did the work as bars.", "Yesterday's finished to-dos stay listed, struck through."],
  ],
};
