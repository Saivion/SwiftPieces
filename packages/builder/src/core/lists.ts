// Style → Lists: how runs of rows are drawn, the same way in the preview and the Swift.
//
// Rows are separate components (a List Row, a Task Row, a Media Row…) stacked in a Group, a
// panel or on the screen, so a "list" is found, not declared: rows side by side in one column,
// with only dividers between them. A Group holding a single row (a book on its own card) counts
// as that row, so a column of carded rows becomes one list. A Group holding nothing but rows is
// itself the list, and its own card and spacing give way to the list's. Rows inside a card that
// also holds other things keep the layout they were built with, so a list never nests a card in
// a card. Every run is drawn, a lone row too, so each row on a screen follows the same style.
import type { Props, ScreenNode, SwiftPieceDefinition, ThemeLists } from "./schema.js";

export type ListMode = ThemeLists;

/** The vertical padding a list gives a row that doesn't name its own. */
export const LIST_ROW_PAD = 12;
/** Each row's inset from the card's edges (grouped and cards), unless the row names its own. */
export const LIST_INSET = 16;
/** The corner radius of the list's cards, before the theme's corner scale. */
export const LIST_RADIUS = 16;
/** The gap between separate row cards, before the theme's density. */
export const LIST_GAP = 8;

/** One piece of a column: a node drawn as built, or a run of rows drawn as a list. */
export type ListPart = { node: ScreenNode } | { rows: ScreenNode[] };

export type ListPlan = {
  /** The column is itself the list: its own card, padding and spacing give way. */
  whole: boolean;
  parts: ListPart[];
};

type Lookup = { get(id: string): Pick<SwiftPieceDefinition, "list"> | undefined };

const isDivider = (n: ScreenNode) => n.component === "divider";

/** The row a node is: a row itself, or a Group holding just one row (its card gives way). */
function rowOf(n: ScreenNode, registry: Lookup): ScreenNode | null {
  if (registry.get(n.component)?.list) return n;
  if (n.component !== "vstack") return null;
  const inner = (n.children ?? []).filter((c) => !isDivider(c));
  return inner.length === 1 && registry.get(inner[0].component)?.list ? inner[0] : null;
}

/** Columns a list can sit in. A panel with rounded corners is a card; one without is a ground. */
function column(n: ScreenNode): { surfaced: boolean } | null {
  if (n.component === "screen") return { surfaced: false };
  if (n.component === "vstack") return { surfaced: n.props.style === "card" || n.props.style === "outlined" };
  if (n.component === "tint-panel") return { surfaced: Number(n.props.radius ?? 0) > 0 };
  return null;
}

/**
 * How a column's children are drawn under a Lists style, or null when nothing changes (no
 * style, not a column, or no rows in it).
 */
export function planList(container: ScreenNode, registry: Lookup, mode: ListMode | null | undefined): ListPlan | null {
  const col = mode ? column(container) : null;
  if (!col) return null;
  const children = container.children ?? [];
  const rows = children.map((c) => rowOf(c, registry));
  if (!rows.some(Boolean)) return null;
  // A Group of nothing but rows (and dividers) is the list, one row or several.
  if (container.component === "vstack" && children.every((c, i) => rows[i] || isDivider(c))) {
    return { whole: true, parts: [{ rows: rows.filter((r): r is ScreenNode => Boolean(r)) }] };
  }
  // Inside a card with other things in it, rows stay as built.
  if (col.surfaced) return null;
  const parts: ListPart[] = [];
  let run: ScreenNode[] = [];
  let held: ScreenNode[] = [];
  const flush = () => {
    if (run.length) parts.push({ rows: run });
    parts.push(...held.map((n) => ({ node: n })));
    run = [];
    held = [];
  };
  children.forEach((c, i) => {
    const row = rows[i];
    if (row) {
      // Dividers between two rows belong to the list; they're redrawn as its hairlines.
      held = [];
      run.push(row);
    } else if (isDivider(c) && run.length) {
      held.push(c);
    } else {
      flush();
      parts.push({ node: c });
    }
  });
  flush();
  return { whole: false, parts };
}

/** A row's props inside a styled list: its own, with its card or fill taken away. */
export function bareProps(def: Pick<SwiftPieceDefinition, "list"> | undefined, props: Props): Props {
  return def?.list?.bare ? { ...props, ...def.list.bare } : props;
}

/** The vertical padding a list gives a row. */
export const rowPad = (def: Pick<SwiftPieceDefinition, "list"> | undefined) => def?.list?.pad ?? LIST_ROW_PAD;

/** The horizontal inset a card list gives a row (less for rows with their own side padding). */
export const rowInset = (def: Pick<SwiftPieceDefinition, "list"> | undefined) => def?.list?.inset ?? LIST_INSET;
