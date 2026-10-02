// The visual-planner recreation: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in visual-planner.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "visual-planner", title: "Visual Day Planner", category: "Productivity",
    summary: "The day split into parts on symbol cards, a calm timer for the task you're on, and a brain dump that comes back as a plan, in the Swift Pieces look.",
    description: "A visual planner in three screens, in the Swift Pieces look, light or dark: the day under a two-weight header by anytime, morning, afternoon and evening under a week strip, each task a card with a tinted symbol and a check, and a Later part whose empty state invites a brain dump; a focus sheet whose ring counts down around the task's symbol, with a sound rail and what's up next; and a brain dump that turns what you type into timed tasks, answered by the mascot. Shape lock: actions are pills, cards 20, badges round. Built from Screen Header, Day Picker, Plan Row, Elastic Button, Filter Rail, Focus Ring, Chat Bubble and Mascot.",
    try: ["Tap another day in the strip", "Check off a task", "Open Pack the gym bag, pick a sound, then pause or add five minutes", "Open the brain dump from the pencil and add it all to today"],
    interactions: ["select", "toggle", "sheet", "tap", "press", "spring", "haptic"],
    components: ["screen-header", "day-picker", "plan-row", "elastic-button", "filter-rail", "focus-ring", "chat-bubble", "mascot"],
    keywords: ["swiftui day planner", "swiftui focus timer", "swiftui week strip", "swiftui ai planner chat"],
    steps: [
      { title: "Today", transition: "start" },
      { title: "Focus", transition: "sheet" },
      { title: "Brain dump", transition: "sheet" },
    ],
  },
  moves: [
    ["The day is split by part (anytime, morning, afternoon, evening), gentler than a clock grid, with a count beside every part.", "Each task is its own card with a tinted symbol, so the list reads by picture first; an empty Later part says what goes there and offers the brain dump."],
    ["Focus is a full-attention sheet: one task, one ring that empties as time passes, and +5 that forgives running over.", "A rail of sounds sits under the title and what's next waits at the bottom; the close button is in the header."],
    ["Type everything at once; bubbles settle in and the reply comes back as the same task cards, already timed, added in one squashy tap.", "The mascot stands in for the helper, so the answer has a face without a second character."],
  ],
};
