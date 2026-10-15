// The air-quality remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in air-quality.build.ts (Pro), loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "air-quality", title: "Air Quality", category: "Weather",
    summary: "An air quality map in the SwiftPieces look: sensors as pins coloured by the EPA scale with a glass sheet for the one you pick, its last 24 hours as graded bars with what to do about it, the week's history, nearby and saved sensors, alerts and widgets.",
    description: "An air quality app in seven screens across three tabs on a floating dock, in the SwiftPieces look, light or dark; actions are pills, sheets and cards 28, tiles 18, and colour comes from the data: the US EPA scale on every pin, badge and bar, with indigo for the app's own switches and selection. The map opens under a two-weight header that says how the air is, a glass segment to switch between AQI, temperature, humidity and PM2.5, and sensors as numbered pins in their EPA colour; the selected one waits on a glass sheet with its reading in a round badge, how fresh and how far, a star to save it and a legend of the scale. A sensor pushes in on one glowing number and where it sits on the scale, the last 24 hours as bars that turn from amber to red as the air worsens, the EPA's advice for sensitive groups and everyone else, and temperature, humidity and PM2.5 with their trends. History compares the week's daily highs with last week and lets you drag through today's PM2.5. Nearby leads with the closest sensor, then the rest and your favourites as badges with trend arrows; Alerts sets the category that warns you, what happens when it clears and the sensors you watch, with a test alert; widgets show the Lock Screen, a Live Activity and a tile coloured by its reading; a sheet picks data sources and corrections. Built from Screen Header, Glass Segments, Place Map, Tint Panel, Avatar, Reaction Toggle, Tag, Elastic Button, Glow Number, Step Trail, Category Bars, Stat Grid, Compare Line, Area Scrub, Switch, List Row, Swipe Action Row, Toast, Bar Chart, Motion Card, Picker, Decimal Stepper and Commit Button.",
    try: ["Tap a pin on the map, then save the sensor with the star", "Open Sensor details and drag across the 24-hour bars", "Open History and drag through today's PM2.5", "Switch to Nearby and open the closest sensor", "On Alerts, pick Unhealthy and send a test alert", "Tilt the Good widget"],
    interactions: ["tabs", "push", "sheet", "tap", "drag", "scrub", "select", "swipe", "toggle", "haptic", "spring"],
    components: ["screen-header", "glass-segments", "place-map", "tint-panel", "avatar", "reaction-toggle", "tag", "elastic-button", "glow-number", "step-trail", "category-bars", "stat-grid", "compare-line", "area-scrub", "toggle", "row", "swipe-action-row", "toast", "chart", "motion-card", "picker", "decimal-stepper", "commit-button"],
    keywords: ["swiftui air quality app", "swiftui aqi map", "swiftui map pins", "swiftui colour graded chart"],
    steps: [
      { title: "Map", transition: "start" },
      { title: "A sensor", transition: "push" },
      { title: "History", transition: "push" },
      { title: "Nearby and saved", transition: "tab" },
      { title: "Alerts", transition: "tab" },
      { title: "Widgets", transition: "push" },
      { title: "Data sources", transition: "sheet" },
    ],
  },
  moves: [
    ["The header says it in words, the map in colour: every pin wears its EPA grade, so the bad block stands out before you read a number.", "The picked sensor waits on a glass sheet with its reading in a round badge, how fresh and how far, and a star to keep it; the legend sits below as chips."],
    ["One glowing number leads, and the scale under it shows how close the air is to the next grade.", "The last 24 hours are bars graded by colour, so the turn from amber to red reads as a story; the advice and the readings with their trends follow."],
    ["The week's daily highs run against last week with the grade lines marked, so a smoky spell is a hump you can see.", "Today's PM2.5 is a hill you drag through hour by hour."],
    ["The closest sensor leads with its three readings; the rest are round badges in their grade with how far, how fresh and which way it's heading.", "Favourites keep an indoor sensor beside the outdoor ones, so inside and out compare at a glance."],
    ["One category decides when you hear about it, picked on a glass segment; clearing and worsening each get their own switch.", "Watched sensors swipe away, and a test alert shows exactly what will arrive."],
    ["Widgets reuse the app's own pieces: tiles for the Lock Screen, a Live Activity with its bars, and a tile coloured by its reading that tilts under your finger."],
    ["Every network is a switch, and corrections are one picker and one stepper, explained in a line.", "Saving refreshes the map and closes the sheet."],
  ],
};
