// Sun Path: where the sun is at any moment of the day, drawn over a place. A tilted horizon ring
// with the day's arc above it and the sun on the arc, a block at the centre casting its shadow, and
// the time beside it. Drag sideways anywhere to move through the day: the sun climbs and sets, the
// shadow swings and stretches, the time and the readouts (shadow ratio, azimuth, altitude) follow.
// Scenes: a plain field, a city map (every roof and tree casts its shadow with the sun), a contour
// map (each step of the hill shades the one below it, away from the sun), and a sky view facing the
// sea. A place bar at the bottom opens the day's events. Two palettes: the SwiftPieces sweep (the
// arc in signal → ember → blush → azure, a column lit from the sun's side, the time large
// at the top and the place on a card; dark ground in the dark scheme, pale ground and dark ink in the
// light one) and daylight (bright scenes, pill chrome). Scene and chrome settle in once from 0.95.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, modifiers, num } from "../../core/swift.js";
import { bool, link, number, opts, select, text } from "../shared.js";
import { linkAction } from "./emit-link-action.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const b = (p: Props, k: string) => p[k] === true;

// ---------------------------------------------------------------- The sun (shared with the preview)

/** Where the sun is at `t` (0 sunrise, 1 sunset): altitude and azimuth in degrees, and the shadow ratio. */
export function sunAt(t: number): { alt: number; az: number; ratio: number } {
  const alt = Math.max(3, 62 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
  const az = 90 + 180 * t;
  return { alt, az, ratio: 1 / Math.tan((alt * Math.PI) / 180) };
}
export const compass = (az: number) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((az % 360) + 360) % 360) / 45) % 8];
/** 1000 → "04:40 PM", or "4:40 PM" unpadded. */
export function clockLabel(minutes: number, pad = true): string {
  const m = Math.round(minutes) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const hh = String(h % 12 === 0 ? 12 : h % 12);
  return `${pad ? hh.padStart(2, "0") : hh}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
/** "07:13" or "7:13 PM" → minutes after midnight; unparsable gives the fallback. */
export function parseClock(value: unknown, fallback: number): number {
  const m = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return fallback;
  let h = Number(m[1]) % 24;
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return h * 60 + Number(m[2]);
}

// ---------------------------------------------------------------- Scenes (unit square data, shared)

/** A tiny seeded random, so the preview and the Swift draw the same city. */
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function round(v: number) {
  return Math.round(v * 10) / 10;
}

// The maps are drawn in a 400 × 600 world, fitted to the scene and centred (the city turned a few
// degrees so it reads as a map, not a grid). Everything below is world units, drawn back to front.

/** How the world sits in a scene of w × h: its scale, and the city's turn in degrees. */
export const SUN_WORLD = { w: 400, h: 600, cityTurn: -9, cityZoom: 1.05, hillZoom: 1 } as const;

/** Where the river runs: its north bank at x. */
const bank = (x: number) => 548 - x * 0.12;
/** The diagonal avenue, from one end to the other, and its width. */
export const CITY_AVENUE = { from: [-120, 96], to: [520, 468], width: 15 } as const;
const offAvenue = (x: number, y: number, pad: number) => {
  const [ax, ay] = CITY_AVENUE.from;
  const [bx, by] = CITY_AVENUE.to;
  const d = Math.abs((by - ay) * x - (bx - ax) * y + bx * ay - by * ax) / Math.hypot(bx - ax, by - ay);
  return d > CITY_AVENUE.width / 2 + pad;
};

/**
 * The city: blocks of land [x, y, w, h] between streets of mixed widths, buildings packed into
 * them [x, y, w, h, height 0–1], a park [x, y, w, h] with its trees [x, y, r], and the river's bank
 * [x, y] from west to east. Streets are the ground showing between blocks.
 */
export const SUN_CITY = (() => {
  const r = seeded(7);
  const cols: Array<[number, number]> = [];
  const rows: Array<[number, number]> = [];
  for (let x = -150, k = 0; x < 560; k++) {
    const bw = 54 + Math.floor(r() * 38);
    cols.push([x, bw]);
    x += bw + (k % 3 === 1 ? 13 : 6);
  }
  for (let y = -110, k = 0; y < 720; k++) {
    const bh = 40 + Math.floor(r() * 26);
    rows.push([y, bh]);
    y += bh + (k % 4 === 2 ? 13 : 6);
  }
  const blocks: number[][] = [];
  const buildings: number[][] = [];
  // Only what a scene can show once the city is turned (a card up to ~700 pt tall).
  const turn = (SUN_WORLD.cityTurn * Math.PI) / 180;
  const seen = (x: number, y: number, w: number, h: number) => {
    const cx = x + w / 2 - SUN_WORLD.w / 2;
    const cy = y + h / 2 - SUN_WORLD.h / 2;
    const m = Math.max(w, h) / 2;
    return Math.abs(cx * Math.cos(turn) - cy * Math.sin(turn)) < 212 + m && Math.abs(cx * Math.sin(turn) + cy * Math.cos(turn)) < 302 + m;
  };
  const park = [58, 356, 128, 104];
  const inPark = (x: number, y: number, w: number, h: number) => x < park[0] + park[2] && x + w > park[0] && y < park[1] + park[3] && y + h > park[1];
  // Split a lot along its longer side until the pieces are house-sized; a few stay open (a yard).
  const pack = (x: number, y: number, w: number, h: number, depth: number) => {
    // Now and then a whole block is one landmark, taller than its street.
    const landmark = depth === 0 && r() < 0.1;
    if (landmark || (w * h < 520 && depth > 0) || depth > 4 || Math.min(w, h) < 13) {
      if (r() < 0.07 || !offAvenue(x + w / 2, y + h / 2, Math.max(w, h) * 0.55) || !seen(x, y, w, h)) return;
      buildings.push([round(x), round(y), round(w), round(h), round(landmark ? 1 : 0.2 + r() * 0.65)]);
      return;
    }
    const f = 0.36 + r() * 0.28;
    if (w > h) {
      pack(x, y, w * f - 1, h, depth + 1);
      pack(x + w * f + 1, y, w * (1 - f) - 1, h, depth + 1);
    } else {
      pack(x, y, w, h * f - 1, depth + 1);
      pack(x, y + h * f + 1, w, h * (1 - f) - 1, depth + 1);
    }
  };
  for (const [y, bh] of rows) {
    for (const [x, bw] of cols) {
      if (y + bh > bank(x + bw / 2) - 16) continue;
      if (inPark(x, y, bw, bh)) continue;
      if (seen(x, y, bw, bh)) blocks.push([x, y, bw, bh]);
      pack(x + 3, y + 3, bw - 6, bh - 6, 0);
    }
  }
  const trees: number[][] = [];
  while (trees.length < 26) {
    const x = park[0] + 8 + r() * (park[2] - 16);
    const y = park[1] + 8 + r() * (park[3] - 16);
    // A path crosses the park corner to corner; trees keep off it.
    if (Math.abs((y - park[1]) / park[3] - (x - park[0]) / park[2]) < 0.14) continue;
    trees.push([round(x), round(y), round(4 + r() * 4)]);
  }
  const river = Array.from({ length: 9 }, (_, k) => [-160 + k * 90, round(bank(-160 + k * 90))]);
  return { blocks, buildings, park, trees, river };
})();

/** One hill's contour lines: peak [x, y], rings, spacing, how far the rings drift as they widen, and a seed for its shape. */
export const SUN_HILLS: number[][] = [
  [336, 214, 12, 15, -30, 26, 0.6],
  [70, 118, 6, 14, 18, 10, 2.3],
];
/** The contour ring `k` (1 innermost) of a hill, as `points` world points. */
export function contour(hill: number[], k: number, points = 72): Array<[number, number]> {
  const [px, py, rings, step, dx, dy, seed] = hill;
  const cx = px + (dx * k) / rings;
  const cy = py + (dy * k) / rings;
  return Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const rr = k * step * (1 + 0.13 * Math.sin(2 * a + seed + 0.05 * k) + 0.07 * Math.sin(3 * a + 1.9 * seed - 0.08 * k) + 0.035 * Math.sin(5 * a + 0.3 * k));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.88];
  });
}

/** The hills around it: the road (cubic segments), the trail to the top, woods [x, y, r], houses [x, y, w, h, height], the sea's shore and a stream. */
export const SUN_TERRAIN = (() => {
  const r = seeded(11);
  const road = [[-80, 226], [60, 246, 128, 330, 170, 410], [206, 474, 300, 474, 480, 540]];
  const at = (t: number): [number, number, number, number] => {
    // A point on the road and its direction, t across both segments.
    const seg = t < 0.5 ? 0 : 1;
    const u = seg === 0 ? t * 2 : t * 2 - 1;
    const p0 = seg === 0 ? road[0] : road[1].slice(4);
    const [c1x, c1y, c2x, c2y, ex, ey] = road[seg + 1];
    const m = 1 - u;
    const x = m * m * m * p0[0] + 3 * m * m * u * c1x + 3 * m * u * u * c2x + u * u * u * ex;
    const y = m * m * m * p0[1] + 3 * m * m * u * c1y + 3 * m * u * u * c2y + u * u * u * ey;
    const tx = 3 * m * m * (c1x - p0[0]) + 6 * m * u * (c2x - c1x) + 3 * u * u * (ex - c2x);
    const ty = 3 * m * m * (c1y - p0[1]) + 6 * m * u * (c2y - c1y) + 3 * u * u * (ey - c2y);
    const l = Math.hypot(tx, ty) || 1;
    return [x, y, tx / l, ty / l];
  };
  const houses: number[][] = [];
  // Two hamlets strung along the road, houses on both sides.
  for (const [from, to, n] of [[0.1, 0.22, 7], [0.64, 0.84, 11]]) {
    for (let i = 0; i < n; i++) {
      const [x, y, tx, ty] = at(from + ((to - from) * (i + r() * 0.6)) / n);
      const side = i % 2 === 0 ? 1 : -1;
      const off = 11 + r() * 9;
      const w = 8 + r() * 5;
      const h = 6 + r() * 4;
      houses.push([round(x - ty * off * side - w / 2), round(y + tx * off * side - h / 2), round(w), round(h), round(0.4 + r() * 0.5)]);
    }
  }
  const woods: number[][] = [];
  for (const [cx, cy, spread, n] of [[40, 300, 40, 16], [236, 74, 36, 13], [356, 420, 30, 10], [168, 552, 28, 8], [150, 40, 30, 9]]) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * spread;
      woods.push([round(cx + Math.cos(a) * d), round(cy + Math.sin(a) * d * 0.8), round(3.5 + r() * 3)]);
    }
  }
  return {
    road: road.flat(),
    trail: [300, 474, 356, 404, 292, 300, 332, 228],
    woods,
    houses,
    // M, Q, Q: the shore from the west edge round to the south, then along the frame.
    shore: [-60, 452, 104, 462, 142, 548, 170, 616, 250, 680],
    stream: [214, 318, 180, 380, 210, 430, 118, 506],
  };
})();

export const SUN_SCENES: Record<string, { label: string; top: string; sweepTop: string }> = {
  plain: { label: "Field", top: "#FFD21F", sweepTop: "#070708" },
  city: { label: "City map", top: "#E4E1DA", sweepTop: "#161619" },
  terrain: { label: "Terrain map", top: "#D3E4C4", sweepTop: "#0F1210" },
  sky: { label: "Sky view", top: "#7FAFD8", sweepTop: "#070708" },
};
/** The sweep, as the arc and the sky path paint it. */
export const SUN_SWEEP = ["#FF0000", "#FF7A3C", "#FF8FB8", "#4D8DFF"];
/** Scene colours: [sweep, daylight, sweep in the light scheme] per part, hex. */
export const SUN_TONES = {
  // The city: streets are the ground, blocks sit on it, roofs on the blocks.
  street: ["#0B0B0D", "#CFCBC4", "#E3E0DA"], block: ["#161619", "#E4E1DA", "#F1EFEB"], roof: ["#2B2B31", "#FBFAF7", "#FFFFFF"], roofEdge: ["#35353C", "#D3CEC5", "#DDD9D1"],
  avenue: ["#222226", "#FFFFFF", "#FFFFFF"], park: ["#16211A", "#BFDDAE", "#DCEBD3"], tree: ["#213629", "#93C47F", "#B3D5A3"], water: ["#0D1A2E", "#A7D1F0", "#D3E3F4"],
  // The hills: land tinted from the valley up to the top, contour lines, woods, the road.
  low: ["#0F1210", "#D3E4C4", "#EEF1E8"], high: ["#232A23", "#F2ECD8", "#FBF8EF"], contour: ["#E9D5B3", "#6F5E3E", "#8A7650"], wood: ["#1A2B1F", "#8DBE78", "#BCD8AE"],
  casing: ["#050506", "#BDB6A8", "#D9D3C7"], road: ["#2C2C31", "#FFFFFF", "#FFFFFF"],
  // The sky scene.
  lakeTop: ["#15203A", "#5C788F", "#A9C3DE"], lakeBottom: ["#070708", "#26384D", "#7F9AB8"], farHills: ["#1E2230", "#8C99A8", "#B7C0CB"], nearHills: ["#151823", "#6F7E8E", "#97A5B4"], shore: ["#0B0C0E", "#29381F", "#3E4C3C"], trees: ["#050506", "#1F2E1A", "#26331F"],
} as const;
/** A pine's right half, [across, up] as fractions of its width and height, tip to foot: three tiers. */
export const SUN_PINE: number[][] = [[0, 1], [0.3, 0.62], [0.14, 0.62], [0.42, 0.32], [0.2, 0.32], [0.5, 0]];
/** The sky scene's path as fractions of its height at the left and right edges, and where on it the sun sets (the horizon). */
export const SKY_PATH = { from: 0.814, to: 0.3, set: 0.3 } as const;
/** Light on the water under the sun: [offset from it, length, height as a fraction of the scene]. */
export const SKY_GLINTS: number[][] = [[0, 34, 0.68], [-6, 22, 0.695], [8, 40, 0.71], [-10, 16, 0.728], [4, 28, 0.745], [14, 12, 0.765], [-4, 20, 0.785], [-16, 10, 0.81], [6, 14, 0.835], [0, 8, 0.865]];
/** How dark a cast shadow is, [sweep dark, daylight, sweep light]. */
export const SUN_SHADE = [0.6, 0.24, 0.18] as const;
/** The sky and the open field behind the sweep dial, dark and light. */
export const SUN_SKY = { dark: ["#070708", "#16264A", "#4A2A3E"], light: ["#CFE0F7", "#F4EBE2", "#F6D9C6"], day: ["#80B0D9", "#EDD6B3"] } as const;
export const SUN_FIELD = { dark: ["#070708", "#141416"], light: ["#F7F6F3", "#ECEBE7"], floorDark: "#1C1C20", floorLight: "#E2E0DA" } as const;
export const SUN_TOOLBARS: Record<string, string> = { none: "None", "map-pill": "Map button", "map-tools": "Map tools", "sky-tools": "Camera tools" };

// ---------------------------------------------------------------- SwiftUI

const arr = (rows: number[][]) => `[${rows.map((r) => `[${r.map((v) => num(v)).join(", ")}]`).join(", ")}]`;

const hx = (c: string) => "0x" + c.slice(1).toUpperCase();
/** A scene colour in Swift: its three columns (sweep dark, daylight, sweep light). */
const tn = (k: keyof typeof SUN_TONES) => `tone(${SUN_TONES[k].map(hx).join(", ")})`;
const px = (k: keyof typeof SUN_TONES) => `pick(${SUN_TONES[k].map(hx).join(", ")})`;
const flat = (rows: number[][]) => `[${rows.map((r) => r.map((v) => num(v)).join(", ")).join(",\n        ")}]`;
const pts = (list: readonly number[]) => list.map((v) => num(v));

const SCENES_SWIFT = `    // MARK: Scenes

    /// Which column of the scene colours: the sweep in dark, daylight, the sweep in light.
    private func pick(_ s: UInt32, _ d: UInt32, _ l: UInt32) -> UInt32 { sweep ? (lit ? l : s) : d }
    private func tone(_ s: UInt32, _ d: UInt32, _ l: UInt32) -> Color { Self.rgb(pick(s, d, l)) }
    /// How dark cast shadows are.
    private var shade: Double { sweep ? (lit ? ${num(SUN_SHADE[2])} : ${num(SUN_SHADE[0])}) : ${num(SUN_SHADE[1])} }
    /// The shadow's direction on the ground (on screen, away from the sun) and how far it runs.
    private var shadowDirection: CGVector {
        let dx = cos(.pi * t), l = hypot(dx, 0.15)
        return CGVector(dx: dx / l, dy: 0.15 / l)
    }
    private var shadowLength: Double { min(1 / tan(altitude * .pi / 180), 5) }

    private static func mix(_ a: UInt32, _ b: UInt32, _ f: Double) -> Color {
        func part(_ v: UInt32, _ s: UInt32) -> Double { Double((v >> s) & 0xFF) / 255 }
        let r = part(a, 16) + (part(b, 16) - part(a, 16)) * f
        let g = part(a, 8) + (part(b, 8) - part(a, 8)) * f
        let bl = part(a, 0) + (part(b, 0) - part(a, 0)) * f
        return Color(red: r, green: g, blue: bl)
    }
    /// The maps are drawn in a 400 × 600 world, fitted to the scene, centred and turned.
    private func world(_ context: GraphicsContext, _ size: CGSize, turn: Double, zoom: Double) -> GraphicsContext {
        var g = context
        let k = max(size.width / ${SUN_WORLD.w}, size.height / ${SUN_WORLD.h}) * zoom
        g.translateBy(x: size.width / 2, y: size.height / 2)
        g.rotate(by: .degrees(turn))
        g.scaleBy(x: k, y: k)
        g.translateBy(x: -${SUN_WORLD.w / 2}, y: -${SUN_WORLD.h / 2})
        return g
    }
    private static func box(_ v: [Double], _ i: Int) -> CGRect { CGRect(x: v[i], y: v[i + 1], width: v[i + 2], height: v[i + 3]) }
    private static func dot(_ x: Double, _ y: Double, _ r: Double) -> Path { Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)) }
    /// The shadow a box casts on the ground: the outline of the box and its copy moved by the shadow.
    private static func cast(_ b: CGRect, _ v: CGVector) -> Path {
        let corners = [CGPoint(x: b.minX, y: b.minY), CGPoint(x: b.maxX, y: b.minY), CGPoint(x: b.maxX, y: b.maxY), CGPoint(x: b.minX, y: b.maxY)]
        let all = (corners + corners.map { CGPoint(x: $0.x + v.dx, y: $0.y + v.dy) }).sorted { $0.x != $1.x ? $0.x < $1.x : $0.y < $1.y }
        func cross(_ o: CGPoint, _ a: CGPoint, _ b: CGPoint) -> CGFloat { (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x) }
        func half(_ list: [CGPoint]) -> [CGPoint] {
            var out: [CGPoint] = []
            for q in list {
                while out.count >= 2 && cross(out[out.count - 2], out[out.count - 1], q) <= 0 { out.removeLast() }
                out.append(q)
            }
            out.removeLast()
            return out
        }
        var path = Path()
        path.addLines(half(all) + half(all.reversed()))
        path.closeSubpath()
        return path
    }
    /// Contour line \`k\` (1 innermost) of a hill: its rings widen, drift and wobble so no two hills match.
    private static func contour(_ hill: [Double], _ k: Int) -> Path {
        let kk = Double(k), rings = hill[2], step = hill[3], seed = hill[6]
        let cx = hill[0] + hill[4] * kk / rings, cy = hill[1] + hill[5] * kk / rings
        var path = Path()
        for i in 0..<72 {
            let a = Double(i) / 72 * 2 * .pi
            let wobble = 0.13 * sin(2 * a + seed + 0.05 * kk) + 0.07 * sin(3 * a + 1.9 * seed - 0.08 * kk) + 0.035 * sin(5 * a + 0.3 * kk)
            let rr = kk * step * (1 + wobble)
            let p = CGPoint(x: cx + cos(a) * rr, y: cy + sin(a) * rr * 0.88)
            if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
        }
        path.closeSubpath()
        return path
    }

    private func drawScene(_ context: inout GraphicsContext, _ size: CGSize) {
        let w = size.width, h = size.height
        func rect(_ x: Double, _ y: Double, _ rw: Double, _ rh: Double) -> CGRect { CGRect(x: x * w, y: y * h, width: rw * w, height: rh * h) }
        let v = shadowDirection, long = shadowLength
        let ink: Color = sweep ? (lit ? Color(white: 0.11) : .white) : Color(white: 0.16)
        switch scene {
        case 1:
            // The city: streets are the ground, blocks sit on it, roofs on the blocks, each casting its shadow.
            let g = world(context, size, turn: ${num(SUN_WORLD.cityTurn)}, zoom: ${num(SUN_WORLD.cityZoom)})
            let a = ${num(-SUN_WORLD.cityTurn)} * Double.pi / 180
            let s = CGVector(dx: (v.dx * cos(a) - v.dy * sin(a)) * 15 * long, dy: (v.dx * sin(a) + v.dy * cos(a)) * 15 * long)
            let block = ${tn("block")}, avenueTone = ${tn("avenue")}
            g.fill(Path(CGRect(x: -400, y: -400, width: 1200, height: 1400)), with: .color(${tn("street")}))
            for i in stride(from: 0, to: Self.cityBlocks.count, by: 4) {
                g.fill(Path(roundedRect: Self.box(Self.cityBlocks, i), cornerRadius: 3), with: .color(block))
            }
            var avenue = Path()
            avenue.move(to: CGPoint(x: ${num(CITY_AVENUE.from[0])}, y: ${num(CITY_AVENUE.from[1])}))
            avenue.addLine(to: CGPoint(x: ${num(CITY_AVENUE.to[0])}, y: ${num(CITY_AVENUE.to[1])}))
            g.stroke(avenue, with: .color(avenueTone), lineWidth: ${num(CITY_AVENUE.width)})
            let bank = Self.river.map { CGPoint(x: $0[0], y: $0[1]) }
            var river = Path()
            river.addLines(bank + [CGPoint(x: 560, y: 900), CGPoint(x: -200, y: 900)])
            river.closeSubpath()
            g.fill(river, with: .color(${tn("water")}))
            var embankment = Path()
            embankment.addLines(bank.map { CGPoint(x: $0.x, y: $0.y - 9) })
            g.stroke(embankment, with: .color(avenueTone), lineWidth: 8)
            let park = CGRect(x: ${pts(SUN_CITY.park).join(", y: ").replace(/, y: (\S+), y: (\S+), y: (\S+)$/, ", y: $1, width: $2, height: $3")})
            g.fill(Path(roundedRect: park, cornerRadius: 10), with: .color(${tn("park")}))
            var footpath = Path()
            footpath.move(to: CGPoint(x: park.minX + 6, y: park.minY + 6))
            footpath.addLine(to: CGPoint(x: park.maxX - 6, y: park.maxY - 6))
            g.stroke(footpath, with: .color(block), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            g.drawLayer { layer in
                layer.opacity = shade
                for i in stride(from: 0, to: Self.cityBuildings.count, by: 5) {
                    let z = Self.cityBuildings[i + 4]
                    layer.fill(Self.cast(Self.box(Self.cityBuildings, i), CGVector(dx: s.dx * z, dy: s.dy * z)), with: .color(.black))
                }
                for i in stride(from: 0, to: Self.cityTrees.count, by: 3) {
                    let tree = Array(Self.cityTrees[i..<i + 3])
                    layer.fill(Self.dot(tree[0] + s.dx * tree[2] / 30, tree[1] + s.dy * tree[2] / 30, tree[2]), with: .color(.black))
                }
            }
            for i in stride(from: 0, to: Self.cityTrees.count, by: 3) {
                g.fill(Self.dot(Self.cityTrees[i], Self.cityTrees[i + 1], Self.cityTrees[i + 2]), with: .color(${tn("tree")}))
            }
            let roof = ${tn("roof")}, edge = ${tn("roofEdge")}
            for i in stride(from: 0, to: Self.cityBuildings.count, by: 5) {
                let shape = Path(roundedRect: Self.box(Self.cityBuildings, i), cornerRadius: 1.5)
                g.fill(shape, with: .color(roof))
                g.stroke(shape, with: .color(edge), lineWidth: 0.6)
            }
        case 2:
            // The hills: each contour step shades the one below it on the side away from the sun, then
            // takes its tint (lighter toward the top); the whole hill casts a soft shadow on the valley.
            let g = world(context, size, turn: 0, zoom: ${num(SUN_WORLD.hillZoom)})
            let reach = 2 + long * 1.6
            let vx = v.dx * reach, vy = v.dy * reach
            let low = ${px("low")}, high = ${px("high")}
            g.fill(Path(CGRect(x: -400, y: -400, width: 1200, height: 1400)), with: .color(Self.rgb(low)))
            for hill in Self.hills {
                let n = Int(hill[2])
                let outer = Self.contour(hill, n)
                g.drawLayer { layer in
                    layer.addFilter(.blur(radius: 18))
                    layer.fill(outer.offsetBy(dx: vx * 3, dy: vy * 3), with: .color(.black.opacity(shade * 0.8)))
                }
                g.fill(outer, with: .color(Self.rgb(low)))
                for k in stride(from: n - 1, through: 1, by: -1) {
                    let ring = Self.contour(hill, k)
                    g.drawLayer { layer in
                        layer.addFilter(.blur(radius: 3))
                        layer.fill(ring.offsetBy(dx: vx, dy: vy), with: .color(.black.opacity(shade * 0.35)))
                    }
                    g.fill(ring, with: .color(Self.mix(low, high, Double(n - k) / Double(n - 1))))
                }
                let line = ${tn("contour")}
                for k in 1...n {
                    // Every fourth line is an index contour, drawn heavier.
                    g.stroke(Self.contour(hill, k), with: .color(line.opacity(k % 4 == 0 ? 0.55 : 0.28)), lineWidth: k % 4 == 0 ? 1.1 : 0.6)
                }
            }
            let water = ${tn("water")}
            var sea = Path()
            sea.move(to: CGPoint(x: ${num(SUN_TERRAIN.shore[0])}, y: ${num(SUN_TERRAIN.shore[1])}))
            sea.addQuadCurve(to: CGPoint(x: ${num(SUN_TERRAIN.shore[4])}, y: ${num(SUN_TERRAIN.shore[5])}), control: CGPoint(x: ${num(SUN_TERRAIN.shore[2])}, y: ${num(SUN_TERRAIN.shore[3])}))
            sea.addQuadCurve(to: CGPoint(x: ${num(SUN_TERRAIN.shore[8])}, y: ${num(SUN_TERRAIN.shore[9])}), control: CGPoint(x: ${num(SUN_TERRAIN.shore[6])}, y: ${num(SUN_TERRAIN.shore[7])}))
            sea.addLine(to: CGPoint(x: 250, y: 900))
            sea.addLine(to: CGPoint(x: -200, y: 900))
            sea.addLine(to: CGPoint(x: -200, y: ${num(SUN_TERRAIN.shore[1])}))
            sea.closeSubpath()
            g.fill(sea, with: .color(water))
            var stream = Path()
            stream.move(to: CGPoint(x: ${num(SUN_TERRAIN.stream[0])}, y: ${num(SUN_TERRAIN.stream[1])}))
            stream.addCurve(to: CGPoint(x: ${num(SUN_TERRAIN.stream[6])}, y: ${num(SUN_TERRAIN.stream[7])}), control1: CGPoint(x: ${num(SUN_TERRAIN.stream[2])}, y: ${num(SUN_TERRAIN.stream[3])}), control2: CGPoint(x: ${num(SUN_TERRAIN.stream[4])}, y: ${num(SUN_TERRAIN.stream[5])}))
            g.stroke(stream, with: .color(water), style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
            g.drawLayer { layer in
                layer.opacity = shade
                for i in stride(from: 0, to: Self.woods.count, by: 3) {
                    layer.fill(Self.dot(Self.woods[i] + vx * 0.8, Self.woods[i + 1] + vy * 0.8, Self.woods[i + 2]), with: .color(.black))
                }
                for i in stride(from: 0, to: Self.houses.count, by: 5) {
                    let z = Self.houses[i + 4] * 1.6
                    layer.fill(Self.cast(Self.box(Self.houses, i), CGVector(dx: vx * z, dy: vy * z)), with: .color(.black))
                }
            }
            for i in stride(from: 0, to: Self.woods.count, by: 3) {
                g.fill(Self.dot(Self.woods[i], Self.woods[i + 1], Self.woods[i + 2]), with: .color(${tn("wood")}))
            }
            var trail = Path()
            trail.move(to: CGPoint(x: ${num(SUN_TERRAIN.trail[0])}, y: ${num(SUN_TERRAIN.trail[1])}))
            trail.addCurve(to: CGPoint(x: ${num(SUN_TERRAIN.trail[6])}, y: ${num(SUN_TERRAIN.trail[7])}), control1: CGPoint(x: ${num(SUN_TERRAIN.trail[2])}, y: ${num(SUN_TERRAIN.trail[3])}), control2: CGPoint(x: ${num(SUN_TERRAIN.trail[4])}, y: ${num(SUN_TERRAIN.trail[5])}))
            g.stroke(trail, with: .color(${tn("contour")}.opacity(0.8)), style: StrokeStyle(lineWidth: 1.4, lineCap: .round, dash: [3, 4]))
            var road = Path()
            road.move(to: CGPoint(x: ${num(SUN_TERRAIN.road[0])}, y: ${num(SUN_TERRAIN.road[1])}))
            road.addCurve(to: CGPoint(x: ${num(SUN_TERRAIN.road[6])}, y: ${num(SUN_TERRAIN.road[7])}), control1: CGPoint(x: ${num(SUN_TERRAIN.road[2])}, y: ${num(SUN_TERRAIN.road[3])}), control2: CGPoint(x: ${num(SUN_TERRAIN.road[4])}, y: ${num(SUN_TERRAIN.road[5])}))
            road.addCurve(to: CGPoint(x: ${num(SUN_TERRAIN.road[12])}, y: ${num(SUN_TERRAIN.road[13])}), control1: CGPoint(x: ${num(SUN_TERRAIN.road[8])}, y: ${num(SUN_TERRAIN.road[9])}), control2: CGPoint(x: ${num(SUN_TERRAIN.road[10])}, y: ${num(SUN_TERRAIN.road[11])}))
            g.stroke(road, with: .color(${tn("casing")}), style: StrokeStyle(lineWidth: 10, lineCap: .round))
            g.stroke(road, with: .color(${tn("road")}), style: StrokeStyle(lineWidth: 6.5, lineCap: .round))
            let roof = ${tn("roof")}, edge = ${tn("roofEdge")}
            for i in stride(from: 0, to: Self.houses.count, by: 5) {
                let shape = Path(roundedRect: Self.box(Self.houses, i), cornerRadius: 1.5)
                g.fill(shape, with: .color(roof))
                g.stroke(shape, with: .color(edge), lineWidth: 0.6)
            }
            // The summit, marked and named by its height.
            let peak = CGPoint(x: Self.hills[0][0], y: Self.hills[0][1])
            var mark = Path()
            mark.addLines([CGPoint(x: peak.x, y: peak.y - 5), CGPoint(x: peak.x + 5, y: peak.y + 4), CGPoint(x: peak.x - 5, y: peak.y + 4)])
            mark.closeSubpath()
            g.fill(mark, with: .color(ink.opacity(0.75)))
            g.draw(Text("528 m").font(.system(size: 10, weight: .semibold).monospacedDigit()).foregroundColor(ink.opacity(0.6)), at: CGPoint(x: peak.x + 9, y: peak.y), anchor: .leading)
        case 3:
            let sky: [Color] = sweep ? (lit ? [${SUN_SKY.light.map((c) => `Self.rgb(${hx(c)})`).join(", ")}] : [${SUN_SKY.dark.map((c) => `Self.rgb(${hx(c)})`).join(", ")}]) : [${SUN_SKY.day.map((c) => `Self.rgb(${hx(c)})`).join(", ")}]
            context.fill(Path(rect(0, 0, 1, 0.66)), with: .linearGradient(Gradient(colors: sky), startPoint: .zero, endPoint: CGPoint(x: 0, y: h * 0.66)))
            context.fill(Path(rect(0, 0.66, 1, 0.34)), with: .linearGradient(Gradient(colors: [${tn("lakeTop")}, ${tn("lakeBottom")}]), startPoint: CGPoint(x: 0, y: h * 0.66), endPoint: CGPoint(x: 0, y: h)))
            // Hills and the wooded shore stand on the right; the sun sets over open water on the left.
            var land = context
            land.translateBy(x: w, y: 0)
            land.scaleBy(x: -1, y: 1)
            var far = Path()
            far.move(to: CGPoint(x: w * 0.26, y: h * 0.66)); far.addQuadCurve(to: CGPoint(x: w, y: h * 0.585), control: CGPoint(x: w * 0.62, y: h * 0.53)); far.addLine(to: CGPoint(x: w, y: h * 0.66))
            land.fill(far, with: .color(${tn("farHills")}))
            var near = Path()
            near.move(to: CGPoint(x: w * 0.5, y: h * 0.66)); near.addQuadCurve(to: CGPoint(x: w, y: h * 0.63), control: CGPoint(x: w * 0.8, y: h * 0.605)); near.addLine(to: CGPoint(x: w, y: h * 0.66))
            land.fill(near, with: .color(${tn("nearHills")}))
            var shore = Path()
            shore.move(to: CGPoint(x: 0, y: h * 0.4)); shore.addQuadCurve(to: CGPoint(x: w * 0.62, y: h * 0.67), control: CGPoint(x: w * 0.3, y: h * 0.52)); shore.addLine(to: CGPoint(x: 0, y: h * 0.67))
            land.fill(shore, with: .color(${tn("shore")}))
            let pine = Self.pine + Self.pine.dropFirst().reversed().map { [-$0[0], $0[1]] }
            for k in 0..<7 {
                // Pines along the shore's rise, smaller toward the water, in three tiers.
                let u = 0.06 + Double(k) * 0.12, m = 1 - u
                let x = 2 * m * u * 0.3 * w + u * u * 0.62 * w + w * 0.02
                let base = m * m * 0.4 * h + 2 * m * u * 0.52 * h + u * u * 0.67 * h + h * 0.03
                let height = (0.21 - Double(k) * 0.018) * h, width = height * 0.36
                var tree = Path()
                tree.addLines(pine.map { CGPoint(x: x + $0[0] * width, y: base - $0[1] * height) })
                tree.closeSubpath()
                land.fill(tree, with: .color(${tn("trees")}))
            }
        default:
            if sweep {
                context.fill(Path(rect(0, 0, 1, 1)), with: .linearGradient(Gradient(colors: lit ? [Self.rgb(${hx(SUN_FIELD.light[0])}), Self.rgb(${hx(SUN_FIELD.light[1])})] : [Self.rgb(${hx(SUN_FIELD.dark[0])}), Self.rgb(${hx(SUN_FIELD.dark[1])})]), startPoint: .zero, endPoint: CGPoint(x: 0, y: h)))
            } else {
                context.fill(Path(rect(0, 0, 1, 1)), with: .linearGradient(Gradient(colors: [Color(red: 1, green: 0.84, blue: 0.12), Color(red: 0.97, green: 0.63, blue: 0.11)]), startPoint: CGPoint(x: w, y: 0), endPoint: CGPoint(x: 0, y: h)))
            }
        }
    }

    /// Over a map, the ground fades out under the time and under the place card, so both read.
    private func drawVeil(_ context: inout GraphicsContext, _ size: CGSize) {
        guard sweep, scene == 1 || scene == 2 else { return }
        let veil = scene == 1 ? ${tn("block")} : ${tn("low")}
        let w = size.width, h = size.height
        let top = Gradient(stops: [.init(color: veil.opacity(0.96), location: 0), .init(color: veil.opacity(0.7), location: 0.55), .init(color: veil.opacity(0), location: 1)])
        context.fill(Path(CGRect(x: 0, y: 0, width: w, height: h * 0.3)), with: .linearGradient(top, startPoint: .zero, endPoint: CGPoint(x: 0, y: h * 0.3)))
        context.fill(Path(CGRect(x: 0, y: h * 0.74, width: w, height: h * 0.26)), with: .linearGradient(Gradient(colors: [veil.opacity(0), veil.opacity(0.75)]), startPoint: CGPoint(x: 0, y: h * 0.74), endPoint: CGPoint(x: 0, y: h)))
    }

    // MARK: The dial

    private func sunPoint(_ c: CGPoint, _ r: CGFloat, _ t: Double) -> CGPoint {
        CGPoint(x: c.x - r * cos(.pi * t), y: c.y - r * 0.9 * sin(.pi * t) - r * 0.1)
    }

    private func drawDial(_ context: inout GraphicsContext, _ c: CGPoint, _ r: CGFloat) {
        let ink: Color = sweep ? (lit ? Color(white: 0.11) : .white) : scene == 0 ? Color(red: 0.35, green: 0.25, blue: 0.05) : Color(red: 0.2, green: 0.22, blue: 0.24)
        let floor = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r * 0.42, width: r * 2, height: r * 0.84))
        if sweep && scene == 0 { context.fill(floor, with: .color(Self.rgb(lit ? ${hx(SUN_FIELD.floorLight)} : ${hx(SUN_FIELD.floorDark)}))) }
        // Over a map the ground inside the ring is a lens, quieter than the streets around it.
        if scene == 1 || scene == 2 {
            let lens: Color = sweep ? (lit ? Color.white.opacity(0.62) : Self.rgb(0x070708).opacity(0.55)) : Color.white.opacity(0.4)
            context.fill(floor, with: .color(lens))
        }
        context.stroke(floor, with: .color(ink.opacity(sweep ? 0.22 : 0.35)), lineWidth: 1.5)
        if sweep {
            // The ground's compass: the sun rises on the left (east) and sets on the right (west).
            let letters: [(String, CGPoint)] = [("E", CGPoint(x: c.x - r * 0.8, y: c.y)), ("W", CGPoint(x: c.x + r * 0.8, y: c.y)), ("S", CGPoint(x: c.x, y: c.y - r * 0.26)), ("N", CGPoint(x: c.x, y: c.y + r * 0.26))]
            for (letter, point) in letters {
                context.draw(Text(letter).font(.system(size: 10, weight: .semibold)).foregroundColor(ink.opacity(0.45)), at: point)
            }
        }
        var arc = Path()
        for step in 0...60 {
            let p = sunPoint(c, r, Double(step) / 60)
            if step == 0 { arc.move(to: p) } else { arc.addLine(to: p) }
        }
        if sweep {
            context.stroke(arc, with: .linearGradient(Self.band, startPoint: CGPoint(x: c.x - r, y: 0), endPoint: CGPoint(x: c.x + r, y: 0)), style: StrokeStyle(lineWidth: 4, lineCap: .round))
        } else {
            context.stroke(arc, with: .color(ink.opacity(0.6)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
        }
        for hour in 1..<12 {
            let p = sunPoint(c, r, Double(hour) / 12)
            context.fill(Path(ellipseIn: CGRect(x: p.x - 2, y: p.y - 2, width: 4, height: 4)), with: .color(lit ? .black.opacity(0.35) : .white.opacity(0.8)))
        }
        // The shadow: away from the sun, longer the lower it is.
        let length = min(r * 1.6, r * 0.55 / tan(altitude * .pi / 180))
        let dx = cos(.pi * t), dy = 0.3
        let norm = max(0.001, hypot(dx, dy))
        let tip = CGPoint(x: c.x + dx / norm * length, y: c.y + r * 0.1 + dy / norm * length * 0.5)
        let sun = sunPoint(c, r, t)
        if scene == 0 {
            let half = r * 0.17
            // A column (sweep) or a cube (daylight) at the centre.
            let foot = sweep ? half * 0.45 : half
            let base = c.y + half * 0.4
            var shadow = Path()
            shadow.move(to: CGPoint(x: c.x - foot, y: base)); shadow.addLine(to: CGPoint(x: c.x + foot, y: base))
            shadow.addLine(to: CGPoint(x: tip.x + foot, y: tip.y + half * 0.4)); shadow.addLine(to: CGPoint(x: tip.x - foot, y: tip.y + half * 0.4)); shadow.closeSubpath()
            context.fill(shadow, with: .color(sweep ? .black.opacity(lit ? 0.2 : 0.7) : ink.opacity(0.55)))
            if sweep {
                let top = base - half * 2.8
                context.drawLayer { layer in
                    layer.addFilter(.blur(radius: 3))
                    layer.fill(Path(ellipseIn: CGRect(x: c.x - foot * 1.7, y: base - foot * 0.7, width: foot * 3.4, height: foot * 1.4)), with: .color(.black.opacity(lit ? 0.18 : 0.5)))
                }
                // Its lit side faces the sun.
                let lightX = dx > 0 ? c.x - foot : c.x + foot
                let side = GraphicsContext.Shading.linearGradient(Gradient(colors: [.white, Self.rgb(lit ? 0xC9C9CE : 0x8E8E93)]), startPoint: CGPoint(x: lightX, y: 0), endPoint: CGPoint(x: 2 * c.x - lightX, y: 0))
                context.fill(Path(CGRect(x: c.x - foot, y: top, width: foot * 2, height: base - top)), with: side)
                context.fill(Path(ellipseIn: CGRect(x: c.x - foot, y: base - foot * 0.42, width: foot * 2, height: foot * 0.84)), with: side)
                let cap = Path(ellipseIn: CGRect(x: c.x - foot, y: top - foot * 0.42, width: foot * 2, height: foot * 0.84))
                context.fill(cap, with: .color(.white))
                if lit { context.stroke(cap, with: .color(.black.opacity(0.08)), lineWidth: 1) }
            } else {
                let cube = CGRect(x: c.x - half, y: c.y - half * 1.4, width: half * 2, height: half * 2)
                context.fill(Path(roundedRect: cube.offsetBy(dx: 0, dy: half * 0.25), cornerRadius: half * 0.25), with: .color(Color(white: 0.8)))
                context.fill(Path(roundedRect: cube, cornerRadius: half * 0.25), with: .color(.white))
            }
        } else {
            let azure = sweep ? Self.azure : Color(red: 0.45, green: 0.62, blue: 0.9)
            var ray = Path(); ray.move(to: c); ray.addLine(to: tip)
            context.stroke(ray, with: .color(azure), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            context.fill(Self.dot(tip.x, tip.y, 3.5), with: .color(azure))
            var line = Path(); line.move(to: c); line.addLine(to: sun)
            context.stroke(line, with: .color(sweep ? Self.ember : .orange), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            // You are here.
            context.drawLayer { puck in
                puck.addFilter(.shadow(color: .black.opacity(0.3), radius: 2, y: 1))
                puck.fill(Self.dot(c.x, c.y, 7), with: .color(.white))
            }
            context.stroke(Self.dot(c.x, c.y, 7), with: .color(lit || !sweep ? Color(white: 0.11) : Self.rgb(0x070708)), lineWidth: 2.5)
        }
        context.drawLayer { glow in
            glow.addFilter(.shadow(color: sweep ? Self.ember.opacity(0.9) : .white.opacity(0.9), radius: 10))
            glow.fill(Path(ellipseIn: CGRect(x: sun.x - 13, y: sun.y - 13, width: 26, height: 26)), with: .color(.white))
        }
        if lit { context.stroke(Path(ellipseIn: CGRect(x: sun.x - 13, y: sun.y - 13, width: 26, height: 26)), with: .color(Self.ember), lineWidth: 1.5) }
    }

    /// Facing west over the sea: the sun comes down the band through the day and sets where it meets
    /// the horizon (the ring); below the horizon the path runs on, dotted.
    private func drawSkyPath(_ context: inout GraphicsContext, _ size: CGSize) {
        let w = size.width, h = size.height
        let a = CGPoint(x: 0, y: h * ${num(SKY_PATH.from)}), b = CGPoint(x: w, y: h * ${num(SKY_PATH.to)})
        func at(_ f: Double) -> CGPoint { CGPoint(x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f) }
        let set = at(${num(SKY_PATH.set)})
        let sun = at(${num(SKY_PATH.set)} + ${num(1 - SKY_PATH.set)} * pow(1 - t, 0.8))
        var below = Path(); below.move(to: a); below.addLine(to: set)
        context.stroke(below, with: .color((sweep && lit ? Color(white: 0.11) : .white).opacity(0.3)), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [2, 6]))
        var line = Path(); line.move(to: set); line.addLine(to: b)
        if sweep {
            context.stroke(line, with: .linearGradient(Self.band, startPoint: set, endPoint: b), style: StrokeStyle(lineWidth: 6, lineCap: .round))
        } else {
            context.stroke(line, with: .color(.white.opacity(0.7)), style: StrokeStyle(lineWidth: 6, lineCap: .round))
        }
        context.drawLayer { glow in
            glow.addFilter(.blur(radius: 30))
            glow.fill(Self.dot(sun.x, sun.y, 72), with: .color(sweep ? Self.ember.opacity(0.3 + 0.35 * t) : Color(red: 1, green: 0.95, blue: 0.8).opacity(0.9)))
        }
        // The sun's light on the water, under it.
        for glint in Self.glints {
            var streak = Path()
            streak.move(to: CGPoint(x: sun.x + glint[0] - glint[1] / 2, y: h * glint[2]))
            streak.addLine(to: CGPoint(x: sun.x + glint[0] + glint[1] / 2, y: h * glint[2]))
            context.stroke(streak, with: .color(.white.opacity(0.6 * (1 - (glint[2] - 0.67) * 2.6))), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
        }
        context.fill(Self.dot(set.x, set.y, 7), with: .color(.white))
        context.stroke(Self.dot(set.x, set.y, 7), with: .color(sweep ? Self.signal : .orange), lineWidth: 3)
        context.drawLayer { glow in
            glow.addFilter(.shadow(color: sweep ? Self.ember.opacity(0.9) : .white.opacity(0.9), radius: 6))
            glow.fill(Self.dot(sun.x, sun.y, 26), with: .color(.white))
        }
        if lit { context.stroke(Self.dot(sun.x, sun.y, 25.25), with: .color(Self.ember), lineWidth: 1.5) }
    }
`;

const DATA_SWIFT = `    private static let cityBlocks: [Double] = ${flat(SUN_CITY.blocks)}
    private static let cityBuildings: [Double] = ${flat(SUN_CITY.buildings)}
    private static let cityTrees: [Double] = ${flat(SUN_CITY.trees)}
    private static let river: [[Double]] = ${arr(SUN_CITY.river)}
    private static let hills: [[Double]] = ${arr(SUN_HILLS)}
    private static let woods: [Double] = ${flat(SUN_TERRAIN.woods)}
    private static let houses: [Double] = ${flat(SUN_TERRAIN.houses)}
    private static let pine: [[Double]] = ${arr(SUN_PINE)}
    private static let glints: [[Double]] = ${arr(SKY_GLINTS)}`;

const VIEW = [
  "private struct SunPath: View {",
  "    /// 0 field, 1 city map, 2 terrain map, 3 sky",
  "    var scene = 0",
  "    /// The SwiftPieces sweep palette (dark ground, signal → ember → blush → azure), or daylight.",
  "    var sweep = true",
  "    var sunrise: Double = 433",
  "    var sunset: Double = 1179",
  "    @State var now: Double = 1000",
  "    var place = \"\"",
  "    var region = \"\"",
  "    /// 0 none, 1 map button, 2 map tools, 3 camera tools",
  "    var toolbar = 0",
  "    var readouts = false",
  "    /// Inset as a rounded card under a header, instead of filling the screen edge to edge.",
  "    var framed = false",
  "    var corner: CGFloat = 28",
  "    var onPlace: () -> Void = {}",
  "    var onTool: () -> Void = {}",
  "",
  "    @State private var time: Double?",
  "    @State private var dragFrom: Double?",
  "    @State private var taps = 0",
  "    @State private var appeared = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @Environment(\\.colorScheme) private var colorScheme",
  "",
  "    /// The sweep palette in the light scheme: pale ground, dark ink, the same sweep arc.",
  "    private var lit: Bool { sweep && colorScheme == .light }",
  "    private var chromeInk: Color { lit ? Color(red: 0.078, green: 0.078, blue: 0.078) : .white }",
  "    private var chromeSurface: Color { lit ? Color.white.opacity(0.94) : Self.rgb(0x141416).opacity(0.94) }",
  "    private var chromeFill: Color { lit ? Color.black.opacity(0.06) : Color.white.opacity(0.12) }",
  "",
  "    private var minutes: Double { time ?? now }",
  "    private var t: Double { min(1, max(0, (minutes - sunrise) / max(1, sunset - sunrise))) }",
  "    private var altitude: Double { max(3, 62 * sin(.pi * t)) }",
  "",
  "    private static let signal = Color(red: 1, green: 0, blue: 0)",
  "    private static let ember = Color(red: 1, green: 0.478, blue: 0.235)",
  "    private static let blush = Color(red: 1, green: 0.561, blue: 0.722)",
  "    private static let azure = Color(red: 0.302, green: 0.553, blue: 1)",
  "    private static let band = Gradient(colors: [signal, ember, blush, azure])",
  "    private static func rgb(_ hex: UInt32) -> Color {",
  "        Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)",
  "    }",
  "",
  "    var body: some View {",
  "        GeometryReader { geo in",
  "            let size = geo.size",
  "            let center = CGPoint(x: size.width / 2, y: size.height * (sweep ? (framed ? 0.56 : 0.5) : 0.52))",
  "            let radius = size.width * (sweep && framed ? 0.35 : 0.32)",
  "            ZStack {",
  "                Canvas { context, size in",
  "                    drawScene(&context, size)",
  "                    drawVeil(&context, size)",
  "                    if scene == 3 { drawSkyPath(&context, size) } else { drawDial(&context, center, radius) }",
  "                }",
  "                // Entrance, once: the scene settles in from 0.95 with a fade, the chrome 40 ms after it.",
  "                .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "                .opacity(appeared ? 1 : 0)",
  "                .animation(.easeOut(duration: reduceMotion ? 0.2 : 0.3), value: appeared)",
  "                Group {",
  "                    if sweep { sweepChrome } else { dayChrome(size, center, radius) }",
  "                }",
  "                .scaleEffect(appeared || reduceMotion ? 1 : 0.95)",
  "                .opacity(appeared ? 1 : 0)",
  "                .animation(.easeOut(duration: reduceMotion ? 0.2 : 0.28).delay(reduceMotion ? 0 : 0.04), value: appeared)",
  "            }",
  "            .contentShape(Rectangle())",
  "            .gesture(",
  "                DragGesture(minimumDistance: 6)",
  "                    .onChanged { value in",
  "                        if dragFrom == nil { dragFrom = minutes }",
  "                        let span = sunset - sunrise",
  "                        let next = (dragFrom ?? minutes) + value.translation.width / size.width * span",
  "                        time = min(sunset, max(sunrise, (next / 5).rounded() * 5))",
  "                    }",
  "                    .onEnded { _ in dragFrom = nil }",
  "            )",
  "        }",
  "        .clipShape(RoundedRectangle(cornerRadius: framed ? corner : 0, style: .continuous))",
  "        .ignoresSafeArea(edges: framed ? [] : .all)",
  "        .sensoryFeedback(.selection, trigger: Int(minutes / 15))",
  "        .sensoryFeedback(.impact(weight: .light), trigger: taps)",
  "        .onAppear { appeared = true }",
  "    }",
  "",
  ...SCENES_SWIFT.split("\n"),
  "",
  "    // MARK: Chrome, SwiftPieces: the time big at the top, a card for the place at the bottom",
  "",
  "    private var sweepChrome: some View {",
  "        let alt = altitude, az = 90 + 180 * t",
  "        let moved = abs(minutes - now) >= 1",
  "        let label = Self.clock(minutes, pad: false)",
  "        return VStack(alignment: .leading, spacing: 8) {",
  "            Text(\"TODAY\").font(.caption.weight(.semibold)).foregroundStyle(chromeInk.opacity(0.6))",
  "            HStack(alignment: .firstTextBaseline, spacing: 8) {",
  "                // The time large and light, its AM/PM quieter beside it.",
  "                Text(String(label.dropLast(3)))",
  "                    .font(.system(size: 46, weight: .light).monospacedDigit())",
  "                    .contentTransition(.numericText())",
  "                Text(String(label.suffix(2)))",
  "                    .font(.title3.weight(.medium))",
  "                    .foregroundStyle(chromeInk.opacity(0.6))",
  "                Button {",
  "                    taps += 1",
  "                    withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.2)) { time = nil }",
  "                } label: {",
  "                    Text(\"Now\").font(.subheadline.weight(.semibold))",
  "                        .foregroundStyle(moved ? .white : chromeInk)",
  "                        .padding(.horizontal, 12).padding(.vertical, 6)",
  "                        .background(moved ? AnyShapeStyle(Self.signal) : AnyShapeStyle(chromeFill), in: Capsule())",
  "                        .frame(minHeight: 44)",
  "                        .contentShape(Rectangle())",
  "                }",
  "                .buttonStyle(SunPathPress())",
  "            }",
  "            if readouts {",
  "                HStack(spacing: 8) {",
  "                    chip(\"Shadow 1 : \" + (1 / tan(alt * .pi / 180)).formatted(.number.precision(.fractionLength(2))))",
  "                    chip(\"\\(Int(az))° \\(heading(az))\")",
  "                    chip(\"\\(Int(alt))° up\")",
  "                }",
  "            }",
  "            Spacer()",
  "            HStack {",
  "                Spacer()",
  "                switch toolbar {",
  "                case 1:",
  "                    Button(action: { taps += 1; onTool() }) { Label(\"Map\", systemImage: \"map\").font(.subheadline.weight(.semibold)) }",
  "                        .buttonStyle(.plain).padding(.horizontal, 14).padding(.vertical, 9)",
  "                        .background(chromeSurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))",
  "                case 2:",
  "                    HStack(spacing: 20) {",
  "                        Image(systemName: \"sun.max.fill\").foregroundStyle(Self.ember)",
  "                        Image(systemName: \"magnifyingglass\")",
  "                        Button(action: { taps += 1; onTool() }) { Image(systemName: \"square.3.layers.3d\") }.buttonStyle(.plain)",
  "                        Image(systemName: \"location\")",
  "                    }",
  "                    .padding(.horizontal, 18).padding(.vertical, 11)",
  "                    .background(chromeSurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))",
  "                case 3:",
  "                    HStack(spacing: 22) {",
  "                        Image(systemName: \"calendar\")",
  "                        Button(action: { taps += 1; onTool() }) { Image(systemName: \"viewfinder\") }.buttonStyle(.plain)",
  "                        Image(systemName: \"sun.max\")",
  "                    }",
  "                    .padding(.horizontal, 18).padding(.vertical, 11)",
  "                    .background(chromeSurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))",
  "                default:",
  "                    EmptyView()",
  "                }",
  "                Spacer()",
  "            }",
  "            if !place.isEmpty {",
  "                Button(action: { taps += 1; onPlace() }) {",
  "                    HStack(spacing: 12) {",
  "                        Circle().fill(AngularGradient(gradient: Self.band, center: .center)).frame(width: 30, height: 30)",
  "                        VStack(alignment: .leading, spacing: 1) {",
  "                            Text(place).font(.headline)",
  "                            Text(region).font(.caption).foregroundStyle(chromeInk.opacity(0.6))",
  "                        }",
  "                        Spacer()",
  "                        Image(systemName: \"chevron.up\").font(.footnote.weight(.bold)).frame(width: 36, height: 36).background(chromeFill, in: Circle())",
  "                    }",
  "                    .padding(12)",
  "                    .background(chromeSurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))",
  "                    .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))",
  "                }",
  "                .buttonStyle(SunPathPress())",
  "            }",
  "        }",
  "        .foregroundStyle(chromeInk)",
  "        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)",
  "        .padding(.horizontal, framed ? 16 : 20)",
  "        .padding(.top, framed ? 18 : 64)",
  "        .padding(.bottom, framed ? 16 : 30)",
  "    }",
  "",
  "    private func chip(_ text: String) -> some View {",
  "        Text(text)",
  "            .font(.footnote.weight(.semibold).monospacedDigit())",
  "            .padding(.horizontal, 10)",
  "            .padding(.vertical, 5)",
  "            .background(chromeFill, in: RoundedRectangle(cornerRadius: 8, style: .continuous))",
  "    }",
  "",
  "    // MARK: Chrome, daylight: pills beside the dial, a capsule place bar",
  "",
  "    @ViewBuilder private func dayChrome(_ size: CGSize, _ c: CGPoint, _ r: CGFloat) -> some View {",
  "        let dark = scene == 0 ? Color(red: 0.35, green: 0.25, blue: 0.05) : Color(red: 0.16, green: 0.2, blue: 0.26)",
  "        VStack(spacing: 12) {",
  "            if readouts {",
  "                let alt = altitude, az = 90 + 180 * t",
  "                HStack(spacing: 8) {",
  "                    pill(\"1 : \" + (1 / tan(alt * .pi / 180)).formatted(.number.precision(.fractionLength(2))), dark)",
  "                    pill(\"\\(Int(az))° \\(heading(az))\", dark)",
  "                    pill(\"\\(Int(alt))°\", dark)",
  "                }",
  "                .padding(.top, 60)",
  "            }",
  "            Spacer()",
  "            switch toolbar {",
  "            case 1:",
  "                Button(action: { taps += 1; onTool() }) { Label(\"Map\", systemImage: \"map\").font(.subheadline.weight(.semibold)) }",
  "                    .buttonStyle(.plain).foregroundStyle(.white).padding(.horizontal, 12).padding(.vertical, 7).background(dark.opacity(0.75), in: Capsule())",
  "            case 2:",
  "                HStack(spacing: 18) {",
  "                    Image(systemName: \"sun.max.fill\").foregroundStyle(.orange)",
  "                    Image(systemName: \"magnifyingglass\")",
  "                    Text(\"2D\").font(.subheadline.weight(.bold))",
  "                    Button(action: { taps += 1; onTool() }) { Image(systemName: \"square.3.layers.3d\") }.buttonStyle(.plain)",
  "                    Image(systemName: \"location.north.circle\")",
  "                }",
  "                .foregroundStyle(.white).padding(.horizontal, 18).padding(.vertical, 10).background(dark.opacity(0.8), in: Capsule())",
  "            case 3:",
  "                HStack(spacing: 22) {",
  "                    Image(systemName: \"calendar\")",
  "                    Button(action: { taps += 1; onTool() }) { Image(systemName: \"viewfinder\") }.buttonStyle(.plain)",
  "                    Image(systemName: \"sun.max\")",
  "                }",
  "                .foregroundStyle(.white).padding(.horizontal, 18).padding(.vertical, 10).background(dark.opacity(0.7), in: Capsule())",
  "            default:",
  "                EmptyView()",
  "            }",
  "            if !place.isEmpty {",
  "                Button(action: { taps += 1; onPlace() }) {",
  "                    HStack {",
  "                        Image(systemName: \"camera.aperture\").frame(width: 40, height: 40).background(.white.opacity(0.12), in: Circle())",
  "                        Spacer()",
  "                        VStack(spacing: 1) {",
  "                            Text(place).font(.subheadline.weight(.semibold))",
  "                            Text(region.uppercased()).font(.caption2).opacity(0.7)",
  "                        }",
  "                        Spacer()",
  "                        Image(systemName: \"ellipsis\").frame(width: 40, height: 40).background(.white.opacity(0.12), in: Circle())",
  "                    }",
  "                    .foregroundStyle(.white)",
  "                    .padding(8)",
  "                    .background(dark.opacity(0.85), in: Capsule())",
  "                }",
  "                .buttonStyle(.plain)",
  "            }",
  "        }",
  "        .frame(maxWidth: .infinity, maxHeight: .infinity)",
  "        .padding(.horizontal, 20)",
  "        .padding(.bottom, 30)",
  "        .overlay(alignment: .topLeading) {",
  "            pill(\"Today\", .white, ink: .black).offset(x: 16, y: c.y + r * 0.45)",
  "        }",
  "        .overlay(alignment: .topTrailing) {",
  "            VStack(alignment: .trailing, spacing: r * 0.6) {",
  "                Button {",
  "                    withAnimation(.bouncy) { time = nil }",
  "                } label: { pill(\"Now\", dark.opacity(0.85)) }",
  "                .buttonStyle(.plain)",
  "                pill(Self.clock(minutes, pad: true), .white, ink: .black)",
  "                    .contentTransition(.numericText())",
  "            }",
  "            .offset(x: -16, y: c.y - r * 0.55)",
  "        }",
  "    }",
  "",
  "    private func pill(_ text: String, _ fill: Color, ink: Color = .white) -> some View {",
  "        Text(text)",
  "            .font(.subheadline.weight(.semibold).monospacedDigit())",
  "            .foregroundStyle(ink)",
  "            .padding(.horizontal, 12)",
  "            .padding(.vertical, 6)",
  "            .background(fill, in: Capsule())",
  "    }",
  "",
  "    private func heading(_ az: Double) -> String {",
  "        [\"N\", \"NE\", \"E\", \"SE\", \"S\", \"SW\", \"W\", \"NW\"][Int((az / 45).rounded()) % 8]",
  "    }",
  "",
  "    static func clock(_ minutes: Double, pad: Bool) -> String {",
  "        let m = Int(minutes.rounded()) % 1440, h = m / 60",
  "        return String(format: pad ? \"%02d:%02d %@\" : \"%d:%02d %@\", h % 12 == 0 ? 12 : h % 12, m % 60, h < 12 ? \"AM\" : \"PM\")",
  "    }",
  "",
  ...DATA_SWIFT.split("\n"),
  "}",
  "",
  "/// Press feedback for the sun path's buttons: 0.97, under 150 ms.",
  "private struct SunPathPress: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)",
  "    }",
  "}",
];

const SCENE_IDS = ["plain", "city", "terrain", "sky"];
const TOOLBAR_IDS = ["none", "map-pill", "map-tools", "sky-tools"];

export const sunPath: SwiftPieceDefinition = {
  id: "sun-path",
  name: "Sun Path",
  category: "pieces",
  description: "The sun's arc over a place with the sun at any time of day and the shadow it casts. Drag sideways to move through the day.",
  availability: "free",
  preview: { component: "sun-path", chunk: "app-pieces" },
  card: (p) => (p.frame === "card" ? Number(p.radius ?? 28) : null),
  icon: "sun.max",
  concepts: ["gesture", "state", "formatstyle"],
  anatomy: [
    { part: "Scene", props: ["scene", "palette", "height", "frame", "radius"] },
    { part: "Day", props: ["sunrise", "sunset", "now"] },
    { part: "Readouts", props: ["readouts"] },
    { part: "Place bar", props: ["place", "region", "link"] },
    { part: "Toolbar", props: ["toolbar", "toolLink"] },
  ],
  interactions: ["drag", "scrub", "tap", "press", "spring", "haptic"],
  variants: [
    { id: "field", label: "Field", props: { scene: "plain", toolbar: "map-pill", readouts: false, now: "4:10 PM" } },
    { id: "city", label: "City shadows", props: { scene: "city", toolbar: "map-tools", readouts: false, now: "5:15 PM" } },
    { id: "terrain", label: "Hill shadows", props: { scene: "terrain", toolbar: "map-tools", readouts: false, now: "5:40 PM", place: "Sintra hills", region: "Sintra, Portugal · WEST" } },
    { id: "sky", label: "Sky view", props: { scene: "sky", toolbar: "sky-tools", readouts: true, now: "5:50 PM", place: "Cascais coast", region: "Cascais, Portugal · WEST" } },
    { id: "card", label: "Rounded card", props: { frame: "card", height: 480, scene: "plain", toolbar: "none", readouts: false, now: "4:10 PM" } },
    { id: "daylight", label: "Daylight palette", props: { palette: "daylight", scene: "plain", toolbar: "map-pill", readouts: false, now: "4:10 PM" } },
  ],
  states: [
    { id: "morning", label: "Morning", props: { now: "8:45 AM" } },
    { id: "noon", label: "Solar noon", props: { now: "1:22 PM" } },
  ],
  properties: [
    select("scene", "Scene", "plain", opts(...Object.entries(SUN_SCENES).map(([id, v]): [string, string] => [id, v.label])), { group: "color" }),
    number("height", "Height", 0, 0, 900, 10, { group: "layout", hint: "0 fills the screen; a height leaves room for things below it." }),
    select("frame", "Frame", "bleed", opts(["bleed", "Edge to edge"], ["card", "Rounded card"]), { group: "layout", hint: "A rounded card sits inside the screen's margins, under a header." }),
    number("radius", "Corner radius", 28, 0, 40, 1, { group: "layout", hint: "The card's corners; match the app's card radius.", when: { prop: "frame", equals: ["card"] } }),
    select("palette", "Palette", "sweep", opts(["sweep", "SwiftPieces sweep"], ["daylight", "Daylight"]), { group: "color" }),
    text("sunrise", "Sunrise", "7:24 AM", { maxLength: 10 }),
    text("sunset", "Sunset", "7:21 PM", { maxLength: 10 }),
    text("now", "Now", "4:10 PM", { maxLength: 10, group: "state", hint: "Where the sun starts, and where Now brings it back." }),
    bool("readouts", "Readouts", false, { hint: "Shadow ratio, azimuth and altitude along the top." }),
    text("place", "Place", "Alfama, Lisbon", { maxLength: 40, hint: "The place bar at the bottom. Leave empty to hide it." }),
    text("region", "Region", "Lisbon, Portugal · WEST", { maxLength: 40 }),
    select("toolbar", "Toolbar", "map-pill", opts(...Object.entries(SUN_TOOLBARS))),
    link("link", "Tap the place bar"),
    link("toolLink", "Tap the toolbar", { when: { prop: "toolbar", notEquals: ["none"] } }),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("SunPath", VIEW);
      const rise = parseClock(p.sunrise, 433);
      const set = parseClock(p.sunset, 1179);
      const now = parseClock(p.now, 1000);
      const scene = Math.max(0, SCENE_IDS.indexOf(s(p, "scene")));
      const toolbar = Math.max(0, TOOLBAR_IDS.indexOf(s(p, "toolbar")));
      const onPlace = linkAction(ctx, p.link);
      const onTool = toolbar > 0 ? linkAction(ctx, p.toolLink) : null;
      const lines = call("SunPath", [
        scene > 0 && ["scene", String(scene)],
        s(p, "palette") === "daylight" && ["sweep", "false"],
        rise !== 433 && ["sunrise", num(rise)],
        set !== 1179 && ["sunset", num(set)],
        ["now", num(now)],
        s(p, "place").trim() && ["place", ctx.str(s(p, "place").trim())],
        s(p, "region").trim() && ["region", ctx.str(s(p, "region").trim())],
        toolbar > 0 && ["toolbar", String(toolbar)],
        b(p, "readouts") && ["readouts", "true"],
        s(p, "frame") === "card" && ["framed", "true"],
        s(p, "frame") === "card" && p.radius != null && Number(p.radius) !== 28 && ["corner", num(Number(p.radius))],
        onPlace && ["onPlace", onPlace],
        onTool && ["onTool", onTool],
      ]);
      // It fills the screen (out past the screen's padding and under the status bar), or takes a
      // set height at the top with room below it.
      const height = Number(p.height ?? 0);
      if (s(p, "frame") === "card") return { lines: modifiers(lines, [`frame(height: ${num(height > 0 ? height : 520)})`]) };
      if (height > 0) return { lines: modifiers(lines, [`frame(height: ${num(height)})`, "padding(.horizontal, -24)", "padding(.top, -24)"]) };
      return { lines: modifiers(lines, ["padding(-24)", "frame(maxHeight: .infinity)"]) };
    },
  },
};
