// Set Table: one exercise in a workout log. The exercise name over a table of sets (set, last
// time, weight, reps and a check), the way a gym log keeps them. Tapping a set's check fills it
// and tints the row with a success tap, and starts the rest timer: a chip beside the name that
// counts down to zero. Tapping the check again takes the set back. Add Set copies the last set
// into a new row. A warm-up set is labelled W. Under reduced motion the rows change without the
// spring.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, num, str } from "../../core/swift.js";
import { bool, number, select, text, opts } from "../shared.js";
import { data, records, swiftHex, tint, tintHex } from "./data-kit.js";
import { construct } from "./emit-link-action.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const I = (d: number) => INDENT.repeat(d);

export type WorkSet = { label: string; previous: string; weight: number; reps: number; done: boolean };

/** "W | 40 × 10 | 40 | 10 | done; 1 | 60 × 8 | 62.5 | 8 |" → sets. Anything unparsable reads 0. */
export function parseSets(value: unknown): WorkSet[] {
  return records(value, 12).map((f) => ({
    label: f[0] || "1",
    previous: f[1] || "–",
    weight: Number.isFinite(Number(f[2])) ? Number(f[2]) : 0,
    reps: Number.isFinite(Number(f[3])) ? Math.round(Number(f[3])) : 0,
    done: /^(done|yes|x|✓)$/i.test(f[4] ?? ""),
  }));
}

/** A rest time as m:ss. */
export const restClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;

/** The weight as it reads in a cell: 62.5, 60. */
export const weightText = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

const STRUCT = (): string[] => [
  "/// One exercise in a workout log: a table of sets you check off, with a rest timer that starts on each check.",
  "private struct SetTable: View {",
  `${I(1)}struct WorkSet: Identifiable {`,
  `${I(2)}let id = UUID()`,
  `${I(2)}var label: String`,
  `${I(2)}var previous: String`,
  `${I(2)}var weight: Double`,
  `${I(2)}var reps: Int`,
  `${I(2)}var done = false`,
  `${I(1)}}`,
  "",
  `${I(1)}var title = ""`,
  `${I(1)}var note = ""`,
  `${I(1)}var unit = "kg"`,
  `${I(1)}var rest = 120`,
  `${I(1)}var tint: Color = .green`,
  `${I(1)}var titleInk: Color = .blue`,
  `${I(1)}var addsSets = true`,
  `${I(1)}@State var sets: [WorkSet]`,
  `${I(1)}@State private var restLeft = 0`,
  `${I(1)}@State private var checks = 0`,
  `${I(1)}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  "",
  `${I(1)}var body: some View {`,
  `${I(2)}VStack(alignment: .leading, spacing: 8) {`,
  `${I(3)}if !title.isEmpty {`,
  `${I(4)}HStack(spacing: 8) {`,
  `${I(5)}Text(title).font(.headline).foregroundStyle(titleInk).lineLimit(1)`,
  `${I(5)}Spacer(minLength: 8)`,
  `${I(5)}if restLeft > 0 {`,
  `${I(6)}Label(clock(restLeft), systemImage: "timer")`,
  `${I(7)}.font(.subheadline.weight(.semibold))`,
  `${I(7)}.monospacedDigit()`,
  `${I(7)}.contentTransition(.numericText(countsDown: true))`,
  `${I(7)}.padding(.horizontal, 10)`,
  `${I(7)}.padding(.vertical, 5)`,
  `${I(7)}.background(titleInk.opacity(0.14), in: .capsule)`,
  `${I(7)}.foregroundStyle(titleInk)`,
  `${I(7)}.transition(.scale.combined(with: .opacity))`,
  `${I(5)}}`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(3)}if !note.isEmpty {`,
  `${I(4)}Text(note).font(.subheadline).foregroundStyle(.secondary)`,
  `${I(3)}}`,
  `${I(3)}HStack(spacing: 8) {`,
  `${I(4)}Text("SET").frame(width: 30, alignment: .leading)`,
  `${I(4)}Text("PREVIOUS").frame(maxWidth: .infinity, alignment: .leading)`,
  `${I(4)}Text(unit.uppercased()).frame(width: 56)`,
  `${I(4)}Text("REPS").frame(width: 44)`,
  `${I(4)}Image(systemName: "checkmark").frame(width: 32)`,
  `${I(3)}}`,
  `${I(3)}.font(.caption.weight(.semibold))`,
  `${I(3)}.foregroundStyle(.secondary)`,
  `${I(3)}.padding(.horizontal, 6)`,
  `${I(3)}ForEach($sets) { $set in`,
  `${I(4)}HStack(spacing: 8) {`,
  `${I(5)}Text(set.label)`,
  `${I(6)}.font(.subheadline.weight(.bold))`,
  `${I(6)}.foregroundStyle(set.label == "W" ? Color.orange : Color.primary)`,
  `${I(6)}.frame(width: 30, alignment: .leading)`,
  `${I(5)}Text(set.previous)`,
  `${I(6)}.font(.subheadline)`,
  `${I(6)}.foregroundStyle(.secondary)`,
  `${I(6)}.lineLimit(1)`,
  `${I(6)}.frame(maxWidth: .infinity, alignment: .leading)`,
  `${I(5)}Text(set.weight.formatted())`,
  `${I(6)}.font(.subheadline.weight(.semibold))`,
  `${I(6)}.monospacedDigit()`,
  `${I(6)}.frame(width: 56, height: 32)`,
  `${I(6)}.background(.fill.tertiary, in: .rect(cornerRadius: 8))`,
  `${I(5)}Text("\\(set.reps)")`,
  `${I(6)}.font(.subheadline.weight(.semibold))`,
  `${I(6)}.monospacedDigit()`,
  `${I(6)}.frame(width: 44, height: 32)`,
  `${I(6)}.background(.fill.tertiary, in: .rect(cornerRadius: 8))`,
  `${I(5)}Button {`,
  `${I(6)}withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) {`,
  `${I(7)}set.done.toggle()`,
  `${I(7)}restLeft = set.done ? rest : restLeft`,
  `${I(6)}}`,
  `${I(6)}if set.done { checks += 1 }`,
  `${I(5)}} label: {`,
  `${I(6)}Image(systemName: "checkmark")`,
  `${I(7)}.font(.subheadline.weight(.bold))`,
  `${I(7)}.frame(width: 32, height: 32)`,
  `${I(7)}.background(set.done ? tint : Color.secondary.opacity(0.18), in: .rect(cornerRadius: 8))`,
  `${I(7)}.foregroundStyle(set.done ? Color.white : Color.secondary)`,
  `${I(5)}}`,
  `${I(5)}.buttonStyle(.plain)`,
  `${I(5)}.accessibilityLabel(set.done ? "Completed" : "Complete set")`,
  `${I(4)}}`,
  `${I(4)}.padding(.vertical, 4)`,
  `${I(4)}.padding(.horizontal, 6)`,
  `${I(4)}.background(set.done ? tint.opacity(0.16) : Color.clear, in: .rect(cornerRadius: 10))`,
  `${I(3)}}`,
  `${I(3)}if addsSets {`,
  `${I(4)}Button(action: add) {`,
  `${I(5)}Label("Add Set", systemImage: "plus")`,
  `${I(6)}.font(.subheadline.weight(.semibold))`,
  `${I(6)}.frame(maxWidth: .infinity)`,
  `${I(6)}.padding(.vertical, 10)`,
  `${I(6)}.background(.fill.tertiary, in: .capsule)`,
  `${I(4)}}`,
  `${I(4)}.buttonStyle(.plain)`,
  `${I(4)}.padding(.top, 4)`,
  `${I(3)}}`,
  `${I(2)}}`,
  `${I(2)}.frame(maxWidth: .infinity, alignment: .leading)`,
  `${I(2)}.task(id: restLeft > 0) {`,
  `${I(3)}while restLeft > 0 && !Task.isCancelled {`,
  `${I(4)}try? await Task.sleep(for: .seconds(1))`,
  `${I(4)}withAnimation(reduceMotion ? nil : .snappy) { restLeft = max(0, restLeft - 1) }`,
  `${I(3)}}`,
  `${I(2)}}`,
  `${I(2)}.sensoryFeedback(.success, trigger: checks)`,
  `${I(1)}}`,
  "",
  `${I(1)}private func clock(_ seconds: Int) -> String {`,
  `${I(2)}"\\(seconds / 60):" + (seconds % 60 < 10 ? "0" : "") + "\\(seconds % 60)"`,
  `${I(1)}}`,
  "",
  `${I(1)}private func add() {`,
  `${I(2)}let last = sets.last`,
  `${I(2)}let number = sets.filter { $0.label != "W" }.count + 1`,
  `${I(2)}withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) {`,
  `${I(3)}sets.append(WorkSet(label: "\\(number)", previous: "–", weight: last?.weight ?? 0, reps: last?.reps ?? 0))`,
  `${I(2)}}`,
  `${I(1)}}`,
  "}",
];

export const setTable: SwiftPieceDefinition = {
  id: "set-table",
  name: "Set Table",
  category: "pieces",
  description: "One exercise in a workout log: its sets as rows of last time, weight and reps with a check. Checking a set tints the row and starts a rest timer; Add Set copies the last row.",
  availability: "free",
  preview: { component: "set-table", chunk: "app-pieces" },
  icon: "dumbbell",
  concepts: ["state", "animation"],
  interactions: ["tap", "haptic"],
  anatomy: [
    { part: "Exercise", props: ["title", "note", "titleTint"] },
    { part: "Sets", props: ["sets", "unit", "tint"] },
    { part: "Rest timer", props: ["rest"] },
    { part: "Add Set", props: ["addsSets"] },
  ],
  properties: [
    text("title", "Exercise", "Bench Press (Barbell)", { maxLength: 48 }),
    text("note", "Note", "", { maxLength: 80 }),
    data("sets", "Sets", "W | 40 kg × 10 | 40 | 10 | done; 1 | 60 kg × 8 | 60 | 8 | done; 2 | 60 kg × 8 | 62.5 | 8 | ; 3 | 60 kg × 7 | 62.5 | 7 |", { hint: "Set | last time | weight | reps | done, separated by semicolons. W marks a warm-up." }),
    select("unit", "Unit", "kg", opts(["kg", "kg"], ["lbs", "lbs"], ["km", "km"], ["min", "min"])),
    number("rest", "Rest (seconds)", 120, 0, 600, 15),
    tint("tint", "Done colour", "green"),
    tint("titleTint", "Exercise colour", "azure"),
    bool("addsSets", "Add Set button", true),
  ],
  variants: [
    { id: "squat", label: "Squat", props: { title: "Squat (Barbell)", sets: "W | 60 kg × 8 | 60 | 8 | done; 1 | 100 kg × 5 | 102.5 | 5 | ; 2 | 100 kg × 5 | 102.5 | 5 |", rest: 180 } },
    { id: "pounds", label: "Pounds", props: { title: "Lat Pulldown (Cable)", unit: "lbs", sets: "1 | 110 lbs × 12 | 120 | 10 | ; 2 | 110 lbs × 12 | 120 | 10 |", titleTint: "violet" } },
  ],
  states: [{ id: "all-done", label: "All sets done", props: { sets: "1 | 60 kg × 8 | 60 | 8 | done; 2 | 60 kg × 8 | 62.5 | 8 | done; 3 | 60 kg × 7 | 62.5 | 7 | done" } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("SetTable", STRUCT());
      const sets = parseSets(p.sets);
      const rows = sets.map((x) => `.init(label: ${str(x.label)}, previous: ${str(x.previous)}, weight: ${num(x.weight)}, reps: ${x.reps}${x.done ? ", done: true" : ""})`);
      return {
        lines: construct("SetTable", [
          s(p, "title").trim() && `title: ${ctx.str(s(p, "title").trim())}`,
          s(p, "note").trim() && `note: ${ctx.str(s(p, "note").trim())}`,
          s(p, "unit") !== "kg" && `unit: ${str(s(p, "unit"))}`,
          n(p, "rest") !== 120 && `rest: ${Math.round(n(p, "rest"))}`,
          `tint: ${swiftHex(tintHex(s(p, "tint"), "green"))}`,
          `titleInk: ${swiftHex(tintHex(s(p, "titleTint"), "azure"))}`,
          p.addsSets === false && "addsSets: false",
          rows.length ? ["sets: [", ...rows.map((r) => `${INDENT}${r},`), "]"] : "sets: []",
        ]),
      };
    },
  },
};
