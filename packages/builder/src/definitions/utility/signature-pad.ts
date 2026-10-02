// Signature Pad: velocity-weighted ink on a pad with a baseline, Undo, Clear and a Type instead mode.
// The emitter calls the piece's public API exactly as SignaturePad.swift declares it and holds the
// signature in a `@State` the generated screen owns.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, modifiers, num, str } from "../../core/swift.js";
import { bool, number, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Swift defaults, so the emitted call only spells out what differs. */
export const SIGNATURE_DEFAULTS = { prompt: "Sign here", height: 200, lineWidth: 3.6 } as const;

export const definition: SwiftPieceDefinition = {
  id: "signature-pad",
  name: "Signature Pad",
  category: "pieces",
  description: "A signature field with ink that thins on quick strokes and runs full on slow ones. Undo removes the last stroke, Clear wipes the pad, and Type instead sets a typed name in a script face.",
  availability: "free",
  preview: { component: "signature-pad", chunk: "pieces-utility" },
  source: { registry: "free", name: "SignaturePad" },
  docs: "/docs/components/inputs/signature-pad",
  icon: "pencil",
  concepts: ["state", "binding", "gesture", "textfield"],
  interactions: ["drag", "tap", "type", "haptic", "transition"],
  properties: [
    text("prompt", "Hint", SIGNATURE_DEFAULTS.prompt, { maxLength: 40, hint: "Shown under the line until the first stroke." }),
    bool("allowsTyping", "Type instead", true, { hint: "Lets people type their name instead of drawing. Keep it on unless your flow offers another way to sign." }),
    text("typedName", "Typed name", "", { maxLength: 40, hint: "Starts in Type instead mode with this name. Leave empty to start on the pad.", when: { prop: "allowsTyping", equals: [true] } }),
    number("height", "Pad height", SIGNATURE_DEFAULTS.height, 150, 360, 10, { group: "layout" }),
    number("lineWidth", "Ink weight", SIGNATURE_DEFAULTS.lineWidth, 2, 6, 0.2, { level: "advanced", group: "shape", hint: "Width of slow strokes. Fast strokes thin to about 40% of it." }),
    bool("disabled", "Disabled", false, { level: "advanced", group: "state" }),
  ],
  variants: [
    { id: "delivery", label: "Delivery", props: { prompt: "Sign for delivery", allowsTyping: true, typedName: "", height: 200 } },
    { id: "waiver", label: "Waiver", props: { prompt: "Sign to agree", allowsTyping: true, typedName: "", height: 240 } },
    { id: "drawn", label: "Drawn only", props: { prompt: "Sign here", allowsTyping: false, typedName: "", height: 200 } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { typedName: "", disabled: false } },
    { id: "typed", label: "Typed name", props: { allowsTyping: true, typedName: "Maya Lindqvist", disabled: false } },
    { id: "disabled", label: "Disabled", props: { typedName: "", disabled: true } },
  ],
  anatomy: [
    { part: "Pad", props: ["height", "lineWidth"] },
    { part: "Hint", props: ["prompt"] },
    { part: "Type instead", props: ["allowsTyping", "typedName"] },
    { part: "State", props: ["disabled"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const typing = b(p, "allowsTyping") && s(p, "typedName").trim() !== "";
      const initial = typing ? `SignaturePad.Signature(typedName: ${str(s(p, "typedName").trim())})` : "SignaturePad.Signature()";
      const name = ctx.state("signature", "", initial);
      const height = Math.round(n(p, "height") || SIGNATURE_DEFAULTS.height);
      const lineWidth = Math.round((n(p, "lineWidth") || SIGNATURE_DEFAULTS.lineWidth) * 10) / 10;
      const style = [
        lineWidth !== SIGNATURE_DEFAULTS.lineWidth && `lineWidth: ${num(lineWidth)}`,
        height !== SIGNATURE_DEFAULTS.height && `height: ${num(height)}`,
      ].filter(Boolean);
      const prompt = s(p, "prompt").trim();
      const lines = call("SignaturePad", [
        ["signature", `$${name}`],
        prompt && prompt !== SIGNATURE_DEFAULTS.prompt && ["prompt", str(prompt)],
        !b(p, "allowsTyping") && ["allowsTyping", "false"],
        style.length > 0 && ["style", `.init(${style.join(", ")})`],
      ]);
      return { lines: modifiers(lines, [b(p, "disabled") && "disabled(true)"]) };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
