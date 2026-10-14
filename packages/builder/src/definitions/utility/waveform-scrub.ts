// Waveform Scrub: a voice note player whose waveform is the scrubber. A red play button joined to a glass capsule
// of bars and the time, an optional speed chip joined to its end, and a time bubble that buds up above the finger
// while it scrubs. Playback is the app's, so the emitter writes a small stand-in player (a task that moves the time
// on while playing) next to a sample waveform, holds the time, playing flag and speed in `@State`, and calls
// `WaveformScrub(samples:duration:time:isPlaying:rate:…)` exactly as registry/swift/media/WaveformScrub.swift declares
// it, writing only what differs from its defaults.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Swift defaults, so the emitted call only spells out what differs. */
export const WAVEFORM_DEFAULTS = { title: "Voice note", rates: [1, 1.5, 2] } as const;

/** The speed sets the Speeds property offers. */
export const WAVEFORM_RATES: Record<string, number[]> = {
  standard: [1, 1.5, 2],
  fine: [1, 1.25, 1.5, 2],
  slower: [0.75, 1, 1.5, 2],
};

/** A spoken note: five phrases with short pauses between them. The same envelope as the piece's example and preview. */
export const VOICE_NOTE_SAMPLES = [
  0.05, 0.32, 0.45, 0.27, 0.6, 0.8, 0.17, 0.42, 0.55, 0.22, 0.78, 0.99, 0.06, 0.04, 0.37, 0.49, 0.25,
  0.67, 0.83, 0.29, 0.5, 0.63, 0.22, 0.31, 0.37, 0.19, 0.59, 0.73, 0.05, 0.04, 0.26, 0.33, 0.27, 0.47,
  0.6, 0.26, 0.73, 0.88, 0.06, 0.06, 0.46, 0.54, 0.29, 0.67, 0.84, 0.2, 0.33, 0.41, 0.22, 0.72, 0.91,
  0.28, 0.49, 0.62, 0.05, 0.06, 0.38, 0.46, 0.23, 0.55, 0.68, 0.23, 0.27, 0.35, 0.05,
];

/** Where each "Preview as" state starts: seconds into the note (as a share of it) and whether it plays. */
export const WAVEFORM_STATES: Record<string, { at: number; playing: boolean; loading?: boolean }> = {
  start: { at: 0, playing: false },
  playing: { at: 0.28, playing: true },
  midway: { at: 0.55, playing: false },
  finished: { at: 1, playing: false },
  loading: { at: 0, playing: false, loading: true },
};

/** The note's length in whole seconds, within what the property allows. */
export const waveformDuration = (p: Props) => Math.min(Math.max(Math.round(n(p, "duration") || 42), 2), 7200);

function sampleWaveform(): string[] {
  const rows: string[] = [];
  for (let i = 0; i < VOICE_NOTE_SAMPLES.length; i += 13) rows.push(`${INDENT}${INDENT}${VOICE_NOTE_SAMPLES.slice(i, i + 13).map(num).join(", ")},`);
  return [
    "/// A sample waveform, so the screen runs on its own. In your app, read it from the recording:",
    "/// `samples = try await WaveformScrub.samples(from: url)`.",
    "enum VoiceNoteSample {",
    `${INDENT}static let samples: [Float] = [`,
    ...rows,
    `${INDENT}]`,
    "}",
  ];
}

export const definition: SwiftPieceDefinition = {
  id: "waveform-scrub",
  name: "Waveform Scrub",
  category: "pieces",
  description: "A voice note player whose waveform is the scrubber: a red play button joined to a glass capsule of bars. Drag across it to seek, with the time on a bubble above your finger, and tap the speed chip for 1.5× or 2×.",
  availability: "free",
  preview: { component: "waveform-scrub", chunk: "pieces-utility" },
  source: { registry: "free", name: "WaveformScrub" },
  docs: "/docs/components/media/waveform-scrub",
  icon: "mic",
  concepts: ["state", "binding", "closure", "gesture", "async", "formatstyle"],
  interactions: ["scrub", "drag", "tap", "press", "toggle", "loading", "haptic", "transition", "spring"],
  properties: [
    number("duration", "Length (seconds)", 42, 2, 7200, 1, { hint: "The note's length. From an hour the times read 1:12:30." }),
    bool("speedChip", "Speed chip", true, { group: "interaction", hint: "A chip joined to the end that cycles the playback speed." }),
    select("rates", "Speeds", "standard", opts(["standard", "1×, 1.5×, 2×"], ["fine", "1×, 1.25×, 1.5×, 2×"], ["slower", "0.75×, 1×, 1.5×, 2×"]), { group: "interaction", hint: "What each tap on the speed chip steps through." }),
    text("title", "VoiceOver label", WAVEFORM_DEFAULTS.title, { maxLength: 40, level: "advanced", hint: "What VoiceOver calls the waveform, such as Message from Ines." }),
    select("state", "Preview as", "start", opts(["start", "At the start"], ["playing", "Playing"], ["midway", "Paused midway"], ["finished", "Played to the end"], ["loading", "Waveform loading"]), {
      group: "state",
      hint: "Where the screen starts. In your app the player's time and state drive it.",
    }),
  ],
  variants: [
    { id: "voice", label: "Voice note", props: { duration: 42, speedChip: true, rates: "standard" } },
    { id: "reply", label: "Quick reply", props: { duration: 7, speedChip: false, rates: "standard" } },
    { id: "podcast", label: "Podcast clip", props: { duration: 154, speedChip: true, rates: "fine" } },
    { id: "recording", label: "Long recording", props: { duration: 4350, speedChip: true, rates: "slower" } },
  ],
  states: [
    { id: "start", label: "At the start", props: { state: "start" } },
    { id: "playing", label: "Playing", props: { state: "playing" } },
    { id: "midway", label: "Paused midway", props: { state: "midway" } },
    { id: "finished", label: "Played to the end", props: { state: "finished" } },
    { id: "loading", label: "Waveform loading", props: { state: "loading" } },
  ],
  anatomy: [
    { part: "Play button", props: ["state"] },
    { part: "Waveform", props: ["duration", "title"] },
    { part: "Speed chip", props: ["speedChip", "rates"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const duration = waveformDuration(p);
      const start = WAVEFORM_STATES[s(p, "state")] ?? WAVEFORM_STATES.start;
      const chip = b(p, "speedChip");
      const rates = WAVEFORM_RATES[s(p, "rates")] ?? WAVEFORM_RATES.standard;
      if (!start.loading) ctx.declare("VoiceNoteSample", sampleWaveform());
      const at = Math.round(start.at * duration * 10) / 10;
      const time = ctx.state("time", "TimeInterval", num(at));
      const playing = ctx.state("isPlaying", "", start.playing ? "true" : "false");
      const rate = chip ? ctx.state("rate", "", "1.0") : null;
      const title = s(p, "title").trim();
      const customRates = chip && rates.join() !== WAVEFORM_DEFAULTS.rates.join();
      const lines = call("WaveformScrub", [
        ["samples", start.loading ? "[]" : "VoiceNoteSample.samples"],
        ["duration", num(duration)],
        ["time", time],
        ["isPlaying", playing],
        rate && ["rate", `$${rate}`],
        customRates && ["rates", `[${rates.map(num).join(", ")}]`],
        title && title !== WAVEFORM_DEFAULTS.title && ["messages", `.init(title: ${str(title)})`],
        // A Style accent reaches the play button and the glyph on it.
        ctx.theme && ["style", ".init(accent: Theme.accent, accentInk: Theme.accentInk)"],
        ["onPlayPause", `{ ${playing}.toggle() }`],
        ["onSeek", `{ ${time} = $0 }`],
      ]);
      // The stand-in player: in your app, the player's time and state come from AVAudioPlayer or AVPlayer.
      const step = rate ? `0.25 * ${rate}` : "0.25";
      ctx.attach([
        `.task(id: ${playing}) {`,
        `${INDENT}// Stands in for your audio player: moves the time on while playing, and stops at the end.`,
        `${INDENT}while ${playing}, !Task.isCancelled {`,
        `${INDENT}${INDENT}try? await Task.sleep(for: .milliseconds(250))`,
        `${INDENT}${INDENT}guard ${playing} else { break }`,
        `${INDENT}${INDENT}${time} = min(${time} + ${step}, ${num(duration)})`,
        `${INDENT}${INDENT}if ${time} >= ${num(duration)} { ${playing} = false }`,
        `${INDENT}}`,
        "}",
      ]);
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
