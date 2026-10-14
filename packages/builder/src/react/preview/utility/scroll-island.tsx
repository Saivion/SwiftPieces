"use client";
// Scroll Island in the Playground: the sample page scrolls under a floating glass island that names the section in
// view and rings how much is read, as the generated screen does. Scroll the page and the title follows; past the first
// section a back-to-top bubble buds out joined to the island. Tap the island (or press Return when it is focused) and
// it grows in place into the contents: press a row, or slide over the rows, and the red puck follows with a selection
// tick per row; let go and the page jumps there as the panel melts back into the pill. Drag the closed island sideways
// to step through sections with rubber band at the ends, or swipe it up to open. Mirrors ScrollIsland.swift.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { islandSections, islandStartIndex, ISLAND_DEFAULTS } from "../../../definitions/utility/scroll-island.js";
import { glassSurface } from "../glass.js";
import { ACCENT, ACCENT_INK, b, cr, fillStyle, fw, houseVar, n, s, ts, useAxis, type Renderer } from "../env.js";
import { useLive, useRuntime } from "../runtime.js";

/** The piece's metrics in points. */
const BAR = 48, RING = 26, STROKE = 2.5, ROW = 44, INSET = 6, GAP = 2, MARGIN = 16, BOTTOM = 8, JOINED = 4, STEP = 32, SLOP = 8;
const OPEN = "cubic-bezier(.32,.72,0,1)";
const CLOSE = "cubic-bezier(.3,0,.1,1)";
const SPRING = "cubic-bezier(.34,1.35,.64,1)";
const KEYFRAMES = [
  ".spsi-scroll::-webkit-scrollbar{display:none}",
  "@media (prefers-reduced-motion: reduce){[data-spsi-motion]{transition-duration:.01ms!important;animation:none!important}}",
].join("");

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** A scroll view's edge resistance, as PieceMotion.rubberBand. */
const rubber = (over: number, limit: number) => (over === 0 ? 0 : Math.sign(over) * (1 - 1 / ((Math.abs(over) * 0.55) / limit + 1)) * limit);

type Gesture = { mode: "undecided" | "scrub" | "opening" | "pick" | "pass"; x0: number; y0: number; origin: number; startY: number };

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const still = rt.still === true;
  const animate = !still && !reduced;
  const sections = useMemo(() => islandSections(p), [p.sections, p.content]);
  const count = sections.length;
  const details = b(p, "details");
  const fromScroll = s(p, "progress") !== "estimate";
  const showsTop = b(p, "showsTopButton");
  const contents = s(p, "contents").trim() || ISLAND_DEFAULTS.contents;
  const height = Math.max(240, n(p, "height") || 560);
  const maxWidth = Math.max(200, n(p, "maxWidth") || ISLAND_DEFAULTS.maxWidth);
  const start = islandStartIndex(p, count);

  const [current, setCurrent] = useState(start);
  const [open, setOpen] = useLive(b(p, "open") && count > 1);
  const [candidate, setCandidate] = useState<number | null>(null);
  const [read, setRead] = useState(0);
  const [pull, setPull] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [width, setWidth] = useState(0);
  const [barW, setBarW] = useState<number[]>([]);
  const box = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const measure = useRef<HTMLDivElement | null>(null);
  const sectionEls = useRef<Array<HTMLDivElement | null>>([]);
  const gesture = useRef<Gesture | null>(null);
  /** While the page glides to a pick, the island holds the pick instead of reading every section it passes. */
  const jumping = useRef<{ to: number; timer?: ReturnType<typeof setTimeout> } | null>(null);

  // The box's width, for the panel; the closed bar's natural width for each section, for the hug.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    setBarW(Array.from(el.children).map((c) => (c as HTMLElement).offsetWidth));
  }, [sections, p.contents]);

  // Opens where the screen starts: at the top, or partway down.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    sc.scrollTop = start > 0 ? Math.max((sectionEls.current[start]?.offsetTop ?? 0) - 20, 0) : 0;
    setCurrent(start);
    onScroll();
  }, [start, count]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The page scrolled: the section at the top, and how far through it is. */
  const onScroll = () => {
    const sc = scroller.current;
    if (!sc) return;
    const travel = sc.scrollHeight - sc.clientHeight;
    const top = sc.scrollTop + 24;
    let at = 0;
    sectionEls.current.forEach((el, i) => { if (el && el.offsetTop <= top) at = i; });
    const j = jumping.current;
    if (j) {
      clearTimeout(j.timer);
      j.timer = setTimeout(() => { jumping.current = null; onScroll(); }, 140);
      at = j.to;
    }
    setCurrent(at);
    setRead(fromScroll ? (travel > 0 ? Math.min(Math.max(sc.scrollTop / travel, 0), 1) : 1) : (at + 0.5) / Math.max(count, 1));
  };
  useEffect(() => { if (!fromScroll) setRead((current + 0.5) / Math.max(count, 1)); }, [fromScroll, current, count]);

  /** Writes the pick: the page scrolls there, as the generated screen's `scrollPosition(id:)` does. */
  const commit = (i: number) => {
    const sc = scroller.current;
    const target = Math.min(Math.max(i, 0), count - 1);
    setCurrent(target);
    if (!sc) return;
    jumping.current = { to: target };
    const top = target === 0 ? 0 : Math.max((sectionEls.current[target]?.offsetTop ?? 0) - 20, 0);
    sc.scrollTo({ top, behavior: animate ? "smooth" : "auto" });
    jumping.current.timer = setTimeout(() => { jumping.current = null; onScroll(); }, 900);
  };

  const shown = Math.min(Math.max(candidate ?? current, 0), Math.max(count - 1, 0));
  const isOpen = open && count > 1;
  const topOut = showsTop && count > 1 && current > 0 && !isOpen;
  const panelW = Math.max(Math.min((width || 360) - MARGIN * 2, maxWidth), BAR * 3);
  const rowsH = count * ROW;
  const viewport = Math.min(rowsH, Math.max(height * 0.6 - BAR - INSET - GAP, ROW * 2.5));
  const panelH = BAR + INSET + viewport + GAP;
  const room = topOut ? BAR + JOINED : 0;
  const hug = Math.min(Math.ceil((barW[shown] ?? 200) + 1), panelW - room);
  const islandW = isOpen ? panelW : hug;
  const islandH = isOpen ? panelH : BAR;
  const puck = Math.min(Math.max(candidate ?? current, 0), count - 1);
  const motion = (open: boolean) => (animate ? `${open ? 500 : 320}ms ${open ? OPEN : CLOSE}${open ? "" : " 80ms"}` : "0ms");

  // Bring the puck into view when the contents open and scroll.
  useEffect(() => {
    const el = rowsRef.current;
    if (!isOpen || !el || viewport >= rowsH) return;
    el.scrollTop = Math.max(puck * ROW - viewport / 2 + ROW / 2, 0);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOpenTo = (next: boolean, el: Element | null) => {
    if (next === isOpen || (next && count < 2)) return;
    setOpen(next);
    setCandidate(null);
    rt.haptic("light", el);
  };
  const aim = (i: number | null, el: Element | null) => {
    if (i !== null && i !== puck) rt.haptic("selection", el);
    setCandidate(i);
  };
  const pick = (i: number, el: Element | null) => {
    if (i !== current) commit(i);
    setCandidate(null);
    setOpen(false);
    rt.haptic("light", el);
  };
  /** The row under a client point, or null outside the rows. */
  const rowAt = (cx: number, cy: number): number | null => {
    const el = rowsRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const k = rect.height / (el.clientHeight || 1);
    if (cx < rect.left - 24 || cx > rect.right + 24 || cy < rect.top - 24 || cy > rect.bottom + 4) return null;
    return Math.min(Math.max(Math.floor(((cy - rect.top) / k + el.scrollTop) / ROW), 0), count - 1);
  };

  // The bar: tap toggles, sideways scrubs while closed, up opens and a finger that carries on onto a row picks it.
  const onBarDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || count < 2) return;
    gesture.current = { mode: "undecided", x0: e.clientX, y0: e.clientY, origin: current, startY: e.clientY };
    setPressed(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onBarMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const k = rt.scale() || 1;
    const dx = (e.clientX - g.x0) / k, dy = (e.clientY - g.y0) / k;
    if (g.mode === "undecided") {
      if (Math.hypot(dx, dy) < SLOP) return;
      setPressed(false);
      if (!isOpen && Math.abs(dx) > Math.abs(dy)) g.mode = "scrub";
      else if (dy < 0) {
        if (!isOpen) setOpenTo(true, e.currentTarget);
        g.mode = viewport < rowsH ? "pass" : "opening";
      } else g.mode = "pass";
    }
    if (g.mode === "scrub") {
      const raw = g.origin + dx / STEP;
      const held = Math.min(Math.max(raw, 0), count - 1);
      aim(Math.round(held), e.currentTarget);
      setPull(animate ? rubber((raw - held) * STEP, 14) : 0);
    } else if (g.mode === "opening") {
      const row = rowAt(e.clientX, e.clientY);
      if (row !== null && (row !== current || Math.abs(e.clientY - g.startY) / k > ROW * 0.75)) { g.mode = "pick"; aim(row, e.currentTarget); }
    } else if (g.mode === "pick") aim(rowAt(e.clientX, e.clientY), e.currentTarget);
  };
  const onBarUp = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setPressed(false);
    if (!g) return;
    if (cancelled) { setCandidate(null); setPull(0); return; }
    if (g.mode === "undecided") setOpenTo(!isOpen, e.currentTarget);
    else if (g.mode === "scrub") {
      const to = candidate ?? current;
      if (to !== current) commit(to);
      setCandidate(null);
      setPull(0);
    } else if (g.mode === "pick" && candidate !== null) pick(candidate, e.currentTarget);
  };

  // The rows, when they all fit: the puck goes to the row under the finger and follows it; let go to pick.
  const rowsSlide = viewport >= rowsH;
  const onRowsDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !isOpen) return;
    if (!rowsSlide) return;
    gesture.current = { mode: "pick", x0: e.clientX, y0: e.clientY, origin: current, startY: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    aim(rowAt(e.clientX, e.clientY), e.currentTarget);
  };
  const onRowsMove = (e: PointerEvent<HTMLDivElement>) => { if (gesture.current?.mode === "pick") aim(rowAt(e.clientX, e.clientY), e.currentTarget); };
  const onRowsUp = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (gesture.current?.mode !== "pick") return;
    gesture.current = null;
    const row = cancelled ? null : rowAt(e.clientX, e.clientY);
    if (row !== null) pick(row, e.currentTarget); else setCandidate(null);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    const el = e.currentTarget;
    if (isOpen) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); aim(Math.min(Math.max(puck + (e.key === "ArrowDown" ? 1 : -1), 0), count - 1), el); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(puck, el); }
      else if (e.key === "Escape") { e.preventDefault(); setOpenTo(false, el); }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = Math.min(Math.max(current + (e.key === "ArrowRight" ? 1 : -1), 0), count - 1);
      if (next !== current) { rt.haptic("selection", el); commit(next); }
    } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowUp") { e.preventDefault(); setOpenTo(true, el); }
  };

  const look = glassSurface(r.scheme);
  const percent = `${Math.round(read * 100)}% read`;
  const position = (i: number) => `${i + 1} of ${count}`;
  const fade = (on: boolean): CSSProperties => ({
    opacity: on ? 1 : 0, filter: animate ? `blur(${on ? 0 : 5}px)` : undefined,
    transition: animate ? (on ? "opacity .24s ease-out .2s, filter .24s ease-out .2s" : "opacity .12s ease-out, filter .12s ease-out") : undefined,
  });
  const ringR = (RING - STROKE) / 2, ringC = 2 * Math.PI * ringR;
  const label: CSSProperties = { fontSize: ts(17), fontWeight: fw(600), whiteSpace: "nowrap", lineHeight: 1 };
  const meta: CSSProperties = { fontSize: ts(13), fontWeight: fw(600), whiteSpace: "nowrap", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: houseVar("muted") };

  /** The closed bar's content, laid out once per section off stage to measure the hug. */
  const barRow = (i: number, live: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: BAR, paddingLeft: (BAR - RING) / 2, paddingRight: 16, boxSizing: "border-box", width: live ? "100%" : undefined }}>
      <svg aria-hidden viewBox={`0 0 ${RING} ${RING}`} style={{ width: RING, height: RING, flex: "none", transform: "rotate(-90deg)" }}>
        <circle cx={RING / 2} cy={RING / 2} r={ringR} fill="none" strokeWidth={STROKE} stroke={`color-mix(in srgb, ${houseVar("muted")} 34%, transparent)`} />
        {live ? <circle data-spsi-motion cx={RING / 2} cy={RING / 2} r={ringR} fill="none" strokeWidth={STROKE} stroke={ACCENT} strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - read)} style={{ transition: "stroke-dashoffset .35s ease-out" }} /> : null}
      </svg>
      <span style={{ position: "relative", minWidth: 0, display: "flex", ...label }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", ...(live ? fade(!isOpen) : null) }}>{sections[i]?.title}</span>
        {live ? <span style={{ position: "absolute", left: 0, top: 0, ...fade(isOpen) }}>{contents}</span> : null}
      </span>
      <span style={{ flex: 1, minWidth: 10 }} />
      {count > 1 ? (
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: houseVar("muted"), flex: "none" }}>
          <span style={{ position: "relative", ...meta }}>
            <span style={live ? fade(!isOpen) : undefined}>{position(i)}</span>
            {live ? <span style={{ position: "absolute", right: 0, top: 0, ...fade(isOpen) }}>{percent}</span> : null}
          </span>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, transform: `rotate(${live && isOpen ? 180 : 0}deg)`, transition: animate ? "transform .35s ease" : undefined }}>
            <path d="M6 15l6-6 6 6" />
          </svg>
        </span>
      ) : null}
    </div>
  );

  const rowFace = (onPuck: boolean) => sections.map((x, i) => (
    <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 12, height: ROW, padding: "0 14px", boxSizing: "border-box", whiteSpace: "nowrap" }}>
      <span style={{ ...meta, width: String(count).length * 8 + 2, color: onPuck ? `color-mix(in srgb, ${ACCENT_INK} 62%, transparent)` : houseVar("muted") }}>{i + 1}</span>
      <span style={{ ...label, color: onPuck ? ACCENT_INK : houseVar("text"), overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{x.title}</span>
      <span style={{ flex: 1 }} />
      {details ? <span style={{ ...meta, color: onPuck ? `color-mix(in srgb, ${ACCENT_INK} 62%, transparent)` : houseVar("muted") }}>{x.minutes} min</span> : null}
    </div>
  ));

  const glide = animate ? `top .3s ${SPRING}, height .3s ${SPRING}` : undefined;

  return (
    <div {...r.box} ref={box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height, flex: "none", overflow: "hidden", color: houseVar("text"), minWidth: 0 }}>
      <style>{KEYFRAMES}</style>
      {/* The sample page. */}
      <div ref={scroller} className="spsi-scroll" onScroll={onScroll} style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none", overscrollBehavior: "contain" }}>
        <div style={{ padding: "20px 20px 320px", display: "flex", flexDirection: "column", gap: 32 }}>
          {sections.map((x, i) => (
            <div key={x.id} ref={(el) => { sectionEls.current[i] = el; }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: ts(22), fontWeight: fw(600), lineHeight: 1.2 }}>{x.title}</span>
              {x.paragraphs.map((t) => <span key={t} style={{ fontSize: ts(17), fontWeight: fw(600), lineHeight: 1.35, color: houseVar("muted") }}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* The closed bar of each section, measured off stage for the hug. */}
      <div ref={measure} aria-hidden style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", left: 0, top: 0 }}>
        {sections.map((x, i) => <div key={x.id} style={{ position: "absolute", left: 0, top: 0, width: "max-content" }}>{barRow(i, false)}</div>)}
      </div>

      {/* The island and its back-to-top bubble, centred together; only they take touches. */}
      <div data-spsi-motion style={{ position: "absolute", left: "50%", bottom: BOTTOM, width: 0, height: 0, transform: `translateX(${pull + room / 2}px)`, transition: animate && !gesture.current ? `transform .5s ${SPRING}` : undefined }}>
        {showsTop && count > 1 ? (
          <button
            type="button"
            aria-label="Back to top"
            tabIndex={topOut ? 0 : -1}
            onClick={(e) => { if (current > 0) { rt.haptic("selection", e.currentTarget); commit(0); } }}
            data-spsi-motion
            style={{
              position: "absolute", bottom: 0, left: -islandW / 2 - JOINED - BAR, width: BAR, height: BAR, borderRadius: "50%", border: 0, padding: 0, cursor: "pointer",
              display: "grid", placeItems: "center", color: houseVar("text"), ...look,
              transform: topOut ? "none" : `translateX(${JOINED + BAR / 2 + (BAR * 0.72) / 2}px) scale(.72)`, opacity: topOut ? 1 : 0, pointerEvents: topOut ? "auto" : "none",
              transition: animate ? `transform ${topOut ? `.62s ${SPRING} ${isOpen ? 0 : ".28s"}` : ".45s ease-in"}, opacity ${topOut ? ".3s ease-out .1s" : ".14s ease-out"}, left ${motion(isOpen)}` : undefined,
            }}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
            </svg>
          </button>
        ) : null}

        <div
          role="group"
          aria-label={isOpen ? contents : `${contents}, ${sections[shown]?.title ?? ""}, section ${shown + 1} of ${count}, ${percent}`}
          tabIndex={count > 1 ? 0 : -1}
          onKeyDown={onKey}
          data-spsi-motion
          style={{
            position: "absolute", bottom: 0, left: -islandW / 2, width: islandW, height: islandH, borderRadius: cr(isOpen ? 26 : BAR / 2), overflow: "hidden", outline: "none", userSelect: "none", WebkitUserSelect: "none",
            ...look, transform: `scale(${pressed && animate ? 0.97 : 1})`, transformOrigin: "50% 100%",
            transition: animate ? `width ${motion(isOpen)}, height ${motion(isOpen)}, left ${motion(isOpen)}, border-radius ${motion(isOpen)}, transform .2s ease` : undefined,
          }}
        >
          {/* The contents, laid out at the panel's width so nothing reflows as the glass grows. */}
          <div
            ref={rowsRef}
            className="spsi-scroll"
            onPointerDown={onRowsDown}
            onPointerMove={onRowsMove}
            onPointerUp={(e) => onRowsUp(e, false)}
            onPointerCancel={(e) => onRowsUp(e, true)}
            style={{
              position: "absolute", left: "50%", bottom: BAR + GAP, width: panelW - INSET * 2, marginLeft: -(panelW - INSET * 2) / 2, height: viewport,
              overflowY: rowsSlide ? "hidden" : "auto", scrollbarWidth: "none", touchAction: rowsSlide ? "none" : "pan-y",
              opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: animate ? (isOpen ? "opacity .26s ease-out .16s" : "opacity .12s ease-out") : undefined,
            }}
          >
            <div role="list" style={{ position: "relative", height: rowsH }}>
              {sections.map((x, i) => (
                <div key={x.id} role="listitem" aria-current={i === current ? "true" : undefined} onClick={(e) => { if (!rowsSlide) pick(i, e.currentTarget); }} style={{ position: "absolute", left: 0, right: 0, top: i * ROW, height: ROW, cursor: "pointer" }}>
                  {rowFace(false)[i]}
                </div>
              ))}
              {/* The red puck over the current row, with the rows in ink cut to its outline, so a title turns exactly
                  under its edge as it passes. */}
              <div data-spsi-motion aria-hidden style={{ position: "absolute", left: 0, right: 0, top: puck * ROW, height: ROW, borderRadius: cr(ROW / 2), background: ACCENT, overflow: "hidden", pointerEvents: "none", transition: glide }}>
                <div data-spsi-motion style={{ position: "absolute", left: 0, right: 0, top: -puck * ROW, transition: glide }}>{rowFace(true)}</div>
              </div>
            </div>
          </div>
          {/* The bar, at the bottom of the island either way. */}
          <div
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={(e) => onBarUp(e, false)}
            onPointerCancel={(e) => onBarUp(e, true)}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BAR, cursor: count > 1 ? "pointer" : "default", touchAction: "none", userSelect: "none" }}
          >
            {barRow(shown, true)}
          </div>
        </div>
      </div>
    </div>
  );
};
