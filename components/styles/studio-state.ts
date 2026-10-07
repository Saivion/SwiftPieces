"use client";
// The Styles studio's state: the style being made, the way back through what was made before it
// (the Playground's Style tab keeps the same history), shuffle with locks and moods, and the style
// kept in the page's address and in this browser, so a link or a return visit opens it again.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decodeStyle, editTheme, encodeStyle, newSeed, shuffleTheme, themeFromLook, type Mood, type StyleSection, type Theme } from "@swiftpieces/builder";

/** Dispatched on window with the style code whenever the studio's style changes. */
export const STYLE_EVENT = "sp:style";

/** This browser's last style, as its code. */
const LAST_KEY = "sp:styles:last";

type History = { list: Theme[]; at: number };

export type Studio = {
  theme: Theme;
  code: string;
  /** The mood the last shuffle drew from, while the style is still that shuffle's. */
  mood: Mood | null;
  locks: ReadonlySet<StyleSection>;
  /** The mood Shuffle draws from: "any", or a mood's id. */
  pick: string;
  setPick(pick: string): void;
  canBack: boolean;
  canForward: boolean;
  /** A hand edit: merged in, defaults left out, the shuffled name dropped. */
  edit(patch: Partial<Theme>): void;
  /** A whole style (a preset, a pasted code): remembered, so Back returns from it. */
  apply(next: Theme): void;
  /** A new style, in the picked mood (or `moodId`), keeping what's locked. */
  shuffle(moodId?: string): void;
  toggleLock(section: StyleSection): void;
  back(): void;
  forward(): void;
  /** Reads a pasted code; false when it isn't one. */
  paste(code: string): boolean;
};

function readLast(): Theme | null {
  try {
    const code = window.localStorage.getItem(LAST_KEY);
    return code ? decodeStyle(code) : null;
  } catch {
    return null;
  }
}

function writeLast(code: string) {
  try {
    window.localStorage.setItem(LAST_KEY, code);
  } catch {
    // Storage blocked (a private window): the link still carries the style.
  }
}

/**
 * The first style: the one in the address (`?style=`), else this browser's last, else the
 * SwiftPieces look. `refused` is set when the address held a code that doesn't decode.
 */
export function initialStyle(): { theme: Theme; fromLink: boolean; refused: boolean } {
  const asked = new URLSearchParams(window.location.search).get("style");
  const linked = asked ? decodeStyle(asked) : null;
  if (linked) return { theme: linked, fromLink: true, refused: false };
  return { theme: readLast() ?? themeFromLook("pieces"), fromLink: false, refused: Boolean(asked) };
}

export function useStudio(first: Theme): Studio {
  const [history, setHistory] = useState<History>({ list: [first], at: 0 });
  const [locks, setLocks] = useState<Set<StyleSection>>(() => new Set());
  const [mood, setMood] = useState<Mood | null>(null);
  const [pick, setPick] = useState("any");
  const theme = history.list[history.at] ?? first;
  const code = useMemo(() => encodeStyle(theme), [theme]);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const listRef = useRef(history.list);
  listRef.current = history.list;

  // Every new style goes on the history after the one showing (dropping any forward ones), up to 50.
  const push = useCallback((next: Theme) => {
    setHistory((h) => {
      const list = [...h.list.slice(0, h.at + 1), next].slice(-50);
      return { list, at: list.length - 1 };
    });
  }, []);

  // A run of hand edits replaces one history entry instead of filling it: the entry the edits
  // started from stays, so Back undoes the whole run of tweaks, as in the Playground.
  const editing = useRef(false);
  const edit = useCallback((patch: Partial<Theme>) => {
    const next = editTheme(themeRef.current, patch);
    setMood(null);
    setHistory((h) => {
      if (editing.current && h.at === h.list.length - 1 && h.at > 0) {
        const list = [...h.list.slice(0, h.at), next];
        return { list, at: list.length - 1 };
      }
      editing.current = true;
      const list = [...h.list.slice(0, h.at + 1), next].slice(-50);
      return { list, at: list.length - 1 };
    });
  }, []);

  const apply = useCallback((next: Theme) => {
    editing.current = false;
    setMood(null);
    push(next);
  }, [push]);

  const shuffle = useCallback((moodId?: string) => {
    editing.current = false;
    const asked = moodId ?? (pick === "any" ? undefined : pick);
    const out = shuffleTheme(newSeed(), themeRef.current, locks, listRef.current.slice(-8), asked);
    setMood(out.mood);
    push(out.theme);
  }, [locks, pick, push]);

  const toggleLock = useCallback((section: StyleSection) => {
    setLocks((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const back = useCallback(() => {
    editing.current = false;
    setMood(null);
    setHistory((h) => (h.at > 0 ? { ...h, at: h.at - 1 } : h));
  }, []);
  const forward = useCallback(() => {
    editing.current = false;
    setMood(null);
    setHistory((h) => (h.at < h.list.length - 1 ? { ...h, at: h.at + 1 } : h));
  }, []);

  const paste = useCallback((text: string) => {
    const decoded = decodeStyle(text);
    if (!decoded) return false;
    apply(decoded);
    return true;
  }, [apply]);

  // The address and this browser follow the style once it's been changed here, or when it came by
  // link: a plain visit to /styles keeps its plain address. replaceState, so tweaking a colour
  // doesn't fill the browser's Back.
  const firstCode = useRef(code);
  const touched = useRef(false);
  // Tell the rest of the page (the "everywhere" section) which style is showing, at once and on
  // every change; the last one is kept on window for a listener that mounts later.
  useEffect(() => {
    (window as Window & { __spStyle?: string }).__spStyle = code;
    window.dispatchEvent(new CustomEvent(STYLE_EVENT, { detail: code }));
  }, [code]);

  useEffect(() => {
    if (code !== firstCode.current) touched.current = true;
    if (!touched.current && !new URLSearchParams(window.location.search).has("style")) return;
    const t = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("style", code);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      writeLast(code);
    }, 250);
    return () => window.clearTimeout(t);
  }, [code]);

  return {
    theme,
    code,
    mood,
    locks,
    pick,
    setPick,
    canBack: history.at > 0,
    canForward: history.at < history.list.length - 1,
    edit,
    apply,
    shuffle,
    toggleLock,
    back,
    forward,
    paste,
  };
}
