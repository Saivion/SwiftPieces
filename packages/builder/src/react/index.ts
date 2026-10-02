"use client";
// The Playground UI and the runtime renderers run in. Import from a client component behind
// `next/dynamic` or a client page, and import "@swiftpieces/builder/builder.css" on the route.
export { Playground, type PlaygroundInitial } from "./playground/Playground.js";
export type { PlaygroundHost, EventProps } from "./playground/context.js";
// For a host's own sidebar (PlaygroundHost.sidebar): read and drive the running Playground.
export { usePlayground } from "./playground/context.js";
// The Build sheet's picture of the app itself (PlaygroundHost.art).
export { BuildArt } from "./playground/BuildArt.js";
// A saved remix's screens as still phones, outside the Playground (an account's saved list).
export { ProjectStills } from "./playground/Stills.js";
export { usePlay, currentScreenId } from "./playground/store.js";
export { registerRenderers, type RendererGroup } from "./preview/NodeView.js";
export { registerFill } from "./preview/fills.js";
export { Frame, b, fillStyle, font, houseVar, n, paint, s, useAxis, useScheme, useTheme, alignItems, type Renderer, type RenderProps } from "./preview/env.js";
export { useRuntime, useLive, useTap, useDrag, useChoice, SPRING, BOUNCE, HAPTIC_SWIFT, type HapticKind, type DragInfo } from "./preview/runtime.js";
export { Glyph, UI, ProCrown } from "./icons.js";
export { beaconTracker } from "./track.js";
