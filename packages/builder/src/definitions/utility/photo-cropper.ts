// Photo Cropper: a crop step for a picked photo. The photo sits in a dark well under a frame of the chosen aspect;
// pinch, pan and double-tap frame it, chips switch the aspect, rotate turns it a quarter, and Choose renders the
// crop at the original's resolution, then follows the After Choose link when there is one. The emitter calls
// `PhotoCropper(image:aspect:…)` (or `framing:` when the screen starts zoomed or turned) exactly as
// registry/swift/media/PhotoCropper.swift declares it, with a sample photo drawn in code from the same shapes the
// Playground renderer draws.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, num } from "../../core/swift.js";
import { bool, link, linkStatement, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

// ---------------------------------------------------------------- The sample photo

/** One shape of the sample photo, in a 1600 x 1200 design space. Curves are cubic: [c1x, c1y, c2x, c2y, x, y]. */
export type CropShape =
  | { kind: "rect"; fill: string; x: number; y: number; w: number; h: number; r?: number }
  | { kind: "oval"; fill: string; cx: number; cy: number; rx: number; ry: number }
  /** A filled hill: from `from` along the curves, then down to the bottom corners. */
  | { kind: "land"; fill: string; from: [number, number]; curves: number[][] }
  /** A stroked line: segments of [x, y] (straight) or six numbers (a cubic). */
  | { kind: "stroke"; color: string; width: number; from: [number, number]; to: number[][] };

const SKY = "#9CC2FF", SUN = "#FFD976", PAPER = "#F4F3EF", LILAC = "#CDB8FF", SAGE = "#A9DCB7", SAND = "#E9D5B3", INK = "#141414", RED = "#FF0000";

/** Sky, sun, clouds, layered hills, cypresses and a red tram under its wire: the photo the piece's own preview draws. */
export const CROP_SCENE: CropShape[] = [
  { kind: "rect", fill: SKY, x: 0, y: 0, w: 1600, h: 1200 },
  { kind: "oval", fill: SUN, cx: 1215, cy: 285, rx: 105, ry: 105 },
  { kind: "rect", fill: PAPER, x: 262, y: 300, w: 268, h: 56, r: 28 },
  { kind: "oval", fill: PAPER, cx: 352, cy: 300, rx: 50, ry: 50 },
  { kind: "oval", fill: PAPER, cx: 436, cy: 286, rx: 62, ry: 62 },
  { kind: "rect", fill: PAPER, x: 930, y: 212, w: 176, h: 38, r: 19 },
  { kind: "oval", fill: PAPER, cx: 990, cy: 212, rx: 32, ry: 32 },
  { kind: "oval", fill: PAPER, cx: 1046, cy: 204, rx: 40, ry: 40 },
  { kind: "land", fill: LILAC, from: [0, 690], curves: [[180, 560, 380, 560, 560, 650], [720, 730, 860, 560, 1060, 590], [1260, 620, 1380, 540, 1600, 600]] },
  { kind: "land", fill: SAGE, from: [0, 840], curves: [[260, 720, 520, 760, 760, 820], [1000, 880, 1260, 760, 1600, 790]] },
  { kind: "oval", fill: INK, cx: 196, cy: 770, rx: 16, ry: 48 },
  { kind: "oval", fill: INK, cx: 236, cy: 784, rx: 12, ry: 36 },
  { kind: "oval", fill: INK, cx: 1372, cy: 752, rx: 15, ry: 46 },
  { kind: "oval", fill: INK, cx: 1408, cy: 766, rx: 11, ry: 32 },
  { kind: "land", fill: SAND, from: [0, 980], curves: [[400, 900, 1000, 930, 1600, 960]] },
  { kind: "rect", fill: INK, x: 0, y: 1048, w: 1600, h: 7 },
  { kind: "rect", fill: INK, x: 0, y: 1070, w: 1600, h: 7 },
  { kind: "stroke", color: INK, width: 5, from: [0, 790], to: [[540, 812, 1060, 812, 1600, 786]] },
  { kind: "stroke", color: INK, width: 5, from: [748, 838], to: [[790, 806], [832, 838]] },
  { kind: "rect", fill: RED, x: 560, y: 858, w: 440, h: 170, r: 34 },
  { kind: "rect", fill: PAPER, x: 588, y: 838, w: 384, h: 30, r: 15 },
  ...[592, 680, 768, 856].map((x): CropShape => ({ kind: "rect", fill: INK, x, y: 888, w: 70, h: 58, r: 12 })),
  { kind: "rect", fill: INK, x: 944, y: 888, w: 40, h: 58, r: 12 },
  { kind: "rect", fill: PAPER, x: 560, y: 964, w: 440, h: 12 },
  { kind: "oval", fill: INK, cx: 640, cy: 1030, rx: 24, ry: 24 },
  { kind: "oval", fill: INK, cx: 920, cy: 1030, rx: 24, ry: 24 },
  { kind: "oval", fill: SUN, cx: 986, cy: 996, rx: 9, ry: 9 },
];

const hex = (h: string) => `0x${h.replace("#", "").toUpperCase()}`;
const pt = (x: number, y: number) => `CGPoint(x: ${num(x)}, y: ${num(y)})`;

/** `CropSample`: the scene drawn with UIKit at 2400 x 1800 pixels, so the generated screen runs without assets. */
function samplePhotoSwift(): string[] {
  const i = INDENT;
  const draw: string[] = [];
  for (const shape of CROP_SCENE) {
    if (shape.kind === "rect") {
      const rect = `CGRect(x: ${num(shape.x)}, y: ${num(shape.y)}, width: ${num(shape.w)}, height: ${num(shape.h)})`;
      draw.push(shape.r ? `fill(${hex(shape.fill)}, UIBezierPath(roundedRect: ${rect}, cornerRadius: ${num(shape.r)}))` : `fill(${hex(shape.fill)}, UIBezierPath(rect: ${rect}))`);
    } else if (shape.kind === "oval") {
      draw.push(`fill(${hex(shape.fill)}, UIBezierPath(ovalIn: CGRect(x: ${num(shape.cx - shape.rx)}, y: ${num(shape.cy - shape.ry)}, width: ${num(shape.rx * 2)}, height: ${num(shape.ry * 2)})))`);
    } else if (shape.kind === "land") {
      draw.push(`fill(${hex(shape.fill)}, land(from: ${pt(shape.from[0], shape.from[1])}, [`);
      shape.curves.forEach(([a, b2, c, d, e, f]) => draw.push(`${i}(${pt(a, b2)}, ${pt(c, d)}, ${pt(e, f)}),`));
      draw.push("]))");
    } else {
      draw.push("do {");
      draw.push(`${i}let line = UIBezierPath()`);
      draw.push(`${i}line.move(to: ${pt(shape.from[0], shape.from[1])})`);
      for (const seg of shape.to) {
        draw.push(seg.length === 6 ? `${i}line.addCurve(to: ${pt(seg[4], seg[5])}, controlPoint1: ${pt(seg[0], seg[1])}, controlPoint2: ${pt(seg[2], seg[3])})` : `${i}line.addLine(to: ${pt(seg[0], seg[1])})`);
      }
      draw.push(`${i}line.lineWidth = ${num(shape.width)}`, `${i}line.lineJoinStyle = .round`, `${i}color(${hex(shape.color)}).setStroke()`, `${i}line.stroke()`, "}");
    }
  }
  return [
    "/// A sample photo drawn in code, 2400 by 1800 pixels. In your app the photo comes from a PhotosPicker",
    "/// or the camera; keep it in state so the cropper isn't reset on every update.",
    "enum CropSample {",
    `${i}static let photo: UIImage = {`,
    `${i}${i}let format = UIGraphicsImageRendererFormat()`,
    `${i}${i}format.scale = 1`,
    `${i}${i}format.opaque = true`,
    `${i}${i}return UIGraphicsImageRenderer(size: CGSize(width: 2400, height: 1800), format: format).image { context in`,
    `${i}${i}${i}context.cgContext.scaleBy(x: 1.5, y: 1.5)`,
    `${i}${i}${i}func color(_ hex: UInt32) -> UIColor {`,
    `${i}${i}${i}${i}UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)`,
    `${i}${i}${i}}`,
    `${i}${i}${i}func fill(_ hex: UInt32, _ path: UIBezierPath) {`,
    `${i}${i}${i}${i}color(hex).setFill()`,
    `${i}${i}${i}${i}path.fill()`,
    `${i}${i}${i}}`,
    `${i}${i}${i}func land(from start: CGPoint, _ curves: [(CGPoint, CGPoint, CGPoint)]) -> UIBezierPath {`,
    `${i}${i}${i}${i}let path = UIBezierPath()`,
    `${i}${i}${i}${i}path.move(to: start)`,
    `${i}${i}${i}${i}for (c1, c2, end) in curves { path.addCurve(to: end, controlPoint1: c1, controlPoint2: c2) }`,
    `${i}${i}${i}${i}path.addLine(to: CGPoint(x: 1600, y: 1200))`,
    `${i}${i}${i}${i}path.addLine(to: CGPoint(x: 0, y: 1200))`,
    `${i}${i}${i}${i}path.close()`,
    `${i}${i}${i}${i}return path`,
    `${i}${i}${i}}`,
    ...indent(draw, 3),
    `${i}${i}}`,
    `${i}}()`,
    "}",
  ];
}

// ---------------------------------------------------------------- Aspects

export type CropAspect = {
  /** Stable key: "circle", "original" or "w:h" in lowest terms. */
  id: string;
  /** The chip's title. */
  title: string;
  /** Width over height; null for the photo's own shape. */
  ratio: number | null;
  circle: boolean;
  /** How the Swift writes it. */
  swift: string;
};

const BUILT_IN: Record<string, CropAspect> = {
  circle: { id: "circle", title: "Circle", ratio: 1, circle: true, swift: ".circle" },
  "1:1": { id: "1:1", title: "Square", ratio: 1, circle: false, swift: ".square" },
  "4:5": { id: "4:5", title: "4:5", ratio: 0.8, circle: false, swift: ".portrait" },
  "16:9": { id: "16:9", title: "16:9", ratio: 16 / 9, circle: false, swift: ".landscape" },
  original: { id: "original", title: "Original", ratio: null, circle: false, swift: ".original" },
};

/** The starting aspect's choices, by prop value. */
export const START_ASPECTS: Record<string, CropAspect> = {
  circle: BUILT_IN.circle,
  square: BUILT_IN["1:1"],
  portrait: BUILT_IN["4:5"],
  landscape: BUILT_IN["16:9"],
  original: BUILT_IN.original,
};

export const DEFAULT_TILES = "Circle, Square, 4:5, 16:9, Original";

const gcd = (a: number, c: number): number => (c ? gcd(c, a % c) : a);

/** "Circle, Square, 4:5, 3:2" to aspects: names or whole-number ratios, repeats dropped, at most six. */
export function parseAspects(value: unknown): CropAspect[] {
  const out: CropAspect[] = [];
  for (const raw of String(value ?? "").split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    let aspect: CropAspect | undefined;
    if (token === "circle") aspect = BUILT_IN.circle;
    else if (token === "square") aspect = BUILT_IN["1:1"];
    else if (token === "original") aspect = BUILT_IN.original;
    else {
      const m = /^(\d{1,3})\s*[:x×/]\s*(\d{1,3})$/.exec(token);
      if (m && Number(m[1]) > 0 && Number(m[2]) > 0) {
        const g = gcd(Number(m[1]), Number(m[2]));
        const w = Number(m[1]) / g, h = Number(m[2]) / g;
        aspect = BUILT_IN[`${w}:${h}`] ?? { id: `${w}:${h}`, title: `${w}:${h}`, ratio: w / h, circle: false, swift: `.ratio(${w}, ${h})` };
      }
    }
    if (aspect && !out.some((a) => a.id === aspect.id)) out.push(aspect);
    if (out.length === 6) break;
  }
  return out;
}

const DEFAULT_SWIFT = parseAspects(DEFAULT_TILES).map((a) => a.swift).join(", ");

// ---------------------------------------------------------------- Definition

export const definition: SwiftPieceDefinition = {
  id: "photo-cropper",
  name: "Photo Cropper",
  category: "pieces",
  description: "A crop step after picking a photo. Pinch and drag to frame it (it always fills the frame and springs back past the edges), pick circle, square, 4:5, 16:9 or the photo's own shape, turn it a quarter, then Choose renders the crop at full resolution.",
  availability: "free",
  preview: { component: "photo-cropper", chunk: "pieces-utility" },
  source: { registry: "free", name: "PhotoCropper" },
  docs: "/docs/components/media/photo-cropper",
  icon: "crop",
  concepts: ["state", "binding", "gesture", "closure", "async", "enum"],
  interactions: ["drag", "tap", "press", "select", "spring", "loading", "haptic", "transition"],
  properties: [
    select("aspect", "Starts as", "square", opts(["circle", "Circle"], ["square", "Square"], ["portrait", "4:5 portrait"], ["landscape", "16:9 landscape"], ["original", "The photo's own shape"]), { group: "shape" }),
    text("aspects", "Aspect chips", DEFAULT_TILES, { maxLength: 80, hint: "Names or ratios such as 3:2, separated by commas. One or none hides the chips for a fixed frame." }),
    bool("cancel", "Cancel button", true, { group: "interaction", hint: "Dismisses the screen." }),
    link("link", "After Choose", { hint: "Where Choose goes once the crop is ready, such as back to the screen that opened it. Empty stays on the cropper." }),
    number("zoom", "Starting zoom", 1, 1, 5, 0.1, { group: "state", hint: "Zoom relative to filling the frame. Above 1, the screen binds a Framing so it can start there." }),
    select("turns", "Starting rotation", "0", opts(["0", "Upright"], ["1", "Quarter turn left"], ["2", "Half turn"], ["3", "Quarter turn right"]), { group: "state" }),
    select("photo", "Photo", "sample", opts(["sample", "Sample photo"], ["missing", "Can't be opened"]), { group: "state", hint: "Can't be opened shows the failed state." }),
    select("simulate", "Preview as", "editing", opts(["editing", "Editing"], ["cropping", "Cropping"]), { group: "state", hint: "Only for this preview. In the app Choose spins while the crop renders." }),
    number("maxOutput", "Largest output (px)", 4096, 512, 8192, 256, { level: "advanced", hint: "The longest side of the rendered crop. Smaller crops keep the photo's own pixels." }),
  ],
  variants: [
    { id: "avatar", label: "Profile photo", props: { aspect: "circle", aspects: "Circle, Square", cancel: true, zoom: 1, turns: "0" } },
    { id: "post", label: "Post", props: { aspect: "portrait", aspects: "Square, 4:5, 16:9", cancel: true, zoom: 1, turns: "0" } },
    { id: "cover", label: "Cover image", props: { aspect: "landscape", aspects: "16:9, 3:1, Original", cancel: true, zoom: 1, turns: "0" } },
    { id: "fixed", label: "Fixed square", props: { aspect: "square", aspects: "", cancel: false, zoom: 1, turns: "0" } },
  ],
  states: [
    { id: "ready", label: "Ready", props: { zoom: 1, turns: "0", photo: "sample", simulate: "editing" } },
    { id: "zoomed", label: "Zoomed in", props: { zoom: 2.2, turns: "0", photo: "sample", simulate: "editing" } },
    { id: "turned", label: "Turned", props: { zoom: 1, turns: "1", photo: "sample", simulate: "editing" } },
    { id: "cropping", label: "Cropping", props: { zoom: 1, turns: "0", photo: "sample", simulate: "cropping" } },
    { id: "failed", label: "Can't open", props: { zoom: 1, turns: "0", photo: "missing", simulate: "editing" } },
  ],
  anatomy: [
    { part: "Photo", props: ["photo", "zoom", "turns"] },
    { part: "Frame", props: ["aspect"] },
    { part: "Aspect chips", props: ["aspects"] },
    { part: "Buttons", props: ["cancel", "link", "simulate"] },
    { part: "Output", props: ["maxOutput"] },
  ],
  swift: {
    imports: ["UIKit"],
    emit(p, ctx) {
      ctx.import("UIKit");
      const missing = s(p, "photo") === "missing";
      if (!missing) ctx.declare("CropSample", samplePhotoSwift());
      const photo = ctx.state("photo", "", missing ? "UIImage()" : "CropSample.photo");
      const start = START_ASPECTS[s(p, "aspect")] ?? START_ASPECTS.square;
      const zoom = Math.min(Math.max(Math.round((n(p, "zoom") || 1) * 10) / 10, 1), 5);
      const turns = (Math.round(n(p, "turns")) % 4 + 4) % 4;
      // Starting zoomed or turned needs the framing binding; otherwise the plain aspect init.
      let framing: [string, string] | false = start.swift !== ".square" && ["aspect", start.swift];
      if (zoom !== 1 || turns !== 0) {
        const initial = call("PhotoCropper.Framing", [start.swift !== ".square" && ["aspect", start.swift], zoom !== 1 && ["zoom", num(zoom)], turns !== 0 && ["quarterTurns", String(turns)]]).join(" ");
        framing = ["framing", `$${ctx.state("framing", "", initial)}`];
      }
      const tiles = parseAspects(p.aspects).map((a) => a.swift).join(", ");
      const cropped = ctx.state("cropped", "UIImage?", "nil");
      const max = Math.round(n(p, "maxOutput") || 4096);
      const cancel = b(p, "cancel") ? ctx.dismiss() : null;
      const head = call("PhotoCropper", [
        ["image", photo],
        framing,
        tiles !== DEFAULT_SWIFT && ["aspects", `[${tiles}]`],
        max !== 4096 && ["maxOutputDimension", num(max)],
        // A Style accent reaches Choose, the selected chip and the limit flash.
        ctx.theme && ["style", ".init(accent: Theme.accent, accentInk: Theme.accentInk)"],
        cancel && ["onCancel", `{ ${cancel}() }`],
      ]);
      head[head.length - 1] += " { crop in";
      // After Choose: the link runs once the crop is kept (a sheet usually goes back).
      const then = linkStatement(ctx, p.link);
      const lines = [
        ...head,
        ...indent([
          "// Upload or keep the crop here; Choose spins until this returns. crop.rect and",
          "// crop.quarterTurns repeat it on the original, on a server.",
          `${cropped} = crop.image`,
          ...(then ? [then] : []),
        ]),
        "}",
      ];
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
