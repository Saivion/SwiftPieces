// Number Pad: an amount typed on a big on-screen keypad, the way a quick expense or transfer is
// entered. Digits push in from the right (cents first), delete steps back, and the done key
// confirms with a success tap and follows its link.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, str } from "../../core/swift.js";
import { link, number, opts, select, text } from "../shared.js";
import { construct, linkAction } from "./emit-link-action.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

export const PAD_CURRENCIES: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

const STRUCT = (): string[] => [
  "/// A keypad key: a soft highlight disc and a slight dip under the finger.",
  "private struct PadKeyStyle: ButtonStyle {",
  `${INDENT}func makeBody(configuration: Configuration) -> some View {`,
  `${INDENT}${INDENT}configuration.label`,
  `${INDENT}${INDENT}${INDENT}.contentShape(.rect)`,
  `${INDENT}${INDENT}${INDENT}.background(Circle().fill(.secondary.opacity(configuration.isPressed ? 0.18 : 0)).frame(width: 56, height: 56))`,
  `${INDENT}${INDENT}${INDENT}.scaleEffect(configuration.isPressed ? 0.97 : 1)`,
  `${INDENT}${INDENT}${INDENT}.animation(.easeOut(duration: 0.12), value: configuration.isPressed)`,
  `${INDENT}}`,
  "}",
  "",
  "/// An amount typed on a keypad: digits push in from the right, delete steps back, done confirms.",
  "private struct NumberPad: View {",
  `${INDENT}@State var cents: Int`,
  `${INDENT}var currency = "USD"`,
  `${INDENT}var note = ""`,
  `${INDENT}var keyHeight: CGFloat = 46`,
  `${INDENT}var onDone: () -> Void = {}`,
  `${INDENT}@State private var presses = 0`,
  `${INDENT}@State private var confirmed = 0`,
  `${INDENT}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  `${INDENT}private let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "delete", "0", "done"]`,
  "",
  `${INDENT}var body: some View {`,
  `${INDENT}${INDENT}VStack(spacing: 16) {`,
  `${INDENT}${INDENT}${INDENT}if !note.isEmpty {`,
  `${INDENT}${INDENT}${INDENT}${INDENT}Label(note, systemImage: "bookmark")`,
  `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}.font(.footnote.weight(.medium))`,
  `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}.foregroundStyle(.secondary)`,
  `${INDENT}${INDENT}${INDENT}}`,
  `${INDENT}${INDENT}${INDENT}Text(Double(cents) / 100, format: .currency(code: currency))`,
  `${INDENT}${INDENT}${INDENT}${INDENT}.font(.system(size: 44, weight: .medium))`,
  `${INDENT}${INDENT}${INDENT}${INDENT}.monospacedDigit()`,
  `${INDENT}${INDENT}${INDENT}${INDENT}.contentTransition(.numericText())`,
  `${INDENT}${INDENT}${INDENT}LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 6) {`,
  `${INDENT}${INDENT}${INDENT}${INDENT}ForEach(keys, id: \\.self) { key in`,
  `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}Button { press(key) } label: {`,
  `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}label(for: key).frame(maxWidth: .infinity, minHeight: keyHeight)`,
  `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}`,
  `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}.buttonStyle(PadKeyStyle())`,
  `${INDENT}${INDENT}${INDENT}${INDENT}}`,
  `${INDENT}${INDENT}${INDENT}}`,
  `${INDENT}${INDENT}}`,
  `${INDENT}${INDENT}.frame(maxWidth: .infinity)`,
  `${INDENT}${INDENT}.sensoryFeedback(.selection, trigger: presses)`,
  `${INDENT}${INDENT}.sensoryFeedback(.success, trigger: confirmed)`,
  `${INDENT}}`,
  "",
  `${INDENT}@ViewBuilder private func label(for key: String) -> some View {`,
  `${INDENT}${INDENT}switch key {`,
  `${INDENT}${INDENT}case "delete": Image(systemName: "delete.left.fill").font(.title3)`,
  `${INDENT}${INDENT}case "done": Image(systemName: "checkmark.circle.fill").font(.title).foregroundStyle(Color.accentColor)`,
  `${INDENT}${INDENT}default: Text(key).font(.title2)`,
  `${INDENT}${INDENT}}`,
  `${INDENT}}`,
  "",
  `${INDENT}private func press(_ key: String) {`,
  `${INDENT}${INDENT}switch key {`,
  `${INDENT}${INDENT}case "delete":`,
  `${INDENT}${INDENT}${INDENT}withAnimation(reduceMotion ? nil : .snappy(duration: 0.2)) { cents /= 10 }`,
  `${INDENT}${INDENT}${INDENT}presses += 1`,
  `${INDENT}${INDENT}case "done":`,
  `${INDENT}${INDENT}${INDENT}confirmed += 1`,
  `${INDENT}${INDENT}${INDENT}onDone()`,
  `${INDENT}${INDENT}default:`,
  `${INDENT}${INDENT}${INDENT}guard cents < 10_000_000, let digit = Int(key) else { return }`,
  `${INDENT}${INDENT}${INDENT}withAnimation(reduceMotion ? nil : .snappy(duration: 0.2)) { cents = cents * 10 + digit }`,
  `${INDENT}${INDENT}${INDENT}presses += 1`,
  `${INDENT}${INDENT}}`,
  `${INDENT}}`,
  "}",
];

export const numberPad: SwiftPieceDefinition = {
  id: "number-pad",
  name: "Number Pad",
  category: "pieces",
  description: "An amount typed on a big keypad. Digits push in from the right, delete steps back, and the done key confirms with a success tap.",
  availability: "free",
  preview: { component: "number-pad", chunk: "app-pieces" },
  icon: "square.grid.2x2",
  concepts: ["state", "animation"],
  interactions: ["tap", "haptic"],
  anatomy: [
    { part: "Amount", props: ["amount", "currency"] },
    { part: "Note", props: ["note"] },
    { part: "Done key", props: ["link"] },
  ],
  properties: [
    number("amount", "Amount", 18.4, 0, 99999.99, 0.01),
    select("currency", "Currency", "USD", opts(["USD", "US dollar"], ["EUR", "Euro"], ["GBP", "Pound"])),
    text("note", "Note button", "Add a note", { maxLength: 30, hint: "Leave empty for none." }),
    number("keyHeight", "Key height", 46, 40, 72, 1, { group: "layout", hint: "Taller keys let the pad fill a sheet." }),
    link("link", "Done key opens"),
  ],
  variants: [
    { id: "expense", label: "Expense", props: { amount: 18.4, note: "Add a note" } },
    { id: "empty", label: "Empty", props: { amount: 0, note: "" } },
    { id: "euro", label: "Euro", props: { amount: 9.6, currency: "EUR", note: "" } },
  ],
  states: [{ id: "zero", label: "Nothing typed", props: { amount: 0 } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("NumberPad", STRUCT());
      const action = linkAction(ctx, p.link);
      const note = s(p, "note").trim();
      return {
        lines: construct("NumberPad", [
          `cents: ${Math.round(n(p, "amount") * 100)}`,
          s(p, "currency") !== "USD" && `currency: ${str(s(p, "currency"))}`,
          note && `note: ${str(note)}`,
          n(p, "keyHeight") > 0 && n(p, "keyHeight") !== 46 && `keyHeight: ${Math.round(n(p, "keyHeight"))}`,
          action && `onDone: ${action}`,
        ]),
      };
    },
  },
};
