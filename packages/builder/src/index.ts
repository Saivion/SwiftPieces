// @swiftpieces/builder — the shared core of the SwiftPieces Playground (swiftpieces.com/playground,
// and unlocked for Pro owners at pro.swiftpieces.com/builder). Pure TypeScript, safe on the server
// and in the browser: schema, registry, catalog, validation, tree operations, SwiftUI generation,
// interactions and the Web → SwiftUI glossary. The React UI lives in "@swiftpieces/builder/react" and the zip/Xcode export in
// "@swiftpieces/builder/export", each loaded only where it is used.

export * from "./core/schema.js";
export * from "./core/palette.js";
export * from "./core/tree.js";
export * from "./core/registry.js";
export * from "./core/validate.js";
export * from "./core/generate.js";
export * from "./core/glossary.js";
export * from "./core/catalog.js";
export * from "./core/interactions.js";
export * from "./core/inspect.js";
export * from "./core/events.js";
export * from "./core/share.js";
export * from "./core/looks.js";
export * from "./core/fonts.js";
export * from "./core/shuffle.js";
export { styleSwiftSource, rewriteFonts, rewriteCorners } from "./core/theme-swift.js";
export * from "./core/prompt.js";
export { str, num, call, modifiers, indent, list, identifier, INDENT, type Arg } from "./core/swift.js";
export { primitives } from "./definitions/primitives.js";
export { freePieces, parseSlices, dockSymbol } from "./definitions/pieces.js";
export { nd, app as catalogApp, group as catalogGroup, type Links, type ScreenSpec } from "./definitions/catalog/kit.js";
export { opts, text as textProp, bool as boolProp, select as selectProp, number as numberProp, spacing as spacingProp, color as colorProp, icon as iconProp, textStyles, weights } from "./definitions/shared.js";

import { primitives } from "./definitions/primitives.js";
import { freePieces } from "./definitions/pieces.js";
import { nativeDefinitions } from "./definitions/native.js";
import { motionPieces } from "./definitions/pieces-motion.js";
import { surfacePieces } from "./definitions/pieces-surfaces.js";
import { mediaPieces } from "./definitions/pieces-media.js";
import { utilityPieces } from "./definitions/pieces-utility.js";
import { appPieceDefinitions } from "./definitions/app-pieces/index.js";

export { nativeDefinitions, motionPieces, surfacePieces, mediaPieces, utilityPieces, appPieceDefinitions };

/** Every SwiftPieces component the Playground runs (native SwiftUI definitions excluded). */
export const freePieceDefinitions = [...freePieces, ...motionPieces, ...surfacePieces, ...mediaPieces, ...utilityPieces];

/**
 * Every definition the free Playground offers. Pro passes these plus its own. App pieces (made
 * for the app library's recreations) emit SwiftUI inline, like the native definitions.
 */
export const freeDefinitions = [...primitives, ...nativeDefinitions, ...freePieceDefinitions, ...appPieceDefinitions];

/** Registry names of free pieces the Playground runs, for "Open in Playground" on component pages. */
export const playgroundPieceNames: string[] = freePieceDefinitions.map((d) => d.source!.name);

/** The Playground definition id for a registry piece name, or null. */
export function playgroundComponentId(registryName: string): string | null {
  return freePieceDefinitions.find((d) => d.source?.name === registryName)?.id ?? null;
}
