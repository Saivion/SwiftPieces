// Free SwiftPieces that solve everyday app problems: a section index scrubber, drag-to-select, an
// attachment tray, a feed that follows new content, address autocomplete, a signature pad, link previews,
// a photo cropper, a map location picker, a spotlight tour and an activity heatmap, plus a picture
// headline (text with living pictures between its words). One file per piece in ./utility, each exporting its definition.
import type { SwiftPieceDefinition } from "../core/schema.js";
import * as indexScrubber from "./utility/index-scrubber.js";
import * as dragSelectGrid from "./utility/drag-select-grid.js";
import * as attachmentTray from "./utility/attachment-tray.js";
import * as followScroll from "./utility/follow-scroll.js";
import * as addressField from "./utility/address-field.js";
import * as signaturePad from "./utility/signature-pad.js";
import * as linkPreview from "./utility/link-preview.js";
import * as photoCropper from "./utility/photo-cropper.js";
import * as locationPicker from "./utility/location-picker.js";
import * as spotlightTour from "./utility/spotlight-tour.js";
import * as activityHeatmap from "./utility/activity-heatmap.js";
import * as pictureHeadline from "./utility/picture-headline.js";

const all = [indexScrubber, dragSelectGrid, attachmentTray, followScroll, addressField, signaturePad, linkPreview, photoCropper, locationPicker, spotlightTour, activityHeatmap, pictureHeadline];

export const utilityPieces: SwiftPieceDefinition[] = all.flatMap((m) => (m.definition ? [m.definition] : []));

/** Which of these take all the width they are offered (see react/preview/fills.ts). */
export const utilityFills: Record<string, boolean> = Object.fromEntries(all.flatMap((m) => (m.definition ? [[m.definition.id, m.fill]] : [])));
