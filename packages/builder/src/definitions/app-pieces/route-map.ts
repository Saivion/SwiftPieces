// Route Map: a drawn map of North America with flight routes arcing between airports and a plane
// on each flight in the air. Drag across it to move the followed plane along its route; tap a
// plane to follow that one. The default Graphite style is the Swift Pieces look: near-black land on
// a darker sea, a faint lat/long grid, the followed route in signal red and the others in azure.
// Night globe, atlas and satellite styles remain, with an optional weather radar layer, initials
// pins for people on board, a speed and height badge, and rounded corners when it sits inset.
// Graphite follows the colour scheme (near-black in dark, pale paper in light); the routes you
// aren't following stay a quiet grey so the one accent marks the followed flight. Dragging the
// plane rubber-bands past either end and springs home with the release velocity.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, modifiers, num } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";
import { swiftHex } from "./data-kit.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

// ---------------------------------------------------------------- Geography (shared with the preview)

/** Map frame: longitude -170…-20, latitude 76…4, projected to MAP_W × MAP_H. */
export const MAP_W = 100;
export const MAP_H = 62;
export const project = (lon: number, lat: number): [number, number] => [((lon + 170) / 150) * MAP_W, ((76 - lat) / 72) * MAP_H];

export const AIRPORTS: Record<string, { city: string; lon: number; lat: number }> = {
  SFO: { city: "San Francisco", lon: -122.4, lat: 37.6 },
  LAX: { city: "Los Angeles", lon: -118.4, lat: 33.9 },
  JFK: { city: "New York", lon: -73.8, lat: 40.6 },
  MIA: { city: "Miami", lon: -80.3, lat: 25.8 },
  SEA: { city: "Seattle", lon: -122.3, lat: 47.4 },
  ORD: { city: "Chicago", lon: -87.9, lat: 42 },
  DEN: { city: "Denver", lon: -104.7, lat: 39.9 },
  BOS: { city: "Boston", lon: -71, lat: 42.4 },
  PHL: { city: "Philadelphia", lon: -75.2, lat: 39.9 },
  ATL: { city: "Atlanta", lon: -84.4, lat: 33.6 },
  DFW: { city: "Dallas", lon: -97, lat: 32.9 },
  LAS: { city: "Las Vegas", lon: -115.2, lat: 36.1 },
  SLC: { city: "Salt Lake City", lon: -112, lat: 40.8 },
  PHX: { city: "Phoenix", lon: -112, lat: 33.4 },
  MSP: { city: "Minneapolis", lon: -93.2, lat: 44.9 },
  AUS: { city: "Austin", lon: -97.7, lat: 30.2 },
  YYC: { city: "Calgary", lon: -114, lat: 51.1 },
  YVR: { city: "Vancouver", lon: -123.2, lat: 49.2 },
  MEX: { city: "Mexico City", lon: -99.1, lat: 19.4 },
  HNL: { city: "Honolulu", lon: -157.9, lat: 21.3 },
  YUL: { city: "Montréal", lon: -73.7, lat: 45.5 },
  YYZ: { city: "Toronto", lon: -79.6, lat: 43.7 },
  ANC: { city: "Anchorage", lon: -150, lat: 61.2 },
  PDX: { city: "Portland", lon: -122.6, lat: 45.6 },
  MSY: { city: "New Orleans", lon: -90.3, lat: 30 },
  SAN: { city: "San Diego", lon: -117.2, lat: 32.7 },
  NRT: { city: "Tokyo", lon: -205, lat: 38 },
  LHR: { city: "London", lon: 5, lat: 51.5 },
};

type LonLat = Array<[number, number]>;
/** Coarse coastlines, lon/lat, drawn as closed polygons. */
export const LAND: LonLat[] = [
  [[-168, 65], [-162, 70], [-150, 71], [-140, 69.5], [-128, 70], [-115, 68.5], [-100, 68], [-94, 72], [-82, 69], [-80, 63], [-88, 56], [-82, 52], [-78, 55], [-77, 60], [-70, 59], [-64, 60], [-61, 56], [-56, 52], [-60, 47], [-66, 45], [-70, 43.5], [-70, 41.5], [-74, 40.5], [-76, 38], [-75.5, 35], [-78, 33.8], [-81, 31.5], [-80, 27], [-80.3, 25.2], [-81.8, 26.5], [-83, 29], [-84.5, 30], [-88, 30.3], [-90, 29.2], [-94, 29.6], [-97.3, 27.5], [-97.5, 24], [-97.8, 22], [-96, 19], [-94.5, 18.2], [-91, 18.8], [-90.5, 21], [-87, 21.5], [-88, 18], [-88.5, 16], [-84, 15.5], [-83.5, 11], [-80, 8.5], [-78, 8], [-80, 7.3], [-83, 8.2], [-86, 11], [-88, 13.3], [-92, 14.5], [-95, 16], [-100, 17], [-105, 20], [-105.5, 23], [-109.5, 26.5], [-112.5, 29.5], [-114.5, 31], [-113.5, 29], [-110, 24], [-109.5, 23], [-112, 25], [-114.5, 28], [-115.8, 30.5], [-117, 32.5], [-118.5, 34], [-120.6, 34.6], [-122.5, 37.5], [-124, 40.5], [-124.5, 43], [-124, 46.5], [-124.7, 48.4], [-123, 49], [-127, 50.5], [-130, 54], [-133, 57], [-137, 58.5], [-141, 60], [-146, 60.8], [-150, 59.5], [-154, 57.5], [-158, 56], [-163, 54.8], [-160, 58.5], [-162, 60], [-165, 61.5], [-164.5, 63.5]],
  [[-73, 78], [-60, 82], [-35, 83], [-20, 80], [-18, 75], [-22, 70], [-32, 66], [-43, 60], [-48, 61], [-53, 66], [-54, 70], [-60, 76]],
  [[-85, 21.9], [-82, 23.1], [-77, 21.8], [-74.2, 20.1], [-77.7, 19.9], [-80, 21.8]],
  [[-77, 8], [-72, 12], [-64, 10.8], [-60, 8.5], [-52, 5], [-50, 0], [-45, -2], [-80, -2], [-78, 2]],
  [[-100, 73], [-85, 74], [-80, 73], [-90, 71], [-100, 71]],
  [[-125, 72], [-115, 73.5], [-108, 71], [-118, 70.5]],
];
export const landPaths = (): Array<Array<[number, number]>> => LAND.map((poly) => poly.map(([lo, la]) => project(lo, la)));

/** Patches of darker and lighter ground that make the land read as terrain. */
export const PATCHES: Array<{ lon: number; lat: number; r: number; tone: 0 | 1 | 2 }> = [
  { lon: -112, lat: 42, r: 7, tone: 1 }, { lon: -106, lat: 36, r: 6, tone: 1 }, { lon: -118, lat: 50, r: 6, tone: 2 },
  { lon: -95, lat: 40, r: 7, tone: 0 }, { lon: -85, lat: 35, r: 6, tone: 2 }, { lon: -100, lat: 57, r: 9, tone: 2 },
  { lon: -75, lat: 50, r: 7, tone: 2 }, { lon: -145, lat: 64, r: 8, tone: 1 }, { lon: -103, lat: 26, r: 6, tone: 1 },
  { lon: -120, lat: 38, r: 4, tone: 0 }, { lon: -80, lat: 42, r: 4, tone: 0 },
  { lon: -121.5, lat: 38.5, r: 1.2, tone: 1 }, { lon: -120.5, lat: 37, r: 1, tone: 0 }, { lon: -122.8, lat: 39.5, r: 1.1, tone: 0 },
  { lon: -119, lat: 35.5, r: 1.3, tone: 1 }, { lon: -117, lat: 34.5, r: 1.2, tone: 1 }, { lon: -115.5, lat: 36.5, r: 1.4, tone: 1 },
  { lon: -113.5, lat: 38.5, r: 1.2, tone: 2 }, { lon: -111, lat: 39.5, r: 1.3, tone: 0 }, { lon: -109, lat: 37, r: 1.1, tone: 1 },
  { lon: -106, lat: 40, r: 1.4, tone: 0 }, { lon: -112.5, lat: 34.5, r: 1.2, tone: 1 }, { lon: -110, lat: 42.5, r: 1.3, tone: 2 },
];

export type MapStyle = {
  label: string;
  ocean: [string, string];
  land: string;
  tones: [string, string, string];
  /** The followed route, and the others when `alt` is set. */
  route: string;
  alt?: string;
  space: string | null;
  /** A faint latitude and longitude grid over the sea and land, and a hairline along the coasts. */
  grid?: boolean;
  coast?: boolean;
  /** Radar cells from light to heavy, and the fills behind people's initials. */
  radar?: [string, string, string];
  pins?: string[];
  /** Initials ink on the pins. */
  pinInk?: string;
  /** Light-scheme ground, when the style follows the colour scheme. */
  light?: { ocean: [string, string]; land: string; tones: [string, string, string] };
};

export const RADAR_DEFAULT: [string, string, string] = ["#34C759", "#FFD60A", "#FF3B30"];
export const PIN_DEFAULT = ["#F5A25D", "#F07CA6", "#6FD6B4", "#F3D25B"];

/** The fill behind a route's initials: by position, or (styles with their own pins) by the initials, so a person keeps a colour. */
export function pinFill(st: MapStyle, initials: string, i: number): string {
  if (!st.pins) return PIN_DEFAULT[i % PIN_DEFAULT.length];
  return st.pins[[...initials].reduce((a, c, k) => a + c.charCodeAt(0) * (k + 1), 0) % st.pins.length];
}

export const MAP_STYLES: Record<string, MapStyle> = {
  // The Swift Pieces look: graphite land (pale paper in light), the followed route in signal red,
  // the others a quiet grey; radar from the sweep, people's pins from the house blocks.
  graphite: { label: "Graphite", ocean: ["#0A0A0C", "#070708"], land: "#1C1C20", tones: ["#19191D", "#222226", "#1F1F23"], route: "#FF0000", alt: "#8E8E93", space: null, grid: true, coast: true, radar: ["#4D8DFF", "#FF8FB8", "#FF7A3C"], pins: ["#9CC2FF", "#FFD976", "#A9DCB7", "#CDB8FF", "#E9D5B3"], pinInk: "#141414", light: { ocean: ["#E4E7EC", "#DDE1E7"], land: "#F7F6F2", tones: ["#EFEEE9", "#FBFAF7", "#ECEBE5"] } },
  globe: { label: "Night globe", ocean: ["#12365c", "#0a1f38"], land: "#3a5a34", tones: ["#2c4a2b", "#6b6a45", "#4d6b3c"], route: "#3d8bff", space: "#05070d" },
  atlas: { label: "Atlas", ocean: ["#5bb3ec", "#2f86d1"], land: "#8fca6c", tones: ["#79b85c", "#d8d98e", "#a9d67e"], route: "#2f7ff0", space: null },
  satellite: { label: "Satellite", ocean: ["#23455f", "#152f45"], land: "#56683a", tones: ["#3f5530", "#7d6c47", "#6a7b44"], route: "#3d8bff", space: null },
};

/** Grid lines every 10° of longitude and latitude, as map-unit segments. */
export function gridLines(): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let lon = -170; lon <= -20; lon += 10) {
    const a = project(lon, 90);
    const b = project(lon, -10);
    out.push([a[0], a[1], b[0], b[1]]);
  }
  for (let lat = 0; lat <= 80; lat += 10) {
    const a = project(-240, lat);
    const b = project(20, lat);
    out.push([a[0], a[1], b[0], b[1]]);
  }
  return out;
}

export type MapRoute = { from: string; to: string; plane: number | null };

/** "SEA-BOS@40, DEN-ATL" → routes; @n puts a plane n% of the way along. */
export function parseRoutes(value: unknown, max = 6): MapRoute[] {
  return String(value ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .map((r) => {
      const m = r.match(/^([A-Z]{3})\s*-\s*([A-Z]{3})(?:\s*@\s*(\d{1,3}))?$/);
      if (!m || !AIRPORTS[m[1]] || !AIRPORTS[m[2]]) return null;
      return { from: m[1], to: m[2], plane: m[3] != null ? Math.min(100, Number(m[3])) / 100 : null };
    })
    .filter((r): r is MapRoute => r !== null)
    .slice(0, max);
}

/** The arc from a to b: a quadratic curve bowed toward the pole, like a great circle on a flat map. */
export function arc(a: [number, number], b: [number, number]): { c: [number, number]; at(t: number): [number, number]; angle(t: number): number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const bow = len * 0.22;
  // Perpendicular, pointing up the map (toward smaller y).
  let px = -dy / (len || 1);
  let py = dx / (len || 1);
  if (py > 0) {
    px = -px;
    py = -py;
  }
  const c: [number, number] = [(a[0] + b[0]) / 2 + px * bow, (a[1] + b[1]) / 2 + py * bow];
  const at = (t: number): [number, number] => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const angle = (t: number) => {
    const tx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const ty = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    return Math.atan2(ty, tx);
  };
  return { c, at, angle };
}

/** Radar cells around a point: offsets in map units, radius and intensity 0 green, 1 yellow, 2 red. */
export const RADAR: Array<[number, number, number, 0 | 1 | 2]> = [
  [-0.4, -1.6, 0.8, 0], [0, -0.8, 0.9, 0], [0.5, 0, 1, 0], [0.9, 0.8, 0.9, 0], [1.4, 1.5, 1, 0], [1.8, 2.3, 0.9, 0], [2.3, 3, 1, 0],
  [2.9, 3.6, 0.9, 0], [3.5, 4.1, 1, 0], [4.2, 4.5, 0.8, 0], [1, 0.2, 0.7, 0], [2.4, 2.2, 0.7, 0], [3.2, 4.6, 0.8, 0], [0.2, -0.2, 0.6, 0],
  [0.5, 0.1, 0.45, 1], [1.4, 1.6, 0.5, 1], [2.3, 3.1, 0.55, 1], [3.5, 4.1, 0.5, 1], [3.9, 4.4, 0.35, 2], [2.4, 3.2, 0.3, 2], [1.5, 1.6, 0.25, 2],
];

// ---------------------------------------------------------------- SwiftUI

const VIEW = [
  "private struct MapRoute {",
  "    let from: CGPoint",
  "    let to: CGPoint",
  "    let fromCode: String",
  "    let fromCity: String",
  "    var plane: Double?",
  "}",
  "",
  "private struct RouteMap: View {",
  "    let land: [[CGPoint]]",
  "    @State var routes: [MapRoute]",
  "    var ocean: [Color]",
  "    var landColor: Color",
  "    var tones: [Color]",
  "    var routeColor: Color = .blue",
  "    /// The routes you aren't following, when they take their own colour.",
  "    var altColor: Color? = nil",
  "    var space: Color? = nil",
  "    var grid = false",
  "    var coast = false",
  "    var radarColors: [Color] = [.green, .yellow, .red]",
  "    var pinColors: [Color] = [.orange, .pink, .mint, .yellow]",
  "    var pinInk: Color = .white",
  "    /// The light-scheme ground, when the style follows the colour scheme.",
  "    var lightOcean: [Color]? = nil",
  "    var lightLand: Color? = nil",
  "    var lightTones: [Color]? = nil",
  "    var patches: [(CGPoint, CGFloat, Int)] = []",
  "    var zoom: CGFloat = 1",
  "    /// Where the camera looks: 0 the whole map, 1 the followed route's origin, 2 its plane.",
  "    var focus = 0",
  "    @State var active = 0",
  "    var radar = false",
  "    var labels = false",
  "    var pins: [String] = []",
  "    var badge = \"\"",
  "    var height: CGFloat = 360",
  "    var corner: CGFloat = 0",
  "",
  "    @State private var dragStart: Double?",
  "    @State private var appeared = false",
  "    @State private var canvasSize: CGSize = .zero",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @Environment(\\.colorScheme) private var colorScheme",
  "    private let mapSize = CGSize(width: " + String(MAP_W) + ", height: " + String(MAP_H) + ")",
  "",
  "    private var isLight: Bool { colorScheme == .light && lightLand != nil }",
  "    private var followedPlane: Double { routes.indices.contains(active) ? routes[active].plane ?? 0 : 0 }",
  "",
  "    var body: some View {",
  "        Canvas { context, size in",
  "            let t = transform(size)",
  "            func pt(_ p: CGPoint) -> CGPoint { p.applying(t) }",
  "            let scale = t.a",
  "            let sea = isLight ? (lightOcean ?? ocean) : ocean",
  "            let ground = isLight ? (lightLand ?? landColor) : landColor",
  "            let shades = isLight ? (lightTones ?? tones) : tones",
  "            let hairline: Color = isLight ? .black : .white",
  "            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(space ?? sea.last ?? .blue))",
  "            var water = Path(CGRect(origin: .zero, size: size))",
  "            if space != nil {",
  "                let r = min(size.width, size.height) * 0.92",
  "                water = Path(ellipseIn: CGRect(x: size.width / 2 - r, y: size.height * 0.55 - r * 0.62, width: r * 2, height: r * 2))",
  "            }",
  "            context.fill(water, with: .linearGradient(Gradient(colors: sea), startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)))",
  "            context.clip(to: water)",
  "            var shore = Path()",
  "            for poly in land {",
  "                guard let first = poly.first else { continue }",
  "                shore.move(to: pt(first))",
  "                for p in poly.dropFirst() { shore.addLine(to: pt(p)) }",
  "                shore.closeSubpath()",
  "            }",
  "            context.fill(shore, with: .color(ground))",
  "            if coast { context.stroke(shore, with: .color(hairline.opacity(isLight ? 0.1 : 0.14)), lineWidth: 1) }",
  "            context.drawLayer { layer in",
  "                layer.clip(to: shore)",
  "                layer.addFilter(.blur(radius: max(1.5, scale * 0.45)))",
  "                for (c, r, tone) in patches {",
  "                    let p = pt(c), rr = r * scale",
  "                    layer.fill(Path(ellipseIn: CGRect(x: p.x - rr, y: p.y - rr * 0.7, width: rr * 2, height: rr * 1.4)), with: .color(shades[tone].opacity(0.7)))",
  "                }",
  "            }",
  "            if grid {",
  "                var lines = Path()",
  "                for lon in stride(from: -170.0, through: -20, by: 10) {",
  "                    lines.move(to: pt(CGPoint(x: (lon + 170) / 150 * mapSize.width, y: (76 - 90) / 72 * mapSize.height)))",
  "                    lines.addLine(to: pt(CGPoint(x: (lon + 170) / 150 * mapSize.width, y: (76 + 10) / 72 * mapSize.height)))",
  "                }",
  "                for lat in stride(from: 0.0, through: 80, by: 10) {",
  "                    lines.move(to: pt(CGPoint(x: (-240 + 170) / 150 * mapSize.width, y: (76 - lat) / 72 * mapSize.height)))",
  "                    lines.addLine(to: pt(CGPoint(x: (20 + 170) / 150 * mapSize.width, y: (76 - lat) / 72 * mapSize.height)))",
  "                }",
  "                context.stroke(lines, with: .color(hairline.opacity(isLight ? 0.06 : 0.07)), lineWidth: 1)",
  "            }",
  "            if radar, routes.indices.contains(active) {",
  "                let o = routes[active].from",
  "                context.drawLayer { layer in",
  "                    layer.addFilter(.blur(radius: max(1.5, scale * 0.06)))",
  "                    for (dx, dy, r, level) in radarCells {",
  "                        let p = pt(CGPoint(x: o.x + 0.6 + dx * 0.9, y: o.y - 1.8 + dy * 0.9))",
  "                        let rr = r * 0.9 * scale",
  "                        layer.fill(Path(ellipseIn: CGRect(x: p.x - rr, y: p.y - rr, width: rr * 2, height: rr * 2)), with: .color(radarColors[level].opacity(0.75)))",
  "                    }",
  "                }",
  "            }",
  "            for (i, route) in routes.enumerated() {",
  "                let a = pt(route.from), b = pt(route.to), c = control(a, b)",
  "                let tint = i == active ? routeColor : (altColor ?? routeColor)",
  "                var line = Path()",
  "                line.move(to: a)",
  "                line.addQuadCurve(to: b, control: c)",
  "                context.stroke(line, with: .color(tint.opacity(i == active ? 1 : 0.7)), style: StrokeStyle(lineWidth: i == active ? 3.5 : 2.5, lineCap: .round))",
  "                for end in [a, b] {",
  "                    context.fill(Path(ellipseIn: CGRect(x: end.x - 6, y: end.y - 6, width: 12, height: 12)), with: .color(.white))",
  "                    context.fill(Path(ellipseIn: CGRect(x: end.x - 4, y: end.y - 4, width: 8, height: 8)), with: .color(tint))",
  "                }",
  "                if labels, i == active {",
  "                    let tag = context.resolve(Text(\"\\(route.fromCity)  \\(route.fromCode)\").font(.caption.weight(.semibold)).foregroundStyle(.white))",
  "                    let w = tag.measure(in: size)",
  "                    let box = CGRect(x: a.x - w.width - 22, y: a.y - 11, width: w.width + 14, height: 22)",
  "                    context.fill(Path(roundedRect: box, cornerRadius: 6), with: .color(routeColor))",
  "                    context.draw(tag, at: CGPoint(x: box.midX, y: box.midY))",
  "                }",
  "                if let f = route.plane {",
  "                    let q = bezier(a, c, b, f), d = tangent(a, c, b, f)",
  "                    var plane = context",
  "                    plane.translateBy(x: q.x, y: q.y)",
  "                    plane.rotate(by: .radians(atan2(d.y, d.x)))",
  "                    plane.addFilter(.shadow(color: .black.opacity(isLight ? 0.2 : 0.45), radius: 4, y: 2))",
  "                    plane.draw(Image(systemName: \"airplane\"), in: CGRect(x: -15, y: -15, width: 30, height: 30))",
  "                    if pins.indices.contains(i), !pins[i].isEmpty {",
  "                        let bubble = CGRect(x: q.x - 30, y: q.y - 84, width: 60, height: 60)",
  "                        context.fill(Path(ellipseIn: bubble.insetBy(dx: -4, dy: -4)), with: .color(.white.opacity(0.9)))",
  "                        context.fill(Path(ellipseIn: bubble), with: .color(pinColors[i % max(1, pinColors.count)]))",
  "                        context.draw(Text(pins[i]).font(.title2.weight(.bold)).foregroundStyle(pinInk), at: CGPoint(x: bubble.midX, y: bubble.midY))",
  "                    }",
  "                }",
  "            }",
  "        }",
  "        .foregroundStyle(isLight ? Color(white: 0.11) : .white)",
  "        .frame(height: height)",
  "        .background(GeometryReader { g in Color.clear.onAppear { canvasSize = g.size }.onChange(of: g.size) { _, s in canvasSize = s } })",
  "        // Entrance, once: the map settles in from 0.95 with a fade (a plain fade with Reduce Motion).",
  "        .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "        .opacity(appeared ? 1 : 0)",
  "        .onAppear {",
  "            guard !appeared else { return }",
  "            withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.3)) { appeared = true }",
  "        }",
  "        .overlay(alignment: .top) {",
  "            if !badge.isEmpty {",
  "                Text(badge)",
  "                    .font(.caption.weight(.semibold))",
  "                    .monospacedDigit()",
  "                    .padding(.horizontal, 12)",
  "                    .padding(.vertical, 6)",
  "                    .background(.ultraThinMaterial, in: Capsule())",
  "                    .padding(.top, corner > 0 ? 12 : 60)",
  "            }",
  "        }",
  "        .contentShape(Rectangle())",
  "        .gesture(scrub)",
  "        .onTapGesture { location in follow(at: location) }",
  "        .sensoryFeedback(.impact(weight: .light), trigger: active)",
  "        // A tick every tenth of the way; a success, not a tick, when the plane lands.",
  "        .sensoryFeedback(.selection, trigger: Int(min(1, max(0, followedPlane)) * 10)) { _, new in new < 10 }",
  "        .sensoryFeedback(.success, trigger: followedPlane >= 1) { old, new in !old && new }",
  "        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))",
  "        .ignoresSafeArea(edges: .top)",
  "        .accessibilityLabel(\"Flight map\")",
  "    }",
  "",
  "    /// Tap a plane to follow it: the nearest plane within reach of the finger.",
  "    private func follow(at location: CGPoint) {",
  "        let t = transform(canvasSize)",
  "        var best: (Int, CGFloat)? = nil",
  "        for (i, r) in routes.enumerated() {",
  "            guard let f = r.plane else { continue }",
  "            let q = bezier(r.from, control(r.from, r.to), r.to, f).applying(t)",
  "            let d = hypot(q.x - location.x, q.y - location.y)",
  "            if d < 30, d < (best?.1 ?? .infinity) { best = (i, d) }",
  "        }",
  "        if let (i, _) = best, i != active { withAnimation(.spring(duration: 0.5)) { active = i } }",
  "    }",
  "",
  "    /// Drag flies the followed plane: it tracks the finger, rubber-bands past either end of the route,",
  "    /// and springs back home with the release velocity.",
  "    private var scrub: some Gesture {",
  "        DragGesture(minimumDistance: 4)",
  "            .onChanged { value in",
  "                guard routes.indices.contains(active) else { return }",
  "                if dragStart == nil { dragStart = routes[active].plane ?? 0 }",
  "                routes[active].plane = rubber((dragStart ?? 0) + value.translation.width / 300)",
  "            }",
  "            .onEnded { value in",
  "                dragStart = nil",
  "                guard routes.indices.contains(active), let f = routes[active].plane else { return }",
  "                let home = min(1, max(0, f))",
  "                guard home != f else { return }",
  "                let velocity = max(-20, min(20, (value.velocity.width / 300) / (home - f)))",
  "                withAnimation(.interpolatingSpring(stiffness: 170, damping: 22, initialVelocity: velocity)) { routes[active].plane = home }",
  "            }",
  "    }",
  "",
  "    private func rubber(_ x: Double) -> Double {",
  "        if x > 1 { return 1 + min(0.08, (x - 1) * 0.2) }",
  "        if x < 0 { return max(-0.08, x * 0.2) }",
  "        return x",
  "    }",
  "",
  "    private func transform(_ size: CGSize) -> CGAffineTransform {",
  "        let fit = max(size.width / mapSize.width, size.height / mapSize.height) * zoom",
  "        var center = CGPoint(x: mapSize.width * 0.47, y: mapSize.height * 0.5)",
  "        if focus > 0, routes.indices.contains(active) {",
  "            let r = routes[active]",
  "            center = focus == 1 ? r.from : bezier(r.from, control(r.from, r.to), r.to, min(1, max(0, r.plane ?? 0.5)))",
  "        }",
  "        let tx = size.width / 2 - center.x * fit",
  "        let ty = size.height * (space == nil ? 0.5 : 0.55) - center.y * fit",
  "        return CGAffineTransform(a: fit, b: 0, c: 0, d: fit, tx: tx, ty: ty)",
  "    }",
  "",
  "    private func control(_ a: CGPoint, _ b: CGPoint) -> CGPoint {",
  "        let dx = b.x - a.x, dy = b.y - a.y, len = max(0.001, hypot(dx, dy))",
  "        var px = -dy / len, py = dx / len",
  "        if py > 0 { px = -px; py = -py }",
  "        return CGPoint(x: (a.x + b.x) / 2 + px * len * 0.22, y: (a.y + b.y) / 2 + py * len * 0.22)",
  "    }",
  "",
  "    private func bezier(_ a: CGPoint, _ c: CGPoint, _ b: CGPoint, _ t: Double) -> CGPoint {",
  "        let u = 1 - t",
  "        return CGPoint(x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y)",
  "    }",
  "",
  "    private func tangent(_ a: CGPoint, _ c: CGPoint, _ b: CGPoint, _ t: Double) -> CGPoint {",
  "        CGPoint(x: 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x), y: 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y))",
  "    }",
  "",
  "    private let radarCells: [(CGFloat, CGFloat, CGFloat, Int)] = [" + RADAR.map(([x, y, r, l]) => `(${x}, ${y}, ${r}, ${l})`).join(", ") + "]",
  "}",
];

const pointList = (pts: Array<[number, number]>) => `[${pts.map(([x, y]) => `CGPoint(x: ${num(x)}, y: ${num(y)})`).join(", ")}]`;

export const routeMap: SwiftPieceDefinition = {
  id: "route-map",
  name: "Route Map",
  category: "pieces",
  description: "A drawn map with flight routes arcing between airports and planes in the air. Drag to move the followed plane along its route.",
  availability: "free",
  preview: { component: "route-map", chunk: "app-pieces" },
  icon: "map",
  concepts: ["gesture", "state", "array"],
  anatomy: [
    { part: "Map", props: ["style", "zoom", "focus", "height", "bleed", "radius"] },
    { part: "Routes", props: ["routes", "active", "labels"] },
    { part: "Layers", props: ["radar", "pins", "badge"] },
  ],
  interactions: ["drag", "tap", "spring", "haptic"],
  variants: [
    { id: "graphite", label: "Graphite", props: { style: "graphite", routes: "SEA-ATL@45, DEN-BOS, PDX-AUS", active: 0, zoom: 1, focus: "all", radar: false, pins: "", badge: "" } },
    { id: "radar", label: "Weather radar", props: { style: "graphite", routes: "BOS-DEN@90", active: 0, zoom: 4, focus: "origin", radar: true, labels: true, pins: "", badge: "" } },
    { id: "friends", label: "Friends in the air", props: { style: "graphite", routes: "ANC-SEA@60, YUL-MSY@40, SAN-YYZ@30", active: 1, zoom: 1.2, focus: "all", radar: false, pins: "RK, TN, EL", badge: "" } },
    { id: "follow", label: "Following a plane", props: { style: "graphite", routes: "DEN-PHX@50, SEA-ATL@30, ORD-SLC@60, DFW-YVR@40", active: 1, zoom: 3, focus: "plane", badge: "842 km/h · 36,000 ft" } },
    { id: "globe", label: "Night globe", props: { style: "globe", routes: "SEA-ATL@45, DEN-BOS, PDX-AUS", active: 0, zoom: 1, focus: "all", radar: false, pins: "", badge: "" } },
  ],
  states: [
    { id: "departing", label: "Just departed", props: { routes: "SEA-ATL@4" } },
    { id: "landing", label: "About to land", props: { routes: "SEA-ATL@96" } },
  ],
  properties: [
    select("style", "Style", "graphite", opts(...Object.entries(MAP_STYLES).map(([id, v]): [string, string] => [id, v.label])), { group: "color" }),
    { id: "routes", label: "Routes", type: "text", defaultValue: "SEA-ATL@45, DEN-BOS, PDX-AUS", maxLength: 200, group: "content", hint: "Airport codes, comma-separated: SEA-BOS@40 puts a plane 40% of the way." },
    number("active", "Followed route", 0, 0, 5, 1, { group: "state", hint: "Which route the drag moves and the camera can follow." }),
    number("zoom", "Zoom", 1, 1, 6, 0.1, { group: "layout" }),
    select("focus", "Camera on", "all", opts(["all", "Whole map"], ["origin", "Followed origin"], ["plane", "Followed plane"]), { group: "layout" }),
    bool("radar", "Weather radar", false),
    bool("labels", "Origin label", false),
    text("pins", "Pins", "", { maxLength: 40, hint: "Initials over each route's plane, comma-separated (people on board)." }),
    text("badge", "Badge", "", { maxLength: 40, hint: "A pill at the top, like speed and altitude." }),
    number("height", "Height", 360, 200, 640, 10, { group: "layout" }),
    bool("bleed", "Edge to edge", true, { group: "layout", hint: "Runs under the status bar and to the screen edges." }),
    number("radius", "Corner radius", 0, 0, 40, 1, { group: "layout", hint: "Rounds the corners when the map sits inset (edge to edge off).", when: { prop: "bleed", equals: [false] } }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("RouteMap", VIEW);
      const st = MAP_STYLES[s(p, "style")] ?? MAP_STYLES.graphite;
      const routes = parseRoutes(p.routes);
      const focus = { all: 0, origin: 1, plane: 2 }[s(p, "focus")] ?? 0;
      const pins = String(p.pins ?? "").split(",").map((x) => x.trim());
      const routeLits = routes.map((r) => {
        const a = project(AIRPORTS[r.from].lon, AIRPORTS[r.from].lat);
        const z = project(AIRPORTS[r.to].lon, AIRPORTS[r.to].lat);
        return `MapRoute(from: CGPoint(x: ${num(a[0])}, y: ${num(a[1])}), to: CGPoint(x: ${num(z[0])}, y: ${num(z[1])}), fromCode: ${ctx.str(r.from)}, fromCity: ${ctx.str(AIRPORTS[r.from].city)}${r.plane != null ? `, plane: ${num(r.plane)}` : ""})`;
      });
      const patches = PATCHES.map((q) => {
        const [x, y] = project(q.lon, q.lat);
        return `(CGPoint(x: ${num(x)}, y: ${num(y)}), ${num(q.r * 0.667)}, ${q.tone})`;
      });
      let lines = call("RouteMap", [
        ["land", `[${landPaths().map(pointList).join(", ")}]`],
        ["routes", `[${routeLits.join(", ")}]`],
        ["ocean", `[${st.ocean.map((c) => swiftHex(c)).join(", ")}]`],
        ["landColor", swiftHex(st.land)],
        ["tones", `[${st.tones.map((c) => swiftHex(c)).join(", ")}]`],
        ["routeColor", swiftHex(st.route)],
        st.alt && ["altColor", swiftHex(st.alt)],
        st.space && ["space", swiftHex(st.space)],
        st.grid && ["grid", "true"],
        st.coast && ["coast", "true"],
        st.radar && b(p, "radar") && ["radarColors", `[${st.radar.map((c) => swiftHex(c)).join(", ")}]`],
        st.pins && pins.some(Boolean) && ["pinColors", `[${routes.map((_, i) => swiftHex(pinFill(st, pins[i] ?? "", i))).join(", ")}]`],
        st.pinInk && pins.some(Boolean) && ["pinInk", swiftHex(st.pinInk)],
        st.light && ["lightOcean", `[${st.light.ocean.map((c) => swiftHex(c)).join(", ")}]`],
        st.light && ["lightLand", swiftHex(st.light.land)],
        st.light && ["lightTones", `[${st.light.tones.map((c) => swiftHex(c)).join(", ")}]`],
        ["patches", `[${patches.join(", ")}]`],
        n(p, "zoom") !== 1 && ["zoom", num(n(p, "zoom"))],
        focus > 0 && ["focus", String(focus)],
        n(p, "active") > 0 && ["active", num(Math.round(n(p, "active")))],
        b(p, "radar") && ["radar", "true"],
        b(p, "labels") && ["labels", "true"],
        pins.some(Boolean) && ["pins", `[${pins.map((x) => ctx.str(x)).join(", ")}]`],
        s(p, "badge").trim() && ["badge", ctx.str(s(p, "badge").trim())],
        n(p, "height") !== 360 && ["height", num(n(p, "height"))],
        !b(p, "bleed") && n(p, "radius") > 0 && ["corner", num(n(p, "radius"))],
      ]);
      // Edge to edge: out past the screen's padding, and up under the status bar (ignoresSafeArea).
      if (b(p, "bleed")) lines = modifiers(lines, ["padding(.horizontal, -24)", "padding(.top, -24)"]);
      return { lines };
    },
  },
};
