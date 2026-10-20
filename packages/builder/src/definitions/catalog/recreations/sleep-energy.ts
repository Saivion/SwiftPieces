// The sleep-energy remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in sleep-energy.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "sleep-energy", title: "Sleep and Energy", category: "Health",
    summary: "A sleep tracker in the SwiftPieces look: sleep debt as one big figure, the day's energy as a curve of peaks and dips you scrub, habits timed to it, your calendar beside it, fourteen nights of progress and sounds to wind down.",
    description: "A sleep and energy app in seven screens across four tabs on a floating dock, in the SwiftPieces look; actions are pills, cards 20, chips 10, tiles 16. Sleep stands on a plum ground: your sleep debt rising in large, energy, sleep need and great nights as tiles, last night's times and fourteen nights of debt against the low-debt line. Energy stands on navy with an ember glow: the moment you're in as a word, the day's predicted energy as a hill you drag through from waking to bed, and the peaks and dips as moments, from grogginess to the melatonin window, each a tap for a reminder. Habits are a sheet of checkable rows timed to that curve, morning light to bedtime, with one reminder switch. Plan my day sets your calendar on the hours with each event in its energy block and a sync that confirms as a toast. Progress swipes between sleep times, debt and how you felt over fourteen nights above four totals; Tools leads with a guided session on a parallax card, sleep sounds to play and a sleep timer dial, and the session breathes with the tide full screen. Built from Screen Header, Tint Panel, Text Reveal, Stat Grid, Compare Line, Elastic Button, Area Scrub, Moment List, Tag, Plan Row, Row, Glass Segments, Hour Timeline, Toast, Tracking Tabs, Chart, Mood Line, Parallax Card, Media Row, Timer Dial and Breath Scene.",
    try: ["Drag through the energy curve to the afternoon dip", "Tap the melatonin window for a reminder", "Open Habits and check off the last big meal", "Plan my day, then sync the calendar", "Swipe Progress from Sleep debt to Quality", "Start Reduce stress from Tools"],
    interactions: ["tabs", "sheet", "push", "tap", "scrub", "swipe", "select", "drag", "toggle", "haptic"],
    components: ["screen-header", "tint-panel", "text-reveal", "stat-grid", "compare-line", "elastic-button", "area-scrub", "moment-list", "tag", "plan-row", "row", "glass-segments", "hour-timeline", "toast", "tracking-tabs", "chart", "mood-line", "parallax-card", "media-row", "timer-dial", "breath-scene"],
    keywords: ["swiftui sleep tracker", "swiftui energy curve", "swiftui sleep debt", "swiftui circadian rhythm"],
    steps: [
      { title: "Sleep debt", transition: "start" },
      { title: "Energy today", transition: "tab" },
      { title: "Habits", transition: "sheet" },
      { title: "The day by energy", transition: "push" },
      { title: "Progress", transition: "tab" },
      { title: "Tools", transition: "tab" },
      { title: "A wind-down session", transition: "sheet" },
    ],
  },
  moves: [
    ["Sleep debt is the screen's one number, set huge on a plum ground, with what it means in plain words under it.", "Fourteen nights of debt run against the low-debt line, so getting under it is a gap you watch close."],
    ["The day's energy is a hill you drag through, the moment you're in named in large above it.", "Peaks and dips follow as moments on a rail, warm for the peaks and cool for the dips, each a tap for a reminder."],
    ["Every habit carries its time from the energy curve, so morning light and the last coffee are when, not just what.", "Rows check off in place; one switch handles every reminder."],
    ["Your calendar sits on the hours with each event named for the energy block it falls in, so the dip gets the email and the peak gets the work.", "Syncing confirms as a toast."],
    ["Sleep times, debt and how you felt are pages you swipe under a sliding block, all over the same fourteen nights.", "Four totals below say how the fortnight went."],
    ["A guided session leads on a picture card that lifts when pressed; sounds play from their rows.", "The sleep timer is a dial you turn to the minutes before it fades the sound out."],
    ["The session fills the screen and swells with each breath in, the round and the time along the bar; Done closes it."],
  ],
};
