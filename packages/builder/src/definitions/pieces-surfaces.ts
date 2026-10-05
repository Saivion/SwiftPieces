// Free SwiftPieces that present, open or switch: a toast, a confirmation sheet and a permission
// sheet (each a trigger button that presents the real piece), a floating glass action menu, and
// two ways to switch between options (tracking tabs over paged content, glass segments). Emitters
// call each piece's public API exactly as its Swift source declares it, writing only arguments that
// differ from the Swift defaults. Presented pieces write the `@State` flag, the trigger button and
// the piece's own modifier, so the generated screen behaves like the preview.
import { house, swiftRGB } from "../core/palette.js";
import type { EmitContext, Props, ScreenNode, SwiftPieceDefinition } from "../core/schema.js";
import { INDENT, call, indent, list, num, str } from "../core/swift.js";
import { bool, icon, number, opts, select, text } from "./shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

const docs = (category: string, slug: string) => `/docs/components/${category}/${slug}`;
const piece = (name: string) => ({ registry: "free" as const, name });
const chunk = (id: string) => ({ component: id, chunk: "pieces-surfaces" });

/** House color blocks, as the pieces' own Swift palettes spell them. */
export const BLOCKS = ["butter", "sky", "sage", "lilac", "tangerine", "sand"] as const;
const blockOptions = BLOCKS.map((k): [string, string] => [k, k[0].toUpperCase() + k.slice(1)]);
const blockRGB = (k: string) => swiftRGB(house.blocks[k] ?? house.blocks.butter);

/**
 * Appends modifiers that may span several lines (a modifier with a trailing closure), indented the
 * way `modifiers()` indents one-line ones: under a one-line view they indent, after a closing brace
 * they sit level with it.
 */
function attach(lines: string[], mods: Array<string[] | null | false>): string[] {
  const pad = lines.length === 1 || lines.slice(1).every((l) => l.startsWith(`${INDENT}.`)) ? INDENT : "";
  const out = [...lines];
  for (const m of mods) {
    if (!m || !m.length) continue;
    m.forEach((l, i) => out.push(`${pad}${i === 0 ? "." : ""}${l}`));
  }
  return out;
}

/** A call whose arguments may be multi-line values (an array literal, a nested init). */
type MArg = [label: string | null, value: string | string[]] | null | false | undefined;
function callLines(name: string, args: MArg[], trailing?: string[] | null, trailingHead = ""): string[] {
  const parts = args.filter((a): a is [string | null, string | string[]] => Boolean(a));
  const multi = parts.some(([, v]) => Array.isArray(v));
  let lines: string[];
  if (!multi) {
    lines = call(name, parts.map(([l, v]) => [l, v as string]), null);
  } else {
    const inner: string[] = [];
    parts.forEach(([l, v], i) => {
      const comma = i < parts.length - 1 ? "," : "";
      const value = Array.isArray(v) ? v : [v];
      const head = l ? `${l}: ` : "";
      value.forEach((line, j) => inner.push(`${j === 0 ? head : ""}${line}${j === value.length - 1 ? comma : ""}`));
    });
    lines = [`${name}(`, ...indent(inner), ")"];
  }
  if (trailing == null) return lines;
  lines[lines.length - 1] += ` {${trailingHead ? ` ${trailingHead}` : ""}`;
  return [...lines, ...indent(trailing), "}"];
}

/** `[` one element per line `]`, as Xcode formats a long array literal. */
const arrayLines = (items: string[]) => ["[", ...items.map((i) => `${INDENT}${i},`), "]"];

// ---------------------------------------------------------------- Triggers

/**
 * The inline button a presented piece hangs off. Prominent is the look's accent (the house signal
 * without a look) with its ink; raised is a quiet capsule; text is a plain tinted button.
 */
const triggerProps = (title: string) => [
  text("trigger", "Button text", title, { maxLength: 40, hint: "The button on the screen that presents it." }),
  select("triggerStyle", "Button style", "prominent", opts(["prominent", "Prominent"], ["raised", "Raised"], ["text", "Text only"]), { group: "color" }),
  bool("fullWidth", "Full width", true, { group: "layout", when: { prop: "triggerStyle", notEquals: ["text"] } }),
  bool("presented", "Starts presented", false, { level: "advanced", group: "state", hint: "Shows it as the screen opens, handy for inspecting it." }),
];

function triggerButton(ctx: EmitContext, p: Props, flag: string): string[] {
  const style = s(p, "triggerStyle");
  const title = str(s(p, "trigger"));
  const full = b(p, "fullWidth") && style !== "text";
  const ink = ctx.theme ? "Theme.accentInk" : swiftRGB(house.ink);
  const labelMods = [full && "frame(maxWidth: .infinity)", style === "prominent" && `foregroundStyle(${ink})`].filter(Boolean) as string[];
  const button = labelMods.length
    ? call("Button", [["action", `{ ${flag} = true }`]], [`Text(${title})`, ...labelMods.map((m) => `${INDENT}.${m}`)])
    : [`Button(${title}) { ${flag} = true }`];
  // Without a look the app tint is system blue; the house signal keeps the button on brand.
  const signal = ctx.theme ? null : swiftRGB(house.signal);
  const mods: string[] =
    style === "prominent" ? ["buttonStyle(.borderedProminent)", "buttonBorderShape(.capsule)", "controlSize(.large)", "fontWeight(.semibold)", ...(signal ? [`tint(${signal})`] : [])]
    : style === "raised" ? ["buttonStyle(.bordered)", "buttonBorderShape(.capsule)", "controlSize(.large)", "fontWeight(.semibold)", "tint(.primary)"]
    : ["fontWeight(.semibold)", ...(signal ? [`tint(${signal})`] : [])];
  return attach(button, mods.map((m) => [m]));
}

const triggerAnatomy = { part: "Trigger", props: ["trigger", "triggerStyle", "fullWidth"] };

// ---------------------------------------------------------------- Toast

/** The symbol a toast kind draws when none is given (the preview's nearest glyph). */
export const TOAST_STYLE_SYMBOL: Record<string, string> = { info: "info.circle", success: "checkmark", warning: "exclamationmark.triangle", error: "xmark" };

export const toast: SwiftPieceDefinition = {
  id: "toast",
  name: "Toast",
  category: "pieces",
  description: "A short message that slides in from the top or bottom, then leaves on its own. Swipe it away, or touch it to pause the timer.",
  availability: "free",
  preview: chunk("toast"),
  source: piece("Toast"),
  docs: docs("sheets", "toast"),
  icon: "bell.badge",
  concepts: ["state", "binding", "modifier", "enum", "closure"],
  interactions: ["tap", "press", "swipe", "transition", "spring", "haptic"],
  properties: [
    ...triggerProps("Save changes"),
    text("message", "Message", "Changes saved", { maxLength: 60 }),
    text("detail", "Detail", "Synced to all your devices", { maxLength: 60, hint: "A quieter second line. Leave empty for none." }),
    select("style", "Kind", "success", opts(["info", "Info"], ["success", "Success"], ["warning", "Warning"], ["error", "Error"]), { group: "color", hint: "Picks the tile color, the symbol and the haptic it arrives with." }),
    icon("icon", "Symbol", "none", { hint: "None uses the kind's own symbol." }),
    text("actionTitle", "Action", "Undo", { maxLength: 16, hint: "A trailing button such as Undo. Leave empty for none." }),
    select("position", "Edge", "top", opts(["top", "Top"], ["bottom", "Bottom"]), { group: "layout" }),
    number("duration", "Duration (s)", 3, 1, 10, 0.5, { level: "advanced", pro: true, group: "motion", hint: "Seconds before it leaves on its own." }),
  ],
  anatomy: [
    triggerAnatomy,
    { part: "Tile", props: ["style", "icon"] },
    { part: "Message", props: ["message", "detail"] },
    { part: "Action", props: ["actionTitle"] },
    { part: "Presentation", props: ["position", "duration", "presented"] },
  ],
  variants: [
    { id: "saved", label: "Saved", props: { trigger: "Save changes", message: "Changes saved", detail: "Synced to all your devices", style: "success", actionTitle: "Undo", position: "top" } },
    { id: "archived", label: "Archived", props: { trigger: "Archive", message: "Conversation archived", detail: "Mira Reyes · Invoice 2291", style: "info", actionTitle: "Undo", position: "bottom", triggerStyle: "raised" } },
    { id: "offline", label: "Offline", props: { trigger: "Sync now", message: "You're offline", detail: "We'll sync when you reconnect", style: "warning", actionTitle: "", position: "top" } },
    { id: "failed", label: "Failed", props: { trigger: "Send payment", message: "Payment failed", detail: "Your card was declined", style: "error", actionTitle: "Retry", position: "bottom" } },
  ],
  states: [
    { id: "hidden", label: "Hidden", props: { presented: false } },
    { id: "shown", label: "Shown", props: { presented: true } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const flag = ctx.state("show toast", "", b(p, "presented") ? "true" : "false");
      const ic = s(p, "icon");
      const action = s(p, "actionTitle").trim();
      const detail = s(p, "detail").trim();
      const mod = call("toast", [
        ["isPresented", `$${flag}`],
        ["message", str(s(p, "message"))],
        detail !== "" && ["detail", str(detail)],
        ic !== "none" && ["systemImage", str(ic)],
        s(p, "style") !== "info" && ["style", `.${s(p, "style")}`],
        n(p, "duration") !== 3 && ["duration", num(n(p, "duration"))],
        s(p, "position") !== "top" && ["position", `.${s(p, "position")}`],
        action !== "" && ["action", `.init(${str(action)}) {}`],
      ]);
      // The toast overlays the view it modifies, so it goes on the screen, not on the button.
      ctx.screenModifier([`.${mod[0]}`, ...mod.slice(1)]);
      return { lines: triggerButton(ctx, p, flag) };
    },
  },
};

// ---------------------------------------------------------------- Confirm Sheet

export const confirmSheet: SwiftPieceDefinition = {
  id: "confirm-sheet",
  name: "Confirm Sheet",
  category: "pieces",
  description: "Asks before something important happens. A card rises from the bottom; confirming shows a spinner, then a check, then it closes. Drag it down or tap outside to cancel.",
  availability: "free",
  preview: chunk("confirm-sheet"),
  source: piece("ConfirmSheet"),
  docs: docs("sheets", "confirm-sheet"),
  icon: "exclamationmark.triangle",
  concepts: ["state", "binding", "modifier", "async", "closure"],
  interactions: ["tap", "press", "sheet", "drag", "loading", "spring", "haptic", "transition"],
  properties: [
    ...triggerProps("Delete account"),
    icon("icon", "Symbol", "trash"),
    text("title", "Title", "Delete your account?", { maxLength: 50 }),
    text("message", "Message", "Your profile, photos and messages will be removed. This can't be undone.", { maxLength: 160 }),
    text("confirmTitle", "Confirm text", "Delete account", { maxLength: 30 }),
    text("cancelTitle", "Cancel text", "Cancel", { maxLength: 30 }),
    bool("destructive", "Destructive", true, { group: "color", hint: "Signal-colored confirm button, and a warning haptic when it appears." }),
    select("presentation", "Presents as", "sheet", opts(["sheet", "Sheet"], ["inline", "Floating card"]), { group: "interaction", hint: "A system sheet sized to the card, or a card floating over the screen." }),
  ],
  anatomy: [
    triggerAnatomy,
    { part: "Tile", props: ["icon", "destructive"] },
    { part: "Copy", props: ["title", "message"] },
    { part: "Buttons", props: ["confirmTitle", "cancelTitle", "destructive"] },
    { part: "Presentation", props: ["presentation", "presented"] },
  ],
  variants: [
    { id: "delete", label: "Delete", props: { trigger: "Delete account", icon: "trash", title: "Delete your account?", message: "Your profile, photos and messages will be removed. This can't be undone.", confirmTitle: "Delete account", destructive: true } },
    { id: "signout", label: "Sign out", props: { trigger: "Sign out", triggerStyle: "raised", icon: "hand.wave", title: "Sign out of this iPhone?", message: "Your data stays in iCloud. Sign back in any time to pick up where you left off.", confirmTitle: "Sign out", destructive: false } },
    { id: "publish", label: "Publish", props: { trigger: "Publish", icon: "paperplane", title: "Publish to everyone?", message: "Anyone with the link can see it. You can unpublish later.", confirmTitle: "Publish now", destructive: false, presentation: "inline" } },
  ],
  states: [
    { id: "closed", label: "Closed", props: { presented: false } },
    { id: "open", label: "Open", props: { presented: true } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const flag = ctx.state(`show ${s(p, "trigger") || "confirm"}`, "", b(p, "presented") ? "true" : "false");
      const mod = call(
        "confirmSheet",
        [
          ["isPresented", `$${flag}`],
          s(p, "presentation") === "inline" && ["inline", "true"],
          ["systemImage", str(s(p, "icon") === "none" ? "questionmark.circle" : s(p, "icon"))],
          ["title", str(s(p, "title"))],
          ["message", str(s(p, "message"))],
          s(p, "confirmTitle") !== "Confirm" && ["confirmTitle", str(s(p, "confirmTitle"))],
          s(p, "cancelTitle") !== "Cancel" && ["cancelTitle", str(s(p, "cancelTitle"))],
          b(p, "destructive") && ["isDestructive", "true"],
        ],
        ["// Do the work here; the button spins until it returns.", "try? await Task.sleep(for: .seconds(1))"],
      );
      // Inline overlays the view it modifies (the whole screen); a sheet can hang off the button.
      if (s(p, "presentation") === "inline") {
        ctx.screenModifier([`.${mod[0]}`, ...mod.slice(1)]);
        return { lines: triggerButton(ctx, p, flag) };
      }
      return { lines: attach(triggerButton(ctx, p, flag), [mod]) };
    },
  },
};

// ---------------------------------------------------------------- Permission Sheet

/** What each permission asks for, its symbols, and the real request that returns whether it was granted. */
export const PERMISSIONS: Record<string, { label: string; icon: string; symbol: string; benefits: [string, string][]; module: string; request: string[]; alert: string }> = {
  notifications: {
    label: "Notifications",
    icon: "bell.badge",
    symbol: "bell.badge.fill",
    benefits: [["clock", "clock.fill"], ["person.2", "person.2.fill"], ["moon", "moon.fill"]],
    module: "UserNotifications",
    request: ["let options: UNAuthorizationOptions = [.alert, .badge, .sound]", "return (try? await UNUserNotificationCenter.current().requestAuthorization(options: options)) ?? false"],
    alert: "Would Like to Send You Notifications",
  },
  camera: {
    label: "Camera",
    icon: "camera",
    symbol: "camera.fill",
    benefits: [["qrcode", "qrcode.viewfinder"], ["doc.text", "doc.viewfinder"], ["video", "video.fill"]],
    module: "AVFoundation",
    request: ["await AVCaptureDevice.requestAccess(for: .video)"],
    alert: "Would Like to Access the Camera",
  },
  photos: {
    label: "Photos",
    icon: "photo",
    symbol: "photo.fill",
    benefits: [["sparkles", "sparkles"], ["square.and.arrow.up", "square.and.arrow.up.fill"], ["lock", "lock.fill"]],
    module: "Photos",
    request: ["await PHPhotoLibrary.requestAuthorization(for: .readWrite) == .authorized"],
    alert: "Would Like Full Access to Your Photo Library",
  },
  microphone: {
    label: "Microphone",
    icon: "mic",
    symbol: "mic.fill",
    benefits: [["message", "message.fill"], ["speaker.wave.2", "speaker.wave.2.fill"], ["lock", "lock.fill"]],
    module: "AVFoundation",
    request: ["await AVAudioApplication.requestRecordPermission()"],
    alert: "Would Like to Access the Microphone",
  },
};

export const permissionSheet: SwiftPieceDefinition = {
  id: "permission-sheet",
  name: "Permission Sheet",
  category: "pieces",
  description: "Explains why your app needs a permission before iOS asks. The button runs the real request, then the sheet reacts: a check when allowed, a route to Settings when not.",
  availability: "free",
  preview: chunk("permission-sheet"),
  source: piece("PermissionSheet"),
  docs: docs("sheets", "permission-sheet"),
  icon: "shield",
  concepts: ["state", "binding", "async", "closure", "array", "framework"],
  interactions: ["tap", "press", "sheet", "drag", "loading", "transition", "spring", "haptic"],
  properties: [
    ...triggerProps("Turn on notifications"),
    select("permission", "Permission", "notifications", Object.entries(PERMISSIONS).map(([value, v]) => ({ value, label: v.label })), { group: "interaction", hint: "Which iOS permission the button requests." }),
    icon("icon", "Symbol", "bell.badge"),
    text("title", "Title", "Turn on notifications", { maxLength: 50 }),
    text("message", "Message", "We only send what matters, and you can change this any time.", { maxLength: 140 }),
    text("benefits", "Benefits", "A nudge before things are due, Replies from people you share with, Nothing between 10 PM and 7 AM", { maxLength: 240, hint: "Up to three, separated by commas." }),
    text("allowTitle", "Button text", "Allow notifications", { maxLength: 30 }),
    bool("skippable", "Not now button", true),
    text("deniedTitle", "Denied title", "Notifications are off", { maxLength: 50, level: "advanced" }),
    text("deniedMessage", "Denied message", "Turn them on in Settings whenever you're ready.", { maxLength: 120, level: "advanced" }),
  ],
  anatomy: [
    triggerAnatomy,
    { part: "Tile", props: ["icon", "permission"] },
    { part: "Copy", props: ["title", "message", "deniedTitle", "deniedMessage"] },
    { part: "Benefits", props: ["benefits"] },
    { part: "Buttons", props: ["allowTitle", "skippable", "presented"] },
  ],
  variants: [
    { id: "notifications", label: "Notifications", props: { permission: "notifications", icon: "bell.badge", trigger: "Turn on notifications", title: "Turn on notifications", message: "We only send what matters, and you can change this any time.", benefits: "A nudge before things are due, Replies from people you share with, Nothing between 10 PM and 7 AM", allowTitle: "Allow notifications", deniedTitle: "Notifications are off" } },
    { id: "camera", label: "Camera", props: { permission: "camera", icon: "camera", trigger: "Scan a document", title: "Use your camera to scan", message: "Point it at a receipt or a QR code and we'll do the rest.", benefits: "Scan QR codes in a tap, Turn paper into clean PDFs, Record short clips", allowTitle: "Allow camera", deniedTitle: "Camera is off", deniedMessage: "Turn it on in Settings to scan." } },
    { id: "photos", label: "Photos", props: { permission: "photos", icon: "photo", trigger: "Choose photos", title: "Bring in your photos", message: "Pick the moments you want to edit and share.", benefits: "Smart edits in one tap, Share straight to friends, Private to this device", allowTitle: "Allow photos", deniedTitle: "Photos are off", deniedMessage: "Turn on access in Settings to pick photos.", skippable: false } },
    { id: "microphone", label: "Microphone", props: { permission: "microphone", icon: "mic", trigger: "Record a voice note", title: "Talk instead of type", message: "Hold to record, and we'll turn it into a note.", benefits: "Voice replies in a tap, Hear notes read back, Recordings stay on device", allowTitle: "Allow microphone", deniedTitle: "Microphone is off", deniedMessage: "Turn it on in Settings to record." } },
  ],
  states: [
    { id: "closed", label: "Closed", props: { presented: false } },
    { id: "open", label: "Open", props: { presented: true } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const perm = PERMISSIONS[s(p, "permission")] ?? PERMISSIONS.notifications;
      ctx.import(perm.module);
      const flag = ctx.state(`show ${perm.label} permission`, "", b(p, "presented") ? "true" : "false");
      const benefits = list(p.benefits, 3).map((t, i) => `.init(symbol: ${str(perm.benefits[i][1])}, text: ${str(t)})`);
      const ic = s(p, "icon");
      const sheet = callLines("PermissionSheet", [
        ["systemImage", str(ic === "none" ? perm.symbol : ic)],
        ["title", str(s(p, "title"))],
        ["message", str(s(p, "message"))],
        benefits.length > 0 && ["benefits", arrayLines(benefits)],
        s(p, "allowTitle") !== "Continue" && ["allowTitle", str(s(p, "allowTitle"))],
        s(p, "deniedTitle") !== "Permission is off" && ["deniedTitle", str(s(p, "deniedTitle"))],
        s(p, "deniedMessage") !== "You can turn it on any time in Settings." && ["deniedMessage", str(s(p, "deniedMessage"))],
        ["request", perm.request.length === 1 ? `{ ${perm.request[0]} }` : ["{", ...indent(perm.request), "}"]],
        ["onGranted", `{ ${flag} = false }`],
        b(p, "skippable") && ["onSkip", `{ ${flag} = false }`],
      ]);
      const content = attach(sheet, [["presentationBackground(PermissionSheet.Style.standard.surface)"]]);
      const mod = [`sheet(isPresented: $${flag}) {`, ...indent(content), "}"];
      return { lines: attach(triggerButton(ctx, p, flag), [mod]) };
    },
  },
};

// ---------------------------------------------------------------- Glass Action Menu

const ITEM_SYMBOLS: Array<[RegExp, string]> = [
  [/note|write|compose|draft|post/i, "square.and.pencil"],
  [/voice|memo|mic|record|audio/i, "mic"],
  [/photo|camera|picture|image/i, "camera"],
  [/video|film|clip/i, "video"],
  [/scan|qr/i, "qrcode"],
  [/file|doc|page/i, "doc.text"],
  [/link|url/i, "link"],
  [/event|calendar|meeting/i, "calendar"],
  [/task|todo|reminder/i, "checkmark.circle.fill"],
  [/message|chat|reply/i, "message"],
  [/place|location|map|pin/i, "mappin"],
  [/contact|person|friend|invite/i, "person.badge.plus"],
  [/pay|money|transfer|send/i, "paperplane"],
  [/share/i, "square.and.arrow.up"],
  [/folder|album/i, "folder"],
  [/expense|receipt|card/i, "creditcard"],
];
const FALLBACK_SYMBOLS = ["sparkles", "star", "bolt", "heart", "flag"];
/** The SF Symbol an action label suggests, so typing "Voice memo" gets a microphone. */
export const itemSymbol = (label: string, i: number) => ITEM_SYMBOLS.find(([re]) => re.test(label))?.[1] ?? FALLBACK_SYMBOLS[i % FALLBACK_SYMBOLS.length];
/** Item tiles, in order, when items are color blocks. */
export const ITEM_BLOCKS = ["butter", "lilac", "sky", "sage", "sand"];

export const glassActionMenu: SwiftPieceDefinition = {
  id: "glass-action-menu",
  name: "Glass Action Menu",
  category: "pieces",
  description: "A floating button that blooms into actions. Tap to open, or press and hold, slide to an action and let go to fire it.",
  availability: "free",
  preview: chunk("glass-action-menu"),
  source: piece("GlassActionMenu"),
  docs: docs("glass", "glass-action-menu"),
  icon: "plus.circle.fill",
  concepts: ["array", "closure", "gesture", "spring", "enum"],
  interactions: ["tap", "hold", "drag", "menu", "expand", "spring", "haptic"],
  properties: [
    text("items", "Actions", "Note, Voice memo, Photo", { maxLength: 120, hint: "Up to five, separated by commas. Symbols follow the names." }),
    icon("triggerIcon", "Button symbol", "plus"),
    select("arrangement", "Arrangement", "arc", opts(["arc", "Arc"], ["linear", "Column"]), { group: "layout", hint: "Arc fans up and to the leading side; column stacks straight up." }),
    bool("tinted", "Color blocks", true, { group: "color", hint: "Off draws the actions as clear glass." }),
    select("alignment", "Placement", "trailing", opts(["leading", "Leading"], ["center", "Center"], ["trailing", "Trailing"]), { group: "layout" }),
    bool("confirmsAction", "Confirm with a check", true, { level: "advanced", group: "motion", hint: "The button shows a check for a moment after an action fires." }),
  ],
  anatomy: [
    { part: "Trigger", props: ["triggerIcon", "alignment"] },
    { part: "Actions", props: ["items", "tinted"] },
    { part: "Layout", props: ["arrangement"] },
    { part: "Feedback", props: ["confirmsAction"] },
  ],
  variants: [
    { id: "create", label: "Create", props: { items: "Note, Voice memo, Photo", arrangement: "arc", tinted: true, triggerIcon: "plus" } },
    { id: "column", label: "Column", props: { items: "Scan, Expense, Transfer, Share", arrangement: "linear", tinted: true, triggerIcon: "plus", confirmsAction: false } },
    { id: "glass", label: "Glass", props: { items: "Message, Event, Invite", arrangement: "arc", tinted: false, triggerIcon: "square.and.pencil" } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const labels = list(p.items, 5);
      const safe = labels.length ? labels : ["Action"];
      const items = safe.map((l, i) => `.init(symbol: ${str(itemSymbol(l, i))}, label: ${str(l)}${b(p, "tinted") ? `, tint: ${blockRGB(ITEM_BLOCKS[i % ITEM_BLOCKS.length])}` : ""}) {}`);
      const lines = callLines("GlassActionMenu", [
        ["items", arrayLines(items)],
        s(p, "triggerIcon") !== "plus" && s(p, "triggerIcon") !== "none" && ["triggerSymbol", str(s(p, "triggerIcon"))],
        s(p, "arrangement") !== "linear" && ["arrangement", `.${s(p, "arrangement")}`],
        ctx.theme && ["tint", "Theme.accent"],
        !b(p, "confirmsAction") && ["style", ".init(confirmsAction: false)"],
      ]);
      const a = s(p, "alignment");
      return { lines: attach(lines, [a !== "center" && [`frame(maxWidth: .infinity, alignment: .${a})`]]) };
    },
  },
};

// ---------------------------------------------------------------- Tracking Tabs

/** Counts from "4, 6, 2": whole numbers only; anything else hides the counts. */
export function parseCounts(value: unknown): number[] {
  const parts = list(value, 6);
  if (!parts.length || parts.some((c) => !/^\d{1,5}$/.test(c))) return [];
  return parts.map(Number);
}

export const trackingTabs: SwiftPieceDefinition = {
  id: "tracking-tabs",
  name: "Tracking Tabs",
  category: "pieces",
  description: "Tabs over swipeable pages. A color block slides under the titles and follows your finger as you swipe between pages. Put a component inside for each page.",
  availability: "free",
  preview: chunk("tracking-tabs"),
  source: piece("TrackingTabs"),
  docs: docs("navigation", "tracking-tabs"),
  icon: "rectangle.stack",
  container: {},
  concepts: ["state", "binding", "array", "viewbuilder", "scrollview"],
  interactions: ["tabs", "tap", "press", "swipe", "select", "spring", "haptic"],
  properties: [
    text("titles", "Tabs", "Today, Upcoming, Done", { maxLength: 80, hint: "Up to five, separated by commas. Each tab shows one page; components you add inside fill the pages in order." }),
    text("counts", "Counts", "4, 6, 2", { maxLength: 40, hint: "A number per tab, separated by commas. Leave empty to hide them." }),
    number("selected", "Starts on tab", 0, 0, 4, 1, { group: "state" }),
    select("indicator", "Indicator", "butter", opts(...blockOptions), { group: "color" }),
  ],
  anatomy: [
    { part: "Titles", props: ["titles", "counts"] },
    { part: "Indicator", props: ["indicator", "selected"] },
    { part: "Pages", props: [] },
  ],
  variants: [
    { id: "tasks", label: "Tasks", props: { titles: "Today, Upcoming, Done", counts: "4, 6, 2", indicator: "butter" } },
    { id: "inbox", label: "Inbox", props: { titles: "All, Unread, Flagged", counts: "", indicator: "sky" } },
    { id: "orders", label: "Orders", props: { titles: "Active, Past", counts: "2, 18", indicator: "sage" } },
  ],
  states: [
    { id: "first", label: "First tab", props: { selected: 0 } },
    { id: "second", label: "Second tab", props: { selected: 1 } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const titles = list(p.titles, 5);
      const safe = titles.length ? titles : ["Tab"];
      const sel = Math.min(Math.max(0, Math.round(n(p, "selected"))), safe.length - 1);
      const tab = ctx.state("tab", "", num(sel));
      const counts = parseCounts(p.counts);
      const indicator = s(p, "indicator");
      const style = indicator !== "butter" && [
        "TrackingTabsStyle(",
        `${INDENT}track: TrackingTabsStyle.standard.track,`,
        `${INDENT}indicator: ${blockRGB(indicator)},`,
        `${INDENT}title: TrackingTabsStyle.standard.title,`,
        // On the accent block, titles take the ink that reads on the accent (Style), as in the preview.
        `${INDENT}selectedTitle: ${indicator === "tangerine" && ctx.theme ? "Theme.accentInk" : "TrackingTabsStyle.standard.selectedTitle"}`,
        ")",
      ];
      // A page for every tab: the components placed inside, in order, then a placeholder list.
      const placeholder = [
        "VStack(spacing: 10) {",
        `${INDENT}ForEach(0..<3, id: \\.self) { _ in`,
        `${INDENT}${INDENT}RoundedRectangle(cornerRadius: 18, style: .continuous)`,
        `${INDENT}${INDENT}${INDENT}.fill(TrackingTabsStyle.standard.track)`,
        `${INDENT}${INDENT}${INDENT}.frame(height: 60)`,
        `${INDENT}}`,
        "}",
      ];
      const kids = ctx.children().slice(0, safe.length);
      let page: string[];
      if (!kids.length) page = placeholder;
      else {
        page = ["switch index {"];
        kids.forEach((k, i) => page.push(`case ${i}:`, ...indent(k)));
        page.push("default:", ...indent(kids.length < safe.length ? placeholder : ["EmptyView()"]), "}");
      }
      const lines = callLines("TrackingTabs", [["titles", `[${safe.map(str).join(", ")}]`], ["selection", `$${tab}`], counts.length > 0 && ["counts", `[${counts.join(", ")}]`], style && ["style", style]], page, "index in");
      return { lines };
    },
  },
};

// ---------------------------------------------------------------- Glass Segments

export const glassSegments: SwiftPieceDefinition = {
  id: "glass-segments",
  name: "Glass Segments",
  category: "pieces",
  description: "A segmented control with a glass pill you can tap or grab and drag. The pill stretches as it moves and settles with a spring.",
  availability: "free",
  preview: chunk("glass-segments"),
  source: piece("GlassSegments"),
  docs: docs("glass", "glass-segments"),
  icon: "slider.horizontal.3",
  concepts: ["state", "binding", "array", "closure", "gesture"],
  interactions: ["select", "tap", "drag", "spring", "haptic"],
  properties: [
    text("options", "Options", "Day, Week, Month, Year", { maxLength: 80, hint: "Two to five, separated by commas." }),
    number("selected", "Starts on", 1, 0, 4, 1, { group: "state", hint: "The option selected at first, counting from 0." }),
    select("indicator", "Indicator", "glass", opts(["glass", "Glass"], ...blockOptions), { group: "material", hint: "Glass is a raised pill; a color makes it a solid block." }),
    number("height", "Height", 40, 32, 56, 1, { level: "advanced", group: "layout" }),
    bool("disabled", "Disabled", false, { level: "advanced" }),
  ],
  anatomy: [
    { part: "Options", props: ["options", "selected"] },
    { part: "Indicator", props: ["indicator"] },
    { part: "Track", props: ["height", "disabled"] },
  ],
  variants: [
    { id: "period", label: "Period", props: { options: "Day, Week, Month, Year", selected: 1, indicator: "glass" } },
    { id: "units", label: "Units", props: { options: "Metric, Imperial", selected: 0, indicator: "butter" } },
    { id: "view", label: "View", props: { options: "List, Grid, Map", selected: 0, indicator: "sky" } },
  ],
  states: [
    { id: "enabled", label: "Enabled", props: { disabled: false } },
    { id: "disabled", label: "Disabled", props: { disabled: true } },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const options = list(p.options, 5);
      const safe = options.length ? options : ["One", "Two"];
      const sel = Math.min(Math.max(0, Math.round(n(p, "selected"))), safe.length - 1);
      const name = ctx.state("selection", "", str(safe[sel]));
      const indicator = s(p, "indicator");
      const lines = call(
        "GlassSegments",
        [
          ["options", `[${safe.map(str).join(", ")}]`],
          ["selection", `$${name}`],
          n(p, "height") !== 40 && ["height", num(n(p, "height"))],
          indicator !== "glass" && ["style", `.block(${blockRGB(indicator)})`],
        ],
        ["$0"],
      );
      // `{ $0 }` reads best on one line.
      const compact = lines.length === 3 && lines[1].trim() === "$0" ? [lines[0].replace(/ \{$/, " { $0 }")] : lines;
      return { lines: attach(compact, [b(p, "disabled") && ["disabled(true)"]]) };
    },
  },
};

export const surfacePieces: SwiftPieceDefinition[] = [toast, confirmSheet, permissionSheet, glassActionMenu, trackingTabs, glassSegments];

const triggerFills = (node: ScreenNode) => node.props.fullWidth !== false && node.props.triggerStyle !== "text";

/** Which of these take all the width they are offered (see react/preview/fills.ts). */
export const surfaceFills: Record<string, boolean | ((node: ScreenNode) => boolean)> = {
  toast: triggerFills,
  "confirm-sheet": triggerFills,
  "permission-sheet": triggerFills,
  "glass-action-menu": (node) => node.props.alignment !== "center",
  "tracking-tabs": true,
  "glass-segments": true,
};
