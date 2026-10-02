"use client";
// Web renderers for the free Swift Pieces built on gestures and motion. Each one behaves like the
// piece on iPhone: cards follow the finger and commit or spring home, dials and tracks scrub with a
// tick per step, stacks fan and flip. Painted with the house palette the Swift `Style` defaults
// use, so a piece looks the same here as in the simulator. Loaded as its own chunk.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import { house } from "../../core/palette.js";
import { list } from "../../core/swift.js";
import { LEADING_SETS, ROW_ACTIONS, TRAILING_SETS, cardBlock, initials, uniqueList } from "../../definitions/pieces-motion.js";
import { contourBackground } from "../../definitions/shared.js";
import { Glyph } from "../icons.js";
import { b, fillStyle, houseVar, n, s, useAxis, type Renderer, type RenderProps, cr, ff, fw, ts, ACCENT, inkOn } from "./env.js";
import { BOUNCE, SPRING, useDrag, useLive, useRuntime, useTap, type HapticKind } from "./runtime.js";

const INK = house.ink;
const B: Record<string, string> = { ...house.blocks, tangerine: ACCENT };
const block = (id: string) => B[id] ?? ACCENT;
const corner = (r: number) => cr(r) as string;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function reduced() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Root({ r, style, children }: { r: RenderProps; style?: CSSProperties; children?: ReactNode }) {
  const axis = useAxis();
  return (
    <div {...r.box} style={{ ...r.box.style, ...style, ...fillStyle(r.fill, axis) }}>
      {children}
      <style>{KEYFRAMES}</style>
    </div>
  );
}

const KEYFRAMES = "@keyframes spb-motion-rise{from{opacity:0;transform:translateY(40%)}to{opacity:1;transform:none}}@keyframes spb-motion-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}@keyframes spb-motion-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.012)}}";

/** Underdamped spring from 0 to 1, like `.spring(bounce: ~0.2)`. */
const springEase = (x: number) => (x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(Math.PI * 1.08 * x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

/**
 * A number animated on the main thread, for motion whose shading or depth depends on the animated
 * value mid-flight (a flip that lifts at 90°, pages that shrink as they leave center).
 */
function useTween(initial: number) {
  const [value, setValue] = useState(initial);
  const current = useRef(initial);
  const frame = useRef(0);
  const set = useCallback((x: number) => {
    cancelAnimationFrame(frame.current);
    current.current = x;
    setValue(x);
  }, []);
  const to = useCallback((target: number, ms: number, ease: (x: number) => number = springEase, done?: () => void) => {
    cancelAnimationFrame(frame.current);
    const from = current.current;
    const duration = reduced() ? Math.min(ms, 220) : ms;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const x = k >= 1 ? target : from + (target - from) * ease(k);
      current.current = x;
      setValue(x);
      if (k < 1) frame.current = requestAnimationFrame(tick);
      else done?.();
    };
    frame.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // `set` and `to` are stable; effects depend on them, never on this object.
  return { value, current, set, to };
}

/** The element's layout width in points (unaffected by the phone's scale), kept current. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.offsetWidth || fallback);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

/** A haptic at most every `gap` ms, so a fast scrub reads as ticks rather than a buzz. */
function useTicker(gap = 35) {
  const { haptic } = useRuntime();
  const last = useRef(0);
  return useCallback(
    (kind: HapticKind, el?: Element | null, force = false) => {
      const now = performance.now();
      if (!force && now - last.current < gap) return;
      last.current = now;
      haptic(kind, el);
    },
    [haptic, gap],
  );
}

/** Press feedback for button-like parts: dips while held, springs back on release. */
function usePressed() {
  const [down, setDown] = useState(false);
  const bind = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button === 0) setDown(true);
    },
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    onPointerCancel: () => setDown(false),
  };
  return [down, bind] as const;
}

const eyebrowStyle: CSSProperties = { fontSize: ts(11), fontWeight: fw(700), letterSpacing: "0.1em", lineHeight: 1, textTransform: "uppercase" };

// ---------------------------------------------------------------- Swipe Deck

type Edge = "leading" | "trailing" | "top";
const BADGES: Record<Edge, { title: string; glyph: string; fill: string; tilt: number; pos: CSSProperties }> = {
  trailing: { title: "Keep", glyph: "heart.fill", fill: B.sage, tilt: -10, pos: { left: 20, top: 20 } },
  leading: { title: "Skip", glyph: "xmark", fill: ACCENT, tilt: 10, pos: { right: 20, top: 20 } },
  top: { title: "Save", glyph: "bookmark", fill: B.butter, tilt: 0, pos: { left: "50%", bottom: 20 } },
};

const SwipeDeck: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const palette = s(p, "palette");
  const source = s(p, "items");
  const initial = useMemo(() => uniqueList(source, 8, "Card").map((title, i) => ({ title, fill: block(cardBlock(palette, i)) })), [source, palette]);
  const [cards, setCards] = useLive(initial);
  const [t, setT] = useState({ x: 0, y: 0 });
  const [phase, setPhase] = useState<"rest" | "drag" | "settle" | "throw">("rest");
  const [ref, width] = useWidth<HTMLDivElement>(342);
  const height = n(p, "height");
  const visible = clamp(n(p, "visibleCount") || 3, 1, 5);
  const radius = 34;
  const thX = width * 0.4;
  const thY = height * 0.3;
  const lift = clamp(Math.max(Math.abs(t.x) / thX, Math.max(-t.y, 0) / thY), 0, 1);
  const locked = useRef(false);
  const x = t.x / Math.max(thX, 1);
  const y = Math.max(-t.y, 0) / Math.max(thY, 1);
  const heading: { edge: Edge; progress: number } | null = Math.max(Math.abs(x), y) <= 0.05 ? null : y > Math.abs(x) ? { edge: "top", progress: Math.min(y, 1) } : { edge: x > 0 ? "trailing" : "leading", progress: Math.min(Math.abs(x), 1) };
  const dark = r.scheme === "dark";
  const shadow = Math.min(0.12 * (dark ? 3 : 1), 1);
  const ic = s(p, "icon");

  const throwTop = (edge: Edge, el: Element | null, vector?: { x: number; y: number }) => {
    const dir = vector ?? (edge === "top" ? { x: 0, y: -1 } : edge === "leading" ? { x: -1, y: -0.1 } : { x: 1, y: -0.1 });
    const k = (Math.max(width, height) * 1.6) / Math.max(Math.abs(dir.x), Math.abs(dir.y), 1);
    rt.haptic("medium", el);
    setPhase("throw");
    setT((cur) => ({ x: cur.x + dir.x * k, y: cur.y + dir.y * k }));
    window.setTimeout(() => {
      setCards((cur) => cur.slice(1));
      setT({ x: 0, y: 0 });
      setPhase("rest");
    }, reduced() ? 250 : 420);
  };

  const drag = useDrag({
    slop: 4,
    onStart: () => {
      locked.current = false;
      setPhase("drag");
    },
    onMove: ({ dx, dy, el }) => {
      setT({ x: dx, y: dy });
      const past = Math.max(Math.abs(dx) / thX, Math.max(-dy, 0) / thY) >= 1;
      if (past && !locked.current) rt.haptic("selection", el);
      locked.current = past;
    },
    onEnd: ({ dx, dy, vx, vy, el }) => {
      // SwiftUI's predictedEndTranslation: where the flick would carry the card.
      const px = dx + vx * 0.2;
      const py = dy + vy * 0.2;
      if (-py > thY && Math.abs(py) > Math.abs(px)) throwTop("top", el, { x: px, y: py });
      else if (Math.abs(px) > thX) throwTop(px > 0 ? "trailing" : "leading", el, { x: px, y: py });
      else {
        setPhase("settle");
        setT({ x: 0, y: 0 });
      }
    },
  });

  const transition = phase === "drag" ? "none" : phase === "throw" ? `transform ${reduced() ? 0.25 : 0.42}s cubic-bezier(.25,.8,.35,1), opacity .25s` : `transform .45s ${BOUNCE}`;
  const message = s(p, "emptyMessage").trim();
  const showBadges = b(p, "badges");

  return (
    <Root r={r} style={{ position: "relative", height, width: "100%" }}>
      <div ref={ref} style={{ position: "absolute", inset: 0 }}>
        {cards.length === 0 && message ? (
          <button
            type="button"
            aria-label="Deal the cards again"
            onClick={(e) => {
              rt.haptic("light", e.currentTarget);
              setCards(initial);
            }}
            style={{ all: "unset", position: "absolute", inset: 0, borderRadius: corner(radius), border: `2px dashed ${houseVar("muted")}`, opacity: 0.8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: houseVar("muted"), cursor: "pointer", animation: "spb-motion-in .35s ease-out" }}
          >
            <Glyph name="checkmark" size={26} strokeWidth={2.6} />
            <span style={{ fontSize: ts(20), fontWeight: fw(700), letterSpacing: "-0.02em", textAlign: "center", padding: "0 24px" }}>{message}</span>
          </button>
        ) : null}
        {cards.length === 0 && !message ? <button type="button" aria-label="Deal the cards again" onClick={() => setCards(initial)} style={{ all: "unset", position: "absolute", inset: 0, cursor: "pointer" }} /> : null}
        {cards
          .slice(0, visible)
          .map((card, index) => ({ card, index }))
          .reverse()
          .map(({ card, index }) => {
            const top = index === 0;
            const depth = Math.max(index - lift, 0);
            const swing = top && !reduced() ? (t.x / Math.max(width, 1)) * 14 : 0;
            const keyOpacity = shadow * (top ? 1 + lift * 0.6 : 0.7);
            const style: CSSProperties = {
              position: "absolute",
              inset: 0,
              borderRadius: corner(radius),
              background: card.fill,
              color: INK,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              transformOrigin: "50% 100%",
              transform: top ? `rotate(${swing}deg) translate(${t.x}px, ${t.y}px)` : `translateY(${16 * depth}px) scale(${1 - 0.05 * depth})`,
              filter: depth > 0 ? `brightness(${1 - 0.05 * Math.min(depth, 2)})` : undefined,
              boxShadow: `0 1px 2px rgba(0,0,0,${shadow * 0.5}), 0 ${top ? 12 + lift * 6 : 8}px ${top ? 36 + lift * 20 : 24}px rgba(0,0,0,${Math.min(keyOpacity, 1)})`,
              opacity: top && phase === "throw" && reduced() ? 0 : 1,
              zIndex: visible - index,
              transition: top ? transition : `transform .35s ${SPRING}, filter .35s`,
              touchAction: top ? "none" : undefined,
              cursor: top ? (phase === "drag" ? "grabbing" : "grab") : undefined,
              userSelect: "none",
              WebkitUserSelect: "none",
            };
            return (
              <div
                key={card.title}
                style={style}
                onPointerDown={
                  top && phase !== "throw"
                    ? (e) => {
                        e.stopPropagation();
                        drag(e);
                      }
                    : undefined
                }
              >
                {s(p, "eyebrow").trim() ? <span style={eyebrowStyle}>{s(p, "eyebrow")}</span> : null}
                <span style={{ flex: 1 }} />
                {ic !== "none" ? (
                  <>
                    <span style={{ alignSelf: "center" }}>
                      <Glyph name={ic} size={56} strokeWidth={2} />
                    </span>
                    <span style={{ flex: 1 }} />
                  </>
                ) : null}
                <span style={{ fontSize: ts(32), fontWeight: fw(700), letterSpacing: "-1.2px", lineHeight: 1.05, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.title}</span>
                {top && showBadges
                  ? (Object.keys(BADGES) as Edge[]).map((edge) => {
                      const badge = BADGES[edge];
                      const pr = heading?.edge === edge && phase !== "throw" ? heading.progress : 0;
                      const lockedBadge = pr >= 1;
                      const scale = reduced() ? 1 : lockedBadge ? 1.08 : 0.8 + 0.2 * pr;
                      return (
                        <span
                          key={edge}
                          aria-hidden
                          style={{
                            position: "absolute",
                            ...badge.pos,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            height: 44,
                            padding: "0 16px",
                            borderRadius: cr(22),
                            background: badge.fill,
                            color: INK,
                            fontSize: ts(20),
                            fontWeight: fw(700),
                            letterSpacing: "-0.4px",
                            boxShadow: "0 4px 20px rgba(0,0,0,.18)",
                            opacity: Math.min(pr * 1.6, 1),
                            transform: `${edge === "top" ? "translateX(-50%) " : ""}rotate(${reduced() ? 0 : badge.tilt}deg) scale(${scale})`,
                            transition: `transform .3s ${BOUNCE}`,
                            pointerEvents: "none",
                          }}
                        >
                          <Glyph name={badge.glyph} size={15} strokeWidth={3} />
                          {badge.title}
                        </span>
                      );
                    })
                  : null}
              </div>
            );
          })}
      </div>
    </Root>
  );
};

// ---------------------------------------------------------------- Swipe Action Row

const TILE = 78;
const GAP = 6;

const SwipeActionRow: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const leading = (LEADING_SETS[s(p, "leading")] ?? []).map((k) => ROW_ACTIONS[k]);
  const trailing = (TRAILING_SETS[s(p, "trailing")] ?? []).map((k) => ROW_ACTIONS[k]);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [armed, setArmed] = useState(false);
  const start = useRef(0);
  const [ref, width] = useWidth<HTMLDivElement>(342);
  const widthOf = (count: number) => (TILE + GAP) * count;
  const rubber = (x: number) => 40 * (1 - 1 / (1 + x / 40));
  const limit = (x: number) => (x > 0 ? (leading.length ? x : rubber(x)) : x < 0 ? (trailing.length ? x : -rubber(-x)) : 0);
  const threshold = Math.max(width * 0.6, TILE * 2);
  const fullSwipe = (x: number) => (x > threshold && leading.length ? leading[0] : x < -threshold && trailing.length ? trailing[0] : null);
  const lift = Math.min(1, Math.abs(offset) / 40);
  // In a styled list (Style → Lists) the card goes clear and the list draws the surface: no lift
  // shadow (it would fall on the text), and tighter corners on the tiles.
  const listed = p.listed === true;
  const radius = listed ? 12 : 26;

  const settle = (target: number) => {
    setDragging(false);
    setOffset(target);
  };
  const fire = (el: Element | null) => {
    rt.haptic("light", el);
    settle(0);
  };

  const drag = useDrag({
    axis: "x",
    slop: 10,
    onStart: () => {
      start.current = offset;
      setDragging(true);
    },
    onMove: ({ dx, el }) => {
      const next = limit(start.current + dx);
      setOffset(next);
      const nowArmed = fullSwipe(next) !== null;
      if (nowArmed && !armed) rt.haptic("rigid", el);
      if (nowArmed !== armed) setArmed(nowArmed);
    },
    onEnd: ({ dx, vx, el }) => {
      const current = limit(start.current + dx);
      if (fullSwipe(current)) {
        setArmed(false);
        fire(el);
        return;
      }
      const projected = start.current + dx + vx * 0.2;
      if (leading.length && projected > widthOf(leading.length) / 2) settle(widthOf(leading.length));
      else if (trailing.length && projected < -widthOf(trailing.length) / 2) settle(-widthOf(trailing.length));
      else settle(0);
    },
  });

  const slide = dragging ? "none" : `transform .4s ${BOUNCE}, box-shadow .3s`;
  const bar = (actions: typeof leading, edge: "leading" | "trailing") => {
    const revealed = edge === "leading" ? Math.max(offset, 0) : Math.max(-offset, 0);
    if (!actions.length || revealed <= 0) return null;
    const reveal = Math.min(1, revealed / widthOf(actions.length));
    const ordered = edge === "leading" ? actions : [...actions].reverse();
    const room = Math.max(revealed - GAP * actions.length, 0);
    const first = actions[0];
    return (
      <div style={{ position: "absolute", top: 0, bottom: 0, [edge === "leading" ? "left" : "right"]: 0, width: revealed, display: "flex", flexDirection: "row", paddingLeft: edge === "trailing" ? GAP : 0, paddingRight: edge === "leading" ? GAP : 0, gap: armed ? 0 : GAP, boxSizing: "border-box", transition: dragging ? "none" : `width .4s ${BOUNCE}` }}>
        {ordered.map((a) => {
          const expanded = armed && a === first;
          const w = armed ? (expanded ? room + GAP * (actions.length - 1) : 0) : room / actions.length;
          return (
            <TileButton key={a.title} action={a} width={w} reveal={reveal} expanded={expanded} animate={!dragging || armed} onFire={fire} radius={radius} />
          );
        })}
      </div>
    );
  };

  const title = s(p, "title");
  return (
    <Root r={r} style={{ position: "relative", overflowX: "clip", overflowY: "visible", touchAction: "pan-y" }}>
      <div ref={ref} style={{ position: "relative" }}>
        {bar(leading, "leading")}
        {bar(trailing, "trailing")}
        <div
          onPointerDown={drag}
          onClick={(e) => {
            if (offset !== 0) {
              e.stopPropagation();
              settle(0);
            }
          }}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            borderRadius: corner(radius),
            background: listed ? "transparent" : houseVar("surface"),
            color: houseVar("text"),
            transform: `translateX(${offset}px)`,
            boxShadow: listed ? undefined : `${offset > 0 ? -3 : 3}px ${4 * lift}px 28px rgba(0,0,0,${0.16 * lift * (r.scheme === "dark" ? 2 : 1)})`,
            transition: slide,
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
            cursor: dragging ? "grabbing" : undefined,
          }}
        >
          {b(p, "avatar") ? <span style={{ width: 46, height: 46, borderRadius: cr(23), flex: "none", display: "grid", placeItems: "center", background: block(s(p, "avatarColor")), color: INK, fontSize: ts(15), fontWeight: fw(700), fontFamily: ff('ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif') }}>{initials(title)}</span> : null}
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: ts(17), fontWeight: fw(600), lineHeight: "22px" }}>{title}</span>
            {s(p, "subtitle").trim() ? <span style={{ fontSize: ts(15), lineHeight: "20px", color: houseVar("muted"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s(p, "subtitle")}</span> : null}
          </span>
          {s(p, "detail").trim() ? <span style={{ fontSize: ts(13), color: houseVar("muted"), fontVariantNumeric: "tabular-nums", flex: "none", marginLeft: 8 }}>{s(p, "detail")}</span> : null}
        </div>
      </div>
    </Root>
  );
};

function TileButton({ action, width, reveal, expanded, animate, onFire, radius = 26 }: { action: (typeof ROW_ACTIONS)[string]; width: number; reveal: number; expanded: boolean; animate: boolean; onFire: (el: Element | null) => void; radius?: number }) {
  const [down, bind] = usePressed();
  const glyphScale = reduced() ? 1 : 0.55 + 0.45 * reveal + (expanded ? 0.12 : 0);
  return (
    <button
      type="button"
      {...bind}
      onPointerDown={(e) => {
        e.stopPropagation();
        bind.onPointerDown(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onFire(e.currentTarget);
      }}
      style={{
        all: "unset",
        boxSizing: "border-box",
        width,
        flex: "none",
        overflow: "hidden",
        borderRadius: corner(radius),
        background: block(action.block),
        color: INK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: width < 1 ? 0 : 1,
        cursor: "pointer",
        transform: down && !reduced() ? "scale(0.94)" : "none",
        transition: animate ? `width .25s ${SPRING}, transform .25s ${BOUNCE}, opacity .2s` : `transform .25s ${BOUNCE}`,
      }}
    >
      <span style={{ transform: `scale(${glyphScale})`, transition: `transform .35s ${BOUNCE}` }}>
        <Glyph name={action.glyph} size={20} strokeWidth={2.3} />
      </span>
      <span style={{ fontSize: ts(12), fontWeight: fw(600), lineHeight: 1, whiteSpace: "nowrap", opacity: reduced() ? 1 : Math.max(0, (reveal - 0.45) / 0.55) }}>{action.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------- Flip Card

const CONTOUR_BG = contourBackground();

const FlipCard: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const angle = useTween(0);
  const [press, setPress] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const base = useRef<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>(342);
  const height = n(p, "height");
  const lift = n(p, "lift");
  const a = angle.value;
  const norm = ((a % 360) + 360) % 360;
  const showsBack = norm > 90 && norm < 270;
  const wasBack = useRef(showsBack);
  useEffect(() => {
    if (wasBack.current !== showsBack) rt.haptic("soft", ref.current);
    wasBack.current = showsBack;
  }, [showsBack, rt, ref]);

  const flip = () => angle.to(Math.round(angle.current.current / 180) * 180 + 180, 700);
  const drag = useDrag({
    slop: 0,
    onStart: ({ x, y, el }) => {
      base.current = null;
      setPress({ x, y });
      rt.haptic("light", el);
    },
    onMove: ({ dx, dy }) => {
      if (base.current === null) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          base.current = angle.current.current;
          setPress(null);
          setDragging(true);
        } else return;
      }
      const delta = (dx / Math.max(width, 1)) * 180;
      // Past a half turn the scrub rubber-bands instead of stopping dead.
      const limited = Math.abs(delta) <= 180 ? delta : Math.sign(delta) * (180 + (Math.abs(delta) - 180) * 0.25);
      angle.set(base.current + clamp(limited, -210, 210));
    },
    onEnd: ({ dx, dy, vx }) => {
      const start = base.current;
      base.current = null;
      setPress(null);
      setDragging(false);
      if (start !== null) {
        const projected = ((dx + vx * 0.2) / Math.max(width, 1)) * 180;
        const target = Math.abs(projected) >= 90 ? start + (projected > 0 ? 180 : -180) : start;
        angle.to(target, 550);
      } else if (Math.abs(dy) < 10 && Math.abs(dx) < 10) flip();
    },
  });

  const edge = Math.sin((a * Math.PI) / 180);
  const turn = Math.abs(edge);
  const up = Math.max(turn, dragging ? 0.35 : 0);
  const strength = Math.min(0.14 * (r.scheme === "dark" ? 3 : 1), 1);
  const tiltX = press ? -((press.y / height) - 0.5) * 6 : 0;
  const tiltY = press ? ((press.x / Math.max(width, 1)) - 0.5) * 6 : 0;
  const pressed = press !== null && !reduced();

  const face = (isBack: boolean): CSSProperties => {
    const visible = isBack ? showsBack : !showsBack;
    return {
      position: "absolute",
      inset: 0,
      borderRadius: corner(26),
      // A longhand, so the contour texture (a backgroundImage) can come and go without a React clash.
      backgroundColor: block(s(p, isBack ? "backFill" : "frontFill")),
      color: INK,
      padding: 22,
      display: "flex",
      flexDirection: "column",
      gap: isBack ? 10 : 0,
      overflow: "hidden",
      transform: reduced() ? undefined : `perspective(760px) rotateY(${isBack ? a - 180 : a}deg)`,
      opacity: reduced() ? (isBack ? 0.5 - 0.5 * Math.cos((a * Math.PI) / 180) : 0.5 + 0.5 * Math.cos((a * Math.PI) / 180)) : visible ? 1 : 0,
      filter: reduced() ? undefined : `brightness(${1 - turn * 0.16})`,
      boxShadow: `0 1px 2px rgba(0,0,0,${strength * (1 - up * 0.6)}), ${-edge * 18}px ${12 + up * 10}px ${2 * (16 + up * 18)}px rgba(0,0,0,${strength})`,
      pointerEvents: "none",
    };
  };
  // Contour lines as a background image under the face's own fill (the Swift draws ContourLines).
  const textured = (style: CSSProperties): CSSProperties =>
    s(p, "texture") === "contour" ? { ...style, backgroundImage: CONTOUR_BG, backgroundSize: "cover", backgroundPosition: "center" } : style;
  const sheen = (isBack: boolean) => <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: cr("inherit"), background: `rgba(255,255,255,${0.18 * turn * (edge > 0 !== isBack ? 1 : 0.4)})`, mixBlendMode: "soft-light" }} />;

  return (
    <Root r={r} style={{ height, position: "relative", perspective: 900 }}>
      <div
        ref={ref}
        onPointerDown={(e) => {
          e.stopPropagation();
          drag(e);
        }}
        style={{
          position: "absolute",
          inset: 0,
          transform: `rotateX(${reduced() ? 0 : tiltX}deg) rotateY(${reduced() ? 0 : tiltY}deg) scale(${(1 + lift * (reduced() ? 0 : turn)) * (pressed ? 0.97 : 1)})`,
          transition: `transform .3s ${BOUNCE}`,
          touchAction: "pan-y",
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div style={textured(face(false))}>
          {s(p, "frontEyebrow").trim() ? <span style={eyebrowStyle}>{s(p, "frontEyebrow")}</span> : null}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: ts(46), fontWeight: fw(700), letterSpacing: "-1.8px", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s(p, "frontTitle")}</span>
          {s(p, "frontDetail").trim() ? <span style={{ fontSize: ts(15), fontWeight: fw(500), opacity: 0.62, marginTop: 2 }}>{s(p, "frontDetail")}</span> : null}
          {sheen(false)}
        </div>
        <div style={textured(face(true))}>
          {s(p, "backEyebrow").trim() ? <span style={eyebrowStyle}>{s(p, "backEyebrow")}</span> : null}
          <span style={{ fontSize: ts(22), fontWeight: fw(700), letterSpacing: "-0.6px", lineHeight: 1.15 }}>{s(p, "backText")}</span>
          <span style={{ flex: 1 }} />
          {s(p, "backDetail").trim() ? <span style={{ fontSize: ts(15), fontWeight: fw(500), opacity: 0.62 }}>{s(p, "backDetail")}</span> : null}
          {sheen(true)}
        </div>
      </div>
    </Root>
  );
};

// ---------------------------------------------------------------- Depth Carousel

const DepthCarousel: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const titles = uniqueList(p.items, 8, "Page");
  const palette = s(p, "palette");
  const itemWidth = n(p, "itemWidth");
  const height = n(p, "height");
  const spacing = n(p, "spacing");
  const recede = n(p, "recede");
  const stride = itemWidth + spacing;
  const count = titles.length;
  const [ref, width] = useWidth<HTMLDivElement>(342);
  const inset = Math.max((width - itemWidth) / 2, 0);
  const pos = useTween(0); // page progress: 0 is the first page centered
  const [moving, setMoving] = useState(false);
  const start = useRef(0);
  const current = clamp(Math.round(pos.value), 0, count - 1);
  const last = useRef(current);
  useEffect(() => {
    if (last.current !== current) rt.haptic("selection", ref.current);
    last.current = current;
  }, [current, rt, ref]);
  const { set: posSet, current: posNow } = pos;
  useEffect(() => {
    if (posNow.current > count - 1) posSet(Math.max(count - 1, 0));
  }, [count, posSet, posNow]);

  const move = (index: number) => {
    const target = clamp(index, 0, count - 1);
    setMoving(true);
    pos.to(target, 520, springEase, () => setMoving(false));
  };
  const rubber = (x: number) => {
    const max = count - 1;
    if (x < 0) return -(1 - 1 / (1 - x / 2)) * 0.6;
    if (x > max) return max + (1 - 1 / (1 + (x - max) / 2)) * 0.6;
    return x;
  };
  const drag = useDrag({
    axis: "x",
    slop: 6,
    onStart: () => {
      start.current = pos.current.current;
      setMoving(true);
    },
    onMove: ({ dx }) => pos.set(rubber(start.current - dx / stride)),
    onEnd: ({ dx, vx }) => {
      const projected = start.current - (dx + vx * 0.18) / stride;
      // One page per flick at most, like a paging scroll view.
      move(clamp(Math.round(projected), Math.round(start.current) - 1, Math.round(start.current) + 1));
    },
  });
  // Trackpads: a horizontal wheel scrolls, and a pause settles on the nearest page.
  const wheelTimer = useRef(0);
  const onWheel = (e: ReactWheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    pos.set(rubber(pos.current.current + e.deltaX / stride));
    setMoving(true);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => move(Math.round(pos.current.current)), 140);
  };

  const ic = s(p, "icon");
  const progress = pos.value;
  const clamped = clamp(progress, 0, Math.max(count - 1, 0));
  const dot = 7;
  const pill = 22;
  const step = 15;
  const scrub = useDrag({
    slop: 0,
    onStart: ({ x }) => move(Math.round((x - pill / 2) / step)),
    onMove: ({ x }) => {
      const i = clamp(Math.round((x - pill / 2) / step), 0, count - 1);
      if (i !== Math.round(pos.current.current)) move(i);
    },
  });
  const activeInk = houseVar("text");
  const quiet = r.scheme === "dark" ? "#4A4946" : "#C9C7C1";

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <div ref={ref} onPointerDown={drag} onWheel={onWheel} style={{ position: "relative", height, touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none", cursor: moving ? "grabbing" : "grab" }}>
        {titles.map((title, index) => {
          const phase = clamp(index - progress, -1, 1);
          const depth = reduced() ? 0 : Math.abs(phase);
          const x = inset + index * stride - progress * stride;
          if (x > width + stride || x < -stride * 2) return null;
          const centered = index === current;
          const shown = reduced() ? 0 : phase;
          return (
            <div
              key={title}
              onClick={centered ? undefined : () => move(index)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: itemWidth,
                height,
                transform: `translateX(${x}px) scale(${1 - recede * depth})`,
                opacity: 1 - 0.3 * Math.abs(phase),
                zIndex: Math.round((1 - depth) * 10),
                borderRadius: corner(34),
                overflow: "hidden",
                background: block(cardBlock(palette, index)),
                color: INK,
                boxShadow: `${-phase * 10}px ${16 - 8 * depth}px 44px rgba(0,0,0,${0.18 * (r.scheme === "dark" ? 2.4 : 1) * (1 - 0.6 * depth)})`,
                cursor: centered ? undefined : "pointer",
              }}
            >
              <span aria-hidden style={{ position: "absolute", width: Math.round(itemWidth * 0.66), height: Math.round(itemWidth * 0.66), borderRadius: cr("50%"), background: INK, left: Math.round(itemWidth * 0.55) + shown * 40, top: Math.round(height * 0.19) }} />
              <div style={{ position: "absolute", inset: 0, padding: 22, display: "flex", flexDirection: "column", transform: `translateX(${shown * 10}px)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22 }}>
                  {s(p, "eyebrow").trim() ? <span style={eyebrowStyle}>{s(p, "eyebrow")}</span> : <span />}
                  {ic !== "none" ? <Glyph name={ic} size={18} strokeWidth={2.2} /> : null}
                </div>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: ts(40), fontWeight: fw(700), letterSpacing: "-1.6px", lineHeight: 1.02, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", position: "relative" }}>{title}</span>
              </div>
            </div>
          );
        })}
      </div>
      {b(p, "showsIndicator") ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: b(p, "showsCounter") ? "space-between" : "center", width: b(p, "showsCounter") ? Math.min(itemWidth, Math.max(width, itemWidth)) : undefined, alignSelf: "center", height: 44 }}>
          {b(p, "showsCounter") ? (
            <span style={{ fontFamily: ff('ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif'), fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "baseline", gap: 3 }}>
              <span key={current} style={{ fontSize: ts(22), fontWeight: fw(600), color: activeInk, animation: reduced() ? undefined : `spb-motion-rise .3s ${SPRING}` }}>{String(current + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: ts(15), fontWeight: fw(500), color: quiet }}>/ {String(count).padStart(2, "0")}</span>
            </span>
          ) : null}
          <span onPointerDown={(e) => { e.stopPropagation(); scrub(e); }} style={{ position: "relative", display: "flex", alignItems: "center", gap: step - dot, padding: `0 ${(pill - dot) / 2}px`, height: 44, cursor: "pointer", touchAction: "none" }}>
            {titles.map((t) => <span key={t} style={{ width: dot, height: dot, borderRadius: cr(dot / 2), background: quiet, opacity: moving ? 0.6 : 1, transition: "opacity .2s" }} />)}
            <span style={{ position: "absolute", left: 0, top: (44 - dot) / 2, height: dot, width: pill + (moving ? 6 : 0), borderRadius: cr(dot / 2), background: activeInk, transform: `translateX(${clamped * step - (moving ? 3 : 0)}px)`, transition: `width .2s ${SPRING}` }} />
          </span>
        </div>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Timer Dial

const TimerDial: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const tick = useTicker(25);
  const progressMode = s(p, "mode") === "progress";
  const step = Math.max(1, Number(s(p, "step")) || 1);
  const max = Math.max(n(p, "maxSeconds"), step);
  const startSecs = clamp(Math.round(n(p, "seconds") / step) * step, step, max);
  const [seconds, setSeconds] = useLive(startSecs);
  const [running, setRunning] = useState(false);
  const [remainingAtPause, setRemainingAtPause] = useLive<number>(startSecs);
  const startedAt = useRef<number | null>(null);
  const [now, setNow] = useState(0);
  const lastFraction = useRef<number | null>(null);
  const side = n(p, "size");
  const lw = n(p, "lineWidth");
  const fillColor = block(s(p, "fill"));
  const warnAt = n(p, "warningAt");

  // The clock: a frame loop while running, finishing once at zero.
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const loop = () => {
      const t = performance.now();
      setNow(t);
      const elapsed = startedAt.current === null ? 0 : (t - startedAt.current) / 1000;
      if (remainingAtPause - elapsed <= 0) {
        startedAt.current = null;
        setRemainingAtPause(0);
        setRunning(false);
        rt.haptic("success");
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, remainingAtPause, setRemainingAtPause, rt]);
  // A new starting value resets the clock, as `onChange(of: seconds)` does.
  useEffect(() => {
    startedAt.current = null;
    setRunning(false);
  }, [startSecs, p.mode]);

  const remaining = running && startedAt.current !== null ? Math.max(0, remainingAtPause - (now - startedAt.current) / 1000) : remainingAtPause;
  const phase = running ? "running" : remainingAtPause <= 0 ? "finished" : remainingAtPause < seconds ? "paused" : "idle";
  const settable = !progressMode && !running;
  const shown = Math.ceil(remaining - 1e-6);
  const finished = !progressMode && phase === "finished";
  const warning = !progressMode && phase !== "idle" && !finished && shown <= warnAt;
  // Progress mode springs its ring in, the way the Swift animates a new value.
  const ring = useTween(0);
  const { set: ringSet, to: ringTo } = ring;
  const target = progressMode ? clamp(n(p, "progress") / 100, 0, 1) : null;
  useEffect(() => {
    if (target !== null) {
      ringSet(0);
      ringTo(target, 900);
    }
  }, [target, ringSet, ringTo]);
  const fraction = progressMode ? ring.value : finished ? 1 : remaining / max;

  const toggle = (el: Element | null) => {
    if (running) {
      const elapsed = startedAt.current === null ? 0 : (performance.now() - startedAt.current) / 1000;
      setRemainingAtPause(Math.max(0, remainingAtPause - elapsed));
      startedAt.current = null;
      setRunning(false);
    } else {
      if (remainingAtPause <= 0) setRemainingAtPause(seconds);
      startedAt.current = performance.now();
      setNow(performance.now());
      setRunning(true);
    }
    rt.haptic("light", el);
  };

  const set = (value: number, el: Element | null) => {
    const next = clamp(value, step, max);
    if (next === seconds) return;
    tick(next % 5 === 0 ? "rigid" : "selection", el, true);
    setSeconds(next);
    setRemainingAtPause(next);
  };
  const dial = useDrag({
    slop: 0,
    onStart: (info) => {
      lastFraction.current = null;
      onDial(info);
    },
    onMove: (info) => onDial(info),
    onEnd: () => {
      lastFraction.current = null;
    },
  });
  function onDial({ x, y, el }: { x: number; y: number; el: HTMLElement }) {
    if (!settable) return;
    let f = (Math.atan2(y - side / 2, x - side / 2) + Math.PI / 2) / (2 * Math.PI);
    if (f < 0) f += 1;
    const lastF = lastFraction.current;
    if (lastF !== null) {
      if (lastF > 0.7 && f < 0.3) f = 1;
      else if (lastF < 0.3 && f > 0.7) f = 0;
    }
    lastFraction.current = f;
    set(Math.round((f * max) / step) * step, el);
  }

  const c = side / 2;
  const rad = (side - lw) / 2;
  const C = 2 * Math.PI * rad;
  const tickOuter = side / 2 - lw - 8;
  const digit = Math.min(52, side * 0.3);
  const m = Math.floor(shown / 60);
  const ss = shown % 60;
  const parts = progressMode ? { dim: "", main: String(Math.round(fraction * 100)), unit: "%" } : m === 0 ? { dim: "0:", main: String(ss).padStart(2, "0"), unit: "" } : { dim: "", main: `${m}:${String(ss).padStart(2, "0")}`, unit: "" };
  const caption = s(p, "caption").trim() || (progressMode ? "" : { idle: "Ready", running: "Remaining", paused: "Paused", finished: "Done" }[phase]);
  const stroke = warning ? ACCENT : fillColor;
  const knobVisible = !progressMode && !finished && fraction > 0.005;
  const knobD = lw + (settable ? 10 : 4);
  const breathe = warning && running && !reduced();
  const [btnDown, btnBind] = usePressed();

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div
        onPointerDown={(e) => {
          if (!settable) return;
          e.stopPropagation();
          dial(e);
        }}
        style={{ position: "relative", width: side, height: side, touchAction: settable ? "none" : undefined, cursor: settable ? "grab" : undefined, userSelect: "none", WebkitUserSelect: "none" }}
      >
        <svg viewBox={`0 0 ${side} ${side}`} width={side} height={side} style={{ display: "block", overflow: "visible", transformOrigin: "center", animation: breathe ? "spb-motion-breathe 1s ease-in-out infinite" : undefined }} aria-hidden>
          {b(p, "showsTicks")
            ? Array.from({ length: 60 }, (_, i) => {
                const ang = (i / 60) * Math.PI * 2 - Math.PI / 2;
                const major = i % 5 === 0;
                const len = major ? 8 : 4;
                const lit = i / 60 < (finished ? 1 : fraction);
                return <line key={i} x1={c + Math.cos(ang) * tickOuter} y1={c + Math.sin(ang) * tickOuter} x2={c + Math.cos(ang) * (tickOuter - len)} y2={c + Math.sin(ang) * (tickOuter - len)} stroke={houseVar("muted")} strokeOpacity={lit ? 0.75 : 0.25} strokeWidth={major ? 2 : 1.2} strokeLinecap="round" />;
              })
            : null}
          <circle cx={c} cy={c} r={rad} fill="none" stroke={houseVar("raised")} strokeWidth={lw} />
          <circle cx={c} cy={c} r={rad} fill="none" stroke={stroke} strokeWidth={lw} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - clamp(fraction, 0, 1))} transform={`rotate(-90 ${c} ${c})`} style={{ transition: `stroke .5s ease, stroke-dashoffset ${settable && lastFraction.current === null && !progressMode ? `.6s ${SPRING}` : "0s"}` }} />
          <circle cx={c} cy={c} r={rad} fill="none" stroke={B.sage} strokeWidth={lw} style={{ opacity: finished ? 1 : 0, transform: finished || reduced() ? "scale(1)" : "scale(.94)", transformOrigin: "center", transition: `opacity .4s, transform .5s ${BOUNCE}` }} />
          <g style={{ transform: `rotate(${fraction * 360}deg)`, transformOrigin: `${c}px ${c}px`, transition: settable && lastFraction.current === null ? `transform .6s ${SPRING}` : "none" }}>
            <circle cx={c} cy={lw / 2} r={knobD / 2} fill={houseVar("text")} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))", transform: knobVisible ? "scale(1)" : "scale(0)", transformBox: "fill-box", transformOrigin: "center", transition: `transform .35s ${BOUNCE}, r .3s` }} />
          </g>
        </svg>
        <div style={{ position: "absolute", inset: lw + (b(p, "showsTicks") ? 24 : 12), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, pointerEvents: "none" }}>
          <span style={{ fontSize: ts(digit), fontWeight: fw(300), letterSpacing: `${-digit * 0.03}px`, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            <span style={{ color: houseVar("muted"), opacity: 0.6 }}>{parts.dim}</span>
            <span style={{ color: warning ? ACCENT : houseVar("text"), transition: "color .3s" }}>{parts.main}</span>
            <span style={{ color: houseVar("muted"), opacity: 0.6 }}>{parts.unit}</span>
          </span>
          {caption ? <span style={{ fontSize: ts(11), fontWeight: fw(600), letterSpacing: "0.1em", textTransform: "uppercase", color: houseVar("muted"), whiteSpace: "nowrap" }}>{caption}</span> : null}
        </div>
      </div>
      {!progressMode && b(p, "showsButton") ? (
        <button
          type="button"
          {...btnBind}
          onClick={(e) => toggle(e.currentTarget)}
          style={{ all: "unset", boxSizing: "border-box", height: 50, padding: "0 28px", borderRadius: cr(25), background: "var(--ios-accent)", color: "var(--spb-accent-ink, #fff)", fontSize: ts(17), fontWeight: fw(600), display: "flex", alignItems: "center", cursor: "pointer", transform: btnDown ? "scale(0.96)" : "none", transition: `transform .3s ${BOUNCE}` }}
        >
          {running ? "Pause" : "Start"}
        </button>
      ) : null}
    </Root>
  );
};

// ---------------------------------------------------------------- Expanding Track

const fmtNumber = (v: number, step: number) => {
  const places = step > 0 ? Math.min(6, (String(step).split(".")[1] ?? "").length) : 2;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: places, useGrouping: true }).format(v);
};

/** A numeral with its decimals dimmed. */
function Numeral({ text, dim }: { text: string; dim: string }) {
  const i = text.lastIndexOf(".");
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span style={{ color: dim }}>{text.slice(i)}</span></>;
}

const ExpandingTrack: Renderer = (r) => {
  const { p } = r;
  const tick = useTicker(30);
  const lo = Math.min(n(p, "min"), n(p, "max") - 1);
  const hi = Math.max(n(p, "max"), lo + 1);
  const span = hi - lo;
  const step = n(p, "step");
  const detent = step > 0 ? step : span / 10;
  const isRange = s(p, "mode") === "range";
  const [upper, setUpper] = useLive(clamp(isRange ? Math.max(n(p, "lower"), n(p, "value")) : n(p, "value"), lo, hi));
  const [lower, setLower] = useLive(clamp(isRange ? Math.min(n(p, "lower"), n(p, "value")) : lo, lo, hi));
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState<"lower" | "upper">("upper");
  const activeRef = useRef<"lower" | "upper">("upper");
  const [overshoot, setOvershoot] = useState(0);
  const [ref, width] = useWidth<HTMLDivElement>(300);
  const title = s(p, "title").trim();
  const sym = s(p, "symbol");
  const fill = block(s(p, "fill"));
  const thick = dragging && !reduced();
  const h = thick ? 32 : 8;
  const frac = (v: number) => clamp((v - lo) / span, 0, 1);
  const lowerX = isRange ? frac(lower) * width : 0;
  const upperX = frac(upper) * width;
  const squish = 22;

  const snap = (raw: number) => (step > 0 ? lo + Math.round((raw - lo) / step) * step : raw);
  const setValue = (handle: "lower" | "upper", raw: number, el: Element) => {
    let next = clamp(snap(raw), lo, hi);
    const prev = handle === "lower" ? lower : upper;
    if (isRange) next = handle === "lower" ? Math.min(next, upper) : Math.max(next, lower);
    if (next === prev) return;
    const edge = (next === lo || next === hi) && prev !== next;
    if (edge) tick("rigid", el, true);
    else if (Math.floor((next - lo) / detent + 1e-9) !== Math.floor((prev - lo) / detent + 1e-9)) tick("selection", el);
    if (handle === "lower") setLower(next);
    else setUpper(next);
  };
  const drag = useDrag({
    slop: 0,
    onStart: ({ x, el }) => {
      setDragging(true);
      const handle = isRange && (Math.abs(x - lowerX) < Math.abs(x - upperX) || (lowerX === upperX && x < lowerX)) ? "lower" : "upper";
      setActive(handle);
      activeRef.current = handle;
      setValue(handle, lo + clamp(x / width, 0, 1) * span, el);
    },
    onMove: ({ x, el }) => {
      setValue(activeRef.current, lo + clamp(x / width, 0, 1) * span, el);
      const past = x > width ? x - width : x < 0 ? x : 0;
      setOvershoot((squish * past) / (Math.abs(past) + squish));
    },
    onEnd: () => {
      setDragging(false);
      setOvershoot(0);
    },
  });

  const shownValue = active === "lower" ? lower : upper;
  const count = Math.round(span / detent);
  const dots = (color: string) =>
    count > 1 && width / count >= 8 ? (
      <span aria-hidden style={{ position: "absolute", inset: 0, opacity: thick ? 1 : 0, transition: "opacity .25s" }}>
        {Array.from({ length: count - 1 }, (_, i) => <span key={i} style={{ position: "absolute", left: `${((i + 1) / count) * 100}%`, top: "50%", width: 3, height: 3, marginLeft: -1.5, marginTop: -1.5, borderRadius: cr(1.5), background: color }} />)}
      </span>
    ) : null;
  const readout = (color: string) => (
    <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 12px", fontSize: ts(13), fontWeight: fw(600), fontFamily: ff('ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif'), fontVariantNumeric: "tabular-nums", color, opacity: thick && !title ? 1 : 0, transition: "opacity .2s" }}>{fmtNumber(shownValue, step)}</span>
  );
  const quiet = "rgba(127,127,127,.22)";

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 6, color: houseVar("text") }}>
      {title ? (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: ts(11), fontWeight: fw(600), letterSpacing: "0.09em", textTransform: "uppercase", color: houseVar("muted"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          <span style={{ fontSize: ts(40), fontWeight: fw(300), letterSpacing: "-0.5px", lineHeight: 1.05, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {isRange ? (
              <>
                <Numeral text={fmtNumber(lower, step)} dim={houseVar("muted")} />
                <span style={{ color: houseVar("muted") }}>{"  –  "}</span>
                <Numeral text={fmtNumber(upper, step)} dim={houseVar("muted")} />
              </>
            ) : (
              <Numeral text={fmtNumber(upper, step)} dim={houseVar("muted")} />
            )}
          </span>
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, height: 44 }}>
        {sym !== "none" ? <span style={{ width: 24, display: "flex", justifyContent: "center", color: dragging ? houseVar("text") : houseVar("muted"), transition: "color .2s" }}><Glyph name={sym} size={19} strokeWidth={2.2} /></span> : null}
        <div ref={ref} onPointerDown={(e) => { e.stopPropagation(); drag(e); }} style={{ flex: 1, height: 44, display: "flex", alignItems: "center", touchAction: "pan-y", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: h,
              borderRadius: cr(Math.min(h / 2, 12)),
              overflow: "hidden",
              background: r.scheme === "dark" ? "#2A2A2A" : "#E6E4DE",
              boxShadow: thick ? "0 4px 20px rgba(0,0,0,.12)" : "none",
              transform: `scaleX(${1 - Math.min(Math.abs(overshoot), squish) / Math.max(width, 1)})`,
              transformOrigin: overshoot > 0 ? "left" : "right",
              transition: `height .35s ${BOUNCE}, border-radius .35s ${BOUNCE}, box-shadow .3s, transform ${overshoot ? "0s" : `.45s ${BOUNCE}`}`,
            }}
          >
            {dots(quiet)}
            {readout(houseVar("text"))}
            <span style={{ position: "absolute", top: 0, bottom: 0, left: lowerX, width: Math.max(upperX - lowerX, 0), background: fill }} />
            <span aria-hidden style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${width - upperX}px 0 ${lowerX}px)` }}>
              {dots("rgba(20,20,20,.35)")}
              {readout(INK)}
            </span>
            {isRange
              ? (["lower", "upper"] as const).map((k) => {
                  const sunk = dragging && active === k;
                  const at = k === "lower" ? lowerX + 7 : upperX - 7;
                  return <span key={k} style={{ position: "absolute", left: at - 1.5, top: "50%", width: 3, height: Math.max(h * 0.5, 4), borderRadius: cr(2), background: INK, opacity: sunk ? 0.4 : 0.85, transform: `translateY(-50%) scale(${sunk ? 0.5 : 1})`, transition: `transform .2s, opacity .2s, height .35s ${BOUNCE}` }} />;
                })
              : null}
          </div>
        </div>
      </div>
    </Root>
  );
};

// ---------------------------------------------------------------- Range Slider

const RangeSlider: Renderer = (r) => {
  const { p } = r;
  const tick = useTicker(30);
  const lo = Math.min(n(p, "min"), n(p, "max") - 1);
  const hi = Math.max(n(p, "max"), lo + 1);
  const span = hi - lo;
  const step = n(p, "step");
  const gap = Math.min(n(p, "gap"), span);
  const places = step > 0 ? Math.min(6, (String(step).split(".")[1] ?? "").length) : 2;
  const round = (v: number) => Math.round(v * 10 ** places) / 10 ** places;
  const [lower, setLower] = useLive(clamp(Math.min(n(p, "lower"), n(p, "upper")), lo, hi));
  const [upper, setUpper] = useLive(clamp(Math.max(n(p, "lower"), n(p, "upper")), lo, hi));
  const [active, setActive] = useState<"lower" | "upper" | null>(null);
  const activeRef = useRef<"lower" | "upper" | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>(342);
  const thumb = 28;
  const target = 44;
  const radius = thumb / 2;
  const usable = Math.max(width - thumb, 1);
  const xFor = (v: number) => radius + clamp((v - lo) / span, 0, 1) * usable;
  const valueAt = (x: number) => {
    const raw = lo + clamp((x - radius) / usable, 0, 1) * span;
    if (step <= 0) return raw;
    const snapped = lo + Math.round((raw - lo) / step) * step;
    return round(snapped > hi ? hi : snapped);
  };
  const currency = s(p, "format") === "currency";
  const format = (v: number) => (currency ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v) : new Intl.NumberFormat("en-US", { maximumFractionDigits: places }).format(v));
  const fill = block(s(p, "fill"));

  const move = (which: "lower" | "upper", x: number, el: Element) => {
    const v = valueAt(x);
    const next = which === "lower" ? clamp(v, lo, upper - gap) : clamp(v, lower + gap, hi);
    const prev = which === "lower" ? lower : upper;
    if (next === prev) return;
    const stop = next === lo || next === hi || (which === "lower" ? next === upper - gap : next === lower + gap);
    // A selection tick per step, and a firmer impact against a bound or the other thumb.
    tick(stop ? "rigid" : "selection", el, stop);
    if (which === "lower") setLower(next);
    else setUpper(next);
  };
  const drag = useDrag({
    slop: 0,
    onStart: ({ x, el }) => {
      const lx = xFor(lower);
      const ux = xFor(upper);
      const which = Math.abs(x - lx) === Math.abs(x - ux) ? (x < lx ? "lower" : "upper") : Math.abs(x - lx) < Math.abs(x - ux) ? "lower" : "upper";
      setActive(which);
      activeRef.current = which;
      // Touching the track away from a thumb pulls the nearest one over.
      if (Math.abs(x - (which === "lower" ? lx : ux)) > target / 2) move(which, x, el);
    },
    onMove: ({ x, el }) => {
      if (activeRef.current) move(activeRef.current, x, el);
    },
    onEnd: () => {
      activeRef.current = null;
      setActive(null);
    },
  });

  const lx = xFor(lower);
  const ux = xFor(upper);
  const chipW = (t: string) => 20 + t.length * 7.4;
  const place = (x: number, w: number) => (width > w ? clamp(x, w / 2, width - w / 2) : width / 2);
  const lt = format(lower);
  const ut = format(upper);
  const lw = chipW(lt);
  const uw = chipW(ut);
  const merged = place(lx, lw) + lw / 2 + 6 > place(ux, uw) - uw / 2;
  const mt = `${lt} – ${ut}`;
  const mw = chipW(mt);
  const chip = (text: string, x: number, w: number, lit: boolean, shown: boolean) => (
    <span style={{ position: "absolute", top: 0, left: place(x, w) - w / 2, width: w, height: 26, borderRadius: cr(13), display: "flex", alignItems: "center", justifyContent: "center", fontSize: ts(13), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", background: lit ? fill : houseVar("field"), color: lit ? INK : houseVar("text"), opacity: shown ? 1 : 0, transition: "background-color .2s, color .2s, opacity .18s" }}>{text}</span>
  );
  const thumbEl = (which: "lower" | "upper", x: number) => {
    const grabbed = active === which;
    return (
      <span
        key={which}
        style={{
          position: "absolute",
          left: x - radius,
          top: (target - thumb) / 2,
          width: thumb,
          height: thumb,
          borderRadius: cr(radius),
          background: r.scheme === "dark" ? "#F4F3EF" : "#FFFFFF",
          boxShadow: `inset 0 0 0 ${grabbed ? 3 : 2}px ${INK}, 0 ${grabbed ? 3 : 1}px ${grabbed ? 12 : 6}px rgba(0,0,0,${grabbed ? 0.22 : 0.12})`,
          transform: `scale(${grabbed && !reduced() ? 1.18 : 1})`,
          transition: `transform .3s ${BOUNCE}, box-shadow .2s`,
          zIndex: grabbed ? 2 : 1,
        }}
      />
    );
  };

  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", gap: 10, color: houseVar("text") }}>
      {s(p, "readout") === "header" ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: ts(20), fontWeight: fw(600), lineHeight: "25px", fontVariantNumeric: "tabular-nums" }}>
          <span>{lt}</span>
          <span style={{ color: houseVar("muted") }}>–</span>
          <span>{ut}</span>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {s(p, "readout") === "thumbs" ? (
          <div style={{ position: "relative", height: 26 }}>
            {chip(lt, lx, lw, active === "lower", !merged)}
            {chip(ut, ux, uw, active === "upper", !merged)}
            {chip(mt, (lx + ux) / 2, mw, active !== null, merged)}
          </div>
        ) : null}
        <div ref={ref} onPointerDown={(e) => { e.stopPropagation(); drag(e); }} style={{ position: "relative", height: target, touchAction: "pan-y", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: (target - 8) / 2, height: 8, borderRadius: cr(4), overflow: "hidden", background: r.scheme === "dark" ? "#2A2A2A" : "#E6E4DE" }}>
            <span style={{ position: "absolute", top: 0, bottom: 0, left: lx, width: Math.max(ux - lx, 0), background: fill }} />
          </div>
          {thumbEl("lower", lx)}
          {thumbEl("upper", ux)}
        </div>
      </div>
    </Root>
  );
};

// ---------------------------------------------------------------- Fan Stack

const FACE_COLORS = [ACCENT, B.sky, B.butter, B.sage, B.lilac, B.sand];
/** FNV-1a over the name's UTF-8 bytes, as the Swift picks a stable block per person. */
function faceColor(name: string): string {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(name)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return FACE_COLORS[hash % FACE_COLORS.length];
}

const FanStack: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const names = list(p.names, 12);
  const people = names.length ? names : ["Guest"];
  const size = n(p, "size");
  const maxVisible = Math.max(1, n(p, "max"));
  const overlap = clamp(n(p, "overlap"), 0, 1);
  const [fanned, setFannedState] = useState(false);
  const [hovered, setHoveredState] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const setHovered = (i: number | null) => {
    hoveredRef.current = i;
    setHoveredState(i);
  };
  const longPressed = useRef(false);
  const timer = useRef(0);
  const touching = useRef(false);
  const gapPt = 12;
  const tagRoom = 34;
  const captionRoom = 24;
  const visibleCount = Math.min(people.length, maxVisible);
  const overflow = people.length - visibleCount;
  const collapsedStep = size * (1 - overlap);
  const fannedStep = size + gapPt;
  const width = fanned ? (people.length - 1) * fannedStep + size : (visibleCount - (overflow > 0 ? 0 : 1)) * collapsedStep + size;
  const xPos = (i: number) => (fanned ? i * fannedStep : Math.min(i, visibleCount) * collapsedStep);
  const delay = (i: number) => (reduced() ? 0 : (fanned ? i : people.length - 1 - i) * 35);
  const setFanned = (v: boolean, el: Element | null) => {
    if (v !== fanned) rt.haptic("soft", el);
    setFannedState(v);
    if (!v) setHovered(null);
  };
  const indexAt = (x: number, y: number) => {
    if (y < -tagRoom || y > size + captionRoom + 12) return null;
    const i = Math.floor(x / fannedStep);
    if (i < 0 || i >= people.length) return null;
    return x - i * fannedStep <= size + gapPt / 2 ? i : null;
  };
  const fannedRef = useRef(fanned);
  fannedRef.current = fanned;
  const drag = useDrag({
    slop: 0,
    onStart: ({ el }) => {
      touching.current = true;
      longPressed.current = false;
      if (!fannedRef.current) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          if (!touching.current) return;
          longPressed.current = true;
          setFanned(true, el);
        }, 300);
      }
    },
    onMove: ({ x, y, el }) => {
      if (!fannedRef.current) return;
      const hit = indexAt(x, y);
      if (hit !== hoveredRef.current) {
        setHovered(hit);
        if (hit !== null) rt.haptic("selection", el);
      }
    },
    onEnd: ({ el }) => {
      window.clearTimeout(timer.current);
      touching.current = false;
      if (fannedRef.current) {
        const picked = hoveredRef.current;
        if (picked !== null) {
          rt.haptic("medium", el);
          setFanned(false, el);
        } else if (!longPressed.current) setFanned(false, el);
      } else if (!longPressed.current) setFanned(true, el);
      setHovered(null);
    },
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const ring = houseVar("surface");

  return (
    <Root r={r} style={{ width: "fit-content" }}>
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          drag(e);
        }}
        style={{ position: "relative", width, height: size + (fanned ? captionRoom : 0), transition: `width .45s ${BOUNCE}, height .45s ${BOUNCE}`, touchAction: "none", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }}
      >
        {people.map((name, i) => {
          const hidden = !fanned && i >= visibleCount;
          const lifted = fanned && hovered === i;
          const scale = hidden ? 0.6 : lifted && !reduced() ? 1.18 : 1;
          return (
            <div key={`${name}-${i}`} style={{ position: "absolute", top: 0, left: 0, transform: `translateX(${xPos(i)}px)`, zIndex: lifted ? people.length + 1 : people.length - i, transition: `transform .45s ${BOUNCE} ${delay(i)}ms` }}>
              <span
                style={{
                  width: size,
                  height: size,
                  borderRadius: cr("50%"),
                  display: "grid",
                  placeItems: "center",
                  background: faceColor(name),
                  color: inkOn(faceColor(name), INK),
                  fontSize: ts(size * 0.38),
                  fontWeight: fw(700),
                  fontFamily: ff('ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif'),
                  boxShadow: `0 0 0 3px ${ring}${lifted ? ", 0 6px 20px rgba(0,0,0,.22)" : ""}`,
                  transform: `translateY(${lifted && !reduced() ? -4 : 0}px) scale(${scale})`,
                  opacity: hidden ? 0 : 1,
                  transition: `transform .3s ${BOUNCE} ${hovered !== null ? 0 : delay(i)}ms, opacity .3s ${delay(i)}ms, box-shadow .25s`,
                }}
              >
                {initials(name)}
              </span>
              <span style={{ position: "absolute", top: size + 8, left: size / 2 - fannedStep / 2, width: fannedStep, textAlign: "center", fontSize: ts(12), fontWeight: fw(lifted ? 700 : 500), color: lifted ? houseVar("text") : houseVar("muted"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: fanned ? 1 : 0, transition: "opacity .3s" }}>{name.split(" ")[0]}</span>
              <span style={{ position: "absolute", bottom: size + 8, left: size / 2, height: 26, padding: "0 10px", borderRadius: cr(13), display: "flex", alignItems: "center", whiteSpace: "nowrap", background: houseVar("text"), color: houseVar("ground"), fontSize: ts(13), fontWeight: fw(600), transform: `translateX(-50%) scale(${lifted ? 1 : 0.6})`, transformOrigin: "50% 100%", opacity: lifted ? 1 : 0, transition: `transform .28s ${BOUNCE}, opacity .18s`, pointerEvents: "none" }}>{name}</span>
            </div>
          );
        })}
        {overflow > 0 ? (
          <span
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: cr("50%"),
              display: "grid",
              placeItems: "center",
              background: houseVar("raised"),
              color: houseVar("text"),
              fontSize: ts(size * 0.36),
              fontWeight: fw(700),
              fontFamily: ff('ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif'),
              fontVariantNumeric: "tabular-nums",
              boxShadow: `0 0 0 3px ${ring}`,
              transform: `translateX(${fanned ? xPos(visibleCount) : visibleCount * collapsedStep}px) scale(${fanned ? 0.6 : 1})`,
              opacity: fanned ? 0 : 1,
              zIndex: 0,
              transition: `transform .45s ${BOUNCE} ${delay(visibleCount)}ms, opacity .3s ${delay(visibleCount)}ms`,
            }}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    </Root>
  );
};

// ---------------------------------------------------------------- Parallax Card

const ParallaxCard: Renderer = (r) => {
  const { p } = r;
  // The Swift card is a Button with a lift style and no haptic of its own; a link still navigates.
  const tap = useTap(p.link, null);
  const height = n(p, "height");
  const travel = reduced() ? 0 : height * n(p, "parallax");
  const [progress, setProgress] = useState(0);
  const [hover, setHover] = useState(0);
  const [down, bind] = usePressed();
  const ref = useRef<HTMLDivElement>(null);
  // Position in the scroll viewport, -1 entering at the bottom to 1 leaving at the top.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = el.closest<HTMLElement>(".spb-screen-scroll") ?? el.parentElement;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (!scroller) return;
      const card = el.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      const k = el.offsetHeight ? card.height / el.offsetHeight : 1; // the phone's scale
      const mid = (card.top + card.height / 2 - view.top) / k;
      const vh = view.height / k;
      setProgress(clamp((mid - vh / 2) / Math.max((vh + height) / 2, 1), -1, 1));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    scroller?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      scroller?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [height]);
  // A pointer over the card peeks the same layers, so the depth reads without scrolling.
  const drift = clamp(progress + hover, -1, 1);
  const block2 = s(p, "caption") === "block";
  const captionFill = block(s(p, "captionFill"));
  const sky = block(s(p, "sky"));
  const sun = s(p, "sky") === "tangerine" ? B.butter : ACCENT;
  const shadow = Math.min(0.12 * (r.scheme === "dark" ? 3 : 1), 1);
  const lifted = down && !reduced();
  const meta = list(p.metadata, 4);
  const sym = s(p, "trailingSymbol");
  const radius = 26;
  const ink = block2 ? INK : "#fff";

  return (
    <Root r={r}>
      <div
        ref={ref}
        {...bind}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(((e.clientY - rect.top) / rect.height - 0.5) * 0.8);
        }}
        onPointerLeave={() => {
          bind.onPointerLeave();
          setHover(0);
        }}
        onClick={(e) => tap(e)}
        style={{
          position: "relative",
          height,
          borderRadius: corner(radius),
          overflow: "hidden",
          transform: `scale(${lifted ? 1.02 : 1})`,
          boxShadow: `0 ${lifted ? 16 : 10}px ${lifted ? 52 : 32}px rgba(0,0,0,${lifted ? Math.min(shadow * 1.8, 1) : shadow})`,
          transition: lifted ? "transform .15s ease-out, box-shadow .15s" : `transform .4s ${BOUNCE}, box-shadow .4s`,
          cursor: "pointer",
          touchAction: "manipulation",
          userSelect: "none",
          WebkitUserSelect: "none",
          isolation: "isolate",
        }}
      >
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: -travel, height: height + travel * 2, transform: `translateY(${-drift * travel}px)`, transition: hover ? "transform .5s cubic-bezier(.2,.8,.2,1)" : undefined, background: sky }}>
          <svg viewBox="0 0 400 340" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: "block" }}>
            <rect width="400" height="340" fill={sky} />
            <circle cx="291" cy="105" r="95" fill={sun} />
            <text x="-8" y="24" dominantBaseline="hanging" fontSize={ts(128)} fontWeight={fw(900)} fill={INK} style={{ fontFamily: ff("-apple-system, system-ui, sans-serif") }}>{s(p, "word").toUpperCase()}</text>
          </svg>
        </div>
        {!block2 ? <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.6, background: "linear-gradient(transparent, rgba(0,0,0,.72))", transformOrigin: "bottom", transform: `scaleY(${reduced() ? 1 : 1.3 - 0.4 * Math.abs(drift)})` }} /> : null}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: block2 ? 10 : 0, transform: `translateY(${(-drift * travel) / 3}px)`, transition: hover ? "transform .5s cubic-bezier(.2,.8,.2,1)" : undefined }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: block2 ? 16 : 20, borderRadius: block2 ? `calc(${Math.max(radius - 10, 12)}px * var(--spb-corner, 1))` : 0, background: block2 ? captionFill : undefined, color: ink }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {s(p, "eyebrow").trim() ? <span style={{ ...eyebrowStyle, fontSize: ts(11), letterSpacing: "0.09em", opacity: block2 ? 0.62 : 0.8 }}>{s(p, "eyebrow")}</span> : null}
              <span style={{ fontSize: ts(22), fontWeight: fw(700), letterSpacing: "-0.6px", lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s(p, "title")}</span>
              {meta.length ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ts(15), fontWeight: fw(500), opacity: block2 ? 0.62 : 0.85, whiteSpace: "nowrap", overflow: "hidden" }}>
                  {meta.map((m, i) => (
                    <span key={i} style={{ display: "contents" }}>
                      {i > 0 ? <span style={{ width: 3, height: 3, borderRadius: cr(1.5), background: "currentColor", opacity: 0.6, flex: "none" }} /> : null}
                      <span>{m}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            {sym !== "none" ? (
              <span style={{ width: 44, height: 44, borderRadius: cr(22), flex: "none", display: "grid", placeItems: "center", background: block2 ? INK : "#fff", color: block2 ? captionFill : "#000" }}>
                <span style={{ display: "grid", transform: lifted ? "translate(2px, -2px)" : "none", transition: `transform .3s ${BOUNCE}` }}>
                  <Glyph name={sym} size={17} strokeWidth={2.6} />
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Root>
  );
};

export const motionPieceRenderers: Record<string, Renderer> = {
  "swipe-deck": SwipeDeck,
  "swipe-action-row": SwipeActionRow,
  "flip-card": FlipCard,
  "depth-carousel": DepthCarousel,
  "timer-dial": TimerDial,
  "expanding-track": ExpandingTrack,
  "range-slider": RangeSlider,
  "fan-stack": FanStack,
  "parallax-card": ParallaxCard,
};
