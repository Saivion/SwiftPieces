// Local persistence. Every edit stays in the browser: the draft autosaves to localStorage a moment
// after the last change, never to a server. Storage can be missing or full (private windows, quota)
// and nothing here is allowed to throw into the editor.
import type { Project } from "../core/schema.js";
import type { Persona } from "./store.js";

const safe = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};

export function loadDraft(ns: string): unknown | null {
  const raw = safe.get(`${ns}:draft`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Debounced writer. `flush` runs pending work immediately (page hide, export). */
export function createAutosave(ns: string, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Project | null = null;
  let lastOk = true;
  const write = () => {
    timer = null;
    if (!pending) return;
    lastOk = safe.set(`${ns}:draft`, JSON.stringify(pending));
    pending = null;
  };
  return {
    schedule(project: Project) {
      pending = project;
      if (timer) clearTimeout(timer);
      timer = setTimeout(write, delay);
    },
    flush() {
      if (timer) clearTimeout(timer);
      write();
    },
    /** False when the last write failed (storage full or blocked). */
    ok: () => lastOk,
  };
}

export const prefs = {
  persona(ns: string): Persona | null {
    const v = safe.get(`${ns}:persona`);
    return v === "first-app" || v === "web" || v === "swiftui" || v === "explore" ? v : null;
  },
  setPersona(ns: string, p: Persona) {
    safe.set(`${ns}:persona`, p);
  },
  dismissed(ns: string, id: string): boolean {
    return safe.get(`${ns}:dismissed:${id}`) === "1";
  },
  dismiss(ns: string, id: string) {
    safe.set(`${ns}:dismissed:${id}`, "1");
  },
  clearDraft(ns: string) {
    safe.remove(`${ns}:draft`);
  },
};
