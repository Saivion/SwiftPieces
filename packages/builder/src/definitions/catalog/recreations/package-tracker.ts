// The package-tracker remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in package-tracker.build.ts (Pro), loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "package-tracker", title: "Package Tracker", category: "Lifestyle",
    summary: "A delivery tracker in the SwiftPieces look: every package with its days to go, one delivery's route and history, a full-screen map you step through by date, a quick add form, widgets and the settings that decide when it pings you.",
    description: "A package tracker in six screens, in the SwiftPieces look, light or dark; actions are pills, cards and maps 20, chips 8, and a cardboard orange marks tracking numbers, carriers and switches. Deliveries opens on a two-weight header with glass buttons to settings and +: each package is one row led by its days to go, 0 on the day, then its name, where it left and where it's going, when it lands and the latest status on a quiet line; tabs swap the packages on the way for the delivered ones, which swipe to archive or flag. A delivery pushes in under its own name: the tracking number in orange monospace with its carrier, the days to go and dates as cards, an inset map of its legs with the package on the last one, a status chain, then the history newest first, each event in bold over its place in quiet capitals. The map is a sheet of the whole route with the latest event and a week strip to step through earlier days. Adding is a short sheet: the number pasted from the clipboard, the carrier detected from its shape as option cards, a description, then Add confirms in place. Widgets reuse the same rows small; settings hold the plan, notification switches with quiet hours on a range slider, accounts and appearance. Built from Screen Header, Search Field, Tracking Tabs, Route Row, Swipe Action Row, Elastic Button, Tag, Menu, Stat Grid, Route Map, Status Timeline, Glass Bar, Day Picker, Form Field, Picker, Option Card, Switch, Commit Button, Mini Map, Range Slider, Permission Sheet and Glass Segments.",
    try: ["Swipe to Delivered, then swipe a package to archive it", "Open the jacket and drag the map along its last leg", "Open the full map and tap the 26th", "Press + and pick the carrier it detected", "Press Add delivery", "Drag the quiet hours on the settings sheet"],
    interactions: ["push", "sheet", "tap", "swipe", "drag", "select", "type", "toggle", "menu", "loading", "haptic"],
    components: ["screen-header", "search-field", "tracking-tabs", "route-row", "swipe-action-row", "elastic-button", "tag", "menu", "stat-grid", "route-map", "status-timeline", "glass-bar", "day-picker", "form-field", "picker", "choice", "toggle", "commit-button", "mini-map", "range-slider", "permission-sheet", "glass-segments", "card", "row"],
    keywords: ["swiftui package tracker", "swiftui delivery tracking", "swiftui tracking timeline", "swiftui map route"],
    steps: [
      { title: "Deliveries", transition: "start" },
      { title: "A delivery", transition: "push" },
      { title: "Route map", transition: "sheet" },
      { title: "Add a delivery", transition: "sheet" },
      { title: "Widgets", transition: "push" },
      { title: "Settings", transition: "sheet" },
    ],
  },
  moves: [
    ["The days to go are the anchor of every row, set large on the leading edge, so the list reads as a countdown before you read a name.", "Both ends and the arrival sit on one line, the latest status on a quiet line under them; delivered packages live behind their own tab and swipe away."],
    ["The tracking number leads in orange monospace with its carrier as a chip, and the menu holds edit, copy, share and delete.", "An inset map shows the legs with the package on the last one; the history reads newest first, bold status over the place in quiet capitals."],
    ["The whole route fills the sheet and the latest event sits under a glass bar named for the day.", "A week strip marks the days with events, so stepping back through the trip is one tap a day."],
    ["The number arrives pasted, so most adds are a check: the carrier is detected from the number's shape and offered as option cards.", "Only what some carriers need, a postcode, is asked for, and Add confirms in place before the sheet closes."],
    ["Widgets reuse the list's own rows: the large one adds the map, the small ones a single package each."],
    ["The plan leads as one card; notification switches sit in orange with quiet hours on a range you drag.", "Asking for notifications explains itself first, then runs the real request."],
  ],
};
