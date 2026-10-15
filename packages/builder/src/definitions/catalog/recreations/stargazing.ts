// The stargazing remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in stargazing.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "stargazing", title: "Stargazing", category: "Education",
    summary: "A night sky guide in the SwiftPieces look: tonight's seeing and the planets through the night, a sky view that names what you point at, a planet's moments, a space station pass to the second, the month's events and the news from up there.",
    description: "A stargazing guide in seven screens over a floating dock, in the SwiftPieces look; actions are pills, cards 30, tiles 20, and every screen stands on a night ground that stays dark in light and dark, with the theme's cards on it. Tonight opens on the sky's forecast, how well it shows to the eye, binoculars and a telescope as bars, then Jupiter's altitude as a curve you drag through the night with each visible planet in its own colour, and the space station's bright pass. The Sky tab is the view itself: sweep the phone across the horizon and the brightest thing in view names itself, with a glass pill to step the time on. A planet opens on its pictures, four tiles of figures, tonight's moments you tap for a reminder and its story. The pass is a globe with the track, the times it appears, peaks and disappears on a rail, its brightness, an alert that answers with a toast and the next nights. The Calendar counts down to the eclipse on split-flap tiles over the month's marked days and the events to come; the eclipse unfolds phase by phase on plum. Featured is the news as picture cards that drift as you scroll. Built from Screen Header, Tint Panel, Image, Progress, Area Scrub, Event Line, Elastic Button, Glass Segments, Camera Viewfinder, Page Carousel, Stat Grid, Moment List, Expandable Text, Route Map, Toast, Countdown Card, Day Picker, Media Row, Filter Rail and Parallax Card.",
    try: ["Drag through the night to read Jupiter's height", "Open the sky and sweep across the horizon", "Tap About Jupiter and set a reminder for Io's shadow", "Open the space station pass and turn on its alert", "Tap the eclipse countdown to flip days to weeks", "Scroll the news and watch the cards drift"],
    interactions: ["tabs", "push", "tap", "drag", "scrub", "select", "swipe", "scroll", "spring", "haptic"],
    components: ["screen-header", "tint-panel", "image", "progress", "area-scrub", "event-line", "elastic-button", "glass-segments", "camera-viewfinder", "page-carousel", "stat-grid", "moment-list", "expandable-text", "route-map", "toast", "countdown-card", "day-picker", "media-row", "filter-rail", "parallax-card", "tag"],
    keywords: ["swiftui astronomy app", "swiftui night sky", "swiftui stargazing", "swiftui dark mode app"],
    steps: [
      { title: "Tonight", transition: "start" },
      { title: "The sky", transition: "tab" },
      { title: "A planet", transition: "push" },
      { title: "A space station pass", transition: "push" },
      { title: "Calendar", transition: "tab" },
      { title: "An eclipse", transition: "push" },
      { title: "Featured", transition: "tab" },
    ],
  },
  moves: [
    ["Is it worth going out comes first: the sky's forecast, then how well tonight shows to the eye, binoculars and a telescope as three bars.", "Jupiter's height is a curve you drag through the night, and each visible planet keeps its own colour on its line."],
    ["The view is the screen: sweep the phone across the horizon and the reading steps from Saturn to Capella with a tick each.", "A glass pill steps the time on, and the one button opens what you're pointing at."],
    ["A planet leads with its pictures and four tiles, then tonight's moments on a rail you tap for a reminder.", "Its story waits clamped under them, one tap from the rest."],
    ["The pass is timed to the second: appears, peaks and disappears on a rail, each with where to look.", "Its brightness is put against Jupiter's, and the alert is one tap that answers with a toast."],
    ["The next big event counts down on split-flap tiles over a month with its nights marked.", "Every event below says when and where to look, in the order they come."],
    ["An eclipse gets its own plum ground and unfolds phase by phase in cards, with greatest eclipse alone in the middle."],
    ["The news is picture cards that drift slower than the page as you scroll, each with its kind in small caps."],
  ],
};
