// The focus-soundscapes remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in focus-soundscapes.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "focus-soundscapes", title: "Focus Soundscapes", category: "Health",
    summary: "A sound player in the SwiftPieces look: each mode a living line drawing on charcoal, the day's energy curve with a now line, a timer you turn, a sound you tune and the modes to explore.",
    description: "An adaptive soundscape player in seven screens, in the SwiftPieces look; actions are pills, scenes and cards 28, tiles 20. It opens straight into the sound: Focus stands on a charcoal ground with its scene drawn in thin off-white rings that swell and settle around 852 Hz, the time and the energy phase above it and only quiet controls below. Your guide plots the day's energy as a hill you drag through, with the line at now, the phases as moments you tap for a nudge and the real-time inputs it listens to as switches. The timer is a dial you turn with presets and a focus-interval trail; tuning the sound is three bars that swell under your finger, a drive you pick on glass and layers you toggle. Explore is a sheet of the three modes as small living scenes, timed scenarios and more soundscapes as covers; Relax rolls a tide with a breathing bar, and Sleep drifts orbs with a fade-out you pick and a gentle alarm. Moonlight lilac is the one accent. Built from Tint Panel, Screen Header, Breath Scene, Stat Grid, Elastic Button, Area Scrub, Moment List, Row, Toggle, Timer Dial, Filter Rail, Step Trail, Commit Button, Expanding Track, Glass Segments, Icon Toggles, Cover Grid and Toast.",
    try: ["Tap the Focus scene to pause it, then again to play", "Open Your guide and drag through the day's energy", "Turn the timer dial, then Set timer", "Tune the sound: swell Bright and pick Driven", "Explore, then open Relax and breathe with the tide", "Open Sleep and ask to be woken gently"],
    interactions: ["push", "sheet", "tap", "drag", "scrub", "select", "toggle", "spring", "haptic"],
    components: ["tint-panel", "screen-header", "breath-scene", "stat-grid", "elastic-button", "area-scrub", "moment-list", "row", "toggle", "timer-dial", "filter-rail", "step-trail", "commit-button", "expanding-track", "glass-segments", "icon-toggles", "cover-grid", "toast"],
    keywords: ["swiftui focus sounds", "swiftui sleep sounds", "swiftui ambient player", "swiftui circadian chart"],
    steps: [
      { title: "Focus", transition: "start" },
      { title: "Your guide", transition: "push" },
      { title: "Timer", transition: "sheet" },
      { title: "Tune the sound", transition: "sheet" },
      { title: "Explore", transition: "sheet" },
      { title: "Relax", transition: "push" },
      { title: "Sleep", transition: "push" },
    ],
  },
  moves: [
    ["The sound is the screen: thin off-white rings on charcoal swell and settle with it, and the controls stay small and quiet below.", "The eyebrow says what the sound is tuned for right now, the time and the energy phase, so the app explains itself in one line."],
    ["The day's energy is one hill with a line at now, so 'peaking' is a place you can see; drag to read any hour.", "The phases below are moments you tap for a nudge, and the inputs it listens to are plain switches."],
    ["The timer is a dial you turn with a tick under your finger, with presets for the usual lengths.", "Focus intervals are a trail of blocks, so warm-up, focus and break read as one plan."],
    ["Tuning is felt, not typed: each quality is a bar that swells as you drag it.", "Drive is one choice on glass, and layers are round toggles you can stack."],
    ["Each mode is its own small living drawing, so you pick by feel before reading a name.", "Scenarios are timed sessions in one list, and more soundscapes wait as covers below."],
    ["Relax swaps the rings for a tide with a breathing bar, slower and lower, on the same charcoal.", "One pill goes back to Focus, so switching modes never takes a trip through menus."],
    ["Sleep drifts dim orbs and asks one question: when to fade out.", "A gentle alarm confirms as a toast with an undo."],
  ],
};
