// Place Map: a drawn city map (two rivers, a park, a street grid, district names) with numbered or
// symbol pins for saved places and optional distance rings around the first one. Drag to pan it,
// tap a pin to call out its name, tap the locate button to spring back. Graphite (the Swift Pieces
// look, following the colour scheme: near-black or pale paper, the stay in signal red and the other
// places on house blocks), day or night. A pan rubber-bands at the edges and a flick springs to
// where it was heading. The SwiftUI
// is written inline: the map is drawn in a 400-point square, scaled to fill its frame and clipped.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, list, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";
import { swiftSignal } from "../../core/palette.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** The map, in a 400 × 400 square (absolute M/L/C/Z only, so the web and Swift draw the same). */
export const PLACE_MAP = {
  rivers: [
    "M 92 -10 L 146 -10 C 136 140 124 262 66 410 L -10 410 L -10 330 C 44 262 80 150 92 -10 Z",
    "M 300 -10 L 352 -10 C 334 140 324 262 336 410 L 284 410 C 272 262 282 140 300 -10 Z",
  ],
  park: "M 206 44 L 248 36 L 266 146 L 224 154 Z",
  /**
   * Where pins go, in order, and where district names sit. The first is the centre of the rings;
   * the rest step out around it at different distances and angles, far enough apart that their
   * names never run into each other or into the ring labels, which sit to the right of the centre.
   */
  slots: [[214, 228], [166, 168], [266, 154], [160, 292], [272, 298], [158, 112], [214, 344], [362, 232]] as Array<[number, number]>,
  areas: [[72, 104, 13], [64, 250, 13], [64, 352, 15], [228, 392, 26]] as Array<[number, number, number]>,
  rings: [40, 82, 124],
};

export type PlaceColors = { land: string; water: string; park: string; street: string; label: string; ring: string };
export const PLACE_COLORS: Record<string, PlaceColors> = {
  graphite: { land: "#141416", water: "#10213F", park: "#1B2620", street: "#26262B", label: "#8A8A90", ring: "#FFFFFF" },
  light: { land: "#ECE9E1", water: "#A9D6F5", park: "#CFE7C4", street: "#FFFFFF", label: "#7C818A", ring: "#3A3A3C" },
  dark: { land: "#1C2533", water: "#0C1524", park: "#1C3427", street: "#2B3749", label: "#8C96A8", ring: "#C8CED8" },
};
export const PIN_COLORS = ["#FF2D55", "#FF9500", "#E0284A", "#AF52DE", "#FF2D55", "#FF9F0A", "#34C759", "#FF375F"];
/** Graphite in the light scheme: pale paper ground, sky water, sage park. */
export const PLACE_GRAPHITE_LIGHT: PlaceColors = { land: "#F4F3EF", water: "#CFE0F7", park: "#DCEBD6", street: "#FFFFFF", label: "#8A8A8E", ring: "#3A3A3C" };
/** Graphite pins: the stay (the first) in signal red, the other places on the house blocks with dark ink. */
export const PIN_SWEEP = ["#FF0000", "#9CC2FF", "#FFD976", "#A9DCB7", "#CDB8FF", "#E9D5B3", "#FF8FB8", "#FF7A3C"];
export const PIN_INK_DARK = "#141414";
/** Graphite follows the colour scheme; day and night are fixed. */
export const placeColors = (appearance: string, scheme: "dark" | "light" = "dark") =>
  (appearance === "graphite" || !PLACE_COLORS[appearance]) && scheme === "light" ? PLACE_GRAPHITE_LIGHT : PLACE_COLORS[appearance] ?? PLACE_COLORS.graphite;
/** Pin labels and callouts read light on dark maps. */
export const placeIsDark = (appearance: string, scheme: "dark" | "light" = "dark") => (appearance === "light" ? false : appearance === "dark" ? true : scheme === "dark");
export const PIN_SYMBOLS = ["bag", "fork.knife", "building.columns", "cup.and.saucer", "music.note", "mappin", "star", "bed.double"];
/**
 * Colours a pin can ask for by name: signal red, the sweep and the house blocks. The pale ones take
 * dark ink, signal and azure take white.
 */
export const PIN_TINTS: Record<string, string> = { signal: "#FF0000", ember: "#FF7A3C", blush: "#FF8FB8", azure: "#4D8DFF", sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", lilac: "#CDB8FF", sand: "#E9D5B3" };
const WHITE_INK = new Set([PIN_TINTS.signal, PIN_TINTS.azure]);

export type PlacePin = { name: string; x: number; y: number; color: string; ink: string; symbol: string; number: number };

/**
 * Pins from "Hotel Wren, Corner Bakery, …": each takes the next slot, colour and symbol. A place can
 * name its own symbol and colour, in the same order ("bed.double, cup.and.saucer, …" and "signal,
 * butter, …"), so a pin wears its kind; an unnamed one keeps the defaults.
 */
export function placePins(value: unknown, appearance = "graphite", symbols?: unknown, tints?: unknown): PlacePin[] {
  const fills = appearance === "light" || appearance === "dark" ? PIN_COLORS : PIN_SWEEP;
  const sweep = fills === PIN_SWEEP;
  const ownSymbols = list(symbols, 8);
  const ownTints = list(tints, 8);
  return list(value, 8).map((name, i) => {
    // Own keys only: typed text like "constructor" must never reach an inherited property.
    const key = ownTints[i] ?? "";
    const asked = Object.prototype.hasOwnProperty.call(PIN_TINTS, key) ? PIN_TINTS[key] : undefined;
    const ink = asked ? (WHITE_INK.has(asked) ? "#FFFFFF" : PIN_INK_DARK) : sweep && i > 0 ? PIN_INK_DARK : "#FFFFFF";
    return { name, x: PLACE_MAP.slots[i][0], y: PLACE_MAP.slots[i][1], color: asked ?? fills[i], ink, symbol: ownSymbols[i] || PIN_SYMBOLS[i], number: [7, 9, 3, 5, 2, 4, 6, 8][i] };
  });
}

/** Street lines: one grid tilted along the island, as segments. */
export function placeStreets(): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let k = -12; k <= 12; k++) {
    const x = 200 + k * 26;
    out.push([x + 60, -20, x - 60, 420]);
    const y = 200 + k * 26;
    out.push([-20, y - 30, 420, y + 30]);
  }
  return out;
}

function swiftPath(d: string): string[] {
  const t = d.trim().split(/\s+/);
  const out: string[] = [];
  const pt = (x: string, y: string) => `CGPoint(x: ${x}, y: ${y})`;
  let i = 0;
  while (i < t.length) {
    const c = t[i++];
    if (c === "M") out.push(`p.move(to: ${pt(t[i++], t[i++])})`);
    else if (c === "L") out.push(`p.addLine(to: ${pt(t[i++], t[i++])})`);
    else if (c === "C") {
      const a = t[i++], b = t[i++], c2 = t[i++], d2 = t[i++], x = t[i++], y = t[i++];
      out.push(`p.addCurve(to: ${pt(x, y)}, control1: ${pt(a, b)}, control2: ${pt(c2, d2)})`);
    } else if (c === "Z") out.push("p.closeSubpath()");
  }
  return out;
}

const hex = (h: string) => {
  const v = h.replace("#", "");
  const sig = swiftSignal(v);
  if (sig) return sig;
  const c = (i: number) => Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000;
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
};

export const placeMap: SwiftPieceDefinition = {
  id: "place-map",
  name: "Place Map",
  category: "pieces",
  description: "A drawn city map with numbered or symbol pins for saved places and optional distance rings. Drag to pan, tap a pin to call out its name, tap locate to spring back.",
  availability: "free",
  preview: { component: "place-map", chunk: "app-pieces" },
  icon: "map",
  concepts: ["state", "zstack", "gesture", "spring"],
  interactions: ["drag", "tap", "select", "spring", "haptic"],
  anatomy: [
    { part: "Map", props: ["appearance", "areas", "height"] },
    { part: "Pins", props: ["pins", "marker", "selected"] },
    { part: "Rings", props: ["rings"] },
    { part: "Controls", props: ["controls"] },
  ],
  properties: [
    select("appearance", "Map", "graphite", opts(["graphite", "Graphite"], ["light", "Day"], ["dark", "Night"])),
    text("pins", "Places", "Hotel Wren, Corner Bakery, River Gallery, Night Market, Glass Pier", { maxLength: 200, hint: "Up to eight, separated by commas. The first is the centre of the rings." }),
    select("marker", "Pins", "numbers", opts(["numbers", "Numbers"], ["symbols", "Symbols"])),
    text("symbols", "Pin symbols", "", { maxLength: 200, hint: "Optional: one symbol per place, in the same order, like bed.double, cup.and.saucer.", when: { prop: "marker", equals: ["symbols"] } }),
    text("tints", "Pin colours", "", { maxLength: 120, hint: "Optional: one colour per place, in the same order: signal, ember, blush, azure, sky, butter, sage, lilac or sand." }),
    bool("rings", "Distance rings", true),
    text("areas", "District names", "Northbank, Millside, Canal Row, Old Town", { maxLength: 100, hint: "Four names, the last one large." }),
    bool("controls", "Map buttons", true),
    number("selected", "Called out", -1, -1, 7, 1, { group: "state", hint: "A pin to start with its name called out; -1 for none." }),
    number("height", "Height", 420, 180, 700, 10, { group: "layout" }),
  ],
  variants: [
    { id: "graphite", label: "Graphite, with rings", props: { appearance: "graphite", marker: "numbers", rings: true } },
    { id: "day", label: "Day, with rings", props: { appearance: "light", marker: "numbers", rings: true } },
    { id: "night", label: "Night, symbols", props: { appearance: "dark", marker: "symbols", rings: false, pins: "Corner Bakery, Low Room, Print Museum, Fern Hall, Wine Cellar" } },
    { id: "plain", label: "No buttons", props: { controls: false, rings: false, height: 260 } },
  ],
  states: [
    { id: "none", label: "Nothing called out", props: { selected: -1 } },
    { id: "callout", label: "A pin called out", props: { selected: 0 } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const pins = placePins(p.pins, s(p, "appearance"), p.symbols, p.tints);
      ctx.declare("place-map:view", PLACE_SWIFT);
      const c = placeColors(s(p, "appearance"));
      const follows = s(p, "appearance") === "graphite" || !PLACE_COLORS[s(p, "appearance")];
      const L = PLACE_GRAPHITE_LIGHT;
      const areas = list(p.areas, 4);
      const sel = Math.round(n(p, "selected"));
      return {
        lines: [
          "PlaceMap(",
          `${INDENT}colors: .init(land: ${hex(c.land)}, water: ${hex(c.water)}, park: ${hex(c.park)}, street: ${hex(c.street)}, label: ${hex(c.label)}, ring: ${hex(c.ring)}),`,
          ...(follows ? [`${INDENT}lightColors: .init(land: ${hex(L.land)}, water: ${hex(L.water)}, park: ${hex(L.park)}, street: ${hex(L.street)}, label: ${hex(L.label)}, ring: ${hex(L.ring)}),`] : [`${INDENT}dark: ${s(p, "appearance") === "dark"},`]),
          `${INDENT}pins: [`,
          ...pins.map((pin) => `${INDENT}${INDENT}.init(name: ${str(pin.name)}, x: ${pin.x}, y: ${pin.y}, color: ${hex(pin.color)}${pin.ink !== "#FFFFFF" ? `, ink: ${hex(pin.ink)}` : ""}, symbol: ${str(pin.symbol)}, number: ${pin.number}),`),
          `${INDENT}],`,
          `${INDENT}areas: [${areas.map((a, i) => `.init(text: ${str(a)}, x: ${PLACE_MAP.areas[i][0]}, y: ${PLACE_MAP.areas[i][1]}, size: ${PLACE_MAP.areas[i][2]})`).join(", ")}],`,
          `${INDENT}symbols: ${s(p, "marker") === "symbols"},`,
          `${INDENT}rings: ${p.rings === true},`,
          `${INDENT}controls: ${p.controls === true},`,
          `${INDENT}selected: ${sel >= 0 && sel < pins.length ? sel : "nil"}`,
          ")",
          `.frame(height: ${num(n(p, "height"))})`,
          `.clipShape(RoundedRectangle(cornerRadius: ${num(ctx.corner(20))}, style: .continuous))`,
        ],
      };
    },
  },
};

const I = INDENT;
const PLACE_SWIFT = [
  "private struct PlaceMap: View {",
  "    struct Colors { let land, water, park, street, label, ring: Color }",
  "    struct Pin { let name: String; let x: CGFloat; let y: CGFloat; let color: Color; var ink: Color = .white; let symbol: String; let number: Int }",
  "    struct Area { let text: String; let x: CGFloat; let y: CGFloat; let size: CGFloat }",
  "",
  "    let colors: Colors",
  "    /// The light-scheme map, when it follows the colour scheme.",
  "    var lightColors: Colors? = nil",
  "    /// Whether the map is dark (names read light over it); nil follows the colour scheme.",
  "    var dark: Bool? = nil",
  "    let pins: [Pin]",
  "    let areas: [Area]",
  "    let symbols: Bool",
  "    let rings: Bool",
  "    let controls: Bool",
  "    @State var selected: Int?",
  "    @State private var pan: CGSize = .zero",
  "    @State private var start: CGSize = .zero",
  "    @State private var appeared = false",
  "    @State private var recenters = 0",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @Environment(\\.colorScheme) private var colorScheme",
  "",
  "    private var palette: Colors { colorScheme == .light ? (lightColors ?? colors) : colors }",
  "    private var isDark: Bool { dark ?? (colorScheme == .dark) }",
  "",
  "    var body: some View {",
  "        GeometryReader { geo in",
  "            let k = max(geo.size.width, geo.size.height) / 400",
  "            map",
  "                .frame(width: 400, height: 400)",
  "                .scaleEffect(k)",
  "                .offset(pan)",
  "                .frame(width: geo.size.width, height: geo.size.height)",
  "                .clipped()",
  "                .contentShape(Rectangle())",
  "                .gesture(",
  "                    DragGesture()",
  "                        .onChanged { v in",
  "                            pan = CGSize(width: rubber(start.width + v.translation.width), height: rubber(start.height + v.translation.height))",
  "                        }",
  "                        .onEnded { v in",
  "                            // Where the flick was heading, kept inside the map, reached with a spring.",
  "                            let home = CGSize(width: clamp(start.width + v.predictedEndTranslation.width), height: clamp(start.height + v.predictedEndTranslation.height))",
  "                            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.15)) { pan = home }",
  "                            start = home",
  "                        }",
  "                )",
  "                .overlay(alignment: .topTrailing) {",
  "                    if controls {",
  "                        VStack(spacing: 4) {",
  "                            Image(systemName: \"map\").frame(width: 44, height: 40)",
  "                            Button {",
  "                                recenters += 1",
  "                                withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.25)) { pan = .zero; start = .zero }",
  "                            } label: {",
  "                                Image(systemName: \"location\").frame(width: 44, height: 40)",
  "                            }",
  "                            .buttonStyle(PlaceMapPress())",
  "                        }",
  "                        .font(.body.weight(.semibold))",
  "                        .foregroundStyle(.primary)",
  "                        .padding(.vertical, 4)",
  "                        .background(.regularMaterial, in: Capsule())",
  "                        .padding(12)",
  "                    }",
  "                }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: selected)",
  "        .sensoryFeedback(.impact(weight: .light), trigger: recenters)",
  "        .onAppear { appeared = true }",
  "    }",
  "",
  "    private func rubber(_ x: CGFloat) -> CGFloat {",
  "        let limit: CGFloat = 90",
  "        guard abs(x) > limit else { return x }",
  "        return (x > 0 ? 1 : -1) * (limit + (abs(x) - limit) * 0.3)",
  "    }",
  "",
  "    private func clamp(_ x: CGFloat) -> CGFloat { max(-90, min(90, x)) }",
  "",
  "    private var map: some View {",
  "        ZStack(alignment: .topLeading) {",
  "            palette.land",
  "            Path { p in",
  ...PLACE_MAP.rivers.flatMap((d) => swiftPath(d).map((l) => `                ${l}`)),
  "            }",
  "            .fill(palette.water)",
  "            Path { p in",
  ...swiftPath(PLACE_MAP.park).map((l) => `                ${l}`),
  "            }",
  "            .fill(palette.park)",
  "            Path { p in",
  "                for k in -12...12 {",
  "                    let x = 200 + CGFloat(k) * 26",
  "                    p.move(to: CGPoint(x: x + 60, y: -20))",
  "                    p.addLine(to: CGPoint(x: x - 60, y: 420))",
  "                    let y = 200 + CGFloat(k) * 26",
  "                    p.move(to: CGPoint(x: -20, y: y - 30))",
  "                    p.addLine(to: CGPoint(x: 420, y: y + 30))",
  "                }",
  "            }",
  "            .stroke(palette.street.opacity(0.8), lineWidth: 1.2)",
  "            ForEach(areas.indices, id: \\.self) { i in",
  "                Text(areas[i].text)",
  "                    .font(.system(size: areas[i].size, weight: .semibold))",
  "                    .foregroundStyle(palette.label)",
  "                    .fixedSize()",
  "                    .position(x: areas[i].x, y: areas[i].y)",
  "            }",
  "            if rings, let center = pins.first {",
  "                ForEach(Array([40, 82, 124].enumerated()), id: \\.offset) { i, r in",
  "                    Circle()",
  "                        .stroke(palette.ring.opacity(0.55), lineWidth: 1.4)",
  "                        .frame(width: CGFloat(r) * 2, height: CGFloat(r) * 2)",
  "                        .position(x: center.x, y: center.y)",
  "                    Text(\"\\(i + 1)mi\")",
  "                        .font(.system(size: 13, weight: .bold))",
  "                        .foregroundStyle(palette.ring)",
  "                        .position(x: center.x + CGFloat(r) + 14, y: center.y)",
  "                }",
  "            }",
  "            ForEach(pins.indices, id: \\.self) { i in",
  "                pin(i)",
  "            }",
  "        }",
  "    }",
  "",
  "    private func pin(_ i: Int) -> some View {",
  "        let pin = pins[i]",
  "        let on = selected == i",
  "        return VStack(spacing: 2) {",
  "            ZStack {",
  "                Circle().fill(pin.color)",
  "                Circle().stroke(.white, lineWidth: 2)",
  "                if symbols {",
  "                    Image(systemName: pin.symbol).font(.system(size: 12, weight: .bold))",
  "                } else {",
  "                    Text(\"\\(pin.number)\").font(.system(size: 13, weight: .bold))",
  "                }",
  "            }",
  "            .foregroundStyle(pin.ink)",
  "            .frame(width: 26, height: 26)",
  "            .shadow(color: .black.opacity(0.2), radius: 2, y: 1)",
  "            Text(pin.name)",
  "                .font(.system(size: on ? 13 : 10, weight: .bold))",
  "                .foregroundStyle(isDark ? Color.white : Color(white: 0.11))",
  "                .shadow(color: on ? .clear : (isDark ? .black : .white), radius: 2)",
  "                .lineLimit(1)",
  "                .padding(.horizontal, on ? 8 : 0)",
  "                .padding(.vertical, on ? 4 : 0)",
  "                .background(on ? AnyShapeStyle(.regularMaterial) : AnyShapeStyle(Color.clear), in: Capsule())",
  "                .frame(maxWidth: on ? 160 : 104)",
  "        }",
  "        // Entrance, once: pins settle in from 0.95 with a fade and a short drop, 40 ms apart.",
  "        .opacity(appeared ? 1 : 0)",
  "        .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "        .offset(y: appeared || reduceMotion ? 0 : -6)",
  "        .animation(.easeOut(duration: reduceMotion ? 0.2 : 0.28).delay(reduceMotion ? 0 : Double(min(i, 7)) * 0.04), value: appeared)",
  "        .scaleEffect(on ? 1.15 : 1)",
  "        .position(x: pin.x, y: pin.y + 10)",
  "        .onTapGesture {",
  "            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.35, bounce: 0.4)) { selected = on ? nil : i }",
  "        }",
  "    }",
  "}",
  "",
  "/// Press feedback for the map's buttons: 0.97 and a touch dimmer, under 150 ms.",
  "private struct PlaceMapPress: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .opacity(configuration.isPressed ? 0.6 : 1)",
  "            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)",
  "    }",
  "}",
];
