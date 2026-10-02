// The trip-organizer remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in trip-organizer.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "trip-organizer", title: "Trip Organizer", category: "Travel",
    summary: "A trip counting down with its day-by-day plan, the flight end to end, flight alerts, saved places around the stay, friends' picks, the group's chat and trip spending.",
    description: "A travel organizer in seven screens over a floating dock, in the Swift Pieces look, in light and dark. The trip opens with a designed header and a card counting down the days in split-flap tiles, then the next flight and a plan you page through a day at a time and tick off. Pushed screens take the navigation title and back: the flight on a graphite map, with both ends, its gates and its facts on one card, and the alerts it sends, with switches in the accent. Places is a map around the stay with distance rings and pins by kind, the same kinds and colours as the list under it, which tabs swap (with a composed empty state for shops). Friends' picks fan out over an invite and sit on their own map. Two sheets come up over the tabs: the group's chat, which follows new messages and counts them into a pill once you scroll up, and spending, which rolls in against the budget over a ring by kind. Every list is one row style, a pastel badge by kind; signal red marks the stay, progress and the primary action; actions are pills, cards and maps 24. Built from Screen Header, Countdown Card, Route Row, Tracking Tabs, Plan Row, Route Map, Stat Grid, Elastic Button, Toast, Place Map, Fan Stack, Follow Scroll, Odometer and Ring Breakdown.",
    try: ["Tap the countdown to flip days to weeks", "Swipe the plan from Thursday to Sunday and tick things off", "Open the flight and drag along its route", "Send a test alert", "Tap a pin on the places map, then flick it", "Switch to Shop for the empty state", "Fan out who's going and invite someone", "Open the trip chat from Friends, scroll up and wait for the pill", "Open spending and scrub the ring"],
    interactions: ["tabs", "tap", "push", "sheet", "drag", "swipe", "scroll", "type", "toggle", "press", "spring", "haptic"],
    components: ["screen-header", "countdown-card", "route-row", "tracking-tabs", "plan-row", "route-map", "stat-grid", "elastic-button", "toast", "place-map", "fan-stack", "follow-scroll", "odometer", "ring-breakdown"],
    keywords: ["swiftui trip planner", "swiftui itinerary", "swiftui map pins", "swiftui flight details", "swiftui travel app", "swiftui chat scroll to bottom"],
    steps: [
      { title: "Trip", transition: "start" },
      { title: "Flight", transition: "push" },
      { title: "Flight alerts", transition: "push" },
      { title: "Places", transition: "tab" },
      { title: "Friends' picks", transition: "tab" },
      { title: "Trip chat", transition: "sheet" },
      { title: "Spending", transition: "sheet" },
    ],
  },
  moves: [
    ["The header carries the trip; the countdown card flips its split-flap days to weeks on a tap, and the next flight opens in one tap.", "Day tabs swap the plan as you swipe; each entry wears its kind's symbol and colour and ticks off with a spring."],
    ["The navigation title names the route; the map leads, and both ends of the flight share one card with its time, distance and bags.", "Drag the map and the plane rubber-bands along its route; alerts are one squashy red button away."],
    ["A centred bell explains what you'll hear; alert types are switches in the accent, and past alerts are rows in the app's one row style.", "A test alert slides in from the top as a toast."],
    ["Pins settle onto the map around the stay, each in its kind's symbol and colour, the same as the rows under it.", "Tabs by kind swap the list; a kind with nothing saved shows a composed empty state with a way to fill it."],
    ["Who's going fans apart when touched, centred over an invite that answers with a toast.", "Friends' picks sit on their own map and in the same rows as yours; the group's chat is one row, or one round tap, away."],
    ["The chat comes up as a sheet over the tabs and stays on the newest message while you're at the bottom; scroll up and nothing moves.", "New messages count into a pill that takes you back down; yours always come into view."],
    ["The spend rolls in on a card over a bar toward the budget, then a ring by kind you can scrub."],
  ],
};
