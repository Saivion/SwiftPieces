// Now Playing: the mini player that grows into the full player. A glass bar with the artwork, the title over
// the artist and a red progress hairline, with a red play bubble and forward joined to it; tap or pull it up and
// the same glass grows into a card with a scrubber, and previous and next bud out of play. The emitter holds the
// app's side of playback in `@State` (playing, the time, which track, whether the player is open), runs a small
// clock so the screen plays on its own, and calls `NowPlaying(title:artist:isPlaying:time:duration:expanded:…)`
// exactly as registry/swift/media/NowPlaying.swift declares it, writing only what differs from its defaults.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** The second track the sample queue skips to, shared with the Playground renderer. */
export const NOW_PLAYING_NEXT = { title: "Paper Lanterns", artist: "Aster Vale", duration: 245 } as const;
export const NOW_PLAYING_DEFAULTS = { title: "Slow Mornings", artist: "Aster Vale", duration: 222, position: 48 } as const;

/** The sample covers as the piece's example draws them, in a 100 x 100 space: a butter sun over a sage hill on sky,
 *  and lilac with three hanging lanterns. The renderer draws the same shapes. */
export const NOW_PLAYING_COVERS = {
  sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", sand: "#E9D5B3", lilac: "#CDB8FF", ink: "#141414",
  lanterns: [[26, 50, 15, "#FFD976"], [56, 36, 12, "#E9D5B3"], [78, 60, 10, "#9CC2FF"]] as const,
};

function artworkSwift(): string[] {
  const i = INDENT;
  return [
    "/// Sample covers drawn in code, so the screen runs without assets. In your app, show the track's artwork:",
    "/// `track.artwork.resizable().scaledToFill()`.",
    "struct SampleCover: View {",
    `${i}var track: Int`,
    "",
    `${i}var body: some View {`,
    `${i}${i}Canvas { context, size in`,
    `${i}${i}${i}let w = size.width, h = size.height`,
    `${i}${i}${i}func color(_ hex: UInt32) -> Color {`,
    `${i}${i}${i}${i}Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)`,
    `${i}${i}${i}}`,
    `${i}${i}${i}func land(_ y0: CGFloat, _ c1: CGPoint, _ c2: CGPoint, _ y1: CGFloat) -> Path {`,
    `${i}${i}${i}${i}var path = Path()`,
    `${i}${i}${i}${i}path.move(to: CGPoint(x: 0, y: h * y0))`,
    `${i}${i}${i}${i}path.addCurve(to: CGPoint(x: w, y: h * y1), control1: CGPoint(x: w * c1.x, y: h * c1.y), control2: CGPoint(x: w * c2.x, y: h * c2.y))`,
    `${i}${i}${i}${i}path.addLine(to: CGPoint(x: w, y: h))`,
    `${i}${i}${i}${i}path.addLine(to: CGPoint(x: 0, y: h))`,
    `${i}${i}${i}${i}path.closeSubpath()`,
    `${i}${i}${i}${i}return path`,
    `${i}${i}${i}}`,
    `${i}${i}${i}if track % 2 == 0 {`,
    `${i}${i}${i}${i}context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(color(0x9CC2FF)))`,
    `${i}${i}${i}${i}context.fill(Path(ellipseIn: CGRect(x: w * 0.52, y: h * 0.16, width: w * 0.3, height: w * 0.3)), with: .color(color(0xFFD976)))`,
    `${i}${i}${i}${i}context.fill(land(0.7, CGPoint(x: 0.3, y: 0.48), CGPoint(x: 0.62, y: 0.5), 0.62), with: .color(color(0xA9DCB7)))`,
    `${i}${i}${i}${i}context.fill(land(0.86, CGPoint(x: 0.36, y: 0.74), CGPoint(x: 0.7, y: 0.8), 0.84), with: .color(color(0xE9D5B3)))`,
    `${i}${i}${i}} else {`,
    `${i}${i}${i}${i}context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(color(0xCDB8FF)))`,
    `${i}${i}${i}${i}for (x, y, r, hex) in [(0.26, 0.5, 0.15, 0xFFD976), (0.56, 0.36, 0.12, 0xE9D5B3), (0.78, 0.6, 0.1, 0x9CC2FF)] as [(CGFloat, CGFloat, CGFloat, UInt32)] {`,
    `${i}${i}${i}${i}${i}context.fill(Path(CGRect(x: w * x - 0.4, y: 0, width: 0.8, height: h * (y - r))), with: .color(color(0x141414)))`,
    `${i}${i}${i}${i}${i}context.fill(Path(ellipseIn: CGRect(x: w * (x - r), y: h * y - w * r, width: w * r * 2, height: w * r * 2)), with: .color(color(hex)))`,
    `${i}${i}${i}${i}}`,
    `${i}${i}${i}}`,
    `${i}${i}}`,
    `${i}}`,
    "}",
  ];
}

export const definition: SwiftPieceDefinition = {
  id: "now-playing",
  name: "Now Playing",
  category: "pieces",
  description: "A mini player that grows into the full player. Tap or pull the glass bar up: it becomes a card with the artwork, a scrubber and previous and next, and folds back when dragged down.",
  availability: "free",
  preview: { component: "now-playing", chunk: "pieces-utility" },
  source: { registry: "free", name: "NowPlaying" },
  docs: "/docs/components/media/now-playing",
  icon: "music.note",
  concepts: ["state", "binding", "closure", "gesture", "async", "animation", "piece"],
  interactions: ["tap", "drag", "expand", "scrub", "toggle", "haptic", "spring", "transition"],
  properties: [
    text("title", "Title", NOW_PLAYING_DEFAULTS.title, { maxLength: 60, group: "content", hint: "The track, episode or station. It morphs letter by letter when it changes." }),
    text("artist", "Artist", NOW_PLAYING_DEFAULTS.artist, { maxLength: 60, group: "content", hint: "The artist, show or author under the title." }),
    select("artwork", "Artwork", "sample", opts(["sample", "Sample covers"], ["placeholder", "The house tile"]), { group: "content", hint: "Your app passes the track's own artwork." }),
    select("skipping", "Skip buttons", "tracks", opts(["tracks", "Previous and next track"], ["podcast", "Back 15, forward 30 seconds"], ["none", "None"]), { group: "interaction" }),
    bool("scrubs", "Scrubbing", true, { group: "interaction", hint: "Off makes the track a read-only progress bar." }),
    number("duration", "Length (seconds)", NOW_PLAYING_DEFAULTS.duration, 0, 7200, 1, { group: "content", hint: "0 is a live stream: no hairline, scrubber or times." }),
    number("position", "Starts at (seconds)", NOW_PLAYING_DEFAULTS.position, 0, 7200, 1, { level: "advanced", group: "state" }),
    bool("playing", "Playing", true, { group: "state" }),
    bool("expanded", "Starts open", false, { group: "state", hint: "Shows the full player as the screen opens." }),
  ],
  variants: [
    { id: "music", label: "Music", props: { title: "Slow Mornings", artist: "Aster Vale", artwork: "sample", skipping: "tracks", scrubs: true, duration: 222, position: 48 } },
    { id: "podcast", label: "Podcast", props: { title: "Episode 42: Gardens at Night", artist: "The Quiet Hour", artwork: "placeholder", skipping: "podcast", scrubs: true, duration: 3125, position: 610 } },
    { id: "radio", label: "Live radio", props: { title: "Harbour Radio", artist: "Live from Lisbon", artwork: "placeholder", skipping: "none", scrubs: false, duration: 0, position: 0 } },
  ],
  states: [
    { id: "mini", label: "Mini player", props: { expanded: false, playing: true } },
    { id: "open", label: "Full player", props: { expanded: true, playing: true } },
    { id: "paused", label: "Paused", props: { expanded: false, playing: false } },
  ],
  anatomy: [
    { part: "Track", props: ["title", "artist", "artwork", "duration"] },
    { part: "Transport", props: ["skipping", "playing"] },
    { part: "Scrubber", props: ["scrubs", "position"] },
    { part: "Player", props: ["expanded"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const title = s(p, "title").trim() || NOW_PLAYING_DEFAULTS.title;
      const artist = s(p, "artist").trim();
      const duration = Math.min(Math.max(Math.round(n(p, "duration")), 0), 7200);
      const position = Math.min(Math.max(Math.round(n(p, "position")), 0), duration || 7200);
      const skipping = s(p, "skipping");
      const tracks = skipping === "tracks";
      const sample = s(p, "artwork") !== "placeholder";

      const playing = ctx.state("playing", "Bool", b(p, "playing") ? "true" : "false");
      // A live stream has no position to show, so no clock either.
      const live = duration === 0;
      const time = live ? null : ctx.state("time", "TimeInterval", num(position));
      const open = ctx.state("showsPlayer", "Bool", b(p, "expanded") ? "true" : "false");
      // Skipping between tracks needs a queue; one track otherwise.
      const track = tracks ? ctx.state("track", "Int", "0") : null;
      const pick = (first: string, second: string) => (track && first !== second ? `${track} == 0 ? ${first} : ${second}` : first);
      const titleArg = pick(str(title), str(NOW_PLAYING_NEXT.title));
      const artistArg = pick(str(artist), str(NOW_PLAYING_NEXT.artist));
      const durationArg = pick(num(duration), num(NOW_PLAYING_NEXT.duration));
      if (sample) ctx.declare("SampleCover", artworkSwift());

      const head = call("NowPlaying", [
        ["title", titleArg],
        ["artist", artistArg],
        ["isPlaying", playing],
        ["time", time ?? "0"],
        ["duration", durationArg],
        ["expanded", `$${open}`],
        skipping === "podcast" && ["skipping", ".podcast"],
        // A Style accent reaches the play bubble, the hairline and the played part of the track.
        ctx.theme && ["style", ".init(accent: Theme.accent, accentInk: Theme.accentInk)"],
        ["onPlayPause", `{ ${playing}.toggle() }`],
        track && ["onSkip", time ? `{ _ in ${track} = (${track} + 1) % 2; ${time} = 0 }` : `{ _ in ${track} = (${track} + 1) % 2 }`],
        b(p, "scrubs") && time && ["onSeek", `{ ${time} = $0 }`],
      ]);
      const player = sample ? [...head.slice(0, -1), `${head[head.length - 1]} {`, `${INDENT}SampleCover(track: ${track ?? "0"})`, "}"] : head;
      // The app's player: here a clock that runs twice a second while playing. Yours reports its own time.
      // A mini player rides in the screen's bottom safe area inset: the content stops above the bar, and the card
      // opens over it. So it goes on the screen, and its place in the stack only says where it went.
      ctx.screenModifier([
        ".safeAreaInset(edge: .bottom) {",
        ...indent([
          ...player,
          ".padding(.horizontal, 12)",
          ".padding(.bottom, 8)",
          ...(time
            ? [
                `.task(id: ${playing}) {`,
                ...indent([
                  "// Stands in for your player, which reports its own time.",
                  `while ${playing}, !Task.isCancelled {`,
                  `${INDENT}try? await Task.sleep(for: .milliseconds(500))`,
                  `${INDENT}guard ${playing} else { break }`,
                  `${INDENT}${time} = min(${time} + 0.5, ${durationArg})`,
                  "}",
                ]),
                "}",
              ]
            : []),
        ]),
        "}",
      ]);
      return { lines: ["// Now Playing: the mini player in the screen's bottom safe area inset, below."] };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
