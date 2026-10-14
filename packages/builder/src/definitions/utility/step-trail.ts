// Step Trail: the progress indicator of a multi-step flow (checkout, booking, account setup, verification). Glass
// stops joined into one liquid trail: done steps carry a check, the current step is a red capsule with its number
// and title, reached steps show their number in full text and the rest muted. Tap back to a reached step, drag the
// capsule along the trail; a tap ahead of what has been reached shakes the stop. The emitter calls
// `StepTrail(steps:selection:reached:…)` exactly as registry/swift/navigation/StepTrail.swift declares it, holding the
// step and the furthest step reached in `@State` the screen owns.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, list, str } from "../../core/swift.js";
import { bool, number, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** The Swift defaults, so the emitted call only spells out what differs. */
export const STEP_TRAIL_DEFAULTS = { steps: "Cart, Address, Payment, Review", label: "Progress" } as const;

/** The step titles a value lists: two to eight, separated by commas, with the default checkout when it lists none. */
export function stepTrailSteps(value: unknown): string[] {
  const steps = list(value, 8);
  return steps.length ? steps : list(STEP_TRAIL_DEFAULTS.steps);
}

/**
 * The trail's state for these props, as indexes the Swift binds: the current step (`steps.length` once finished) and
 * the furthest step reached, never behind the current one.
 */
export function stepTrailState(p: Props): { steps: string[]; current: number; reached: number } {
  const steps = stepTrailSteps(p.steps);
  const last = steps.length - 1;
  const current = b(p, "finished") ? steps.length : Math.min(Math.max(Math.round(n(p, "current")) - 1, 0), last);
  const reached = Math.min(Math.max(Math.round(n(p, "reached")) - 1, Math.min(current, last)), last);
  return { steps, current, reached };
}

export const definition: SwiftPieceDefinition = {
  id: "step-trail",
  name: "Step Trail",
  category: "pieces",
  description: "Where you are in a checkout or sign-up: glass stops with a red capsule on the current step. Tap back, or drag it along.",
  availability: "free",
  preview: { component: "step-trail", chunk: "pieces-utility" },
  source: { registry: "free", name: "StepTrail" },
  docs: "/docs/components/navigation/step-trail",
  icon: "figure.walk",
  concepts: ["state", "binding", "array", "gesture", "spring", "piece"],
  interactions: ["tap", "drag", "scrub", "select", "spring", "haptic", "transition"],
  properties: [
    text("steps", "Steps", STEP_TRAIL_DEFAULTS.steps, { maxLength: 120, hint: "Step titles in order, separated by commas. Two to eight." }),
    number("current", "Current step", 2, 1, 8, 1, { group: "state", hint: "Counted from 1. A Continue button moves it on in your app." }),
    number("reached", "Furthest reached", 3, 1, 8, 1, { group: "state", hint: "People can tap back up to here. Steps past it shake." }),
    bool("finished", "Finished", false, { group: "state", hint: "Every step done, as when the flow completes." }),
    bool("caption", "Caption", true, { group: "content", hint: "Step 2 of 4 under the trail. Names the step when titles don't fit." }),
    text("label", "VoiceOver label", STEP_TRAIL_DEFAULTS.label, { maxLength: 40, level: "advanced", hint: "What VoiceOver calls the trail, such as Checkout progress." }),
  ],
  variants: [
    { id: "checkout", label: "Checkout", props: { steps: "Cart, Address, Payment, Review", current: 2, reached: 3, finished: false, caption: true } },
    { id: "booking", label: "Booking", props: { steps: "Dates, Guests, Room, Pay", current: 3, reached: 3, finished: false, caption: true } },
    { id: "setup", label: "Account setup", props: { steps: "Name, Photo, Interests, Alerts", current: 1, reached: 2, finished: false, caption: true } },
    { id: "verify", label: "Verification, six steps", props: { steps: "Email, Phone, Address, ID photo, Selfie, Review", current: 4, reached: 4, finished: false, caption: true } },
  ],
  states: [
    { id: "first", label: "First step", props: { current: 1, reached: 1, finished: false } },
    { id: "midway", label: "Midway", props: { current: 2, reached: 2, finished: false } },
    { id: "back", label: "Went back", props: { current: 1, reached: 3, finished: false } },
    { id: "finished", label: "Finished", props: { current: 4, reached: 4, finished: true } },
  ],
  anatomy: [
    { part: "Stops", props: ["steps"] },
    { part: "Current capsule", props: ["current", "finished"] },
    { part: "Reached steps", props: ["reached"] },
    { part: "Caption", props: ["caption", "label"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const { steps, current, reached } = stepTrailState(p);
      const step = ctx.state("step", "", String(current));
      const furthest = ctx.state("furthest", "", String(Math.max(reached, Math.min(current, steps.length - 1))));
      const label = s(p, "label").trim();
      const lines = call("StepTrail", [
        ["steps", `[${steps.map(str).join(", ")}]`],
        ["selection", `$${step}`],
        ["reached", furthest],
        p.caption === false && ["showsCaption", "false"],
        label && label !== STEP_TRAIL_DEFAULTS.label && ["messages", `.init(label: ${str(label)})`],
        // A Style accent in the Playground reaches the current step's capsule and its ink.
        ctx.theme && ["style", ".init(accent: Theme.accent, accentInk: Theme.accentInk)"],
      ]);
      // People can come back forward to any step they have filled in, so the screen keeps the furthest one.
      ctx.attach([`.onChange(of: ${step}) { _, value in ${furthest} = max(${furthest}, value) }`]);
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts): it hugs its stops. */
export const fill = false;
