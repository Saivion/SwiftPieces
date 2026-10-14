"use client";
// Notice Stack in the Playground: the same sample notices as the generated app (shared with the definition). The
// newest notice sits on a glass card with two narrower peeks of the rest; click the pile to spread it into a list,
// where Show less and a clear button bud out of the top card. Drag any card you can see sideways (the top one while
// collapsed): it follows the pointer, and past 40% of the width or with a flick it flies off and the rest close up;
// short of that it springs back. The clear button stretches into a red Clear all; click it again and the cards leave
// one after another, bottom first. Clicking a card in the list follows On tap. Mirrors NoticeStack.swift's layout,
// thresholds and haptics. When everything is gone the sample notices drop back in after a beat, so the preview never
// stays empty (the app itself shows nothing until you insert more).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { NOTICE_DEFAULTS, noticeSamples, type NoticeSample, type NoticeTint } from "../../../definitions/utility/notice-stack.js";
import { Glyph } from "../../icons.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { BOUNCE, SPRING, useDrag, useLive, useRuntime, useTap } from "../runtime.js";

/** The house blocks; neutral follows the appearance. The red tile is the house red, as `Tint.red` is in Swift. */
const BLOCKS: Record<Exclude<NoticeTint, "neutral">, string> = { sky: "#9CC2FF", butter: "#FFD976", sage: "#A9DCB7", lilac: "#CDB8FF", sand: "#E9D5B3", red: "#FF0000" };
const INK = "#141414";
/** How much lower and narrower each peek is, the header row and its glass, as the Swift piece. */
const PEEK = 10, ROW = 44, GLASS = 30, HOME_SCALE = 0.72;
/** Clear all: each card a beat after the one below it; the top one once the header has melted in. */
const STAGGER = 70, HEADER_HOME = 620;
const EXIT = "cubic-bezier(.25, .8, .3, 1)";
const KEYFRAMES = "@media (prefers-reduced-motion: reduce){[data-spns-motion]{transition-duration:.18s!important;transition-delay:0s!important}}";

type Offset = { x: number; how: "drag" | "fly" | "home" | "cascade"; delay?: number };
type Place = { top: number; h: number; scale: number; depth: number; index: number };

/** "now", "4m", "2h", "3d" and a date after a week, as the Swift piece formats them. */
function ago(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.round(minutes / 1440)}d`;
  return new Date(Date.now() - minutes * 60000).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Xmark({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" style={{ display: "block" }}>
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  );
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const still = rt.still === true;
  const select = useTap(p.link, null);
  const dark = r.scheme === "dark";
  const gap = Math.min(Math.max(Math.round(n(p, "spacing") || NOTICE_DEFAULTS.spacing), 10), 24);
  const radius = Math.min(Math.max(Math.round(n(p, "cornerRadius") || NOTICE_DEFAULTS.cornerRadius), 12), 34);
  const messages = b(p, "messages");
  const times = b(p, "times");
  const seed = useMemo(() => noticeSamples(s(p, "set"), Math.round(n(p, "count")), b(p, "urgent")), [p.set, p.count, p.urgent]);

  const [items, setItems] = useLive<NoticeSample[]>(seed);
  const [expanded, setExpanded] = useLive(b(p, "expanded"));
  const [offsets, setOffsets] = useState<Record<string, Offset>>({});
  /** Cards that have left the layout but are still flying off. */
  const [gone, setGone] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>(() => seed.map((x) => x.id));
  const [armed, setArmed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const box = useRef<HTMLDivElement | null>(null);
  const faces = useRef(new Map<string, HTMLDivElement>());
  const last = useRef(new Map<string, Place>());
  const active = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // A new set of notices from the inspector starts over as a pile at rest.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setOffsets({});
    setGone([]);
    setKnown(seed.map((x) => x.id));
    setArmed(false);
    setClearing(false);
  }, [seed]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Each card's own height at full width, so the pile and the list are laid out as the Swift layout does.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const read = () => {
      const next: Record<string, number> = {};
      faces.current.forEach((el, id) => { next[id] = el.offsetHeight; });
      setHeights((prev) => (Object.keys(next).some((k) => prev[k] !== next[k]) ? next : prev));
    };
    const ro = new ResizeObserver(read);
    faces.current.forEach((el) => ro.observe(el));
    read();
    return () => ro.disconnect();
  }, [items, messages, times, width]);

  // New ids drop in: drawn shrunk above their place for a frame, then sprung in with a soft tick.
  const fresh = items.filter((x) => !known.includes(x.id));
  useEffect(() => {
    if (!fresh.length) return;
    const ids = fresh.map((x) => x.id);
    const t = setTimeout(() => {
      setKnown((k) => [...k, ...ids]);
      rt.haptic("soft", box.current);
    }, 30);
    return () => clearTimeout(t);
  }, [fresh.map((x) => x.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Everything cleared: in the app nothing is drawn until you insert more. Here the samples drop back in.
  const emptied = items.length === 0;
  useEffect(() => {
    if (!emptied || still) return;
    setExpanded(false);
    setArmed(false);
    setKnown([]);
    // Oldest first, so each lands on top of the last and the newest ends up in front.
    [...seed].reverse().forEach((x, i) => later(1400 + i * 380, () => setItems((cur) => [x, ...cur.filter((c) => c.id !== x.id)])));
  }, [emptied, still]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear all waits three seconds for its confirming click.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  const order = items.filter((x) => !gone.includes(x.id));
  const open = expanded && order.length > 0;
  const W = width || 340;
  const heightOf = (id: string) => heights[id] ?? 68;
  const headerGap = gap - (ROW - GLASS) / 2;

  // NoticeStackLayout: collapsed, the newest card and two peeks behind it, each narrower and PEEK lower, cut to the
  // front card's height and scaled about their centres; open, the header row, then every card `gap` apart.
  const places = new Map<string, Place>();
  let total = 0;
  if (order.length && open) {
    let y = ROW + headerGap;
    order.forEach((x, index) => { places.set(x.id, { top: y, h: heightOf(x.id), scale: 1, depth: 0, index }); y += heightOf(x.id) + gap; });
    total = y - gap;
  } else if (order.length) {
    const front = heightOf(order[0].id);
    order.forEach((x, index) => {
      const depth = Math.min(index, 2), scale = Math.max((W - 2 * PEEK * depth) / W, 0.5);
      const h = index === 0 ? front : Math.min(heightOf(x.id), front);
      places.set(x.id, { top: front + PEEK * depth - (h * (1 + scale)) / 2, h, scale, depth, index });
    });
    total = front + PEEK * Math.min(order.length - 1, 2);
  }
  useEffect(() => { places.forEach((pl, id) => last.current.set(id, pl)); });

  // The header waits at home inside the top card whenever there are notices, so opening the list buds it out.
  const headerOut = open && !clearing;
  // Home: just inside the top card's top edge. Closing, the card rises to meet it; during Clear all it sinks in.
  const home = clearing ? ROW / 2 + headerGap + (GLASS * HOME_SCALE) / 2 + 6 : GLASS * 0.4;

  const setOffset = (id: string, o: Offset | null) => setOffsets((cur) => {
    const next = { ...cur };
    if (o) next[id] = o; else delete next[id];
    return next;
  });

  /** A swipe that commits: it leaves at the pointer's speed, leaves the layout once mostly clear, then is removed. */
  const dismiss = (id: string, direction: number, el: Element | null) => {
    rt.haptic("rigid", el);
    setOffset(id, { x: direction * (W * 1.5 + 60), how: "fly" });
    later(160, () => setGone((g) => [...g, id]));
    later(520, () => {
      setItems((cur) => cur.filter((x) => x.id !== id));
      setGone((g) => g.filter((x) => x !== id));
      setOffset(id, null);
    });
  };

  const clearAll = (el: Element | null) => {
    const ids = order.map((x) => x.id);
    if (clearing || !ids.length) return;
    rt.haptic("success", el);
    setArmed(false);
    setClearing(true);
    ids.slice().reverse().forEach((id, rank) => {
      const delay = rank === ids.length - 1 ? Math.max(HEADER_HOME, rank * STAGGER) : rank * STAGGER;
      setOffset(id, { x: W * 1.5 + 60, how: "cascade", delay });
      later(delay + 160, () => setGone((g) => [...g, id]));
    });
    later(Math.max(HEADER_HOME, (ids.length - 1) * STAGGER) + 520, () => {
      setItems((cur) => cur.filter((x) => !ids.includes(x.id)));
      setGone((g) => g.filter((x) => !ids.includes(x)));
      setOffsets({});
      setClearing(false);
      setExpanded(false);
    });
  };

  const drag = useDrag({
    axis: "x",
    onStart(info) {
      const id = active.current;
      if (!id || clearing) return;
      if (armed) setArmed(false);
      setOffset(id, { x: info.dx, how: "drag" });
    },
    onMove(info) {
      const id = active.current;
      if (!id || clearing || offsets[id]?.how === "fly") return;
      setOffset(id, { x: info.dx, how: "drag" });
    },
    onEnd(info) {
      const id = active.current;
      active.current = null;
      if (!id || clearing) return;
      const line = W * 0.4;
      const coast = info.dx + (info.vx / 1000) * 0.99 / 0.01;
      if (Math.abs(info.dx) >= line || (Math.abs(coast) >= line && Math.abs(info.vx) > 250 && coast < 0 === info.dx < 0)) {
        dismiss(id, coast < 0 ? -1 : 1, info.el);
      } else {
        setOffset(id, { x: 0, how: "home" });
      }
    },
  });

  const clickCard = (x: NoticeSample, el: Element) => {
    if (clearing) return;
    if (armed) { setArmed(false); return; }
    if (!open && order.length > 1) { rt.haptic("light", el); setExpanded(true); return; }
    rt.haptic("light", el);
    select({ currentTarget: el });
  };

  const face = dark
    ? { background: "#262628", boxShadow: "inset 0 .5px 0 rgba(255,255,255,.18), inset 0 0 0 .5px rgba(255,255,255,.09), 0 6px 18px rgba(0,0,0,.30)" }
    : { background: "#FFFFFF", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07), 0 6px 18px rgba(0,0,0,.08)" };
  const glass: CSSProperties = { ...face, borderRadius: cr(999) };
  const layoutT = `top ${open ? ".5s" : ".32s"} ${SPRING}, height ${open ? ".5s" : ".32s"} ${SPRING}`;
  const topOffset = order[0] ? offsets[order[0].id]?.x ?? 0 : 0;
  const label = order.length > 1 ? `${order.length} notices. ${order[0].title}. ${messages ? order[0].message : ""}` : order[0] ? order[0].title : "";

  return (
    <div
      {...r.box}
      ref={box}
      role={open || !order.length ? undefined : "button"}
      aria-label={open || !order.length ? undefined : label}
      style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height: total, minWidth: 0, transition: still ? undefined : layoutT, color: houseVar("text") }}
    >
      <style>{KEYFRAMES}</style>
      {order.length || clearing ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ROW, display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: headerOut ? "auto" : "none" }}>
          <button
            type="button"
            data-spns-motion
            onClick={(e) => { rt.haptic("light", e.currentTarget); setArmed(false); setExpanded(false); }}
            style={{ ...glass, height: GLASS, padding: "0 14px", border: 0, color: houseVar("text"), fontSize: ts(13), fontWeight: fw(600), whiteSpace: "nowrap", cursor: "pointer",
              transform: headerOut ? "none" : `translateY(${home}px) scale(${HOME_SCALE})`, opacity: headerOut ? 1 : 0,
              transition: headerOut ? `transform .62s ${BOUNCE}, opacity .3s ease-out .1s` : "transform .5s ease-in-out, opacity .14s ease-out" }}
          >
            Show less
          </button>
          <button
            type="button"
            data-spns-motion
            aria-label="Clear all"
            onClick={(e) => { if (armed) clearAll(e.currentTarget); else { rt.haptic("selection", e.currentTarget); setArmed(true); } }}
            style={{ ...glass, ...(armed ? { background: ACCENT, color: ACCENT_INK } : { color: houseVar("text") }), height: GLASS, width: armed ? "calc(84px * var(--spb-text, 1))" : GLASS, padding: 0, border: 0,
              display: "grid", placeItems: "center", overflow: "hidden", fontSize: ts(13), fontWeight: fw(600), whiteSpace: "nowrap", cursor: "pointer",
              transform: headerOut ? "none" : `translateY(${home}px) scale(${HOME_SCALE})`, opacity: headerOut ? 1 : 0,
              transition: `${headerOut ? `transform .62s ${BOUNCE}, opacity .3s ease-out .1s` : "transform .5s ease-in-out, opacity .14s ease-out"}, background-color .25s, color .25s, width .4s ${SPRING}` }}
          >
            {armed ? "Clear all" : <Xmark size={12} />}
          </button>
        </div>
      ) : null}
      {[...items].reverse().map((x) => {
        const place = places.get(x.id);
        const kept = place ?? last.current.get(x.id) ?? { top: 0, h: heightOf(x.id), scale: 1, depth: 0, index: 0 };
        const o = offsets[x.id];
        const arriving = !known.includes(x.id) && !still;
        const index = place?.index ?? 9;
        // The second card's words show only where the top card has slid away from it.
        const revealing = !open && index === 1 && topOffset !== 0;
        const shown = !!place && !arriving && (open || index === 0 || revealing);
        const half = W / 2, sc = kept.scale;
        const cut = topOffset > 0 ? half + (topOffset - half) / sc : half + (half + topOffset) / sc;
        const clip = revealing ? (topOffset > 0 ? `inset(0 ${Math.max(W - cut, 0)}px 0 0)` : `inset(0 0 0 ${Math.max(cut, 0)}px)`) : "none";
        const xT = !o || arriving ? "none"
          : o.how === "drag" ? "none"
          : o.how === "fly" ? `transform .42s ${EXIT}`
          : o.how === "cascade" ? `transform .45s ${EXIT} ${o.delay ?? 0}ms`
          : `transform .45s ${BOUNCE}`;
        const tint = x.tint === "neutral" ? (dark ? "#3A3A38" : "#E4E2DC") : BLOCKS[x.tint];
        const ink = x.tint === "neutral" ? houseVar("text") : INK;
        const swipes = !clearing && (open || index === 0) && !!place;
        return (
          <div
            key={x.id}
            data-spns-motion
            role={open ? "button" : undefined}
            aria-label={open ? `${x.title}${times ? `, ${ago(x.minutes)}` : ""}. ${messages ? x.message : ""}` : undefined}
            onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => { if (swipes) { active.current = x.id; drag(e); } }}
            onClick={(e) => clickCard(x, e.currentTarget)}
            style={{
              position: "absolute", left: 0, width: "100%", top: kept.top, height: kept.h, cursor: "pointer", touchAction: "pan-y",
              transform: `translateX(${o?.x ?? 0}px)`,
              transition: arriving || still ? "none" : [xT, layoutT].join(", "),
            }}
          >
            <div
              data-spns-motion
              style={{
                ...face, height: "100%", borderRadius: cr(radius), overflow: "hidden",
                transform: `translateY(${arriving ? (open ? -12 : -53) : 0}px) scale(${arriving ? 0.001 : kept.scale})`,
                transition: arriving || still ? "none" : `transform ${open ? ".5s" : ".4s"} ${SPRING}`,
              }}
            >
              <div
                ref={(el) => { if (el) faces.current.set(x.id, el); else faces.current.delete(x.id); }}
                data-spns-motion
                style={{
                  display: "flex", gap: 12, padding: 14, alignItems: messages ? "flex-start" : "center", clipPath: clip,
                  opacity: shown ? 1 : 0, filter: shown ? "none" : "blur(6px)",
                  transition: shown ? "opacity .3s ease-out .1s, filter .3s ease-out .1s" : "opacity .14s ease-out, filter .14s ease-out",
                }}
              >
                <span style={{ width: 38, height: 38, flex: "none", borderRadius: cr(10), background: tint, color: ink, display: "grid", placeItems: "center" }}>
                  <Glyph name={x.icon} size={18} strokeWidth={2.1} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: ts(15), lineHeight: 1.33, fontWeight: fw(600), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.title}</span>
                    {times ? <span style={{ fontSize: ts(12), fontWeight: fw(600), color: houseVar("muted"), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{ago(x.minutes)}</span> : null}
                  </span>
                  {messages ? (
                    <span style={{ fontSize: ts(13), lineHeight: 1.38, fontWeight: fw(600), color: houseVar("muted"), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.message}</span>
                  ) : null}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
