// The weather-forecast remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in weather-forecast.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "weather-forecast", title: "Weather Forecast", category: "Weather",
    summary: "A calm forecast on a plain ground: one big reading, hours you drag, days on one scale.",
    description: "A weather app in seven screens, in the SwiftPieces look on the theme's own ground, light or dark: no colour fields, no glows, no gradients. Every screen keeps one system: a 34-point title, one bold reading under it, cards at radius 24 that each open on a semibold head, quiet secondary lines and pill actions in signal red; the forecast's colours appear only where they carry data. Today opens on the temperature rising in, humidity, wind and UV, the next sixteen hours as a hill you drag through and eight days as capsules on one cold-to-hot scale; tap a day for its line of detail. Saturday shows rain by the hour in millimetres and the chance as a curve, with an alert that confirms as a toast. Tonight lists sunset, moonrise and first light as moments you tap for a reminder, and runs the night's temperatures against last night's. Places is a sheet with your cities as a plain list and the trip under them; the trip's forecast covers just its days, with what to pack. October plots this month's highs against the 30-year normal, and widgets reuse the same pieces small. Built from Screen Header, Text Reveal, Stat Grid, Area Scrub, Forecast Range, Row, Chart, Toast, Moment List, Compare Line, Search Field and Icon Toggles.",
    try: ["Drag through the next sixteen hours", "Tap Saturday in the eight days", "Open Saturday and turn on the rain alert", "Tap a moment tonight for a reminder", "Open places, then the Copenhagen trip", "Read this month's highs against normal"],
    interactions: ["push", "sheet", "tap", "scrub", "select", "haptic"],
    components: ["screen-header", "text-reveal", "stat-grid", "area-scrub", "forecast-range", "row", "chart", "toast", "moment-list", "compare-line", "search-field", "icon-toggles"],
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
    ["One plain ground and one reading: the temperature rises in large and bold, the sky in words under it, the day's range and feel in quiet type.", "The next sixteen hours are a hill you drag through, an hour to a tick; eight days share one scale painted cold to hot, with a dot for now. Tap a day for its detail."],
    ["Rain keeps its own units: millimetres by the hour as bars, the chance of rain as a curve you drag.", "The screen's one red action turns on an alert, which confirms as a toast with an undo."],
    ["Only what matters after dark: sunset, last light, moonrise and first light, each a moment you tap for a reminder.", "The night's temperatures run against last night's on one line, so a colder night is a gap you can see."],
    ["A sheet that opens like Today, on the same header: your places as a plain list with the sky and the temperature, and a search to add one.", "The trip waits in its own card and opens its forecast; the grid button leads to the widgets."],
    ["A trip's forecast covers exactly its days, on the same cold-to-hot scale as the week at home.", "Packing is a row of icons you toggle, filled in red once packed."],
    ["The gap is the story, so it's the reading: 2.4° over normal, then this month's highs against the 30-year line.", "The figures under it say by how much, each against its normal."],
    ["Widgets are the app's own cards, small: the reading, the chance of rain and four days on the forecast's scale.", "One red pill says how to add one."],
  ],
};
