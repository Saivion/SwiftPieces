// The podcast-player remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in podcast-player.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "podcast-player", title: "Podcast Player", category: "Music",
    summary: "Your shows as a wall of covers, the player, a sound sheet, a playlist and the queue.",
    description: "A podcast player in five screens across three tabs, in the SwiftPieces look with a floating dock; actions are pills, cards 24, covers 16. Each tab opens on a designed header whose round button leads somewhere: your library as a grid of cover art in swipeable tabs (with a composed empty state for downloads) over a mini player, the full player with a scrubber, skips and a red play button, a springy speed button and a sleep timer that confirms with a toast, a half-height sheet for speed and voice per show or for every show, a playlist under its centred cover collage with Play all and Shuffle, and the queue with a rolling time-left counter and a hold to clear. Built from Screen Header, Cover Grid, Tracking Tabs, Playback Controls, Elastic Button, Toast, Reaction Toggle, Decimal Stepper, Expanding Track, Media Row, Odometer and Hold to Confirm.",
    try: ["Tap a cover to open the player", "Swipe the library to Offline", "Scrub or skip, then pause", "Open 1.4× and drag the speed", "Set a sleep timer", "Hold to clear the queue"],
    interactions: ["tabs", "sheet", "tap", "scrub", "swipe", "drag", "hold", "toggle", "select", "haptic"],
    components: ["cover-grid", "tracking-tabs", "playback-controls", "elastic-button", "reaction-toggle", "decimal-stepper", "expanding-track", "toggle", "media-row", "odometer", "hold-to-confirm", "search-field", "screen-header", "toast"],
    keywords: ["swiftui podcast app", "swiftui audio player", "swiftui mini player", "swiftui swipe to delete"],
    steps: [
      { title: "Library", transition: "start" },
      { title: "Player", transition: "sheet" },
      { title: "Speed and sound", transition: "sheet", note: ".sheet with .presentationDetents([.medium])" },
      { title: "Playlist", transition: "tab" },
      { title: "Queue", transition: "tab" },
    ],
  },
  moves: [
    ["Covers do the navigating: a grid of artwork that settles in, three across, faster to scan than titles.", "All, New and Offline are pages you swipe, and an empty page explains itself and offers one way forward."],
    ["The artwork leads on the centre line and the transport sits in one card with the red play button; speed opens a sheet, sleep confirms with a toast."],
    ["Speed and sound live in a half-height sheet; this show and every show are pages with their own values.", "Speed steps or scrubs in tenths; voice lift is a bar that swells under your thumb."],
    ["A playlist leads with a centred collage of its shows, then Play all as the one red button with Shuffle beside it.", "Every episode's play button opens the player."],
    ["Time left rolls up as a counter on top, so you know whether the queue fits the trip.", "Rows swipe away one by one; clearing everything takes a deliberate hold."],
  ],
};
