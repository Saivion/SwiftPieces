// Builder analytics, shared by the Free and Pro event endpoints. The contract is deliberately small:
// an allow-listed event name and a handful of short enum-like values. No project content, no text
// people typed, no identifiers. Anything else is dropped here, on the server, before it is stored.

export const BUILDER_EVENTS = [
  // The Playground funnel: Explore → Interact → Inspect → Remix → Build.
  "playground_opened", "screen_viewed", "flow_started", "flow_completed", "component_inspected", "component_remixed",
  "remix_saved", "remix_shared", "code_viewed", "code_copied", "component_opened", "project_downloaded", "xcode_opened",
  "pro_gate_viewed", "pro_upgrade_clicked", "search_used",
  // Composing: screens added, replaced, moved or removed across apps, and the look changed.
  "screen_composed",
  // Health.
  "builder_error", "builder_perf",
] as const;
export type BuilderEventName = (typeof BUILDER_EVENTS)[number];

const NAMES = new Set<string>(BUILDER_EVENTS);
const KEYS = new Set(["tier", "entry", "kind", "slug", "component", "property", "group", "via", "from", "scope", "screens", "step", "where", "init", "update", "codegen", "over", "target", "results"]);

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
