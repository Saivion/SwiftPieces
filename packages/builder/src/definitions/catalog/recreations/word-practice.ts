// The word-practice remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in word-practice.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "word-practice", title: "Word Practice", category: "Education",
    summary: "A word per screen you swipe through, a practice round, topics, your own words, a streak and your liked words A to Z.",
    description: "A word-learning app in six screens, in the SwiftPieces look; actions are pills, and cards, tiles and the word pager share one 24 radius. One word per page on the card surface under a header whose buttons open your streak and a new word, swiped through and saved toward a daily goal; a practice round under the navigation title where you pick the word for a meaning with the mascot watching; a sheet of topics as tilting colour blocks, with the next group still loading as skeleton tiles, whose Liked row pushes your liked words as one list grouped by letter with an A to Z rail to drag; a sheet to add your own word; and the week's streak over the next word. Built from Screen Header, Word Pager, Elastic Button, Quiz Choices, Mascot, Motion Card, Skeleton Loader, Glass Segments, Form Field, Commit Button and Index Scrubber.",
    try: ["Swipe up through the words and save one", "In Practice, pick a wrong answer, then the right one", "Open Topics and tilt a topic card", "Open Liked from Topics and drag down the letters", "Practice a mix from Topics", "Add a word and watch it confirm"],
    interactions: ["swipe", "tap", "drag", "scroll", "toggle", "select", "push", "sheet", "type", "spring", "loading", "haptic"],
    components: ["word-pager", "elastic-button", "quiz-choices", "mascot", "motion-card", "skeleton-loader", "glass-segments", "form-field", "commit-button", "screen-header", "index-scrubber"],
    keywords: ["swiftui word learning app", "swiftui vertical paging", "swiftui quiz", "swiftui flashcards", "swiftui section index"],
    steps: [
      { title: "Word of the day", transition: "start" },
      { title: "Practice", transition: "push" },
      { title: "Topics", transition: "sheet" },
      { title: "Liked words", transition: "push" },
      { title: "Add a word", transition: "sheet", note: ".sheet(isPresented:) with a form" },
      { title: "Streak", transition: "push" },
    ],
  },
  moves: [
    ["One word fills the card and the next is a swipe up; pages ease in as they settle.", "Like and save sit in a rail by your thumb; Practice is the one red button."],
    ["The mascot and a progress bar sit beside the count; the right answer fills with a success tap, a wrong one shakes, and a panel rises with it in a sentence."],
    ["The sheet opens on a title row with a close button; your own words sit first, topics are colour blocks that tilt, and the next group loads as matching skeleton tiles."],
    ["Liked words are one long list under headers that stick as you scroll, pushed inside the Topics sheet with its own back.", "Drag the A to Z rail to jump: the letter swells by your thumb, each new section ticks, and empty letters stay dimmed."],
    ["Part of speech is a glass switch, labels float up as you type, and Add word confirms in place."],
    ["The streak card rides on top of the next word, its days settling in, so progress and practice share one screen."],
  ],
};
