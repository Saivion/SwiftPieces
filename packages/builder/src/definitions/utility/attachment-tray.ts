// Attachment Tray: an add tile that opens the photo picker with the remaining limit, then one tile per
// attachment that loads with a progress ring, settles into a downsampled thumbnail, fails into Retry and
// removes with its badge. The emitter writes sample photos (drawn in code) so the screen runs on its own.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, num, str } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** The flat scenes the preview and the sample photos draw: sky, sun, land (house blocks and paper). */
export const TRAY_SCENES: Array<[string, string, string]> = [
  ["#9CC2FF", "#FFD976", "#A9DCB7"],
  ["#E9D5B3", "#FF0000", "#CDB8FF"],
  ["#A9DCB7", "#F4F3EF", "#9CC2FF"],
  ["#CDB8FF", "#FFD976", "#9CC2FF"],
  ["#FFD976", "#F4F3EF", "#E9D5B3"],
];

const hex = (h: string) => `0x${h.replace("#", "").toUpperCase()}`;

/** Sample photos drawn with UIKit, and a download that fails once, so the tray shows every state without assets. */
function samplePhotos(): string[] {
  const i = INDENT;
  return [
    "/// Sample photos for the attachment tray, drawn in code. In your app, attachments come from the picker,",
    "/// the camera or your own loader.",
    "enum SamplePhotos {",
    `${i}static let scenes: [(UInt32, UInt32, UInt32)] = [`,
    ...TRAY_SCENES.map(([a, b, c], k) => `${i}${i}(${hex(a)}, ${hex(b)}, ${hex(c)})${k < TRAY_SCENES.length - 1 ? "," : ""}`),
    `${i}]`,
    "",
    `${i}/// \`count\` photos already in the tray, plus one still downloading or one whose download fails once.`,
    `${i}static func attachments(_ count: Int, pending: String = "") -> [AttachmentTray.Attachment] {`,
    `${i}${i}var list = (0..<count).map { AttachmentTray.Attachment(data: data($0)) }`,
    `${i}${i}if pending == "loading" {`,
    `${i}${i}${i}list.append(AttachmentTray.Attachment { progress in`,
    `${i}${i}${i}${i}progress.totalUnitCount = 20`,
    `${i}${i}${i}${i}for step in 1...20 {`,
    `${i}${i}${i}${i}${i}try await Task.sleep(for: .milliseconds(200))`,
    `${i}${i}${i}${i}${i}progress.completedUnitCount = Int64(step)`,
    `${i}${i}${i}${i}}`,
    `${i}${i}${i}${i}return data(count)`,
    `${i}${i}${i}})`,
    `${i}${i}} else if pending == "failed" {`,
    `${i}${i}${i}let flaky = Flaky()`,
    `${i}${i}${i}list.append(AttachmentTray.Attachment { _ in`,
    `${i}${i}${i}${i}try await Task.sleep(for: .seconds(1))`,
    `${i}${i}${i}${i}if await flaky.failsOnce() { throw URLError(.notConnectedToInternet) }`,
    `${i}${i}${i}${i}return data(count)`,
    `${i}${i}${i}})`,
    `${i}${i}}`,
    `${i}${i}return list`,
    `${i}}`,
    "",
    `${i}/// Fails the first download it sees, so Retry has something to fix.`,
    `${i}actor Flaky {`,
    `${i}${i}private var failed = false`,
    `${i}${i}func failsOnce() -> Bool {`,
    `${i}${i}${i}defer { failed = true }`,
    `${i}${i}${i}return !failed`,
    `${i}${i}}`,
    `${i}}`,
    "",
    `${i}static func data(_ index: Int) -> Data {`,
    `${i}${i}let (sky, sun, land) = scenes[index % scenes.count]`,
    `${i}${i}let size = CGSize(width: 1200, height: 900)`,
    `${i}${i}let format = UIGraphicsImageRendererFormat()`,
    `${i}${i}format.scale = 1`,
    `${i}${i}let image = UIGraphicsImageRenderer(size: size, format: format).image { context in`,
    `${i}${i}${i}func fill(_ hex: UInt32) {`,
    `${i}${i}${i}${i}UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1).setFill()`,
    `${i}${i}${i}}`,
    `${i}${i}${i}fill(sky)`,
    `${i}${i}${i}context.fill(CGRect(origin: .zero, size: size))`,
    `${i}${i}${i}fill(sun)`,
    `${i}${i}${i}UIBezierPath(ovalIn: CGRect(x: 480, y: 160, width: 260, height: 260)).fill()`,
    `${i}${i}${i}fill(land)`,
    `${i}${i}${i}let hill = UIBezierPath()`,
    `${i}${i}${i}hill.move(to: CGPoint(x: 0, y: 640))`,
    `${i}${i}${i}hill.addQuadCurve(to: CGPoint(x: 1200, y: 560), controlPoint: CGPoint(x: 520, y: 420))`,
    `${i}${i}${i}hill.addLine(to: CGPoint(x: 1200, y: 900))`,
    `${i}${i}${i}hill.addLine(to: CGPoint(x: 0, y: 900))`,
    `${i}${i}${i}hill.fill()`,
    `${i}${i}}`,
    `${i}${i}return image.jpegData(compressionQuality: 0.9) ?? Data()`,
    `${i}}`,
    "}",
  ];
}

export const definition: SwiftPieceDefinition = {
  id: "attachment-tray",
  name: "Attachment Tray",
  category: "pieces",
  description: "A strip of photo attachments with an add tile. Each pick loads with a progress ring and settles into a thumbnail; a failed one offers Retry, the badge removes it, and the add tile shows the count until the limit.",
  availability: "free",
  preview: { component: "attachment-tray", chunk: "pieces-utility" },
  source: { registry: "free", name: "AttachmentTray" },
  docs: "/docs/components/media/attachment-tray",
  icon: "photo",
  concepts: ["state", "binding", "array", "async", "scrollview", "closure"],
  interactions: ["tap", "scroll", "loading", "haptic", "transition"],
  properties: [
    text("title", "Add tile label", "Add photos", { maxLength: 32, hint: "Shown while the tray is empty, and read by VoiceOver." }),
    number("limit", "Limit", 6, 1, 20, 1, { hint: "The picker only allows what is left; at the limit the add tile shows 6/6." }),
    number("photos", "Starting photos", 2, 0, 12, 1),
    select("media", "Picker offers", "images", opts(["images", "Photos"], ["both", "Photos and videos"])),
    select("pending", "Last attachment", "none", opts(["none", "Loaded like the rest"], ["loading", "Still downloading"], ["failed", "Download fails once"]), { group: "state" }),
    number("tileSize", "Tile size", 76, 56, 110, 2, { group: "layout", level: "advanced" }),
  ],
  variants: [
    { id: "composer", label: "Composer", props: { title: "Add photos", limit: 6, photos: 2, media: "images", pending: "none" } },
    { id: "support", label: "Support form", props: { title: "Attach screenshots", limit: 3, photos: 1, media: "images", pending: "none" } },
    { id: "listing", label: "Listing", props: { title: "Add photos and videos", limit: 10, photos: 4, media: "both", pending: "loading" } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { photos: 0, pending: "none" } },
    { id: "some", label: "A few photos", props: { photos: 3, pending: "none" } },
    { id: "loading", label: "Loading", props: { photos: 2, pending: "loading" } },
    { id: "failed", label: "Failed", props: { photos: 2, pending: "failed" } },
    { id: "full", label: "At the limit", props: { photos: 4, limit: 4, pending: "none" } },
  ],
  anatomy: [
    { part: "Add tile", props: ["title", "limit", "media"] },
    { part: "Tiles", props: ["photos", "pending", "tileSize"] },
  ],
  swift: {
    imports: ["UIKit"],
    emit(p, ctx) {
      ctx.import("UIKit");
      ctx.declare("SamplePhotos", samplePhotos());
      const limit = Math.max(1, Math.round(n(p, "limit")));
      const photos = Math.max(0, Math.min(Math.round(n(p, "photos")), 12));
      const pending = s(p, "pending");
      const seed = pending === "loading" || pending === "failed" ? `SamplePhotos.attachments(${photos}, pending: ${str(pending)})` : `SamplePhotos.attachments(${photos})`;
      const name = ctx.state("attachments", "[AttachmentTray.Attachment]", seed);
      const title = s(p, "title").trim() || "Add photos";
      const tile = Math.round(n(p, "tileSize") || 76);
      const lines = call("AttachmentTray", [
        [null, str(title)],
        ["attachments", `$${name}`],
        ["limit", num(limit)],
        ["matching", s(p, "media") === "both" ? ".any(of: [.images, .videos])" : ".images"],
        tile !== 76 && ["style", `.init(tileSize: ${num(tile)})`],
      ]);
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
