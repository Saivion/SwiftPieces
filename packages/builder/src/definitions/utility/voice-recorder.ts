// Voice Recorder: the hold-to-record voice message button beside a composer field. Hold the glass mic and it swells
// red as a recording capsule buds out over the field with a clock and speech bars and a lock lane buds up; slide
// toward the leading edge to discard into a bin, slide up to lock hands-free (send and trash), or let go to send an
// .m4a with its duration and waveform samples. The emitter holds the draft in `@State`, writes the field as the
// recorder's content, and calls `VoiceRecorder { recording in } content: { }` exactly as
// registry/swift/media/VoiceRecorder.swift declares it, writing only what differs from its defaults. "Preview as"
// only changes the Playground's picture: in an app the finger and the microphone drive it.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Swift defaults, so the emitted call only spells out what differs. */
export const RECORDER_DEFAULTS = { maximum: 300, slideToCancel: "Slide to cancel", placeholder: "Message" } as const;

/** The longest take in whole seconds, within what the property allows. */
export const recorderMaximum = (p: Props) => Math.min(Math.max(Math.round(n(p, "maximum") || RECORDER_DEFAULTS.maximum), 15), 900);

/** The simulated source's speech, as VoiceRecorderSpeech draws it: four phrases with short pauses, every 6.4 s. */
export function recorderSpeech(time: number): number {
  const noise = (i: number) => {
    let x = Math.imul(i | 0, 0x9e3779b1) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    x = Math.imul(x, 0x85ebca77) >>> 0;
    x = (x ^ (x >>> 13)) >>> 0;
    return (x % 10000) / 10000;
  };
  const phrases = [[0.12, 1.6, 0.95], [1.95, 3.3, 0.8], [3.7, 4.45, 0.7], [4.85, 6.05, 1]];
  const local = time % 6.4;
  const grain = noise(Math.floor(time * 20));
  const p = phrases.find(([a, z]) => local >= a && local <= z);
  if (!p) return 0.02 + 0.03 * grain;
  const env = Math.min(Math.min((local - p[0]) / 0.12, 1), Math.min((p[1] - local) / 0.15, 1));
  const syllable = Math.abs(Math.sin(Math.PI * 4.4 * time + 1.2 * Math.sin(1.3 * time)));
  return Math.min(Math.max(env * p[2] * (0.35 + 0.65 * syllable) * (0.75 + 0.25 * grain), 0.03), 1);
}

export const definition: SwiftPieceDefinition = {
  id: "voice-recorder",
  name: "Voice Recorder",
  category: "pieces",
  description: "The hold-to-record voice message button for a chat or notes composer. Hold the mic to record with a live clock and bars, slide left to discard, slide up to lock hands-free, let go to send.",
  availability: "free",
  preview: { component: "voice-recorder", chunk: "pieces-utility" },
  source: { registry: "free", name: "VoiceRecorder" },
  docs: "/docs/components/media/voice-recorder",
  icon: "mic",
  concepts: ["state", "closure", "gesture", "async", "textfield", "piece"],
  interactions: ["hold", "press", "drag", "tap", "haptic", "spring", "transition"],
  properties: [
    bool("field", "Composer field", true, { hint: "A message field beside the mic. Off, the mic rests alone and the capsule spans the width." }),
    text("placeholder", "Field placeholder", RECORDER_DEFAULTS.placeholder, { maxLength: 40, hint: "The field's placeholder, such as Message or Add a note." }),
    number("maximum", "Longest take (seconds)", RECORDER_DEFAULTS.maximum, 15, 900, 15, { group: "interaction", hint: "The last ten seconds count down on red; at the end the take is sent." }),
    select("source", "Records from", "microphone", opts(["microphone", "The microphone"], ["simulated", "A simulated voice"]), {
      group: "interaction",
      level: "advanced",
      hint: "Simulated needs no microphone or permission: for the simulator and screenshots.",
    }),
    text("slideToCancel", "Discard hint", RECORDER_DEFAULTS.slideToCancel, { maxLength: 30, level: "advanced", hint: "The quiet hint inside the capsule while the mic is held." }),
    select("state", "Preview as", "rest", opts(["rest", "At rest"], ["holding", "Recording, held"], ["locked", "Recording, hands-free"], ["countdown", "Last ten seconds"], ["short", "Too short (hint)"], ["denied", "Microphone off"]), {
      group: "state",
      hint: "Only for this preview. In the app the finger and the microphone drive it.",
    }),
  ],
  variants: [
    { id: "chat", label: "Chat composer", props: { field: true, placeholder: "Message", maximum: 300 } },
    { id: "note", label: "Quick note", props: { field: true, placeholder: "Add a note", maximum: 120 } },
    { id: "support", label: "Support reply", props: { field: true, placeholder: "Describe the problem", maximum: 180 } },
    { id: "mic", label: "Mic only", props: { field: false, maximum: 60 } },
  ],
  states: [
    { id: "rest", label: "At rest", props: { state: "rest" } },
    { id: "holding", label: "Recording, held", props: { state: "holding" } },
    { id: "locked", label: "Recording, hands-free", props: { state: "locked" } },
    { id: "countdown", label: "Last ten seconds", props: { state: "countdown" } },
    { id: "short", label: "Too short (hint)", props: { state: "short" } },
    { id: "denied", label: "Microphone off", props: { state: "denied" } },
  ],
  anatomy: [
    { part: "Field", props: ["field", "placeholder"] },
    { part: "Mic", props: ["source", "state"] },
    { part: "Recording capsule", props: ["maximum", "slideToCancel"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const field = b(p, "field");
      const maximum = recorderMaximum(p);
      const hint = s(p, "slideToCancel").trim();
      const placeholder = s(p, "placeholder").trim() || RECORDER_DEFAULTS.placeholder;
      // A simulated voice for the simulator and screenshots; the default session records from the microphone.
      const session = s(p, "source") === "simulated" ? ctx.state("recorder", "", "VoiceRecorder.Session(source: .simulated)") : null;
      const lines = call(
        "VoiceRecorder",
        [
          session && ["session", session],
          maximum !== RECORDER_DEFAULTS.maximum && ["maximumDuration", num(maximum)],
          hint && hint !== RECORDER_DEFAULTS.slideToCancel && ["messages", `.init(slideToCancel: ${str(hint)})`],
          // A Style accent reaches the recording mic, the send button and the countdown.
          ctx.theme && ["style", ".init(accent: Theme.accent, accentInk: Theme.accentInk)"],
        ],
        [
          "// Send it: upload recording.url, and keep recording.duration and recording.samples,",
          "// which draw the message with WaveformScrub. The file is yours to delete once sent.",
          'print("Voice message", recording.duration, recording.url.lastPathComponent)',
        ],
      );
      // The first trailing closure is `onSend`; it receives the finished recording.
      const open = lines.findIndex((l) => l.endsWith("{"));
      lines[open] = `${lines[open]} recording in`;
      if (field) {
        const draft = ctx.state("draft", "", '""');
        lines[lines.length - 1] = "} content: {";
        lines.push(
          ...indent([
            `TextField(${str(placeholder)}, text: $${draft})`,
            `${INDENT}.padding(.horizontal, 18)`,
            `${INDENT}.frame(height: 52)`,
            `${INDENT}.background(.quaternary, in: Capsule())`,
          ]),
          "}",
        );
      }
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
