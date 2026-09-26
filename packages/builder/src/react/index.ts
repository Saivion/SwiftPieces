"use client";
// The builder UI. Import from a client component, ideally behind `next/dynamic` so the marketing
// pages never load it. Styles: import "@swiftpieces/builder/builder.css" on the builder route.
export { Builder } from "./Builder.js";
export type { BuilderHost, BuilderEntry, BuilderEvent, EventProps, CloudProject } from "./host.js";
export { registerRenderers, type RendererGroup } from "./preview/NodeView.js";
export { registerFill } from "./preview/fills.js";
export { Frame, b, fillStyle, font, houseVar, n, paint, s, useAxis, useScheme, alignItems, type Renderer, type RenderProps } from "./preview/env.js";
export { Glyph } from "./icons.js";
export { budgets, summary as perfSummary } from "./perf.js";
export { beaconTracker } from "./track.js";
