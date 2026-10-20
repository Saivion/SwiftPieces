// The listening-stats remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in listening-stats.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "listening-stats", title: "Listening Stats", category: "Music",
    summary: "Your listening in the SwiftPieces look: what's playing over your top artists as ranked tiles, top tracks with how far each moved, an artist's numbers and clock, the year against last year, history day by day and a friend's audio features.",
    description: "A music stats app in seven screens across four tabs on a floating dock, in the SwiftPieces look; actions are pills, cards 20, tiles 12, artwork square, and ranks set large and heavy wherever they show. The overview stands on a night ground: what's playing as a mini player you pull up, your top artists of the past four weeks as coloured tiles with their rank and play count, and what you played last. Top swipes between tracks, artists and albums for four weeks, six months or lifetime, each row with its rank and how far it moved, up in mint, down in pink, or new. An artist opens on your numbers with them as four cards, your streams by month against your average artist, the hours you play them and where you sit among friends. Stats sets the year's streams, tracks, artists and minutes against last year, a listening clock by hour and streams by weekday; history folds each day into its counts, with one day open to every play. Friends shows who's listening and how close your taste is; a friend's profile carries their audio features as thin mint bars and their top artists. Built from Tint Panel, Screen Header, Now Playing, Stat Grid, Media Row, Elastic Button, Glass Segments, Tracking Tabs, Image, Compare Line, Chart, Category Bars, Day Picker, Disclosure, Fan Stack, Toast, Avatar, Tag, Button, Filter Rail, Progress and Cover Grid.",
    try: ["Pull the mini player up into the full player", "Tap an artist tile to open their numbers", "Swipe Top from Tracks to Albums and switch to 6 months", "Drag across the artist's streams by month", "Open history and unfold Wednesday", "Open maren.k and read her audio features"],
    interactions: ["tabs", "push", "tap", "drag", "swipe", "scrub", "select", "press", "haptic"],
    components: ["tint-panel", "screen-header", "now-playing", "stat-grid", "media-row", "elastic-button", "glass-segments", "tracking-tabs", "image", "compare-line", "chart", "category-bars", "day-picker", "disclosure", "fan-stack", "toast", "avatar", "tag", "button", "filter-rail", "progress", "cover-grid"],
    keywords: ["swiftui music stats", "swiftui listening history", "swiftui top charts", "swiftui ranked list"],
    steps: [
      { title: "Overview", transition: "start" },
      { title: "Top tracks", transition: "tab" },
      { title: "An artist", transition: "push" },
      { title: "Year stats", transition: "tab" },
      { title: "History by day", transition: "push" },
      { title: "Friends", transition: "tab" },
      { title: "A friend's profile", transition: "push" },
    ],
  },
  moves: [
    ["What's playing sits on top as a mini player that grows into the full one, over a night ground.", "Top artists are coloured tiles with the rank on top and the play count under the name, so the order reads before the names do."],
    ["Every row leads with its rank set heavy and how far it moved: up in mint, down in pink, a dash for no change, NEW for a debut.", "The range is one glass pill; tracks, artists and albums are tabs you swipe."],
    ["An artist opens on your numbers with them, four cards you tap for their notes.", "Streams by month run against your average artist, and the clock says when in the day they get played."],
    ["The year is six figures, each with its change on last year underneath.", "A listening clock by hour and bars by weekday show the shape of your listening, with the peak called out in a line."],
    ["Each day folds into one line of streams and minutes; open one and every play is there with its time and how long you listened.", "A week strip on top moves between days."],
    ["Friends lead as a fan you can spread, with one link to compare taste.", "Each friend shows what they're on now and how close your taste is, as a mint chip."],
    ["A friend's audio features are thin mint bars in two columns, so their taste has a shape at a glance.", "Their top artists follow as square covers, then their top tracks with their moves."],
  ],
};
