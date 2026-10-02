"use client";
// Follow Scroll in the Playground: a chat or live log that keeps arriving. At the bottom each new item
// scrolls in; scroll (or drag) up and nothing moves while new items count into the "3 new" pill, with a
// light haptic when it first appears. Click the pill to jump back (soft haptic); scrolling down by hand
// clears it too. Far up with nothing new, a round jump button shows. With history on, nearing the top
// loads older items with the visible rows held in place.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { fsIsMine, fsLine, fsLog, fsReply, fsThread, type FsThread } from "../../../definitions/utility/follow-scroll.js";
import { Glyph } from "../../icons.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, font, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { useDrag, useRuntime } from "../runtime.js";

const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const HISTORY_START = -36;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

type Item = { id: number; text: string; mine: boolean };
const sample = (log: boolean, id: number, thread: FsThread): Item => (log ? { id, text: fsLog(id), mine: false } : { id, text: fsLine(id, thread), mine: fsIsMine(id) });
const arrival = (log: boolean, id: number, thread: FsThread): Item => (log ? { id, text: fsLog(id), mine: false } : { id, text: fsReply(id, thread), mine: false });

const FollowScroll: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const log = s(p, "kind") === "log";
  const count = Math.max(0, Math.round(n(p, "messages")));
  const every = n(p, "arrival");
  const threshold = n(p, "followThreshold") || 48;
  const long = s(p, "label") === "long";
  const loadsOlder = b(p, "loadsOlder");
  const jumpButton = b(p, "showsJumpButton");
  const height = n(p, "height") || 520;
  // The screen's own thread (or the default one); a new thread starts again at the latest, like new content.
  const thread = fsThread(p);
  const threadKey = `${thread.lines.join("|")}§${thread.replies.join("|")}`;
  const threadRef = useRef(thread);
  threadRef.current = thread;
  const key = `${log}|${count}|${threadKey}`;

  const [items, setItems] = useState<Item[]>(() => Array.from({ length: count }, (_, i) => sample(log, i, thread)));
  const [following, setFollowing] = useState(true);
  const [unread, setUnread] = useState(0);
  const [far, setFar] = useState(false);
  const [loading, setLoading] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const pill = useRef<HTMLButtonElement | null>(null);
  const followingRef = useRef(true);
  const lastTop = useRef(0);
  const jumpingUntil = useRef(0);
  /** When the reader last used the wheel, a pointer, touch or a key: their scrolls always count, even mid-jump. */
  const userAt = useRef(0);
  const markUser = () => { userAt.current = performance.now(); };
  const armed = useRef(true);
  const prepend = useRef<{ height: number; top: number } | null>(null);
  const pendingFollow = useRef(false);

  const setFollow = useCallback((v: boolean) => {
    followingRef.current = v;
    setFollowing(v);
    if (v) {
      setUnread(0);
      setFar(false);
    }
  }, []);

  const toBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    jumpingUntil.current = performance.now() + (smooth ? 650 : 60);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? "smooth" : "auto" });
  }, [reduced]);

  // Remixing the content starts again at the latest.
  useEffect(() => {
    setItems(Array.from({ length: count }, (_, i) => sample(log, i, threadRef.current)));
    setFollow(true);
    armed.current = true;
    pendingFollow.current = false;
    requestAnimationFrame(() => toBottom(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The latest items, for timers and callbacks that outlive a render.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const unreadRef = useRef(0);
  unreadRef.current = unread;

  // New items arrive on a timer, like a live feed.
  useEffect(() => {
    if (rt.still || every <= 0) return;
    const t = setInterval(() => {
      const xs = itemsRef.current;
      const next = (xs.length ? xs[xs.length - 1].id : -1) + 1;
      if (followingRef.current) {
        pendingFollow.current = true;
      } else {
        if (unreadRef.current === 0) rt.haptic("light", pill.current ?? scroller.current);
        unreadRef.current += 1;
        setUnread(unreadRef.current);
      }
      itemsRef.current = [...xs, arrival(log, next, threadRef.current)];
      setItems(itemsRef.current);
    }, every * 1000);
    return () => clearInterval(t);
  }, [every, log, rt]);

  // After each render: follow a new item, or hold the rows in place after a prepend.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prepend.current) {
      el.scrollTop = prepend.current.top + (el.scrollHeight - prepend.current.height);
      lastTop.current = el.scrollTop;
      prepend.current = null;
    }
    if (pendingFollow.current) {
      pendingFollow.current = false;
      toBottom(true);
    }
  }, [items, toBottom]);

  const loadOlder = useCallback(() => {
    const el = scroller.current;
    if (!el || !loadsOlder || loading || !armed.current) return;
    armed.current = false;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const xs = itemsRef.current;
      const first = xs.length ? xs[0].id : 0;
      if (first <= HISTORY_START) return; // the start of history: stay disarmed until they scroll away
      const box = scroller.current;
      if (box) prepend.current = { height: box.scrollHeight, top: box.scrollTop };
      armed.current = true;
      itemsRef.current = [...Array.from({ length: 12 }, (_, i) => sample(log, first - 12 + i, threadRef.current)), ...xs];
      setItems(itemsRef.current);
    }, 1000);
  }, [loadsOlder, loading, log]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const now = performance.now();
    const movedUp = el.scrollTop < lastTop.current - 0.5 && (now - userAt.current < 500 || now > jumpingUntil.current);
    lastTop.current = el.scrollTop;
    if (distance <= threshold) {
      if (!followingRef.current) setFollow(true);
    } else if (movedUp && followingRef.current) {
      setFollow(false);
    }
    const isFar = distance > el.clientHeight * 0.75;
    if (isFar !== far && (!followingRef.current || !isFar)) setFar(isFar);
    if (el.scrollTop < el.clientHeight * 0.75) loadOlder();
    else if (el.scrollTop > el.clientHeight * 1.25) armed.current = true;
  };

  const jump = () => {
    rt.haptic("soft", pill.current);
    setFollow(true);
    toBottom(true);
  };

  // A mouse drag scrolls, as a finger would.
  const startTop = useRef(0);
  const onDrag = useDrag({
    axis: "y",
    onStart() {
      startTop.current = scroller.current?.scrollTop ?? 0;
      jumpingUntil.current = 0;
    },
    onMove(info) {
      const el = scroller.current;
      if (el) el.scrollTop = startTop.current - info.dy;
    },
  });

  const shows = !following && items.length > 0 && (unread > 0 || (jumpButton && far));
  const label = long ? `${unread} new ${log ? "line" : "message"}${unread === 1 ? "" : "s"}` : `${unread} new`;
  const glass: CSSProperties = {
    background: `color-mix(in srgb, ${houseVar("raised")} 74%, transparent)`,
    backdropFilter: "blur(16px) saturate(1.6)",
    WebkitBackdropFilter: "blur(16px) saturate(1.6)",
    boxShadow: "0 8px 24px rgb(0 0 0 / .22), inset 0 0 0 .75px color-mix(in srgb, currentColor 14%, transparent)",
  };

  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height, flex: "none", overflow: "hidden", color: houseVar("text") }}>
      <style>{"@keyframes fs-tick{from{transform:translateY(40%);opacity:0}to{transform:none;opacity:1}}@keyframes fs-spin{to{transform:rotate(360deg)}}.fs-scroll::-webkit-scrollbar{display:none}"}</style>
      <div
        ref={scroller}
        className="fs-scroll"
        onScroll={onScroll}
        onPointerDown={(e) => { markUser(); onDrag(e); }}
        onWheel={markUser}
        onTouchStart={markUser}
        onKeyDown={markUser}
        role="log"
        aria-live="off"
        style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", scrollbarWidth: "none", touchAction: "pan-y" }}
      >
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: log ? 4 : 8, padding: "12px 16px", boxSizing: "border-box" }}>
          {items.map((it) =>
            log ? (
              <div key={it.id} style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: ts(13), lineHeight: 1.45, color: it.text.includes("  500  ") ? ACCENT : houseVar("text"), whiteSpace: "pre-wrap" }}>{it.text}</div>
            ) : (
              <div key={it.id} style={{ alignSelf: it.mine ? "flex-end" : "flex-start", maxWidth: "78%", padding: "10px 14px", borderRadius: cr(18), background: it.mine ? ACCENT : houseVar("field"), color: it.mine ? ACCENT_INK : houseVar("text"), ...font("body") }}>{it.text}</div>
            ),
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Glyph name="bubble.left" size={34} style={{ color: houseVar("muted") }} />
            <span style={{ ...font("headline") }}>{log ? "No logs yet" : "No messages yet"}</span>
            <span style={{ ...font("subheadline"), color: houseVar("muted") }}>{log ? "New lines appear here as they arrive." : "Say hello to start the thread."}</span>
          </div>
        </div>
      ) : null}

      <div style={{ position: "absolute", top: 8, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", opacity: loading ? 1 : 0, transition: "opacity .2s" }}>
        <span style={{ width: 36, height: 36, borderRadius: 18, display: "grid", placeItems: "center", ...glass }}>
          <svg aria-hidden viewBox="0 0 24 24" style={{ width: 18, height: 18, animation: reduced ? undefined : "fs-spin .9s linear infinite" }}>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity={0.6} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="40 60" />
          </svg>
        </span>
      </div>

      <div style={{ position: "absolute", left: 16, right: 16, bottom: 12, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <button
          ref={pill}
          type="button"
          onClick={jump}
          onWheel={(e) => { markUser(); scroller.current?.scrollBy({ top: e.deltaY }); }}
          aria-label={unread > 0 ? label : "Jump to latest"}
          tabIndex={shows ? 0 : -1}
          style={{
            pointerEvents: shows ? "auto" : "none", border: 0, font: "inherit", color: houseVar("text"), cursor: "pointer",
            height: 44, minWidth: 44, padding: unread > 0 ? "0 16px 0 8px" : 0, borderRadius: 22,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10, ...glass,
            opacity: shows ? 1 : 0, transform: shows ? "none" : "translateY(12px) scale(.6)", transformOrigin: "bottom center",
            transition: reduced ? "opacity .2s" : `opacity .25s, transform .42s ${spring}, padding .3s ${ease}`,
          }}
        >
          {unread > 0 ? (
            <>
              <span style={{ width: 28, height: 28, borderRadius: 14, display: "grid", placeItems: "center", background: ACCENT, color: ACCENT_INK, flex: "none" }}>
                <Glyph name="arrow.down" size={14} strokeWidth={3} />
              </span>
              <span key={unread} style={{ ...font("subheadline", 600), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", animation: reduced ? undefined : `fs-tick .3s ${ease} both` }}>{label}</span>
            </>
          ) : (
            <Glyph name="arrow.down" size={16} strokeWidth={2.8} />
          )}
        </button>
      </div>
    </div>
  );
};

export const renderer: Renderer = FollowScroll;
