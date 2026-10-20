// The bird-id remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in bird-id.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "bird-id", title: "Bird ID", category: "Education",
    summary: "A bird identifier in the SwiftPieces look: listen and watch suggestions arrive with the bird singing now on butter, answer five questions step by step, frame a photo, read a species' songs, range and season, explore what's likely near you and keep a life list.",
    description: "A bird identification app in seven screens over a floating dock, in the SwiftPieces look; actions are pills, cards 16, thumbnails 12, with meadow green as the one accent and every bird wearing its four-letter banding code. Identify opens on a forest-green Sound ID card, with Photo ID and Step by Step as tiles beside the bird of the day and your recent sessions. Listening comes up as a sheet on a forest ground: the recording runs as a waveform you can scrub, and the best suggestions gather under it, the bird singing now lifted onto butter. Step by step walks a trail of five questions, size as cards you pick one of and the main colours as swatches you pick up to three of; Photo ID frames the bird in the camera. Every route ends on the species: its plumages to swipe, the Latin name, songs and calls to play, a range map of its migration and its reports by month near you, with This is my bird. Explore lists what's likely today, each bird with its own seasonal bars, and the Life List rings the year's goal over your sightings, newest first. Built from Screen Header, Tint Panel, Elastic Button, Card, Image, Media Row, Waveform Scrub, Page Carousel, Expandable Text, Route Map, Chart, Commit Button, Step Trail, Choice, Color Block List, Camera Viewfinder, Search Field, Filter Rail, Goal Ring and Stat Grid.",
    try: ["Start listening and tap the bird singing now", "Play the song, then slow it down", "Drag the range map", "Answer the size question and pick two colours", "Frame a photo and tap Identify", "Tap This is my bird, then read your life list"],
    interactions: ["tabs", "sheet", "push", "tap", "select", "scrub", "drag", "swipe", "expand", "loading", "haptic"],
    components: ["screen-header", "tint-panel", "elastic-button", "card", "image", "media-row", "waveform-scrub", "page-carousel", "expandable-text", "route-map", "chart", "commit-button", "step-trail", "choice", "color-block-list", "camera-viewfinder", "search-field", "filter-rail", "goal-ring", "stat-grid", "tag"],
    keywords: ["swiftui bird app", "swiftui sound recognition", "swiftui field guide", "swiftui species list"],
    steps: [
      { title: "Identify", transition: "start" },
      { title: "Sound ID", transition: "sheet" },
      { title: "A species", transition: "push" },
      { title: "Step by step", transition: "sheet" },
      { title: "Photo ID", transition: "sheet" },
      { title: "Explore", transition: "tab" },
      { title: "Life list", transition: "tab" },
    ],
  },
  moves: [
    ["Sound ID is the one card in colour, forest green with a sage pill, so the app's best trick is the obvious first tap.", "Photo and step by step sit beside it as quieter tiles, over the bird of the day and your recent sessions."],
    ["The recording runs across the top as a waveform; suggestions gather under it as the birds call.", "The bird singing now is lifted onto butter, with its song written out, and Stop leads to its page."],
    ["A species opens on its plumages, then its Latin name in serif and two chips: its family and whether it's here now.", "Songs play and slow down, the range map arcs its migration, and the month bars mark this one."],
    ["A trail of five questions says how far in you are; size is cards where picking one unpicks the others.", "Colours are swatches you pick up to three of, so the answer is how you'd describe it, not what it's called."],
    ["The camera frames the bird with corners and one line of advice, and Identify goes straight to the match."],
    ["Every likely bird keeps its own month bars with April marked, so arriving, resident and leaving read at a glance.", "Sorting and filters stay one chip away."],
    ["The life list leads with the count and a ring toward the year's goal, then three figures as tiles.", "Each sighting keeps its number, date, place and how you found it."],
  ],
};
