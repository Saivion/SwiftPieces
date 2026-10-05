// The downtime-lists remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in downtime-lists.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "downtime-lists", title: "Downtime Lists", category: "Entertainment",
    summary: "Collections of things to watch, read and play, what's underway, search, a listening queue, what's coming up, your year so far and saved articles as link cards.",
    description: "A backlog app in seven screens across four tabs, in the SwiftPieces look with a floating dock; actions are pills, cards 24, covers and thumbnails 12. Tab screens open on a designed two-weight header whose round button leads somewhere; pushed screens use the navigation title. Collections are led by a pinned collage of solid blocks and strips of covers, and saved articles open as link cards with each page's title and site; shows, books and games in progress are swipeable tabs whose next episodes play straight into the listening queue; search swaps shelves of covers per type; the queue sits under the episode that's playing; countdowns flip between days and weeks, with a composed empty state for later; and the year is one big rolling figure over bars you drag. Built from Screen Header, Photo Mosaic, Cover Grid, Media Row, Tracking Tabs, Playback Controls, Countdown Card, Elastic Button, Odometer, Category Bars and Link Preview.",
    try: ["Open Saved articles and hold a card to copy its link", "Swipe between Shows, Books and Games", "Play a next episode to jump to the queue", "Swipe search between films, shows and books", "Tap a countdown to flip it to weeks", "Open Later for the empty state", "Drag across the months in Stats"],
    interactions: ["push", "tabs", "tap", "hold", "menu", "swipe", "scrub", "drag", "type", "haptic"],
    components: ["photo-mosaic", "cover-grid", "media-row", "tracking-tabs", "search-field", "playback-controls", "countdown-card", "elastic-button", "odometer", "category-bars", "screen-header", "link-preview"],
    keywords: ["swiftui watchlist app", "swiftui media list", "swiftui countdown", "swiftui podcast queue", "swiftui link preview"],
    steps: [
      { title: "Collections", transition: "start" },
      { title: "Underway", transition: "push" },
      { title: "Search", transition: "push" },
      { title: "Saved articles", transition: "push" },
      { title: "Listening queue", transition: "tab" },
      { title: "Coming up", transition: "tab" },
      { title: "Year so far", transition: "tab" },
    ],
  },
  moves: [
    ["A two-weight header with a round search button opens the tab; the pinned list is a collage of its covers that dips under your finger and opens it.", "Each list shows a strip of its own covers that settle in and open the list on a tap."],
    ["The navigation title leads; shows, books and games are pages you swipe, a red block sliding under the tab titles.", "Each show is a card with its progress under the title, and the next episode's play button goes straight to the queue."],
    ["Search keeps one field on top and swaps shelves of covers per type as you swipe, so every tab changes what you see."],
    ["Each saved link is a card with the page's title and site, the newest large and the rest as rows, holding their size while a page loads.", "A tap opens the page; a long press offers Copy Link and Share."],
    ["What's playing sits on top with its own scrubber; the queue under it reads like a feed with a reorder handle on every row."],
    ["Countdowns are split-flap tiles that flip to weeks on a tap, grouped by range in swipeable tabs.", "Later is a composed empty state with one way forward, not a blank page."],
    ["One big figure rolls up on the centre line, then each month is a bar you drag across to read.", "The year ends as plain sentences: fullest month, busiest time of week."],
  ],
};
