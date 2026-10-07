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
// A style on its own, outside the Playground (a Styles page): live components, or a screen in a phone.
export { StylePreview, type StylePreviewProps } from "./preview/StylePreview.js";
// The CSS variables a style sets on a screen (accent, ground, corners, type, cards, backdrop, motion),
// for a host surface that should wear the style's ground and backdrop, and the light or dark a
// screen shows in.
export { themeVars, schemeFor, type Scheme } from "./preview/env.js";
export { PHONE_W, PHONE_H, BEZEL } from "./preview/phone.js";
// Style's web fonts: a stylesheet once per URL, and a theme's body and heading stand-ins.
export { loadFontsHref, useStyleFonts } from "./playground/style-fonts.js";
export { usePlay, currentScreenId } from "./playground/store.js";
export { registerRenderers, type RendererGroup } from "./preview/NodeView.js";
export { registerFill } from "./preview/fills.js";
export { Frame, b, fillStyle, font, houseVar, n, paint, s, useAxis, useScheme, useTheme, alignItems, type Renderer, type RenderProps } from "./preview/env.js";
export { useRuntime, useLive, useTap, useDrag, useChoice, SPRING, BOUNCE, HAPTIC_SWIFT, type HapticKind, type DragInfo } from "./preview/runtime.js";
export { Glyph, UI, ProCrown } from "./icons.js";
export { beaconTracker } from "./track.js";
