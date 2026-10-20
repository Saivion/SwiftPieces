// The film-diary remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in film-diary.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "film-diary", title: "Film Diary", category: "Entertainment",
    summary: "A film diary in the SwiftPieces look: a film page on a darkened ground with its ratings histogram, a sheet to log, like and rate in half stars, the diary by month, a review with its comments and a ranked list of posters.",
    description: "A film logging app in seven screens across three tabs on a floating dock, in the SwiftPieces look; actions are pills, cards 16, posters 6, chips 10. Films opens on what's popular with friends as a grid of typographic posters, then friends' logs with their green stars. A film stands on a charcoal ground like a darkened cinema: the backdrop, the title in serif beside its poster, the tagline in capitals, a synopsis that expands, and ratings as ten half-star bars beside the average. Rate, log, review raises a sheet: watched, like, watchlist and rewatch as round toggles, half stars you drag across, the day you watched it, a review, tags and a save that confirms in place. The diary groups the month's films under each day in an outlined box, stars in green and a heart for the ones you loved; an entry opens its review, with likes and comments. Profile carries the counts, four favourites, your own ratings spread and a ranked list of ten posters numbered in order. Built from Screen Header, Glass Segments, Cover Grid, Avatar, Filter Rail, Tint Panel, Image, Tag, Expandable Text, Chart, Button, Glass Bar, Icon Toggles, Rating Scrub, Day Picker, Input, Token Field, Toggle, Commit Button, Stat Grid, Reaction Toggle, Chat Bubble, Row and Progress.",
    try: ["Open The Salt Orchard from the poster grid", "Expand the synopsis and read the ratings bars", "Tap Rate, log, review and drag the stars to four and a half", "Like it, pick the day and save to the diary", "Open Paper Moons from the diary and like the review", "Open a list from your profile"],
    interactions: ["tabs", "push", "sheet", "tap", "drag", "select", "toggle", "type", "haptic"],
    components: ["screen-header", "glass-segments", "cover-grid", "avatar", "filter-rail", "tint-panel", "image", "tag", "expandable-text", "chart", "button", "glass-bar", "icon-toggles", "rating-scrub", "day-picker", "input", "token-field", "toggle", "commit-button", "stat-grid", "reaction-toggle", "chat-bubble", "row", "progress"],
    keywords: ["swiftui film diary", "swiftui movie app", "swiftui star rating", "swiftui poster grid"],
    steps: [
      { title: "Popular this week", transition: "start" },
      { title: "A film", transition: "push" },
      { title: "Log, like and rate", transition: "sheet" },
      { title: "Diary", transition: "tab" },
      { title: "A review", transition: "push" },
      { title: "Profile", transition: "tab" },
      { title: "A ranked list", transition: "push" },
    ],
  },
  moves: [
    ["Posters lead: what friends watched this week is a grid of covers, each one a tap from its page.", "Friends' logs sit under it with their stars in green, so taste reads before any text."],
    ["The film stands on a charcoal ground, title in serif beside its poster, tagline in small capitals over a synopsis that expands.", "Ratings are ten half-star bars beside one big average, and logging is a single green pill."],
    ["Everything about a viewing is one sheet: watched, like, watchlist and rewatch as round toggles, half stars you drag across.", "The day defaults to today on a week strip; saving confirms in place and lands on the diary."],
    ["Each day sits in an outlined box beside its poster, so a month reads like a ticket stub collection.", "Green stars, an orange heart for the ones you loved and a mark for a review or a rewatch, grouped by month with the count on the right."],
    ["A review leads with who wrote it and their badge, then the film, the stars and when they watched it.", "The heart floods tangerine when you like it; comments sit below as quiet bubbles."],
    ["The counts sit in one plain grid; four favourites are the profile's face, and your ratings spread is the same histogram as a film's.", "Diary, lists and watchlist are rows that go one level deeper."],
    ["A ranked list is a grid of posters numbered in order, under its title in serif and a note that expands.", "A bar says how many you've seen; like and save it from the row above."],
  ],
};
