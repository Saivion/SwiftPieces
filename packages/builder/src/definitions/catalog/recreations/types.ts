import type { CatalogEntry } from "../../../core/catalog.js";

/** One app's recreation: its catalog entry (free) and, per step, what makes the screen work. */
export type Recreation = { entry: Omit<CatalogEntry, "availability" | "moves">; moves: string[][] };
