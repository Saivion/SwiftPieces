// Picture Headline: a headline with living pictures stuck between its words like stickers. In the Playground the
// headline is one line of text with scenes in brackets ("Slow [sun] mornings"); the emitter turns it into
// the segment list `PictureHeadline([...])` takes, exactly as registry/swift/text/PictureHeadline.swift
// declares it, with only the arguments that differ from its defaults.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, modifiers, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** The built-in scenes, as `PictureHeadline.Scene` names them. */
export const SCENES = ["sun", "waves", "moon", "hills", "bloom"] as const;
export type Scene = (typeof SCENES)[number];

export const DEFAULT_TEXT = "Slow [sun] mornings, long [waves] walks and early [moon] nights.";
/** `Segment.art`'s default width, in picture heights; only a different width is written. */
export const DEFAULT_WIDTH = 2.4;

export type Segment = { kind: "text"; text: string } | { kind: "scene"; scene: Scene };

/**
 * The headline as segments: words between scene tokens. A bracketed word that isn't a scene stays as
 * text, so nothing typed is lost; at most eight pictures, so a headline stays a headline.
 */
export function segments(raw: string): Segment[] {
  const out: Segment[] = [];
  let pictures = 0;
  for (const part of raw.split(/(\[[^\]]*\])/)) {
    const token = /^\[\s*([a-z]+)\s*\]$/i.exec(part);
    const scene = token?.[1].toLowerCase() as Scene | undefined;
    if (scene && (SCENES as readonly string[]).includes(scene) && pictures < 8) {
      out.push({ kind: "scene", scene });
      pictures++;
      continue;
    }
    const words = part.trim().replace(/\s+/g, " ");
    if (!words) continue;
    const last = out[out.length - 1];
    if (last?.kind === "text") last.text += ` ${words}`;
    else out.push({ kind: "text", text: words });
  }
  return out;
}

export const definition: SwiftPieceDefinition = {
  id: "picture-headline",
  name: "Picture Headline",
  category: "pieces",
  description: "A headline with living pictures stuck between its words like a hand-placed collage. Each word rises into place and each picture opens from a dot into a tilted sticker with a white rim, landing with crop marks at its corners, then keeps drifting; press one to lift it. Put a scene in brackets where it goes.",
  availability: "free",
  preview: { component: "picture-headline", chunk: "pieces-utility" },
  source: { registry: "free", name: "PictureHeadline" },
  docs: "/docs/components/text/picture-headline",
  icon: "photo",
  concepts: ["animation", "array", "font", "piece"],
  interactions: ["transition", "spring", "tap", "press", "haptic"],
  properties: [
    text("text", "Headline", DEFAULT_TEXT, { maxLength: 160, hint: "Put a scene in brackets where it goes: [sun], [waves], [moon], [hills] or [bloom]." }),
    number("size", "Size", 40, 20, 64),
    select("alignment", "Alignment", "center", opts(["leading", "Leading"], ["center", "Center"])),
    number("width", "Picture width", DEFAULT_WIDTH, 1, 4, 0.2, { group: "layout", hint: "In picture heights: 1 is a square, 2.4 a wide frame." }),
    number("tilt", "Sticker tilt", 4, 0, 10, 1, { group: "layout", hint: "The largest resting tilt, in degrees. 0 lays the pictures flat." }),
    bool("drift", "Pictures keep moving", true, { group: "motion", hint: "Scenes drift after they open. Off holds them still." }),
    bool("haptics", "Haptic tick", true, { level: "advanced", group: "interaction", hint: "A light tick as each picture opens." }),
  ],
  variants: [
    { id: "slow-days", label: "Slow days", props: { text: DEFAULT_TEXT, size: 40, alignment: "center", width: DEFAULT_WIDTH } },
    { id: "leading", label: "Leading", props: { text: "Plan the week [hills] then let it [bloom] grow.", size: 38, alignment: "leading", width: 2 } },
    { id: "squares", label: "Square pictures", props: { text: "Sun [sun] sea [waves] and sleep [moon]", size: 44, alignment: "center", width: 1 } },
  ],
  anatomy: [
    { part: "Words", props: ["text", "size", "alignment"] },
    { part: "Pictures", props: ["width", "tilt", "drift"] },
    { part: "Feel", props: ["haptics"] },
  ],
  swift: {
    imports: [],
    emit(p) {
      const width = n(p, "width") || DEFAULT_WIDTH;
      const tilt = p.tilt === undefined ? 4 : n(p, "tilt");
      const style = [!b(p, "drift") && "drift: false", tilt !== 4 && `tilt: ${num(tilt)}`].filter(Boolean);
      const parts = segments(s(p, "text") || DEFAULT_TEXT).map((seg) =>
        seg.kind === "text" ? str(seg.text) : width !== DEFAULT_WIDTH ? `.art(.${seg.scene}, width: ${num(width)})` : `.art(.${seg.scene})`,
      );
      return {
        lines: modifiers(
          call("PictureHeadline", [
            [null, `[${parts.join(", ")}]`],
            s(p, "alignment") === "center" && ["alignment", ".center"],
            !b(p, "haptics") && ["haptics", "false"],
            style.length > 0 && ["style", `.init(${style.join(", ")})`],
          ]),
          [`font(.system(size: ${num(n(p, "size") || 40)}, weight: .bold))`],
        ),
      };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
