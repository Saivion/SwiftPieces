// Photo Mosaic: a collection shown as a collage of its photos (one tall, two stacked, one tall)
// with its name, a count and a badge under it. A room of plants, an album, a trip. Tap to open. Until
// real photos go in, each tile is a flat house colour with the collection's mark.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, list, num, str } from "../../core/swift.js";
import { ARTS } from "../native.js";
import { icon, link, number, text } from "../shared.js";
import { construct, linkAction, rgb } from "./emit-link-action.js";
import { own } from "../../core/own.js";
import { artworkGround, isArtwork, swiftArtwork } from "./artwork.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const I = (d: number) => INDENT.repeat(d);

/** The house solids: a flat fill with the mark on it, never a gradient. The light ones take a dark mark. */
export const SOLID_ARTS = new Set(["red", "ember", "blush", "azure", "sky", "butter", "sage", "lilac", "sand", "ink"]);
const LIGHT_SOLIDS = new Set(["blush", "sky", "butter", "sage", "lilac", "sand"]);
/** A tile's fill stops (a solid repeats its one colour) and the colour of the mark drawn on it. */
export function mosaicTile(art: string): { stops: string[]; mark: string } {
  // A drawing (a plant, a scene) sits on its own pastel and needs no mark.
  if (isArtwork(art)) return { stops: [artworkGround(art), artworkGround(art)], mark: "" };
  const a = own(ARTS, art) ?? ARTS.graphite;
  const solid = SOLID_ARTS.has(art);
  return { stops: solid ? [a.stops[1], a.stops[1]] : [...a.stops], mark: LIGHT_SOLIDS.has(art) ? "rgba(20,20,20,.38)" : "rgba(255,255,255,.4)" };
}

/** Four tiles' art, cycling what's given. */
export function mosaicArts(p: Props): string[] {
  const given = list(p.arts, 4).filter((a) => own(ARTS, a) || isArtwork(a));
  const arts = given.length ? given : ["sage", "butter", "sky", "sand"];
  return [0, 1, 2, 3].map((i) => arts[i % arts.length]);
}

const STRUCT = (): string[] => [
  "/// A collection as a collage of its photos, with its name, a count and a badge.",
  "private struct PhotoMosaic: View {",
  `${I(1)}/// Stand-ins for the collection's photos: a fill per tile. Swap in Image("…").`,
  `${I(1)}let tiles: [[Color]]`,
  `${I(1)}/// The mark's colour on each tile.`,
  `${I(1)}var marks: [Color] = []`,
  `${I(1)}/// A drawing per tile, in place of the mark (nil keeps the mark).`,
  `${I(1)}var pictures: [AnyView?] = []`,
  `${I(1)}var radius: CGFloat = 18`,
  `${I(1)}let title: String`,
  `${I(1)}var subtitle = ""`,
  `${I(1)}var badge = ""`,
  `${I(1)}var symbol = "leaf.fill"`,
  `${I(1)}var height: CGFloat = 150`,
  `${I(1)}var onOpen: () -> Void = {}`,
  `${I(1)}@State private var opens = 0`,
  `${I(1)}@State private var shown = false`,
  `${I(1)}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  "",
  `${I(1)}var body: some View {`,
  `${I(2)}Button {`,
  `${I(3)}opens += 1`,
  `${I(3)}onOpen()`,
  `${I(2)}} label: {`,
  `${I(3)}VStack(alignment: .leading, spacing: 8) {`,
  `${I(4)}HStack(spacing: 3) {`,
  `${I(5)}tile(0).frame(maxWidth: .infinity)`,
  `${I(5)}VStack(spacing: 3) {`,
  `${I(6)}tile(1)`,
  `${I(6)}tile(2)`,
  `${I(5)}}`,
  `${I(5)}.frame(maxWidth: .infinity)`,
  `${I(5)}tile(3).frame(maxWidth: .infinity)`,
  `${I(4)}}`,
  `${I(4)}.frame(height: height)`,
  `${I(4)}.clipShape(.rect(cornerRadius: radius, style: .continuous))`,
  `${I(4)}.scaleEffect(shown || reduceMotion ? 1 : 0.95)`,
  `${I(4)}.opacity(shown ? 1 : 0)`,
  `${I(4)}HStack(alignment: .firstTextBaseline) {`,
  `${I(5)}VStack(alignment: .leading, spacing: 2) {`,
  `${I(6)}Text(title).font(.headline)`,
  `${I(6)}if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) }`,
  `${I(5)}}`,
  `${I(5)}Spacer()`,
  `${I(5)}if !badge.isEmpty {`,
  `${I(6)}Text(badge)`,
  `${I(7)}.font(.caption2.weight(.semibold))`,
  `${I(7)}.foregroundStyle(.white)`,
  `${I(7)}.padding(.horizontal, 8)`,
  `${I(7)}.padding(.vertical, 4)`,
  `${I(7)}.background(Color(red: 1, green: 0, blue: 0), in: .capsule)`,
  `${I(5)}}`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(2)}}`,
  `${I(2)}.buttonStyle(MosaicPressStyle())`,
  `${I(2)}.onAppear { withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true } }`,
  `${I(2)}.sensoryFeedback(.impact(weight: .light), trigger: opens)`,
  `${I(1)}}`,
  "",
  `${I(1)}private func tile(_ index: Int) -> some View {`,
  `${I(2)}LinearGradient(colors: tiles[index % tiles.count], startPoint: .topLeading, endPoint: .bottomTrailing)`,
  `${I(3)}.overlay {`,
  `${I(4)}if index < pictures.count, let picture = pictures[index] {`,
  `${I(5)}picture.padding(.horizontal, 6).padding(.top, 10)`,
  `${I(4)}} else if !symbol.isEmpty {`,
  `${I(5)}Image(systemName: symbol)`,
  `${I(6)}.font(.system(size: 34))`,
  `${I(6)}.foregroundStyle(index < marks.count ? marks[index] : .white.opacity(0.4))`,
  `${I(6)}.rotationEffect(.degrees(Double(index) * 38 - 30))`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(1)}}`,
  "}",
  "",
  "/// Presses the collage in while a finger is down and springs it back.",
  "private struct MosaicPressStyle: ButtonStyle {",
  `${I(1)}func makeBody(configuration: Configuration) -> some View {`,
  `${I(2)}configuration.label`,
  `${I(3)}.scaleEffect(configuration.isPressed ? 0.97 : 1)`,
  `${I(3)}.animation(.easeOut(duration: configuration.isPressed ? 0.12 : 0.2), value: configuration.isPressed)`,
  `${I(1)}}`,
  "}",
];

export const photoMosaic: SwiftPieceDefinition = {
  id: "photo-mosaic",
  name: "Photo Mosaic",
  category: "pieces",
  description: "A collection as a collage of its photos, one tall, two stacked, one tall, with its name, a count and a badge. Tap it to open the collection.",
  availability: "free",
  preview: { component: "photo-mosaic", chunk: "app-pieces" },
  icon: "photo",
  concepts: ["hstack", "vstack", "button"],
  interactions: ["tap", "press", "spring", "haptic", "push"],
  anatomy: [
    { part: "Collage", props: ["arts", "symbol", "height"] },
    { part: "Caption", props: ["title", "subtitle", "badge"] },
    { part: "Interaction", props: ["link"] },
  ],
  properties: [
    text("arts", "Photos", "sage, butter, sky, sand", { maxLength: 80, hint: "Up to four, one per tile: a drawing (monstera, snake, rubber, fiddle, pothos, cactus, peperomia) on its pastel, a flat house colour (red, ember, blush, azure, sky, butter, sage, lilac, sand, ink) or a photo stand-in such as graphite." }),
    icon("symbol", "Mark", "leaf"),
    text("title", "Title", "Studio", { maxLength: 40 }),
    text("subtitle", "Subtitle", "6 plants", { maxLength: 40 }),
    text("badge", "Badge", "3 due", { maxLength: 20, hint: "Leave empty for none." }),
    number("height", "Collage height", 150, 90, 320, 1, { group: "layout" }),
    number("radius", "Corner radius", 18, 0, 32, 1, { group: "layout" }),
    link("link", "Tapping opens"),
  ],
  variants: [
    { id: "room", label: "Room", props: { arts: "sage, butter, sky, sand", title: "Studio", subtitle: "6 plants", badge: "3 due" } },
    { id: "album", label: "Album", props: { arts: "azure, blush, sky, ember", symbol: "photo", title: "Lisbon", subtitle: "86 photos", badge: "" } },
    { id: "tall", label: "Tall", props: { height: 240, badge: "" } },
  ],
  states: [{ id: "no-badge", label: "Nothing due", props: { badge: "" } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("PhotoMosaic", STRUCT());
      const arts = mosaicArts(p);
      const parts = arts.map(mosaicTile);
      const pictures = arts.map((a) => swiftArtwork(ctx, a));
      const tiles = parts.map((t) => `[${t.stops.map(rgb).join(", ")}]`);
      const markColor = (m: string) => (m.startsWith("rgba(20") ? "Color(red: 0.078, green: 0.078, blue: 0.078, opacity: 0.38)" : ".white.opacity(0.4)");
      const action = linkAction(ctx, p.link);
      const sym = ctx.symbol(s(p, "symbol"));
      return {
        lines: construct("PhotoMosaic", [
          [`tiles: [`, ...tiles.map((t) => `${INDENT}${t},`), "]"],
          parts.some((t) => t.mark.startsWith("rgba(20")) && `marks: [${parts.map((t) => markColor(t.mark)).join(", ")}]`,
          pictures.some(Boolean) && `pictures: [${pictures.map((x) => (x ? `AnyView(${x})` : "nil")).join(", ")}]`,
          n(p, "radius") !== 18 && p.radius !== undefined && `radius: ${num(n(p, "radius"))}`,
          `title: ${str(s(p, "title"))}`,
          s(p, "subtitle").trim() && `subtitle: ${str(s(p, "subtitle").trim())}`,
          s(p, "badge").trim() && `badge: ${str(s(p, "badge").trim())}`,
          s(p, "symbol") === "none" ? `symbol: ""` : sym !== "leaf" && `symbol: ${str(sym)}`,
          n(p, "height") !== 150 && `height: ${num(n(p, "height"))}`,
          action && `onOpen: ${action}`,
        ]),
      };
    },
  },
};
