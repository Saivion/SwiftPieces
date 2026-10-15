// The weather-forecast remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in weather-forecast.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "weather-forecast", title: "Weather Forecast", category: "Weather",
    summary: "A forecast in the SwiftPieces look: each screen's ground is the weather, with an hourly curve you scrub, eight days on one cold-to-hot scale, rain by the hour, tonight, trips and how the month compares to normal.",
    description: "A weather app in seven screens, in the SwiftPieces look; actions are pills, cards 24, chips 14. Every screen stands on a full-bleed ground that is the weather itself: a warm ember glow for a sunny day, navy for rain, plum for night, deep teal for a trip. Today opens on the temperature rising in large, humidity, wind and UV as tiles, the next sixteen hours as a hill you drag through, and eight days as capsules on one scale painted from cold blues to hot reds, with a dot for now; tap a day for its line of detail. Rain shows the day's millimetres by the hour and the chance of rain as a curve, with an alert that confirms as a toast. Tonight lists sunset, moonrise and first light as moments you tap for a reminder. Places is a sheet of cities as colour blocks you swipe, with a trip counting down on split-flap tiles; a trip's forecast covers just its days, with what to pack. Normals plot this month's highs against the 30-year line, and widgets reuse the same pieces small. Built from Screen Header, Tint Panel, Text Reveal, Stat Grid, Area Scrub, Forecast Range, Elastic Button, Chart, Toast, Moment List, Search Field, Colour Block List, Countdown Card, Icon Toggles and Compare Line.",
    try: ["Drag through the next sixteen hours", "Tap Saturday in the eight days", "Open Rain on Saturday and turn on the alert", "Tap a moment tonight for a reminder", "Open places, then the Copenhagen trip", "Read this month's highs against normal"],
    interactions: ["push", "sheet", "tap", "scrub", "swipe", "select", "haptic"],
    components: ["screen-header", "tint-panel", "text-reveal", "stat-grid", "area-scrub", "forecast-range", "elastic-button", "chart", "toast", "moment-list", "search-field", "color-block-list", "countdown-card", "icon-toggles", "compare-line"],
    keywords: ["swiftui weather app", "swiftui forecast", "swiftui temperature chart", "swiftui hourly forecast"],
    steps: [
      { title: "Today", transition: "start" },
      { title: "Rain", transition: "push" },
      { title: "Tonight", transition: "push" },
      { title: "Places and trips", transition: "sheet" },
      { title: "A trip's forecast", transition: "push" },
      { title: "The month against normal", transition: "push" },
      { title: "Widgets", transition: "push" },
    ],
  },
  moves: [
    ["The ground is the forecast: a warm glow for sun, navy for rain, plum for night, so the weather reads before a single number.", "Eight days share one scale, each a capsule painted from the colour of its low to the colour of its high, with a dot for now; tap a day for its detail."],
    ["Rain gets its own ground and its own units: millimetres by the hour as bars, the chance of rain as a curve you drag.", "The alert is one tap and confirms as a toast, with an undo."],
    ["Night keeps only what matters after dark: sunset, last light, moonrise and first light as moments you tap for a reminder.", "The overnight curve shows how cold it gets and when."],
    ["Places are colour blocks you swipe to edit or delete, each with its local offset above the name.", "A trip waits below on a picture card, its split-flap tiles counting the days to go."],
    ["A trip forecast covers exactly the trip, on its own ground, and the packing list is a row of icons you toggle."],
    ["This month's highs run against the 30-year normal on one chart with a legend, so warmer than usual is a gap you can see.", "The figures below say by how much."],
    ["Widgets reuse the app's own pieces small: the reading, the chance of rain and the forecast capsules."],
  ],
};
