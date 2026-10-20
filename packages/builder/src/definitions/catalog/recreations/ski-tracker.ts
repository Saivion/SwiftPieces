// The ski-tracker remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in ski-tracker.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "ski-tracker", title: "Ski Tracker", category: "Sports",
    summary: "A ski and snowboard tracker in the SwiftPieces look: the trail map with your live figures, friends on the mountain, the day summed up, a replay of every run and lift, one run in detail, your heart on the hill and the season against its goal.",
    description: "A ski day tracker in seven screens over a floating dock, in the SwiftPieces look; actions are pills, cards and maps 28, tiles 18. Recording stands on a navy ground: the resort as a snowy trail map with you in signal red, lifts in azure and friends in violet, and one card of live figures (runs, vertical, top speed, distance) over altitude, heart and air, with location sharing and a search for what's open. Friends come up as a sheet with their pins, where each was last seen and a meet-up that answers with a toast. Ending the day pushes its summary: four coloured tiles, your note on butter, the photos, the best moments that jump to their run and a ring of skiing, lifts and rest. The replay plays the day back on the map with a scrubber, the altitude curve you drag and the day as a timeline of runs and lifts; a run opens on its elevation profile and its speed against your best. Vitals glow with the average on runs over the zones and the day's beats, and the Logbook tab rings the season's goal and draws this season's vertical against last. Built from Screen Header, Place Map, Stat Grid, Metric Strip, Search Field, Elastic Button, Swipe Action Row, Fan Stack, Toast, Glass Segments, Ring Breakdown, Playback Controls, Area Scrub, Status Timeline, Compare Line, Glow Number, Category Bars, Band Trend, Filter Rail, Goal Ring, Media Row and Countdown Card.",
    try: ["Drag the trail map and tap a lift", "Open nearby friends and send a meet-up", "End the day and tap Top speed", "Replay the day and drag through the altitude", "Read Riva Ridge against your best", "Open the Logbook and read the season against last"],
    interactions: ["tabs", "sheet", "push", "tap", "drag", "scrub", "toggle", "select", "press", "haptic"],
    components: ["screen-header", "tint-panel", "place-map", "stat-grid", "metric-strip", "search-field", "elastic-button", "swipe-action-row", "fan-stack", "toast", "glass-segments", "ring-breakdown", "playback-controls", "area-scrub", "status-timeline", "compare-line", "glow-number", "category-bars", "band-trend", "filter-rail", "goal-ring", "media-row", "countdown-card", "tag", "toggle", "image"],
    keywords: ["swiftui ski tracker", "swiftui gps tracker", "swiftui trail map", "swiftui season stats"],
    steps: [
      { title: "On the mountain", transition: "start" },
      { title: "Nearby friends", transition: "sheet" },
      { title: "The day", transition: "push" },
      { title: "Replay", transition: "push" },
      { title: "A run", transition: "push" },
      { title: "Vitals", transition: "push" },
      { title: "The season", transition: "tab" },
    ],
  },
  moves: [
    ["The mountain is the screen: a snowy trail map on a navy ground, you in signal red, lifts in azure, friends in violet.", "The live figures sit on one card, big enough to read with gloves on a chairlift, and ending the day is the one red pill."],
    ["Friends keep their pins on a small map, and each row says where they were last seen and how long ago.", "A meet-up is one tap that answers with a toast and an undo."],
    ["The day leads with four coloured tiles, then your own note on butter, so the summary reads like a memory, not a spreadsheet.", "Every best moment taps through to its run, and a ring splits the hours between skiing, lifts and rest."],
    ["The replay keeps the map on top and the day under it: a scrubber for the run, the altitude curve you drag, and the timeline of runs and lifts with the current one marked."],
    ["A run opens on its difficulty and status as chips, then six figures and its elevation profile.", "Speed against your best on the same run shows exactly where you were faster."],
    ["The average on runs glows as one figure, with the zones in their own colours and the day's beats against your aerobic band."],
    ["The season is a goal ring and one line against last season, so being ahead is a gap you can see.", "Each figure says by how much, and the next trip counts down on split-flap tiles."],
  ],
};
