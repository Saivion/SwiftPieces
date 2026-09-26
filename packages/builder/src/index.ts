// @swiftpieces/builder — the shared core of the SwiftPieces playground (swiftpieces.com) and
// builder (pro.swiftpieces.com). Pure TypeScript, safe on the server and in the browser: schema,
// registry, validation, tree operations, SwiftUI generation, templates and the Web → SwiftUI
// glossary. The React UI lives in "@swiftpieces/builder/react" and the zip/Xcode export in
// "@swiftpieces/builder/export", each loaded only where it is used.

export * from "./core/schema.js";
export * from "./core/palette.js";
export * from "./core/tree.js";
export * from "./core/registry.js";
export * from "./core/validate.js";
export * from "./core/generate.js";
export * from "./core/glossary.js";
export * from "./core/intent.js";
export * from "./core/events.js";
export { str, num, call, modifiers, indent, list, identifier, INDENT, type Arg } from "./core/swift.js";
export { primitives } from "./definitions/primitives.js";
export { freePieces, parseSlices, dockSymbol } from "./definitions/pieces.js";
export { freeTemplates, blankTemplate, nd, withIds, singleScreen } from "./definitions/templates.js";
export { opts, text as textProp, bool as boolProp, select as selectProp, number as numberProp, spacing as spacingProp, color as colorProp, icon as iconProp, textStyles, weights } from "./definitions/shared.js";

import { primitives } from "./definitions/primitives.js";
import { freePieces } from "./definitions/pieces.js";

/** Every definition the free playground offers. Pro passes these plus its own. */
export const freeDefinitions = [...primitives, ...freePieces];

/** Registry names of free pieces the playground supports, for "Customize" links on component pages. */
export const playgroundPieceNames: string[] = freePieces.map((d) => d.source!.name);

/** Playground deep link for a piece: /playground?component=<id>. */
export function playgroundComponentId(registryName: string): string | null {
  return freePieces.find((d) => d.source?.name === registryName)?.id ?? null;
}
