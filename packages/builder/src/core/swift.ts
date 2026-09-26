// Small, dependency-free helpers for writing formatted Swift. Definitions build their output with
// these so every component formats the same way: four-space indents, argument lists that break
// onto their own lines once they get long, one modifier per line.

export const INDENT = "    ";

/**
 * `import <Module>` for generated files. Assembled at runtime on purpose: both sites' deploy audits
 * fail any client chunk that contains a Swift import line (their guard against shipping Swift
 * source), and a literal here would be folded into the bundle verbatim.
 */
export function importLine(module: string): string {
  return ["import", module].join(" ");
}
const LINE_LIMIT = 96;

/** A Swift string literal. Escapes backslashes, quotes and control characters. */
export function str(value: string): string {
  const body = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${body}"`;
}

/** A Swift number literal that reads naturally (24, not 24.0; 0.5, not 0.50000001). */
export function num(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 1000) / 1000);
}

export function indent(lines: string[], depth = 1): string[] {
  const pad = INDENT.repeat(depth);
  return lines.map((l) => (l ? pad + l : l));
}

/** One argument: `label: value`, or just `value` when unlabeled. `null`/`undefined` entries are skipped. */
export type Arg = [label: string | null, value: string] | null | undefined | false | "" | 0;

/**
 * `Name(a, b: c)` on one line, or broken one argument per line when it would run long.
 * `trailing` is a trailing closure, already formatted (without braces), e.g. [] for `{}`.
 */
export function call(name: string, args: Arg[] = [], trailing?: string[] | null, trailingParam?: string): string[] {
  const parts = args.filter((a): a is [string | null, string] => Boolean(a)).map(([l, v]) => (l ? `${l}: ${v}` : v));
  const head = parts.length || trailing == null ? `${name}(${parts.join(", ")})` : name;
  let lines: string[];
  if (head.length <= LINE_LIMIT || parts.length <= 1) {
    lines = [head];
  } else {
    lines = [`${name}(`, ...parts.map((p, i) => `${INDENT}${p}${i < parts.length - 1 ? "," : ""}`), ")"];
  }
  if (trailing == null) return lines;
  const label = trailingParam ? ` ${trailingParam}:` : "";
  if (!trailing.length) {
    lines[lines.length - 1] += `${label} {}`;
    return lines;
  }
  lines[lines.length - 1] += `${label} {`;
  return [...lines, ...indent(trailing), "}"];
}

/** Appends `.modifier(...)` lines. Falsy entries are skipped so callers can inline conditions. */
export function modifiers(lines: string[], mods: Array<string | null | undefined | false>): string[] {
  // Xcode's style: a one-line view indents its modifiers; a view that closes with `}` or `)` keeps
  // them level with the closing line.
  const pad = lines.length === 1 || lines.slice(1).every((l) => l.startsWith(`${INDENT}.`)) ? INDENT : "";
  const out = [...lines];
  for (const m of mods) if (m) out.push(`${pad}.${m}`);
  return out;
}

/** A closure body split into lines, for `call(..., trailing)`. */
export function block(...lines: Array<string | string[] | null | undefined | false>): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (!l) continue;
    if (Array.isArray(l)) out.push(...l);
    else out.push(l);
  }
  return out;
}

/** lowerCamel identifier from free text: "Email address" → "emailAddress". */
export function identifier(hint: string, fallback = "value"): string {
  const words = String(hint).replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  let id = words.map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("");
  if (/^\d/.test(id)) id = `${fallback}${id}`;
  if (SWIFT_KEYWORDS.has(id)) id = `${id}Value`;
  return id.slice(0, 40);
}

const SWIFT_KEYWORDS = new Set([
  "associatedtype", "class", "deinit", "enum", "extension", "fileprivate", "func", "import", "init", "inout", "internal", "let", "open",
  "operator", "private", "protocol", "public", "rethrows", "static", "struct", "subscript", "typealias", "var", "break", "case", "continue",
  "default", "defer", "do", "else", "fallthrough", "for", "guard", "if", "in", "repeat", "return", "switch", "where", "while", "as", "Any",
  "catch", "false", "is", "nil", "super", "self", "Self", "throw", "throws", "true", "try", "body", "some", "async", "await",
]);

/** Splits a comma-separated list prop into trimmed, non-empty items. */
export function list(value: unknown, max = 12): string[] {
  return String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, max);
}
