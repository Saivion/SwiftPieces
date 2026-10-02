// Local persistence. Everything a visitor makes stays in this browser: the remix of each entry
// autosaves a moment after the last change, saved remixes and favorites are small lists, and
// nothing ever reaches a server. Storage can be missing or full (private windows, quota), so no
// function here throws; a failed write is reported, never raised.
import type { Project } from "../../core/schema.js";

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}
function json<T>(key: string, fallback: T): T {
  const raw = get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type SavedRemix = { id: string; entry: string; title: string; savedAt: number };

/**
 * A short fingerprint of the project an entry builds, so an autosaved remix is only restored over
 * the same build it started from. When a catalog entry is rebuilt, older remixes of it are stale.
 */
export function buildFingerprint(project: Pick<Project, "screens" | "shell" | "theme"> & { tabBar?: unknown }): string {
  const text = JSON.stringify([project.screens, project.shell, project.theme ?? null, project.tabBar ?? null]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const MAX_RECENT = 12;
const MAX_SAVED = 40;

export function createPersistence(ns: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { key: string; project: Project; base: string } | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) set(`${ns}:remix:${pending.key}`, JSON.stringify({ v: 2, base: pending.base, project: pending.project }));
    pending = null;
  };
  return {
    /**
     * The autosaved remix of an entry, unvalidated (the caller validates), or null. Only a remix of
     * the same build (`base`, a buildFingerprint) comes back; one of an older build, or saved before
     * builds were fingerprinted, is stale and is cleared so the current build shows.
     */
    remix(entryKey: string, base: string): unknown | null {
      const saved = json<{ v?: number; base?: string; project?: unknown } | null>(`${ns}:remix:${entryKey}`, null);
      if (!saved) return null;
      if (saved.v === 2 && saved.base === base && saved.project) return saved.project;
      remove(`${ns}:remix:${entryKey}`);
      return null;
    },
    /** Debounced: typing and sliders become one write. `base` fingerprints the build it started from. */
    saveRemix(entryKey: string, project: Project, base: string) {
      if (pending && pending.key !== entryKey) flush();
      pending = { key: entryKey, project, base };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 400);
    },
    clearRemix(entryKey: string) {
      if (pending?.key === entryKey) pending = null;
      remove(`${ns}:remix:${entryKey}`);
    },
    flush,

    recent: (): string[] => json<string[]>(`${ns}:recent`, []).filter((k) => typeof k === "string"),
    pushRecent(entryKey: string) {
      const next = [entryKey, ...json<string[]>(`${ns}:recent`, []).filter((k) => k !== entryKey)].slice(0, MAX_RECENT);
      set(`${ns}:recent`, JSON.stringify(next));
      return next;
    },

    favorites: (): string[] => json<string[]>(`${ns}:favs`, []).filter((k) => typeof k === "string"),
    toggleFavorite(entryKey: string) {
      const favs = json<string[]>(`${ns}:favs`, []);
      const next = favs.includes(entryKey) ? favs.filter((k) => k !== entryKey) : [entryKey, ...favs];
      set(`${ns}:favs`, JSON.stringify(next));
      return next;
    },

    saved: (): SavedRemix[] => json<SavedRemix[]>(`${ns}:saved`, []).filter((s) => s && typeof s.id === "string"),
    /** Keeps a copy of a remix under its own name. Returns the list, or null when storage refused. */
    save(entryKey: string, title: string, project: Project): SavedRemix[] | null {
      const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      if (!set(`${ns}:saved:${id}`, JSON.stringify(project))) return null;
      const next = [{ id, entry: entryKey, title: title.slice(0, 60), savedAt: Date.now() }, ...json<SavedRemix[]>(`${ns}:saved`, [])].slice(0, MAX_SAVED);
      set(`${ns}:saved`, JSON.stringify(next));
      return next;
    },
    loadSaved: (id: string): unknown | null => json<unknown>(`${ns}:saved:${id}`, null),
    removeSaved(id: string) {
      remove(`${ns}:saved:${id}`);
      const next = json<SavedRemix[]>(`${ns}:saved`, []).filter((s) => s.id !== id);
      set(`${ns}:saved`, JSON.stringify(next));
      return next;
    },

    pref: (key: string): string | null => get(`${ns}:pref:${key}`),
    setPref: (key: string, value: string) => void set(`${ns}:pref:${key}`, value),
  };
}

export type Persistence = ReturnType<typeof createPersistence>;
