// Builder analytics, shared by the Free and Pro event endpoints. The contract is deliberately small:
// an allow-listed event name and a handful of short enum-like values. No project content, no text
// people typed, no identifiers. Anything else is dropped here, on the server, before it is stored.

export const BUILDER_EVENTS = [
  "builder_opened", "component_selected", "component_customized", "screen_created", "template_selected",
  "export_clicked", "code_copied", "project_downloaded", "signup_started", "signup_completed", "pro_cta_clicked",
  "onboarding_answered", "explain_opened", "describe_used", "builder_error", "builder_perf",
] as const;
export type BuilderEventName = (typeof BUILDER_EVENTS)[number];

const NAMES = new Set<string>(BUILDER_EVENTS);
const KEYS = new Set(["tier", "persona", "entry", "component", "property", "template", "via", "from", "kind", "screens", "pieces", "concept", "matched", "where", "init", "update", "codegen", "over"]);

export type CleanEvent = { name: BuilderEventName; props: Record<string, string | number> };

/** Keeps allow-listed names and keys; values are short tokens or finite numbers. At most 20 per batch. */
export function sanitizeEvents(raw: unknown): CleanEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: CleanEvent[] = [];
  for (const e of raw.slice(0, 20)) {
    if (!e || typeof e !== "object") continue;
    const { name, props } = e as { name?: unknown; props?: unknown };
    if (typeof name !== "string" || !NAMES.has(name)) continue;
    const clean: Record<string, string | number> = {};
    if (props && typeof props === "object") {
      for (const [k, v] of Object.entries(props as Record<string, unknown>).slice(0, 8)) {
        if (!KEYS.has(k)) continue;
        if (typeof v === "number" && Number.isFinite(v)) clean[k] = Math.round(v * 10) / 10;
        else if (typeof v === "string" && /^[a-z0-9_.,:-]{1,48}$/i.test(v)) clean[k] = v;
      }
    }
    out.push({ name: name as BuilderEventName, props: clean });
  }
  return out;
}
