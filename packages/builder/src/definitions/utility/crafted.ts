// The eight crafted pieces. Each emitter writes the public SwiftUI initializer and only the arguments
// that differ from its defaults, holding bindings in `@State` the screen owns.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, modifiers, num, str } from "../../core/swift.js";
import { bool, number, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

const piece = (extra: Omit<SwiftPieceDefinition, "category" | "availability" | "preview"> & { component: string }): SwiftPieceDefinition => {
  const { component, ...rest } = extra;
  return {
    category: "pieces",
    availability: "free",
    preview: { component, chunk: "pieces-utility" },
    ...rest,
  };
};

export const crafted: Array<{ definition: SwiftPieceDefinition; fill: boolean }> = [
  {
    fill: true,
    definition: piece({
      component: "scroll-island",
      id: "scroll-island",
      name: "Scroll Island",
      description: "A floating glass island you drag sideways to scrub sections. The title morphs, and a tap buds an Open bubble underneath.",
      source: { registry: "free", name: "ScrollIsland" },
      docs: "/docs/components/navigation/scroll-island",
      icon: "map",
      concepts: ["state", "binding", "gesture", "animation", "spring", "piece"],
      interactions: ["drag", "scrub", "tap", "expand", "haptic", "spring"],
      properties: [bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" })],
      anatomy: [{ part: "Feel", props: ["haptics"] }],
      swift: {
        imports: [],
        emit(p, ctx) {
          const position = ctx.state("section", "CGFloat", "0");
          const expanded = ctx.state("islandOpen", "Bool", "false");
          const stops = [
            `.init(id: "arrive", title: "Arrive", symbol: "airplane", detail: "Kansai, 14:20")`,
            `.init(id: "fushimi", title: "Fushimi", symbol: "tram.fill", detail: "Torii at dusk")`,
            `.init(id: "nara", title: "Nara", symbol: "pawprint.fill", detail: "Park before noon")`,
          ].join(", ");
          return { lines: call("ScrollIsland", [["stops", `[${stops}]`], ["position", `$${position}`], ["expanded", `$${expanded}`], !b(p, "haptics") && ["haptics", "false"]]) };
        },
      },
    }),
  },
  {
    fill: true,
    definition: piece({
      component: "step-trail",
      id: "step-trail",
      name: "Step Trail",
      description: "Throw a glass capsule along a trail of stops. It stretches between them and the page title morphs.",
      source: { registry: "free", name: "StepTrail" },
      docs: "/docs/components/navigation/step-trail",
      icon: "figure.walk",
      concepts: ["state", "binding", "gesture", "animation", "spring", "piece"],
      interactions: ["drag", "scrub", "select", "haptic", "spring"],
      properties: [bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" })],
      anatomy: [{ part: "Feel", props: ["haptics"] }],
      swift: {
        imports: [],
        emit(p, ctx) {
          const selection = ctx.state("step", "String", str("pack"));
          const steps = [
            `.init(id: "pack", title: "Pack", symbol: "suitcase.fill", detail: "Two days, one bag.")`,
            `.init(id: "train", title: "Train", symbol: "tram.fill", detail: "Platform 4, the slow one.")`,
            `.init(id: "walk", title: "Walk", symbol: "figure.walk", detail: "Down through the pines.")`,
            `.init(id: "stay", title: "Stay", symbol: "moon.fill", detail: "A room over the water.")`,
          ].join(", ");
          return { lines: call("StepTrail", [["steps", `[${steps}]`], ["selection", `$${selection}`], !b(p, "haptics") && ["haptics", "false"]]) };
        },
      },
    }),
  },
  {
    fill: true,
    definition: piece({
      component: "waveform-scrub",
      id: "waveform-scrub",
      name: "Waveform Scrub",
      description: "A voice note whose samples are the scrubber. A glass playhead follows your finger and a time bubble buds off it.",
      source: { registry: "free", name: "WaveformScrub" },
      docs: "/docs/components/media/waveform-scrub",
      icon: "mic",
      concepts: ["state", "binding", "gesture", "animation", "piece"],
      interactions: ["scrub", "drag", "toggle", "haptic"],
      properties: [
        bool("playing", "Playing", true, { group: "state" }),
        bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" }),
      ],
      states: [
        { id: "playing", label: "Playing", props: { playing: true } },
        { id: "paused", label: "Paused", props: { playing: false } },
      ],
      anatomy: [{ part: "Playback", props: ["playing", "haptics"] }],
      swift: {
        imports: [],
        emit(p, ctx) {
          const progress = ctx.state("progress", "Double", "0.18");
          const playing = ctx.state("playing", "Bool", b(p, "playing") ? "true" : "false");
          const samples = "[0.15, 0.4, 0.85, 0.55, 0.95, 0.3, 0.7, 0.2, 0.88, 0.45, 0.62, 0.9, 0.25, 0.5]";
          return { lines: call("WaveformScrub", [["samples", samples], ["progress", `$${progress}`], ["isPlaying", `$${playing}`], !b(p, "haptics") && ["haptics", "false"]]) };
        },
      },
    }),
  },
  {
    fill: true,
    definition: piece({
      component: "image-compare",
      id: "image-compare",
      name: "Image Compare",
      description: "Drag a glass seam across two pictures. It rubber-bands at the edges and buds a percent bubble while you drag.",
      source: { registry: "free", name: "ImageCompare" },
      docs: "/docs/components/media/image-compare",
      icon: "photo",
      concepts: ["state", "binding", "gesture", "viewbuilder", "piece"],
      interactions: ["drag", "scrub", "haptic"],
      properties: [
        text("before", "Before", "Dawn", { maxLength: 24 }),
        text("after", "After", "Noon", { maxLength: 24 }),
        number("split", "Split", 62, 0, 100, 1, { group: "state", hint: "How much of the before picture shows, in percent." }),
        bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" }),
      ],
      anatomy: [
        { part: "Pictures", props: ["before", "after"] },
        { part: "Seam", props: ["split", "haptics"] },
      ],
      swift: {
        imports: [],
        emit(p, ctx) {
          const split = ctx.state("split", "CGFloat", num((n(p, "split") || 0) / 100));
          const before = s(p, "before") || "Dawn";
          const after = s(p, "after") || "Noon";
          return {
            lines: modifiers(
              [
                `ImageCompare(split: $${split}, beforeCaption: ${str(before)}, afterCaption: ${str(after)}${b(p, "haptics") ? "" : ", haptics: false"}) {`,
                `    RoundedRectangle(cornerRadius: 28).fill(Color(red: 0.18, green: 0.22, blue: 0.4))`,
                `} after: {`,
                `    RoundedRectangle(cornerRadius: 28).fill(Color(red: 0.45, green: 0.72, blue: 0.95))`,
                `}`,
              ],
              ["frame(height: 240)"],
            ),
          };
        },
      },
    }),
  },
  {
    fill: true,
    definition: piece({
      component: "now-playing",
      id: "now-playing",
      name: "Now Playing",
      description: "A mini player you drag up into the full player. Skip bubbles bud out of play only once it is open.",
      source: { registry: "free", name: "NowPlaying" },
      docs: "/docs/components/media/now-playing",
      icon: "music.note",
      concepts: ["state", "binding", "gesture", "animation", "piece"],
      interactions: ["drag", "expand", "toggle", "scrub", "haptic", "spring"],
      properties: [
        text("title", "Title", "Slow mornings", { maxLength: 40 }),
        text("artist", "Artist", "House palette", { maxLength: 40 }),
        bool("playing", "Playing", true, { group: "state" }),
        bool("expanded", "Open", false, { group: "state" }),
        bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" }),
      ],
      states: [
        { id: "mini", label: "Mini", props: { expanded: false, playing: true } },
        { id: "open", label: "Open", props: { expanded: true, playing: true } },
      ],
      anatomy: [
        { part: "Track", props: ["title", "artist"] },
        { part: "Player", props: ["playing", "expanded", "haptics"] },
      ],
      swift: {
        imports: [],
        emit(p, ctx) {
          const playing = ctx.state("playing", "Bool", b(p, "playing") ? "true" : "false");
          const progress = ctx.state("track", "Double", "0.32");
          const expanded = ctx.state("playerOpen", "Bool", b(p, "expanded") ? "true" : "false");
          return {
            lines: call("NowPlaying", [
              ["title", str(s(p, "title") || "Slow mornings")],
              ["artist", str(s(p, "artist") || "House palette")],
              ["symbol", str("sun.max.fill")],
              ["isPlaying", `$${playing}`],
              ["progress", `$${progress}`],
              ["expanded", `$${expanded}`],
              !b(p, "haptics") && ["haptics", "false"],
            ]),
          };
        },
      },
    }),
  },
  {
    fill: true,
    definition: piece({
      component: "wallet-stack",
      id: "wallet-stack",
      name: "Wallet Stack",
      description: "Passes that melt into one glass shape, fan apart when you drag up, and lift when you tap one.",
      source: { registry: "free", name: "WalletStack" },
      docs: "/docs/components/cards/wallet-stack",
      icon: "creditcard",
      concepts: ["state", "binding", "gesture", "animation", "piece"],
      interactions: ["drag", "tap", "expand", "haptic", "spring"],
      properties: [bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" })],
      anatomy: [{ part: "Feel", props: ["haptics"] }],
      swift: {
        imports: [],
        emit(p, ctx) {
          const selection = ctx.state("pass", "String?", "nil");
          const cards = [
            `.init(id: "rail", name: "Rail pass", detail: "Kansai, 7 days", symbol: "tram.fill", tint: Color(red: 1, green: 0.851, blue: 0.463))`,
            `.init(id: "ferry", name: "Ferry", detail: "Miyajima, noon", symbol: "ferry.fill", tint: Color(red: 0.612, green: 0.761, blue: 1))`,
            `.init(id: "inn", name: "Inn", detail: "Two nights", symbol: "house.fill", tint: Color(red: 0.663, green: 0.863, blue: 0.718))`,
            `.init(id: "museum", name: "Museum", detail: "Timed entry", symbol: "ticket.fill", tint: Color(red: 0.804, green: 0.722, blue: 1))`,
          ].join(", ");
          return { lines: call("WalletStack", [["cards", `[${cards}]`], ["selection", `$${selection}`], !b(p, "haptics") && ["haptics", "false"]]) };
        },
      },
    }),
  },
  {
    fill: true,
    definition: piece({
      component: "notice-stack",
      id: "notice-stack",
      name: "Notice Stack",
      description: "A pile of glass notices. Flick the top one away, or tap to fan them into their own bubbles.",
      source: { registry: "free", name: "NoticeStack" },
      docs: "/docs/components/sheets/notice-stack",
      icon: "bell",
      concepts: ["state", "binding", "gesture", "animation", "piece"],
      interactions: ["swipe", "tap", "expand", "haptic", "spring"],
      properties: [bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" })],
      anatomy: [{ part: "Feel", props: ["haptics"] }],
      swift: {
        imports: [],
        emit(p, ctx) {
          const notices = ctx.state(
            "notices",
            "[NoticeStack.Notice]",
            '[.init(id: "gate", title: "Gate changed", message: "Boarding is now B12.", symbol: "airplane"), .init(id: "rain", title: "Rain at four", message: "The river walk is still fine.", symbol: "cloud.rain.fill"), .init(id: "table", title: "Table held", message: "Under the lanterns, for two.", symbol: "fork.knife")]',
          );
          const expanded = ctx.state("fan", "Bool", "false");
          return { lines: call("NoticeStack", [["notices", `$${notices}`], ["expanded", `$${expanded}`], !b(p, "haptics") && ["haptics", "false"]]) };
        },
      },
    }),
  },
  {
    fill: true,
    definition: piece({
      component: "range-lens",
      id: "range-lens",
      name: "Range Lens",
      description: "Drag a glass window across a series, or grab either edge to resize it. A readout buds off the lens while you drag.",
      source: { registry: "free", name: "RangeLens" },
      docs: "/docs/components/data/range-lens",
      icon: "chart.bar",
      concepts: ["state", "binding", "gesture", "animation", "piece"],
      interactions: ["drag", "scrub", "haptic"],
      properties: [
        number("lower", "Start", 22, 0, 90, 1, { group: "state" }),
        number("upper", "End", 68, 10, 100, 1, { group: "state" }),
        bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction" }),
      ],
      anatomy: [{ part: "Window", props: ["lower", "upper", "haptics"] }],
      swift: {
        imports: [],
        emit(p, ctx) {
          const lower = ctx.state("lower", "Double", num((n(p, "lower") || 0) / 100));
          const upper = ctx.state("upper", "Double", num((n(p, "upper") || 0) / 100));
          const samples = "[0.2, 0.35, 0.55, 0.4, 0.7, 0.9, 0.6, 0.45, 0.8, 0.5, 0.3, 0.65, 0.85, 0.4, 0.25, 0.55, 0.75, 0.95, 0.6, 0.35]";
          return { lines: call("RangeLens", [["samples", samples], ["lower", `$${lower}`], ["upper", `$${upper}`], !b(p, "haptics") && ["haptics", "false"]]) };
        },
      },
    }),
  },
];
