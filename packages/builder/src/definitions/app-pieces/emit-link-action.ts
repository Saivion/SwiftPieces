// Shared by app pieces whose own controls navigate (a keypad's done key, a panel's toolbar buttons):
// a `link` prop written as a Swift closure the piece calls. A push becomes a flag and a
// `.navigationDestination(isPresented:)`, a sheet a flag and a `.sheet`, a root switch sets the
// app's flag, and back calls dismiss. Empty links write nothing, so the piece keeps its default.
import type { EmitContext } from "../../core/schema.js";
import { INDENT } from "../../core/swift.js";
import { swiftSignal } from "../../core/palette.js";

const SHEET_DETENTS: Record<string, string | null> = { large: null, medium: "[.medium]", both: "[.medium, .large]" };

/** The closure body (`{ showHistory = true }`) that follows a link, or null when it leads nowhere. */
export function linkAction(ctx: EmitContext, value: unknown): string | null {
  const target = ctx.link(String(value ?? ""));
  if (!target) return null;
  if (target.kind === "back") return `{ ${ctx.dismiss()}() }`;
  if (target.kind === "root") return `{ ${target.flag} = true }`;
  if (target.kind === "tab") return `{ ${target.set} }`;
  const name = target.view.replace(/View$/, "");
  if (target.kind === "sheet") {
    const flag = ctx.state(`show${name}`, "", "false");
    const detents = SHEET_DETENTS[target.detent] ?? null;
    ctx.attach([
      `.sheet(isPresented: $${flag}) {`,
      `${INDENT}NavigationStack { ${target.view}() }`,
      ...(detents ? [`${INDENT}${INDENT}.presentationDetents(${detents})`] : []),
      "}",
    ]);
    return `{ ${flag} = true }`;
  }
  const flag = ctx.state(`open${name}`, "", "false");
  ctx.attach([`.navigationDestination(isPresented: $${flag}) {`, `${INDENT}${target.view}()`, "}"]);
  return `{ ${flag} = true }`;
}

/** A Swift `Color(red:green:blue:)` for a hex string. */
export function rgb(hex: string): string {
  const v = hex.replace("#", "");
  const sig = swiftSignal(v);
  if (sig) return sig;
  const c = (i: number) => Math.round((parseInt(v.slice(i, i + 2), 16) / 255) * 1000) / 1000;
  return `Color(red: ${c(0)}, green: ${c(2)}, blue: ${c(4)})`;
}

/**
 * `Name(a, b: c)`: on one line when short, else one argument per line. An argument given as several
 * lines (an array literal) is indented as a block. Falsy arguments are skipped.
 */
export function construct(name: string, args: Array<string | string[] | null | undefined | false | "">): string[] {
  const parts = args.filter((a): a is string | string[] => Boolean(a)).map((a) => (Array.isArray(a) ? a : [a]));
  if (!parts.length) return [`${name}()`];
  const one = `${name}(${parts.map((a) => a[0]).join(", ")})`;
  if (parts.every((a) => a.length === 1) && one.length <= 96) return [one];
  const lines = [`${name}(`];
  parts.forEach((a, i) => a.forEach((l, j) => lines.push(`${INDENT}${l}${j === a.length - 1 && i < parts.length - 1 ? "," : ""}`)));
  lines.push(")");
  return lines;
}

/** `label: [` … `]`, one element per line. */
export function arrayArg(label: string, items: string[]): string[] {
  return [`${label}: [`, ...items.map((i) => `${INDENT}${i},`), "]"];
}
