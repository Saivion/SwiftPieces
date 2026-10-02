// The feelings-journal remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in feelings-journal.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "feelings-journal", title: "Feelings Journal", category: "Health",
    summary: "Name a feeling from a field of coloured bubbles, read your check-ins as cards that wear the feeling's shape, see the month in marks, find a tool and share with a small circle.",
    description: "An emotions journal in six screens and four tabs, in the Swift Pieces look: a pannable field of feeling words running edge to edge in solid bubbles, red, gold, blue and green for the four corners of energy and pleasantness, that logs your pick in place; your log as pastel contour cards in the feeling's corner, each with its own shape (a burst, a sun, a drop or a clover) that wobbles when tapped; the month as those marks under every date, a tab a month, with rolling totals and what came up most; a toolkit led by a card you flip, over square contour tiles of the kinds of help; and a small circle of friends whose check-ins come the same way, with a heart to send back and a share that confirms with a toast, the header avatar opening a sheet to crop the photo they see. Actions and chips are pills, cards and the field 24, contour cards 28. Built from Screen Header, Tint Panel, Bubble Field, Feeling Mark, Tracking Tabs, Mood Calendar, Odometer, Category Bars, Flip Card, Stat Grid, Reaction Toggle, Toast and Photo Cropper.",
    try: ["Drag the bubbles, tap one and log it", "Tap a feeling's shape on a card to wobble it", "Open the month and swipe back to September", "Flip the try-now card", "Send a friend a heart, then share yours", "Tap your avatar on Circle, pinch the photo, then Choose"],
    interactions: ["drag", "tap", "select", "push", "tabs", "swipe", "toggle", "sheet", "press", "spring", "loading", "haptic"],
    components: ["screen-header", "tint-panel", "bubble-field", "feeling-mark", "tracking-tabs", "mood-calendar", "odometer", "category-bars", "flip-card", "stat-grid", "reaction-toggle", "toast", "photo-cropper"],
    keywords: ["swiftui emotion picker", "swiftui bubble grid", "swiftui mood calendar", "swiftui mood journal", "swiftui profile photo crop"],
    steps: [
      { title: "Name a feeling", transition: "start" },
      { title: "Your log", transition: "tab" },
      { title: "The month", transition: "push" },
      { title: "Toolkit", transition: "tab" },
      { title: "Your circle", transition: "tab" },
      { title: "Your photo", transition: "sheet" },
    ],
  },
  moves: [
    ["Feelings sit on a map: energy up and down, pleasant left to right, so the colour of the corner you drag toward already narrows the word.", "The field runs edge to edge under the header; bubbles swell near the middle and fade at the edges, a tap glides your pick to the centre and the button under it logs it in place with a success tap."],
    ["Each check-in is a contour card in its corner's pastel: when, then \"I'm feeling\" quietly over the word, and the feeling's own shape across from it.", "Four shapes stand for the four corners, so a glance down the list reads the week before any word does."],
    ["The month shows the same shapes under each date, a column per weekday, so a run of drops or of suns stands out at once.", "Months are tabs you swipe; totals roll up underneath, then bars of the feelings that came up most, in their corner's colour."],
    ["One exercise to try now leads as a contour card you flip for the how.", "The kinds of help are square contour tiles, the name large and how many inside under it, two by two."],
    ["Friends' check-ins come as the same cards, with a heart that bounces back, so their week reads like yours.", "Sharing yours confirms with a toast you can undo; your avatar in the header is one tap from the photo they see."],
    ["The photo sits in a dark well under the circle your circle sees; pinch, drag and turn it, and it springs back to fill the frame.", "Choose spins while the crop renders at full size, checks, then closes the sheet; Cancel leaves it as it was."],
  ],
};
