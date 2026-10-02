// The sun-events remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in sun-events.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "sun-events", title: "Sun Path and Daylight Times", category: "Weather",
    summary: "Where the sun is at any moment and the shadow it casts, over open ground, a city, the hills and the sky, plus every moment of light today and any spot you pick on a map.",
    description: "A sun planner in six screens, in the Swift Pieces look, in light and dark. Four peer views sit behind a floating dock, each with a designed header (a pin to pick a spot on a map you drag under it, and the day's times) over the scene as a rounded card: the sun's arc in the sweep with a column casting its shadow, then over a city map where every roof and tree casts its own, a contour map whose slopes shade away from the sun, and the sky over the sea with altitude, bearing and shadow ratio. Each scene's place card opens a sheet of the day's light: right-now figures, then tabs for today, tomorrow and reminders (a composed empty state until you set one). The time is each scene's one display figure; signal red marks Now and reminders; actions are pills, cards 24. Built from Screen Header, Sun Path, Stat Grid, Tracking Tabs, Moment List and Location Picker.",
    try: ["Drag sideways to move the sun through the day", "Tap Now to spring back", "Switch scenes in the dock", "Tap the place card for the day's times", "Tap a moment to set a reminder", "Tap the pin, drag the map and use the spot"],
    interactions: ["tabs", "drag", "scrub", "tap", "swipe", "sheet", "press", "loading", "spring", "haptic"],
    components: ["screen-header", "sun-path", "stat-grid", "tracking-tabs", "moment-list", "location-picker"],
    keywords: ["swiftui sun path", "swiftui sunrise sunset", "swiftui canvas drag", "swiftui daylight times", "swiftui map location picker"],
    steps: [
      { title: "Sun position", transition: "start" },
      { title: "Pick a spot", transition: "sheet" },
      { title: "City shadows", transition: "tab" },
      { title: "Hill shadows", transition: "tab" },
      { title: "Sun across the sky", transition: "tab" },
      { title: "Daylight times", transition: "sheet" },
    ],
  },
  moves: [
    ["The scene is one control: drag anywhere and the sun rides its arc, the shadow swings, and a tick lands every quarter hour.", "The time is the one big figure; Now turns red once you've moved and springs the sun home."],
    ["The map moves under a fixed red pin that lifts while you drag and drops where it settles, and the card names the street there.", "Use this spot closes the sheet; the locate button asks for your location only when you tap it."],
    ["The same dial sits on a city map, inside a lens that quiets the streets: every roof and tree casts its shadow with the dial as you drag.", "The ember line points at the sun and the azure one is the shadow; the time and the place card sit on a veil so they read over the map.", "Scenes are peers in the dock, so switching keeps each one where you left it."],
    ["Over a contour map each step of the hill shades the one below it on the side away from the sun, so the dial shows when a ridge will block the light before you head out."],
    ["Facing the sea, the sun comes down the sweep band and sets on the horizon ring, its light trailing on the water; readouts under the time turn the scene into numbers."],
    ["Right-now figures lead, then tabs swap today, tomorrow and reminders; moments rise in as dots on a rail.", "Tap a moment and a red bell springs in with a success tap; the header's round close button ends the sheet."],
  ],
};
