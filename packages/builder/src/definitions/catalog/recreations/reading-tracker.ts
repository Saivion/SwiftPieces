// The reading-tracker remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in reading-tracker.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "reading-tracker", title: "Reading Tracker", category: "Books",
    summary: "Your shelves with genre and mood words, picks on big covers, the year by mood, a daily reading goal, friends' reading and yearly challenges.",
    description: "A reading tracker in six screens, in the SwiftPieces look with a floating dock; actions are pills, cards 24, book covers square-cornered like paper. Tab screens open on a designed two-weight header, pushed ones on the navigation title: your shelves as swipeable tabs of book cards with genre and mood words and a shelf pill, picks on rows of covers per reason, the year's total as one big rolling figure over mood bars you drag, a daily goal carried by the mascot with a target you drag, friends' updates with a composed empty state for who you follow, and challenges under one big ring. Built from Screen Header, Book Row, Tracking Tabs, Cover Shelf, Odometer, Live Stat, Category Bars, Mascot, Expanding Track, Compare Line, Goal Ring, Toast and Commit Button.",
    try: ["Swipe between your shelves", "Change a book's shelf", "Swipe the picks between reasons", "Drag across the mood bars", "Open the daily goal and drag the target", "Like a friend's book, then swipe to Following", "Join the summer challenge"],
    interactions: ["select", "menu", "push", "tabs", "tap", "swipe", "scrub", "drag", "toggle", "haptic"],
    components: ["book-row", "tracking-tabs", "cover-shelf", "live-stat", "category-bars", "elastic-button", "mascot", "expanding-track", "compare-line", "goal-ring", "commit-button", "screen-header", "odometer", "toast"],
    keywords: ["swiftui reading tracker", "swiftui book app", "swiftui progress ring", "swiftui bar chart", "swiftui book cover"],
    steps: [
      { title: "Shelves", transition: "start" },
      { title: "For you", transition: "push" },
      { title: "This year", transition: "tab" },
      { title: "Daily goal", transition: "push" },
      { title: "Friends", transition: "tab" },
      { title: "Challenges", transition: "tab" },
    ],
  },
  moves: [
    ["Shelves are pages you swipe, a red block sliding under To read, Reading and Finished.", "Genres read in full ink and moods a step quieter, and the shelf pill opens in place on each card."],
    ["The navigation title leads; each reason for a pick is its own page of cover rows, and the covers swing in."],
    ["Books finished roll up as one big centred figure; under it each mood keeps its own house colour, and dragging singles one out."],
    ["The mascot carries the streak on the centre line; the daily target is a bar you drag, with today and the best run beside it."],
    ["Friends and Following are pages; every card starts with who did what, with a like at the end.", "Following nobody yet is a composed empty state whose one button copies an invite."],
    ["The main challenge gets the ring, which sweeps up on appear; joining a new one confirms in place."],
  ],
};
