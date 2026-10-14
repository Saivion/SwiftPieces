// Wallet Stack: tickets, boarding passes and memberships as solid colour passes stacked so every header strip shows.
// Tap one and it rises and opens to its code while the rest tuck into a pile; drag it down, tap the pile or the clear
// glass close bubble to put it back. The emitter declares the sample passes the screen shows (the same ones the
// Playground renderer draws, codes included) and calls `WalletStack(passes:selection:…)` exactly as
// registry/swift/cards/WalletStack.swift declares it, writing only what differs from its defaults.
import type { EmitContext, Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, num, str } from "../../core/swift.js";
import { bool, number, opts, select } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

/** Swift defaults, so the emitted call only spells out what differs. */
export const WALLET_DEFAULTS = { cornerRadius: 22, pileDepth: 4 } as const;

export type WalletTint = "sky" | "butter" | "sage" | "lilac" | "sand" | "red";

export type WalletPass = {
  id: string;
  title: string;
  subtitle: string;
  /** The SF Symbol the Swift draws on the tile. */
  symbol: string;
  tint: WalletTint;
  headerField: [label: string, value: string];
  fields: Array<[label: string, value: string]>;
  code: string;
  /** The code as Core Image's QR generator draws it (correction M): 21 rows of hex, quiet zone left off. */
  qr: string;
};

/** Every sample pass, back to front. A trip first, then memberships. */
export const WALLET_PASSES: WalletPass[] = [
  {
    id: "gallery", title: "Gallery day pass", subtitle: "Casa da Luz, Lisbon", symbol: "building.columns.fill", tint: "butter",
    headerField: ["Entry", "11:00"], fields: [["Date", "Sat 25 Oct"], ["Guests", "2 adults"], ["Floors", "All"]], code: "GD-1180-0093",
    qr: "1fc07f 104c41 175e5d 17575d 17555d 105a41 1fd57f 001000 17c27c 1caf1a 0579e3 0e332e 067523 001529 1fce24 105c25 175a36 175be8 17554c 104bcd 1fdd24",
  },
  {
    id: "rail", title: "Rail pass", subtitle: "Lisbon to Porto", symbol: "tram.fill", tint: "sky",
    headerField: ["Coach", "4"], fields: [["Departs", "08:42"], ["Arrives", "11:37"], ["Seat", "14A"]], code: "SP-2291-0742",
    qr: "1fc57f 104241 17515d 175d5d 175d5d 105e41 1fd57f 001000 17c67c 0e3f8a 037162 1aa7dc 12f500 00192a 1fc622 105c25 17562e 1757d0 175174 1043f9 1fd924",
  },
  {
    id: "concert", title: "Night Market Live", subtitle: "Riverside Pavilion", symbol: "music.note", tint: "red",
    headerField: ["Doors", "19:30"], fields: [["Date", "Fri 24 Oct"], ["Section", "Floor"], ["Gate", "C"]], code: "NML-0424-1187",
    qr: "1fdf7f 105e41 174a5d 17545d 174c5d 104441 1fd57f 001400 16ec4b 0b95ae 135905 0cb9c7 055248 001871 1fd851 105355 17466b 1754a2 17561c 104b58 1fd392",
  },
  {
    id: "ferry", title: "River ferry", subtitle: "Cais do Sodré to Cacilhas", symbol: "ferry.fill", tint: "sage",
    headerField: ["Boards", "17:10"], fields: [["Pier", "2"], ["Return", "Open"], ["Fare", "Adult"]], code: "RF-5530-0218",
    qr: "1fc17f 104b41 175c5d 175c5d 17595d 105241 1fd57f 001c00 17c27c 1493a9 064163 10377c 09e96b 00112c 1fc226 105825 175e3a 175be0 17554c 104bc5 1fd924",
  },
  {
    id: "gym", title: "Climbing gym", subtitle: "Member since 2024", symbol: "figure.climbing", tint: "lilac",
    headerField: ["Visits", "38"], fields: [["Plan", "Monthly"], ["Renews", "1 Nov"]], code: "CG-7731-22",
    qr: "1fc57f 105c41 174e5d 174b5d 17555d 104941 1fd57f 000300 154a12 068466 01f912 1e1463 165569 00128f 1fcef5 104fa0 175ad7 174856 175d09 10407f 1fd955",
  },
  {
    id: "library", title: "City library", subtitle: "Card holder", symbol: "books.vertical.fill", tint: "sand",
    headerField: ["Loans", "3"], fields: [["Due", "30 Oct"], ["Branch", "Central"]], code: "LIB-0042-1187",
    qr: "1fc37f 104941 175c5d 175e5d 175b5d 105d41 1fd57f 001700 17c97c 1715af 02c264 121474 0d624b 001b17 1fc5e5 105f55 175506 175114 175e34 104805 1fd204",
  },
  {
    id: "coffee", title: "Coffee club", subtitle: "Rua Nova roasters", symbol: "cup.and.saucer.fill", tint: "butter",
    headerField: ["Stamps", "7 of 10"], fields: [["Reward", "Free flat white"]], code: "CC-1029-5531",
    qr: "1fc57f 104141 17545d 175c5d 17555d 105241 1fd57f 001c00 17ca7c 1ca308 1af5a1 15033d 076100 001139 1fce14 105c25 175a26 175fd4 175954 104fc1 1fd114",
  },
  {
    id: "museum", title: "Science museum", subtitle: "Annual pass", symbol: "atom", tint: "sky",
    headerField: ["Valid", "2026"], fields: [["Holder", "Inês Moreira"]], code: "SM-2026-0071",
    qr: "1fd47f 105341 17515d 17455d 175b5d 104841 1fd57f 000000 13fe97 11a7c8 156fa9 199954 167ffb 0015c9 1fd6b0 105854 17507f 1751ec 1747af 104322 1fd5a6",
  },
];

/** Which sample passes a set shows, back to front. */
export const WALLET_SETS: Record<string, string[]> = {
  trip: ["gallery", "rail", "concert", "ferry"],
  memberships: ["gym", "library", "coffee", "museum"],
  everything: ["gallery", "rail", "concert", "ferry", "gym", "library", "coffee", "museum"],
};

/** The passes these props show, back to front. */
export function walletPasses(p: Props): WalletPass[] {
  const ids = WALLET_SETS[s(p, "set")] ?? WALLET_SETS.trip;
  const count = Math.min(Math.max(Math.round(n(p, "count") || 4), 1), ids.length);
  return ids.slice(0, count).map((id) => WALLET_PASSES.find((x) => x.id === id)!);
}

/** The pass the screen starts with open, if any: the second one (the first when there is only one). */
export function walletOpenPass(p: Props, passes: WalletPass[]): string | null {
  if (s(p, "open") !== "open" || !passes.length) return null;
  return passes[Math.min(1, passes.length - 1)].id;
}

function passSwift(pass: WalletPass, ctx: EmitContext): string[] {
  const i = INDENT;
  // A look's accent reaches the one red pass, with the ink that reads on it.
  const tint = pass.tint === "red" && ctx.theme ? ".init(Theme.accent, ink: Theme.accentInk)" : `.${pass.tint}`;
  const field = ([l, v]: [string, string]) => `.init(label: ${str(l)}, value: ${str(v)})`;
  return [
    ".init(",
    `${i}id: ${str(pass.id)}, title: ${str(pass.title)}, subtitle: ${str(pass.subtitle)}, symbol: ${str(pass.symbol)}, tint: ${tint},`,
    `${i}headerField: ${field(pass.headerField)},`,
    `${i}fields: [${pass.fields.map(field).join(", ")}],`,
    `${i}code: ${str(pass.code)}`,
    "),",
  ];
}

/** `SamplePasses`: the trip and the memberships, declared once however many wallets a screen has. */
function samplePassesSwift(ctx: EmitContext): string[] {
  const i = INDENT;
  const list = (ids: string[]) => ids.flatMap((id) => passSwift(WALLET_PASSES.find((x) => x.id === id)!, ctx).map((l) => `${i}${i}${l}`));
  return [
    "/// Sample passes, back to front, so the screen runs on its own. In your app they come from your tickets,",
    "/// boarding passes and memberships.",
    "enum SamplePasses {",
    `${i}/// A trip: a gallery day pass, a rail pass, tonight's concert and a river ferry.`,
    `${i}static let trip: [WalletStack.Pass] = [`,
    ...list(WALLET_SETS.trip),
    `${i}]`,
    "",
    `${i}/// Memberships and loyalty cards.`,
    `${i}static let memberships: [WalletStack.Pass] = [`,
    ...list(WALLET_SETS.memberships),
    `${i}]`,
    "",
    `${i}/// The same passes without their codes.`,
    `${i}static func withoutCodes(_ passes: [WalletStack.Pass]) -> [WalletStack.Pass] {`,
    `${i}${i}passes.map { pass in`,
    `${i}${i}${i}var pass = pass`,
    `${i}${i}${i}pass.code = nil`,
    `${i}${i}${i}return pass`,
    `${i}${i}}`,
    `${i}}`,
    "}",
  ];
}

/** The Swift expression for the passes these props show. */
function passesExpression(p: Props): string {
  const set = WALLET_SETS[s(p, "set")] ? s(p, "set") : "trip";
  let expr = set === "everything" ? "SamplePasses.trip + SamplePasses.memberships" : `SamplePasses.${set}`;
  const count = walletPasses(p).length;
  if (count < WALLET_SETS[set].length) expr = `Array((${expr}).prefix(${count}))`.replace(`(SamplePasses.${set})`, `SamplePasses.${set}`);
  if (p.codes === false) expr = `SamplePasses.withoutCodes(${expr})`;
  return expr;
}

export const definition: SwiftPieceDefinition = {
  id: "wallet-stack",
  name: "Wallet Stack",
  category: "pieces",
  description: "Tickets and passes stacked by their header strips. Tap one to bring it forward with its QR code while the rest tuck into a pile; drag it down to put it back.",
  availability: "free",
  preview: { component: "wallet-stack", chunk: "pieces-utility" },
  source: { registry: "free", name: "WalletStack" },
  docs: "/docs/components/cards/wallet-stack",
  icon: "qrcode",
  concepts: ["state", "binding", "array", "enum", "gesture", "scrollview"],
  interactions: ["tap", "drag", "expand", "scroll", "spring", "haptic", "transition"],
  properties: [
    select("set", "Passes", "trip", opts(["trip", "A trip"], ["memberships", "Memberships"], ["everything", "Trip and memberships"]), { hint: "Sample passes the screen declares. Your app passes its own." }),
    number("count", "How many", 4, 1, 8, 1, { group: "layout", hint: "More than fit draw closer, then the stack scrolls." }),
    bool("codes", "Codes", true, { hint: "Each pass opens to a QR code of its own text." }),
    select("open", "Preview as", "stack", opts(["stack", "The stack"], ["open", "A pass open"]), { group: "state", hint: "Opens the second pass, as a deep link would." }),
    number("pileDepth", "Passes in the pile", WALLET_DEFAULTS.pileDepth, 1, 6, 1, { level: "advanced", group: "layout" }),
    number("cornerRadius", "Pass corners", WALLET_DEFAULTS.cornerRadius, 12, 34, 1, { level: "advanced", group: "shape" }),
  ],
  variants: [
    { id: "trip", label: "A trip", props: { set: "trip", count: 4, codes: true } },
    { id: "memberships", label: "Memberships", props: { set: "memberships", count: 4, codes: true } },
    { id: "full", label: "Full wallet", props: { set: "everything", count: 8, codes: true } },
    { id: "ticket", label: "One ticket", props: { set: "trip", count: 1, codes: true } },
  ],
  states: [
    { id: "stack", label: "The stack", props: { open: "stack" } },
    { id: "open", label: "A pass open", props: { open: "open" } },
    { id: "many", label: "Many passes", props: { set: "everything", count: 8, open: "stack" } },
    { id: "plain", label: "No codes", props: { codes: false, open: "open" } },
  ],
  anatomy: [
    { part: "Passes", props: ["set", "count"] },
    { part: "Code", props: ["codes"] },
    { part: "Pile", props: ["pileDepth"] },
    { part: "Shape", props: ["cornerRadius"] },
    { part: "State", props: ["open"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("SamplePasses", samplePassesSwift(ctx));
      const passes = walletPasses(p);
      const open = walletOpenPass(p, passes);
      const selection = ctx.state("presented", "String?", open ? str(open) : "nil");
      const radius = Math.min(Math.max(Math.round(n(p, "cornerRadius") || WALLET_DEFAULTS.cornerRadius), 12), 34);
      const depth = Math.min(Math.max(Math.round(n(p, "pileDepth") || WALLET_DEFAULTS.pileDepth), 1), 6);
      const styleArgs = [radius !== WALLET_DEFAULTS.cornerRadius && `cornerRadius: ${num(radius)}`, depth !== WALLET_DEFAULTS.pileDepth && `pileDepth: ${num(depth)}`].filter(Boolean);
      const lines = call("WalletStack", [
        ["passes", passesExpression(p)],
        ["selection", `$${selection}`],
        styleArgs.length > 0 && ["style", `.init(${styleArgs.join(", ")})`],
      ]);
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;

/** Whether the passes carry codes. */
export const walletCodes = (p: Props) => p.codes !== false;
