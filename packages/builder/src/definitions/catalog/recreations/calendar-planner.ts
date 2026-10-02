// The calendar-planner remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in calendar-planner.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "calendar-planner", title: "Calendar Planner", category: "Productivity",
    summary: "A calendar with titles in capitals: the week day by day, an event with its place, a day at a glance, the day's forecast, a day's hours, the month and a new event with an address you search, all on one ground that follows your Style.",
    description: "A calendar in seven screens on one ground that follows your Style, light or dark: the week as days split by hairlines, the month running up the dates and the picked day lifted into an accent tile, with a + for a new event on a sheet, where the place is searched as you type and settles into a checked address; an event on a sheet, centred, with its place on a small map, when to leave on a card you flip and directions that confirm in a toast; a day at a glance, its name in capitals over a spaced date, with plans, the weather and to-dos on cards under small spaced labels; the forecast with the sky and the temperature first, then three curves you scrub, one per tab; one day's hours, or the week or the month, in tabs you swipe; and the month with the year and month as one line, busy days on discs and the picked day's plans below with a floating plus. Built from Screen Header, Tint Panel, Agenda Day, Mini Map, Flip Card, Toast, Day Picker, Event Line, Elastic Button, Tracking Tabs, Area Scrub, Hour Timeline, Glass Action Menu, Form Field, Address Field and Commit Button.",
    try: ["Tap a day on the rail, or the calendar button for the month", "Tap +, type Orchard under Where and pick the address", "Open Saturday's lunch, drag the map, flip the leave-by card and tap Directions", "Open Sunday, tick off a to-do and open the weather hour by hour", "Swipe from Temperature to Rain and scrub the curve", "On Friday, tap a free hour, then swipe to Week and Month", "Pick a day in the month and bloom the plus"],
    interactions: ["select", "push", "sheet", "toggle", "scrub", "drag", "swipe", "press", "tap", "type", "loading", "spring", "haptic"],
    components: ["screen-header", "tint-panel", "agenda-day", "mini-map", "flip-card", "toast", "day-picker", "event-line", "elastic-button", "tracking-tabs", "area-scrub", "hour-timeline", "glass-action-menu", "form-field", "address-field", "commit-button"],
    keywords: ["swiftui calendar", "swiftui week agenda", "swiftui month calendar", "swiftui day timeline", "swiftui weather chart", "swiftui address autocomplete"],
    steps: [
      { title: "Week", transition: "start" },
      { title: "An event", transition: "sheet" },
      { title: "A day", transition: "push" },
      { title: "Forecast", transition: "push" },
      { title: "A day's hours", transition: "push" },
      { title: "Month", transition: "push" },
      { title: "New event", transition: "sheet" },
    ],
  },
  moves: [
    ["Each day is one row on a single ground, split by hairlines, the month running up the dates; the picked day lifts into an accent tile and an empty day says so quietly.", "The week sits in a two-weight header on the same ground, its calendar button one tap into the month and its + into a new event."],
    ["One event on one sheet, centred: what, when, with whom, where on a small map you can drag, and when to leave on a card you flip.", "Directions confirms in a toast that slides in; the sheet swipes away."],
    ["A day at a glance: the weekday in capitals over a spaced date, then plans, weather, to-dos and what's next on cards under small spaced labels.", "The weather card's action opens the forecast; a to-do's bar fills as you tick it off."],
    ["The sky and the temperature come first, then one sentence; tabs you swipe swap the curve between temperature, rain and wind, and the value rides the scrub line."],
    ["Day, Week and Month are tabs over pages you swipe, so the switch really changes the view.", "In Day the all-day plan is a chip, free hours are cells you tap to pencil something in, and a now line shows where the day stands."],
    ["Year and month read as one line; the picked day sits in a disc that slides, busy days get a grey disc and days with plans a dot.", "The picked day's plans list under it with how far away it is; a floating plus blooms into event, reminder or invite."],
    ["A short form on a sheet: a title, the day on a week strip with the time under it, then the place.", "Where suggests addresses as you type, the match in bold, and a pick resolves into a checked address; Add event confirms in place."],
  ],
};
