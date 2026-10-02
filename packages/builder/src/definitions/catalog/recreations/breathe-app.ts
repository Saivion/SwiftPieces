// The breathe-app remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in breathe-app.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "breathe-app", title: "Breathing App", category: "Health",
    summary: "Pick an exercise from its own scene, then breathe through full-screen worlds that swell and settle with you, a coach along the way, and see how your pace eased.",
    description: "A breathing app in six screens, in the Swift Pieces look: an exercise led by its own scene, edge to edge under the status bar with an arched foot, a heart to keep it and a play button to try the pace, over its name, a length and one wide Start; then four pushed sessions that take the whole phone, each a colour world of its own (violet orbs with a coach, a mint bloom you turn with a flick, peach pillows on cobalt that swell and part, a cobalt tide with a line to fill on the long out-breath), with a close and a finish over the scene, the round counter under them and a pill at the foot on to the next part; and a summary that replaces the session, with the mascot, rolling figures and tabs for pace and pulse. Actions are pills, cards and scenes 24. Built from Breath Scene, Tag, Tint Panel, Glass Segments, Elastic Button, Mascot, Text Reveal, Odometer, Tracking Tabs, Compare Line and Commit Button.",
    try: ["Tap the scene to feel the pace, keep it with the heart, then Start session", "Breathe along, then take the pill on to the bloom and flick it to turn", "Close a session to leave it, or Finish to skip to the summary", "Swipe from pace to pulse on the summary"],
    interactions: ["tap", "drag", "push", "select", "tabs", "swipe", "scrub", "toggle", "haptic"],
    components: ["breath-scene", "tag", "tint-panel", "glass-segments", "elastic-button", "mascot", "text-reveal", "odometer", "tracking-tabs", "compare-line", "commit-button"],
    keywords: ["swiftui breathing app", "swiftui breathing animation", "swiftui canvas timeline", "swiftui meditation app"],
    steps: [
      { title: "Exercise", transition: "start" },
      { title: "Coach", transition: "push" },
      { title: "Bloom", transition: "push" },
      { title: "Pillows", transition: "push" },
      { title: "Tide", transition: "push" },
      { title: "Summary", transition: "replace" },
    ],
  },
  moves: [
    ["The scene is the preview: the exercise's own world leads the screen, runs up under the status bar and arches into the words below, and a tap plays the pace before you commit to a length.", "A heart over the scene keeps the exercise; the one red button starts it."],
    ["The session is the whole phone: violet orbs swell on the in-breath and settle on the out-breath, with a soft haptic at every turn.", "Close and Finish sit over the scene with the round counter under them; the coach speaks in a note at the foot and a pill moves on to the next part."],
    ["A new world for each part: mint petals open on the in-breath and fold back on the out; dragging turns the flower, and a flick keeps it turning from your release speed without breaking the rhythm."],
    ["Three soft peach pillows on cobalt, widest at the bottom, swell and part as the breath comes in and settle back together as it goes out: a slower, five-second pace you can feel."],
    ["Water rises with the in-breath and ebbs with the out, while breathing out fills a line near the top, turning a long exhale into a small, quiet goal the coach can point at."],
    ["A finished session is a one-way door: the summary replaces it, so back never re-enters the breathing.", "A calm, centred finish, figures that roll up, then pace and pulse as tabs, with a composed state when the watch was off, and one save that loads and confirms."],
  ],
};
