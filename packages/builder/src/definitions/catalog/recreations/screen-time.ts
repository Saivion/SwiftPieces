// The screen-time remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in screen-time.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "screen-time", title: "Screen Time", category: "Productivity",
    summary: "A screen time coach in the SwiftPieces look: a big ring of how much less you're on your phone, a score in three gauges, late-night insights, rules that block apps, a focus timer, the running session and the block screen.",
    description: "A screen time app in seven screens across three tabs on a floating dock, in the SwiftPieces look; actions are pills, cards 24, tiles 18, gauges round, with glacier sky as the one accent. Today leads with a ticked ring of this week against your usual and the time won back in large, then the score as three round gauges for sleep, focus and rest, the day by the hour as bars, and a card about bedtime that opens insights: late-night minutes against the usual line, the first pickup and last scroll as tiles, and the apps used most before bed. Rules shows the apps blocked right now and the rules as tiles; a new rule is a sheet with the apps as chips, start and end, the days and a difficulty on glass. The focus timer is one big rolling time you scrub, with apps blocked and a sound. The running session stands on navy with a soft ring, the blocked apps and a break that asks first; leaving early takes a hold. Opening a blocked app shows the block screen on charcoal, where an unblock has to be earned with a sum. Built from Screen Header, Timer Dial, Stat Grid, Chart, Card, Compare Line, Row, Elastic Button, Avatar, Form Field, Token Field, Picker, Filter Rail, Glass Segments, Commit Button, Text Reveal, Scrub Stepper, Toggle, Icon Toggles, Tint Panel, Focus Ring, Confirm Sheet, Hold to Confirm, Tag and Quiz Choices.",
    try: ["Tap a bar to read an hour of screen time", "Open the bedtime card and drag the late-night line", "Press + and add Games to a new rule", "Scrub the focus timer to 45 minutes and start it", "Take a break, then hold to leave early", "Open Glimpse and earn ten minutes"],
    interactions: ["tabs", "push", "sheet", "tap", "scrub", "drag", "hold", "select", "toggle", "type", "haptic"],
    components: ["screen-header", "timer-dial", "stat-grid", "chart", "card", "compare-line", "row", "elastic-button", "avatar", "form-field", "token-field", "picker", "filter-rail", "glass-segments", "commit-button", "text-reveal", "scrub-stepper", "toggle", "icon-toggles", "tint-panel", "focus-ring", "confirm-sheet", "hold-to-confirm", "tag", "quiz-choices"],
    keywords: ["swiftui screen time", "swiftui app blocker", "swiftui focus mode", "swiftui progress ring"],
    steps: [
      { title: "Today", transition: "start" },
      { title: "Insights", transition: "push" },
      { title: "Apps and rules", transition: "tab" },
      { title: "New rule", transition: "sheet" },
      { title: "Focus timer", transition: "tab" },
      { title: "Session", transition: "push" },
      { title: "Blocked app", transition: "sheet" },
    ],
  },
  moves: [
    ["One ring says it all: this week against your usual, ticked like a dial, with the time won back set large beneath it.", "The score splits into three round gauges, so a bad night's sleep reads apart from a good day's focus."],
    ["Late nights get their own line against the usual, so the habit is a gap you can see; drag to read a night.", "The apps used most before bed sit in one list, with one way forward: a sleep rule."],
    ["What's blocked now comes first, as the apps themselves, then every rule as a tile with when it runs and what it blocks.", "Block now is the one pill, for the moments no rule saw coming."],
    ["A rule is a short sheet: apps as chips, a start and an end, the days, and how hard it is to break.", "Saving confirms in place with when it starts."],
    ["The timer is one big figure you scrub, with blocking and a sound as the only options.", "Starting it is one pill."],
    ["The session takes the whole screen on navy, a soft ring of time left over the apps it's holding back.", "A break asks first and says it gets slower; leaving early takes a hold."],
    ["The block screen names the rule and why, in your own words from yesterday.", "Unblocking has to be earned: answer the sum and ten minutes open, wrong answers shake."],
  ],
};
