// Spotlight Tour: a first-run tour of the screen. The components placed inside it are its stops, in order
// (up to four): each gets `.spotlightAnchor` in the Swift, and the screen gets `.spotlightTour` with a step
// per stop, so the export points at exactly what the preview points at. With nothing inside, it shows plain
// placeholder targets (a search capsule, three rows, a round add button) and writes them too, so it still
// runs on its own. An optional help button presents it again.
import type { EmitContext, Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, modifiers, num, str } from "../../core/swift.js";
import { bool, number, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** The most stops the Playground writes; components after the fourth are laid out but not toured. */
export const MAX_STOPS = 4;

/** Each stop's default copy; the first three describe the placeholder targets, in tour order. */
export const STOP_COPY: Array<[title: string, message: string]> = [
  ["Start a note", "Tap here to write something new."],
  ["Find it fast", "Search every note by title, tag or person."],
  ["Keep it on top", "Pin a note and it stays first in the list."],
  ["Make it yours", "Rename, reorder and color your lists in Settings."],
];

/** A stop's copy: its own title and message, or the default when the title is left empty. */
export function stopCopy(p: Props, i: number): { title: string; message: string } {
  const title = s(p, `title${i + 1}`).trim();
  const message = s(p, `message${i + 1}`).trim();
  return title ? { title, message } : { title: STOP_COPY[i][0], message: message || STOP_COPY[i][1] };
}

/** How many stops the tour has: one per component inside (up to four), or the three placeholders. */
export const stopCount = (children: number) => (children > 0 ? Math.min(children, MAX_STOPS) : 3);

const anchor = (i: number) => `tour.${i + 1}`;

/** The placeholder targets, in layout order (search, rows, add), anchored as stops 2, 3 and 1. */
function placeholders(): string[] {
  const i = INDENT;
  return [
    "// Placeholders for the tour to point at. Put your own views inside the tour in the Playground,",
    "// or add .spotlightAnchor to any view on the screen and name it in a step.",
    "Capsule()",
    `${i}.fill(.fill.tertiary)`,
    `${i}.frame(height: 46)`,
    `${i}.overlay(alignment: .leading) {`,
    `${i}${i}Image(systemName: "magnifyingglass")`,
    `${i}${i}${i}.foregroundStyle(.secondary)`,
    `${i}${i}${i}.padding(.leading, 16)`,
    `${i}}`,
    `${i}.spotlightAnchor(${str(anchor(1))})`,
    "ForEach(0..<3, id: \\.self) { row in",
    `${i}HStack(spacing: 12) {`,
    `${i}${i}Circle()`,
    `${i}${i}${i}.fill(.fill.tertiary)`,
    `${i}${i}${i}.frame(width: 40, height: 40)`,
    `${i}${i}Capsule()`,
    `${i}${i}${i}.fill(.fill.tertiary)`,
    `${i}${i}${i}.frame(width: 128, height: 8)`,
    `${i}${i}Spacer()`,
    `${i}${i}Image(systemName: "pin")`,
    `${i}${i}${i}.foregroundStyle(.secondary)`,
    `${i}${i}${i}.frame(width: 36, height: 36)`,
    `${i}${i}${i}.background(.fill.tertiary, in: .circle)`,
    `${i}${i}${i}.spotlightAnchor(row == 0 ? ${str(anchor(2))} : "tour.pin.\\(row)")`,
    `${i}}`,
    `${i}.padding(12)`,
    `${i}.background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18, style: .continuous))`,
    "}",
    "Image(systemName: \"plus\")",
    `${i}.font(.title3.weight(.bold))`,
    `${i}.foregroundStyle(Color(.systemBackground))`,
    `${i}.frame(width: 56, height: 56)`,
    `${i}.background(Color(.label), in: .circle)`,
    `${i}.spotlightAnchor(${str(anchor(0))})`,
    `${i}.frame(maxWidth: .infinity, alignment: .trailing)`,
  ];
}

/** The steps, in tour order, as `SpotlightTour.Step` initializers. */
function stepLines(p: Props, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const { title, message } = stopCopy(p, i);
    return `.init(${str(anchor(i))}, title: ${str(title)}, message: ${str(message)}),`;
  });
}

function emitTour(p: Props, ctx: EmitContext): string[] {
  const kids = ctx.children();
  const count = stopCount(kids.length);
  const presented = b(p, "presented");
  const once = b(p, "once");
  // First visit only: the tour presents itself (showOnceKey), so the state starts off.
  const flag = ctx.state("showTour", "", presented && !once ? "true" : "false");
  const start = Math.max(0, Math.min(Math.round(n(p, "start")), count - 1));
  const stepState = start > 0 ? ctx.state("tourStep", "", num(start)) : null;

  const body = kids.length ? kids.flatMap((k, i) => (i < MAX_STOPS ? modifiers(k, [`spotlightAnchor(${str(anchor(i))})`]) : k)) : placeholders();
  const trigger = s(p, "trigger").trim();
  if (trigger) {
    body.push(...modifiers([`Button(${str(trigger)}) { ${flag} = true }`], ["buttonStyle(.bordered)", "buttonBorderShape(.capsule)", "tint(.primary)", "fontWeight(.semibold)"]));
  }

  // The tour belongs to the whole screen (it dims everything but the stop), so it goes on the screen.
  const args: string[] = [`isPresented: $${flag}`];
  if (stepState) args.push(`step: $${stepState}`);
  const head = `.spotlightTour(${args.join(", ")}, steps: [`;
  const tail: string[] = [];
  if (once) tail.push(`showOnceKey: ${str(s(p, "onceKey").trim() || "tour.v1")}`);
  if (!b(p, "advances")) tail.push("advancesOnTargetTap: false");
  // A Style accent reaches the ring, the current step and the Next button.
  if (ctx.theme) tail.push("style: .init(accent: Theme.accent, accentInk: Theme.accentInk)");
  ctx.screenModifier([head, ...indent(stepLines(p, count)), `]${tail.map((t) => `, ${t}`).join("")})`]);

  return call("VStack", [["spacing", num(ctx.space(n(p, "spacing")))]], body);
}

const stopProps = Array.from({ length: MAX_STOPS }, (_, i) => [
  text(`title${i + 1}`, `Stop ${i + 1} title`, STOP_COPY[i][0], { maxLength: 40, group: "content", hint: i === 0 ? "The first component inside the tour (or the add button placeholder)." : undefined }),
  text(`message${i + 1}`, `Stop ${i + 1} message`, STOP_COPY[i][1], { maxLength: 120, group: "content", ...(i === 3 ? { level: "advanced" as const } : {}) }),
]).flat();

export const definition: SwiftPieceDefinition = {
  id: "spotlight-tour",
  name: "Spotlight Tour",
  category: "pieces",
  description: "A first-run tour of the screen. Put the components it should point at inside it: each becomes a stop, dimmed around and ringed in red, with a callout that explains it and moves on with Next. Taps on the stop reach it.",
  availability: "free",
  preview: { component: "spotlight-tour", chunk: "pieces-utility" },
  source: { registry: "free", name: "SpotlightTour" },
  docs: "/docs/components/sheets/spotlight-tour",
  icon: "sparkles",
  container: { axis: "v" },
  concepts: ["modifier", "state", "binding", "closure", "animation"],
  interactions: ["tap", "swipe", "spring", "transition", "haptic"],
  properties: [
    ...stopProps.slice(0, 6),
    bool("presented", "Shows when the screen opens", true, { group: "state", hint: "Off: only the help button presents it." }),
    text("trigger", "Help button", "Show me around", { maxLength: 32, group: "interaction", hint: "A button under the stops that presents the tour again. Leave empty for none." }),
    bool("once", "First visit only", false, { group: "state", hint: "Remembers that it was seen, so the app shows it once. The preview shows it every time." }),
    text("onceKey", "Remembered as", "tour.v1", { maxLength: 40, level: "advanced", group: "state", when: { prop: "once", equals: [true] }, hint: "The UserDefaults key. Change it to show a new tour again." }),
    bool("advances", "Tapping a stop moves on", true, { group: "interaction", hint: "The stop's own action runs too." }),
    number("start", "Starts at stop", 0, 0, MAX_STOPS - 1, 1, { level: "advanced", group: "state" }),
    ...stopProps.slice(6),
    number("spacing", "Spacing", 12, 0, 40, 1, { level: "advanced", group: "layout" }),
  ],
  variants: [
    { id: "every-time", label: "Every time", props: { presented: true, once: false, trigger: "Show me around", advances: true, start: 0 } },
    { id: "first-visit", label: "First visit only", props: { presented: true, once: true, trigger: "", advances: true, start: 0 } },
    { id: "help-button", label: "From a help button", props: { presented: false, once: false, trigger: "Show me around", advances: true, start: 0 } },
  ],
  states: [
    { id: "hidden", label: "Not shown", props: { presented: false } },
    { id: "first", label: "First stop", props: { presented: true, start: 0 } },
    { id: "second", label: "Second stop", props: { presented: true, start: 1 } },
    { id: "last", label: "Last stop", props: { presented: true, start: 2 } },
  ],
  anatomy: [
    { part: "Stops", props: ["title1", "message1", "title2", "message2", "title3", "message3", "title4", "message4", "spacing"] },
    { part: "Presenting", props: ["presented", "once", "onceKey", "trigger", "start"] },
    { part: "Interaction", props: ["advances"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      return { lines: emitTour(p, ctx) };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
