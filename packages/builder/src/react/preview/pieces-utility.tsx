"use client";
// Renderers for the utility pieces (definitions/pieces-utility.ts), one file per piece in ./utility,
// keyed by the definition id.
import type { Renderer } from "./env.js";
import { renderer as indexScrubber } from "./utility/index-scrubber.js";
import { renderer as dragSelectGrid } from "./utility/drag-select-grid.js";
import { renderer as attachmentTray } from "./utility/attachment-tray.js";
import { renderer as followScroll } from "./utility/follow-scroll.js";
import { renderer as addressField } from "./utility/address-field.js";
import { renderer as signaturePad } from "./utility/signature-pad.js";
import { renderer as linkPreview } from "./utility/link-preview.js";
import { renderer as photoCropper } from "./utility/photo-cropper.js";
import { renderer as locationPicker } from "./utility/location-picker.js";
import { renderer as spotlightTour } from "./utility/spotlight-tour.js";
import { renderer as activityHeatmap } from "./utility/activity-heatmap.js";
import { renderer as pictureHeadline } from "./utility/picture-headline.js";

const all: Record<string, Renderer | null> = {
  "index-scrubber": indexScrubber,
  "drag-select-grid": dragSelectGrid,
  "attachment-tray": attachmentTray,
  "follow-scroll": followScroll,
  "address-field": addressField,
  "signature-pad": signaturePad,
  "link-preview": linkPreview,
  "photo-cropper": photoCropper,
  "location-picker": locationPicker,
  "spotlight-tour": spotlightTour,
  "activity-heatmap": activityHeatmap,
  "picture-headline": pictureHeadline,
};

export const utilityPieceRenderers: Record<string, Renderer> = Object.fromEntries(Object.entries(all).filter((e): e is [string, Renderer] => e[1] !== null));
