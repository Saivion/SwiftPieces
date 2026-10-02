// The flight-tracker remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in flight-tracker.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "flight-tracker", title: "Flight Tracker", category: "Travel",
    summary: "Your flights on a graphite map, one flight end to end, the plane flying in before yours, friends in the air and a sheet to track a flight.",
    description: "A flight tracker in five screens over a floating dock, in the Swift Pieces look, in light and dark. The two tabs open with a designed header; pushed screens take the navigation title and back. Your flights sit as cards whose tracks fill in under an inset map of their routes; one flight shows how long is left and both ends side by side; the inbound plane holds in weather with its predicted delay rolling in; friends' flights sit behind tabs by person, with a composed empty state for someone who hasn't shared; and a sheet tracks a new flight. Signal red marks the followed flight, progress and the one primary action; actions are pills, cards and maps 24. Built from Screen Header, Route Map, Route Row, Odometer, Status Timeline, Stat Grid, Tracking Tabs, Toast, Search Field, Elastic Button and Commit Button.",
    try: ["Drag across a map to fly the plane, past the end and let go", "Tap the late connection to see the plane before it", "Open a flight and track the inbound plane", "Switch to Friends and swipe between people", "Ask Elif to share", "Tap + and track a flight"],
    interactions: ["tabs", "push", "sheet", "drag", "swipe", "tap", "press", "spring", "haptic"],
    components: ["screen-header", "route-map", "route-row", "odometer", "status-timeline", "stat-grid", "tracking-tabs", "toast", "search-field", "elastic-button", "commit-button"],
    keywords: ["swiftui flight tracker", "swiftui map canvas", "swiftui travel app", "swiftui status timeline"],
    steps: [
      { title: "Your flights", transition: "start" },
      { title: "Flight", transition: "push" },
      { title: "Inbound plane", transition: "push" },
      { title: "Friends", transition: "tab" },
      { title: "Track a flight", transition: "sheet" },
    ],
  },
  moves: [
    ["The map is the key to the list: each card below is one of its arcs, the followed one in signal red, the rest quiet grey.", "Cards settle in and their tracks fill to the plane, so progress reads before any time; a late connection says so in red."],
    ["The navigation title names the route; time left and distance lead, both ends sit side by side as equal cards.", "The next step is one squashy red button; drag the map and the plane rubber-bands at the end of its route."],
    ["The predicted delay rolls in centred at the title's size, then a chain explains it: the weather, the late arrival, your departure."],
    ["Tabs by person swap their cards as you swipe, with a colour block tracking the finger.", "Someone who hasn't shared gets a composed empty state and one action that answers with a toast."],
    ["Both + buttons open one sheet: search a number, see its route, and tracking commits in place with a check."],
  ],
};
