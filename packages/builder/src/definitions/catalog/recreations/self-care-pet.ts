// The self-care-pet remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in self-care-pet.build.ts (Pro), loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "self-care-pet", title: "Self-Care Pet", category: "Health",
    summary: "A self-care companion in the SwiftPieces look: a little pet that grows its energy from the goals you tick off, a morning check-in, its adventure while you carry on, goal buddies, your areas of self-care and the streak celebration.",
    description: "A self-care pet in seven screens across three tabs on a floating dock, in the SwiftPieces look, light or dark; actions are pills, cards 28, tiles 20, and the companion's scenes stand on pastel cards like pages of a storybook. Home opens on Biscuit, a round azure companion that fills up with the day's energy and talks to you in a bubble, over today's goals grouped by part of the day, each worth five energy and ticked off with a check. A heart opens the morning check-in: five faces, the words that fit, what's shaping your mood and a first aid row for low days; checking in confirms in place. Once the energy fills, Biscuit sets off: the adventure is a lilac scene with a ring of time until it's back, its route as glass stops and what it found on the way. Friends puts you and a goal buddy side by side, a violet check for you and a sky one for them, with encouragement that answers as a toast and good vibes to send. Progress counts goals kept in each area of self-care with their trends over a month of moods, and leads to the streak: the line rises in word by word over a glowing 30 with the week ticked and the repairs you have left. A sheet adds a goal. Built from Screen Header, Mascot, Chat Bubble, Plan Row, Elastic Button, Mood Faces, Icon Toggles, Filter Rail, Commit Button, Text Reveal, Timer Dial, Step Trail, Media Row, Fan Stack, Toast, Swipe Action Row, Live Stat, Mood Line, Glow Number, Day Picker, Stat Grid, Form Field and Glass Segments.",
    try: ["Tap Biscuit, then tick off Brush teeth", "Tap the heart and check in as Good", "Peek at the route to Mossy Hollow", "On Friends, send Juno some encouragement", "Open the 30-day streak from Progress", "Press + and add a goal"],
    interactions: ["tabs", "push", "sheet", "tap", "select", "swipe", "drag", "loading", "spring", "haptic"],
    components: ["screen-header", "mascot", "chat-bubble", "plan-row", "elastic-button", "mood-faces", "icon-toggles", "filter-rail", "commit-button", "text-reveal", "timer-dial", "step-trail", "media-row", "fan-stack", "toast", "swipe-action-row", "live-stat", "mood-line", "glow-number", "day-picker", "stat-grid", "form-field", "glass-segments", "card", "row"],
    keywords: ["swiftui self-care app", "swiftui virtual pet", "swiftui goal checklist", "swiftui mood check-in"],
    steps: [
      { title: "Home", transition: "start" },
      { title: "Morning check-in", transition: "sheet" },
      { title: "The adventure", transition: "push" },
      { title: "Goal buddies", transition: "tab" },
      { title: "Self-care progress", transition: "tab" },
      { title: "The streak", transition: "push" },
      { title: "New goal", transition: "sheet" },
    ],
  },
  moves: [
    ["The companion is the progress bar: Biscuit fills to the day's energy with the figure under it, so twelve of twenty-five reads as a pet halfway to an adventure.", "Every goal is worth the same five energy and ticks off with a check, grouped by part of the day so the morning comes first."],
    ["One question and five faces up top; the words that fit and what's shaping the mood are optional taps underneath.", "A first aid row waits for low days, and checking in confirms in place before the sheet closes."],
    ["The adventure is its own lilac scene: the line rises in, Biscuit looks thrilled and a ring counts down until it's home.", "The route is a row of glass stops and what it found sits below as small pictures, so being away still feels like something happening."],
    ["You and a buddy share goals in two columns, a violet check for you and a sky one for them, so who's ahead is plain without a score.", "Encouragement answers as a toast; good vibes are round icons you toggle on a blush card and send in one press."],
    ["Each area of self-care is a tile with its count rolling up, a change chip and a sparkline, so the month shows where you are kindest to yourself.", "The month of moods is a line with gaps for days you skipped, and a new area is one raised button away."],
    ["The celebration is words first, then the number: 30 glows and counts up, the week below is ticked through.", "Repairs say how many are left, and sharing confirms in place before landing on Friends."],
    ["A short sheet: a name, when in the day, which area it feeds and how often, each a single tap.", "Biscuit's suggestions are ready to tick in, and Add goal confirms where the goal will land."],
  ],
};
