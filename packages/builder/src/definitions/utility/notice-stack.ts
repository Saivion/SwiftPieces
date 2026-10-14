// Notice Stack: in-app notices piled the way notification stacks are. The newest shows on a glass card with two
// narrower peeks of the rest; a tap spreads them into a list with Show less and a clear button that stretches into
// a red Clear all; any card swipes away. The emitter declares sample notices (one small enum per sample set, shared
// with the Playground renderer), holds the notices and the expanded flag in `@State` the screen owns, and calls
// `NoticeStack(notices:expanded:style:onSelect:)` exactly as registry/swift/sheets/NoticeStack.swift declares it,
// writing only what differs from its defaults.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, num, str } from "../../core/swift.js";
import { bool, link, linkStatement, number, opts, select } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** Swift defaults, so the emitted call only spells out what differs. */
export const NOTICE_DEFAULTS = { cornerRadius: 22, spacing: 12, count: 3 } as const;

export type NoticeTint = "sky" | "butter" | "sage" | "lilac" | "sand" | "red" | "neutral";

/** One sample notice. `symbol` is the SF Symbol the Swift draws, `icon` the nearest one the Playground can draw. */
export type NoticeSample = { id: string; title: string; message: string; symbol: string; icon: string; tint: NoticeTint; minutes: number };

type NoticeSet = { label: string; type: string; notices: NoticeSample[]; urgent: NoticeSample };

/** Fictional notices for three kinds of app, newest first. */
export const NOTICE_SETS: Record<string, NoticeSet> = {
  travel: {
    label: "Travel day",
    type: "TravelNotices",
    notices: [
      { id: "gate", title: "Gate changed", message: "Boarding is now B12, ten minutes earlier.", symbol: "airplane", icon: "airplane", tint: "sky", minutes: 2 },
      { id: "rain", title: "Rain at four", message: "The river walk is still fine if you leave now.", symbol: "cloud.rain.fill", icon: "cloud", tint: "lilac", minutes: 18 },
      { id: "table", title: "Table held", message: "Under the lanterns, for two, at 19:30.", symbol: "fork.knife", icon: "fork.knife", tint: "butter", minutes: 60 },
      { id: "room", title: "Room ready", message: "Your room at Casa do Rio is ready from 14:00.", symbol: "bed.double.fill", icon: "bed.double", tint: "sage", minutes: 95 },
      { id: "walk", title: "Old town walk", message: "The guided walk starts at the fountain at 17:00.", symbol: "figure.walk", icon: "figure.walk", tint: "sand", minutes: 180 },
      { id: "sunset", title: "Golden hour", message: "The viewpoint over the bay is twenty minutes away.", symbol: "sun.max.fill", icon: "sun.max", tint: "butter", minutes: 300 },
    ],
    urgent: { id: "final", title: "Final call", message: "Boarding at B12 closes in five minutes.", symbol: "exclamationmark.triangle.fill", icon: "exclamationmark.triangle", tint: "red", minutes: 0 },
  },
  home: {
    label: "Deliveries and home",
    type: "HomeNotices",
    notices: [
      { id: "parcel", title: "At your door", message: "The parcel from Rua Augusta was left with the concierge.", symbol: "shippingbox.fill", icon: "shippingbox", tint: "sage", minutes: 0 },
      { id: "groceries", title: "Groceries nearby", message: "Your order is two streets away.", symbol: "bag.fill", icon: "bag", tint: "sky", minutes: 6 },
      { id: "rent", title: "Rent reminder", message: "Due on Friday. Your usual transfer is ready.", symbol: "calendar", icon: "calendar", tint: "butter", minutes: 50 },
      { id: "plants", title: "Water the ferns", message: "It has been five days since they were last watered.", symbol: "leaf.fill", icon: "leaf", tint: "sage", minutes: 140 },
      { id: "laundry", title: "Laundry done", message: "The dryer in the basement finished its cycle.", symbol: "timer", icon: "timer", tint: "lilac", minutes: 220 },
      { id: "library", title: "Library loan", message: "Two books are due back next Tuesday.", symbol: "book.fill", icon: "book", tint: "sand", minutes: 1500 },
    ],
    urgent: { id: "leak", title: "Water under the sink", message: "The kitchen sensor found water. Turn off the valve.", symbol: "drop.fill", icon: "drop", tint: "red", minutes: 0 },
  },
  system: {
    label: "System messages",
    type: "SystemNotices",
    notices: [
      { id: "sync", title: "Synced 214 photos", message: "Everything from this week is on all your devices.", symbol: "checkmark.icloud.fill", icon: "icloud", tint: "neutral", minutes: 1 },
      { id: "update", title: "Update installed", message: "Version 4.2 adds offline maps.", symbol: "arrow.down.circle.fill", icon: "square.and.arrow.down", tint: "neutral", minutes: 30 },
      { id: "signin", title: "New sign-in", message: "From an iPad in Lisbon. Was this you?", symbol: "lock.fill", icon: "lock", tint: "sky", minutes: 75 },
      { id: "wifi", title: "Joined Café Alma", message: "Backups resume while you stay on this network.", symbol: "wifi", icon: "wifi", tint: "neutral", minutes: 160 },
      { id: "backup", title: "Backup complete", message: "1.8 GB saved at 03:12.", symbol: "checkmark.circle.fill", icon: "checkmark.circle.fill", tint: "sage", minutes: 600 },
      { id: "battery", title: "Watch charged", message: "Ready for tomorrow's run.", symbol: "battery.100", icon: "battery.100", tint: "neutral", minutes: 900 },
    ],
    urgent: { id: "storage", title: "Storage full", message: "New photos can't be saved. Free up space.", symbol: "exclamationmark.triangle.fill", icon: "exclamationmark.triangle", tint: "red", minutes: 0 },
  },
};

/** The notices a screen starts with: the urgent one first when asked, then the set, `count` in all. */
export function noticeSamples(setId: string, count: number, urgent: boolean): NoticeSample[] {
  const set = NOTICE_SETS[setId] ?? NOTICE_SETS.travel;
  return (urgent ? [set.urgent, ...set.notices] : set.notices).slice(0, Math.max(0, Math.min(count, 6)));
}

/** The shared sample enum: `sample(count:urgent:messages:times:)` builds the same list the Playground shows. */
function sampleEnum(set: NoticeSet): string[] {
  const i = INDENT;
  const notice = (x: NoticeSample) =>
    `.init(id: ${str(x.id)}, title: ${str(x.title)}, message: ${str(x.message)}, symbol: ${str(x.symbol)}${x.tint === "neutral" ? "" : `, tint: .${x.tint}`}, date: ${x.minutes ? `.now.addingTimeInterval(${num(-x.minutes * 60)})` : ".now"})`;
  return [
    "/// Sample notices so the screen runs on its own. In your app, build them from your own alerts, reminders",
    "/// and updates, newest first, and insert new ones at index 0 to drop them onto the stack.",
    `enum ${set.type} {`,
    `${i}static func sample(count: Int = ${NOTICE_DEFAULTS.count}, urgent: Bool = false, messages: Bool = true, times: Bool = true) -> [NoticeStack.Notice] {`,
    `${i}${i}var notices: [NoticeStack.Notice] = [`,
    ...set.notices.map((x) => `${i}${i}${i}${notice(x)},`),
    `${i}${i}]`,
    `${i}${i}if urgent {`,
    `${i}${i}${i}notices.insert(${notice(set.urgent)}, at: 0)`,
    `${i}${i}}`,
    `${i}${i}return notices.prefix(count).map { sample in`,
    `${i}${i}${i}var notice = sample`,
    `${i}${i}${i}if !messages { notice.message = "" }`,
    `${i}${i}${i}if !times { notice.date = nil }`,
    `${i}${i}${i}return notice`,
    `${i}${i}}`,
    `${i}}`,
    "}",
  ];
}

export const definition: SwiftPieceDefinition = {
  id: "notice-stack",
  name: "Notice Stack",
  category: "pieces",
  description: "In-app notices in a liquid glass pile: tap to spread them into a list, swipe one away, or clear them all with a red, confirming second tap. New notices drop in on top.",
  availability: "free",
  preview: { component: "notice-stack", chunk: "pieces-utility" },
  source: { registry: "free", name: "NoticeStack" },
  docs: "/docs/components/sheets/notice-stack",
  icon: "bell.badge",
  concepts: ["state", "binding", "closure", "gesture", "foreach", "formatstyle", "animation", "piece"],
  interactions: ["tap", "swipe", "expand", "press", "haptic", "transition", "spring"],
  properties: [
    select("set", "Notices", "travel", opts(["travel", "Travel day"], ["home", "Deliveries and home"], ["system", "System messages"]), {
      hint: "Sample notices for this preview. Your app passes its own, newest first.",
    }),
    number("count", "How many", NOTICE_DEFAULTS.count, 0, 6, 1, { hint: "Collapsed, the pile shows the newest and two peeks however many there are. None draws nothing." }),
    bool("urgent", "Urgent first", false, { hint: "Puts one urgent notice on top, on a red tile." }),
    bool("messages", "Messages", true, { group: "layout", hint: "The line or two under each title. Off, cards show the title alone." }),
    bool("times", "Times", true, { group: "layout", hint: "How long ago each one arrived, as now, 4m or 2h, kept current." }),
    link("link", "On tap", { hint: "Where tapping a notice in the list goes, such as the screen that shows it. Empty only expands and collapses." }),
    bool("expanded", "Starts spread", false, { group: "state", hint: "Starts as a list with Show less and Clear all, instead of a pile." }),
    number("spacing", "Gap in the list", NOTICE_DEFAULTS.spacing, 10, 24, 1, { level: "advanced", group: "layout" }),
    number("cornerRadius", "Card corners", NOTICE_DEFAULTS.cornerRadius, 12, 34, 1, { level: "advanced", group: "shape" }),
  ],
  variants: [
    { id: "travel", label: "Travel day", props: { set: "travel", count: 3, urgent: false, messages: true, times: true } },
    { id: "home", label: "Deliveries", props: { set: "home", count: 4, urgent: false, messages: true, times: true } },
    { id: "system", label: "System messages", props: { set: "system", count: 3, urgent: false, messages: false, times: true } },
    { id: "urgent", label: "Urgent first", props: { set: "home", count: 3, urgent: true, messages: true, times: true } },
  ],
  states: [
    { id: "pile", label: "Pile", props: { count: 3, expanded: false } },
    { id: "list", label: "Spread into a list", props: { count: 4, expanded: true } },
    { id: "single", label: "One notice", props: { count: 1, expanded: false } },
    { id: "many", label: "Many notices", props: { count: 6, expanded: false } },
    { id: "empty", label: "Nothing new", props: { count: 0, expanded: false } },
  ],
  anatomy: [
    { part: "Notices", props: ["set", "count", "urgent"] },
    { part: "Card", props: ["messages", "times", "cornerRadius"] },
    { part: "List", props: ["expanded", "spacing"] },
    { part: "Tap", props: ["link"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const set = NOTICE_SETS[s(p, "set")] ?? NOTICE_SETS.travel;
      const count = Math.max(0, Math.min(Math.round(n(p, "count")), 6));
      let seed = "[]";
      if (count > 0) {
        ctx.declare(set.type, sampleEnum(set));
        const args = [
          count !== NOTICE_DEFAULTS.count && `count: ${count}`,
          b(p, "urgent") && "urgent: true",
          !b(p, "messages") && "messages: false",
          !b(p, "times") && "times: false",
        ].filter(Boolean);
        seed = `${set.type}.sample(${args.join(", ")})`;
      }
      const notices = ctx.state("notices", "[NoticeStack.Notice]", seed);
      const expanded = ctx.state("noticesExpanded", "", b(p, "expanded") ? "true" : "false");
      const radius = Math.round(n(p, "cornerRadius") || NOTICE_DEFAULTS.cornerRadius);
      const spacing = Math.round(n(p, "spacing") || NOTICE_DEFAULTS.spacing);
      const style = [
        // A Style accent reaches Clear all.
        ctx.theme && "accent: Theme.accent, accentInk: Theme.accentInk",
        radius !== NOTICE_DEFAULTS.cornerRadius && `cornerRadius: ${num(radius)}`,
        spacing !== NOTICE_DEFAULTS.spacing && `spacing: ${num(spacing)}`,
      ].filter(Boolean);
      const head = call("NoticeStack", [
        ["notices", `$${notices}`],
        ["expanded", `$${expanded}`],
        style.length > 0 && ["style", `.init(${style.join(", ")})`],
      ]);
      // On tap: the link runs with the tapped notice (in your app, open it).
      const then = linkStatement(ctx, p.link);
      if (!then) return { lines: head };
      head[head.length - 1] += " { _ in";
      return { lines: [...head, `${INDENT}// The closure receives the tapped notice, to open what it is about.`, `${INDENT}${then}`, "}"] };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
