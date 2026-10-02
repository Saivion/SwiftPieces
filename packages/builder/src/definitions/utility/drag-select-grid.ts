// Drag Select Grid: a photo or file grid where one drag paints a range of selected items. The emitter
// calls `DragSelectGrid(_:selection:isSelecting:minimumCellWidth:aspectRatio:longPressToSelect:style:cell:)`
// exactly as registry/swift/lists/DragSelectGrid.swift declares it, over a sample `Photo` model the
// screen owns as state, so the generated grid paints, scrolls and auto-scrolls on its own.
import { house, swiftRGB } from "../../core/palette.js";
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, modifiers, num } from "../../core/swift.js";
import { bool, number, opts, select } from "../shared.js";

const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;
const s = (p: Props, k: string) => String(p[k] ?? "");

/** Thumbnail blocks and glyphs, the same picks in the renderer and the generated `Photo.samples`. */
export const DSG_TINTS = ["tangerine", "sky", "butter", "sage", "lilac", "sand"];
export const DSG_SYMBOLS = ["sun.max", "leaf", "moon", "cup.and.saucer", "cloud", "drop"];
export const dsgTint = (i: number) => DSG_TINTS[(i * 7 + Math.floor(i / 5)) % DSG_TINTS.length];
export const dsgSymbol = (i: number) => DSG_SYMBOLS[(i * 5 + Math.floor(i / 4)) % DSG_SYMBOLS.length];
/** The items that start selected: the first `count` after item 0, like a half-finished pick. */
export const dsgPreselected = (count: number, total: number) => Array.from({ length: Math.max(0, Math.min(count, total - 1)) }, (_, k) => k + 1);

export const definition: SwiftPieceDefinition = {
  id: "drag-select-grid",
  name: "Drag Select Grid",
  category: "pieces",
  description: "A photo grid with multi-select the way the photo library does it: in select mode, drag sideways (or hold, then drag) to paint a whole run of items, drag back to unpaint, and hold near the top or bottom edge to scroll while you paint. Vertical swipes still scroll; a tap toggles one.",
  availability: "free",
  preview: { component: "drag-select-grid", chunk: "pieces-utility" },
  source: { registry: "free", name: "DragSelectGrid" },
  docs: "/docs/components/lists/drag-select-grid",
  icon: "square.grid.2x2",
  concepts: ["state", "binding", "foreach", "gesture", "closure", "scrollview"],
  interactions: ["drag", "tap", "hold", "select", "scroll", "haptic"],
  properties: [
    number("items", "Items", 60, 6, 300, 1, { hint: "How many sample photos the grid holds." }),
    number("minimumCellWidth", "Minimum cell width", 96, 64, 180, 2, { group: "layout", hint: "Columns are as many as fit at this width, so the grid adapts to rotation and iPad." }),
    select("aspectRatio", "Cell shape", "1", opts(["1", "Square"], ["0.75", "Portrait (3:4)"], ["1.5", "Landscape (3:2)"]), { group: "layout" }),
    bool("isSelecting", "Starts in select mode", true, { group: "state" }),
    number("preselected", "Selected at start", 3, 0, 40, 1, { group: "state" }),
    bool("longPressToSelect", "Hold to start selecting", true, { group: "interaction", hint: "Outside select mode, holding a photo turns select mode on and keeps painting. Turn off if your cells have a context menu." }),
    bool("selectButton", "Select / Done button", true, { group: "interaction", hint: "A small button over the grid that toggles select mode and clears the selection on Done." }),
    number("height", "Height", 520, 240, 760, 10, { group: "layout" }),
    number("spacing", "Spacing", 4, 0, 16, 1, { level: "advanced", group: "layout" }),
    number("cornerRadius", "Corner radius", 12, 0, 26, 1, { level: "advanced", group: "shape" }),
  ],
  variants: [
    { id: "library", label: "Photo library", props: { items: 60, minimumCellWidth: 96, aspectRatio: "1", spacing: 4, cornerRadius: 12 } },
    { id: "posters", label: "Posters", props: { items: 36, minimumCellWidth: 110, aspectRatio: "0.75", spacing: 8, cornerRadius: 18 } },
    { id: "dense", label: "Dense", props: { items: 150, minimumCellWidth: 72, aspectRatio: "1", spacing: 2, cornerRadius: 6 } },
  ],
  states: [
    { id: "browsing", label: "Browsing", props: { isSelecting: false, preselected: 0 } },
    { id: "selecting", label: "Select mode", props: { isSelecting: true, preselected: 0 } },
    { id: "some", label: "Some selected", props: { isSelecting: true, preselected: 5 } },
  ],
  anatomy: [
    { part: "Items", props: ["items", "aspectRatio"] },
    { part: "Columns", props: ["minimumCellWidth", "spacing", "cornerRadius"] },
    { part: "Selection", props: ["isSelecting", "preselected", "longPressToSelect", "selectButton"] },
    { part: "Frame", props: ["height"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const total = Math.round(n(p, "items"));
      const picked = dsgPreselected(Math.round(n(p, "preselected")), total);
      const aspect = s(p, "aspectRatio") || "1";
      const spacing = n(p, "spacing");
      const radius = ctx.corner(n(p, "cornerRadius"));
      const selectingByDefault = b(p, "isSelecting");

      ctx.declare("Photo", [
        "/// A sample library item. Swap in your own Identifiable model and thumbnail view.",
        "struct Photo: Identifiable {",
        `${INDENT}let id: Int`,
        `${INDENT}let tint: Color`,
        `${INDENT}let symbol: String`,
        "",
        `${INDENT}static func samples(_ count: Int) -> [Photo] {`,
        `${INDENT}${INDENT}let tints: [Color] = [`,
        ...DSG_TINTS.map((t, k) => `${INDENT}${INDENT}${INDENT}${swiftRGB(house.blocks[t])}${k < DSG_TINTS.length - 1 ? "," : ""}`),
        `${INDENT}${INDENT}]`,
        `${INDENT}${INDENT}let symbols = [${DSG_SYMBOLS.map((x) => `"${x}"`).join(", ")}]`,
        `${INDENT}${INDENT}var photos: [Photo] = []`,
        `${INDENT}${INDENT}for i in 0..<count {`,
        `${INDENT}${INDENT}${INDENT}let tint = tints[(i * 7 + i / 5) % tints.count]`,
        `${INDENT}${INDENT}${INDENT}let symbol = symbols[(i * 5 + i / 4) % symbols.count]`,
        `${INDENT}${INDENT}${INDENT}photos.append(Photo(id: i, tint: tint, symbol: symbol))`,
        `${INDENT}${INDENT}}`,
        `${INDENT}${INDENT}return photos`,
        `${INDENT}}`,
        "}",
      ]);

      const photos = ctx.state("photos", "[Photo]", `Photo.samples(${num(total)})`);
      const selection = ctx.state("selection", "Set<Photo.ID>", picked.length ? `[${picked.join(", ")}]` : "[]");
      const isSelecting = ctx.state("isSelecting", "Bool", selectingByDefault ? "true" : "false");

      const styleArgs = [spacing !== 4 && `spacing: ${num(spacing)}`, radius !== 12 && `cornerRadius: ${num(radius)}`].filter(Boolean);
      const cell = [
        "ZStack {",
        `${INDENT}photo.tint`,
        ...indent(modifiers(["Image(systemName: photo.symbol)"], ["font(.title2.weight(.medium))", `foregroundStyle(${swiftRGB(house.ink)}.opacity(0.7))`])),
        "}",
        `.accessibilityLabel("Photo \\(photo.id + 1)")`,
      ];
      const lines = call(
        "DragSelectGrid",
        [
          [null, photos],
          ["selection", `$${selection}`],
          ["isSelecting", `$${isSelecting}`],
          n(p, "minimumCellWidth") !== 96 && ["minimumCellWidth", num(n(p, "minimumCellWidth"))],
          aspect !== "1" && ["aspectRatio", aspect],
          !b(p, "longPressToSelect") && ["longPressToSelect", "false"],
          styleArgs.length > 0 && ["style", `.init(${styleArgs.join(", ")})`],
        ],
        null,
      );
      lines[lines.length - 1] += " { photo, _ in";
      const grid = [...lines, ...indent(cell), "}"];
      const button = b(p, "selectButton")
        ? [
            "overlay(alignment: .topTrailing) {",
            `${INDENT}Button(${isSelecting} ? "Done" : "Select") {`,
            `${INDENT}${INDENT}${isSelecting}.toggle()`,
            `${INDENT}${INDENT}if !${isSelecting} { ${selection}.removeAll() }`,
            `${INDENT}}`,
            `${INDENT}.font(.subheadline.weight(.semibold))`,
            `${INDENT}.buttonStyle(.bordered)`,
            `${INDENT}.buttonBorderShape(.capsule)`,
            `${INDENT}.padding(12)`,
            "}",
          ]
        : null;
      const out = modifiers(grid, [`frame(height: ${num(n(p, "height"))})`]);
      if (button) {
        const pad = out.length === 1 || out.slice(1).every((l) => l.startsWith(`${INDENT}.`)) ? INDENT : "";
        out.push(`${pad}.${button[0]}`, ...button.slice(1, -1).map((l) => pad + l), `${pad}}`);
      }
      return { lines: out };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
