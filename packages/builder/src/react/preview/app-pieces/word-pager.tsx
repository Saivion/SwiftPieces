"use client";
// Word Pager: drag up or down to page through words (each page snaps with a tick), tap the sound to
// hear it, like and save with a bounce; saved words fill the goal. Mirrors WordPager in the export.
import { useLayoutEffect, useRef, useState } from "react";
import { BACKDROPS, WEEKDAYS, pagerWords } from "../../../definitions/app-pieces/word-pager.js";
import { Glyph } from "../../icons.js";
import { n, s, useAxis, type Renderer, cr, ff, fw, ts } from "../env.js";
import { reducedMotion } from "../primitives.js";
import "./data-kit.js";
import { BOUNCE, SPRING, useDrag, useRuntime } from "../runtime.js";

/** The older photographic backdrops carry a faint ring texture; the Swift Pieces ones are clean gradients. */
const TEXTURED = new Set(["canyon", "sea", "dusk", "night"]);

export const WordPager: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const words = pagerWords(p);
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [liked, setLiked] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [spoken, setSpoken] = useState(0);
  const [bounce, setBounce] = useState("");
  const [height, setHeight] = useState(n(p, "height"));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight || n(p, "height"));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [p]);
  const onDrag = useDrag({
    axis: "y",
    onStart: () => setDrag(0),
    onMove: ({ dy }) => {
      const edge = (page === 0 && dy > 0) || (page === words.length - 1 && dy < 0);
      setDrag(edge ? dy * 0.3 : dy);
    },
    onEnd: ({ dy, vy }) => {
      setDrag(null);
      const flick = dy + vy * 0.2;
      const next = Math.max(0, Math.min(words.length - 1, page + (flick < -80 ? 1 : flick > 80 ? -1 : 0)));
      if (next !== page) {
        rt.haptic("selection", ref.current);
        setPage(next);
      }
    },
  });
  const toggle = (id: number, list: number[], set: (v: number[]) => void, key: string, el: Element) => {
    const on = !list.includes(id);
    set(on ? [...list, id] : list.filter((x) => x !== id));
    rt.haptic(on && key === "save" ? "success" : "light", el);
    setBounce(`${key}${Date.now()}`);
  };
  const backdrop = BACKDROPS[s(p, "backdrop")];
  const surface = s(p, "backdrop") === "surface";
  const radius = p.radius === undefined ? 28 : n(p, "radius");
  const onColor = backdrop ? "#fff" : "var(--ios-label)";
  const goal = n(p, "goal");
  const streak = s(p, "streakTitle").trim();
  const day = n(p, "streakDay");
  const rail = s(p, "actions") === "rail";
  const still = reducedMotion();
  const serif = s(p, "design") === "serif";
  const btn = { border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0, minWidth: 44, minHeight: 44, display: "grid", placeItems: "center" } as const;
  return (
    <div
      {...r.box}
      ref={ref}
      style={{
        ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), flex: "1 1 auto", minHeight: n(p, "height"),
        position: "relative", overflow: "hidden", color: onColor, borderRadius: backdrop || surface ? `calc(${radius}px * var(--spb-corner, 1))` : 0,
        background: surface ? "var(--ios-fill)" : backdrop ? `radial-gradient(120% 60% at 30% 35%, rgba(255,255,255,.14), transparent 60%), ${TEXTURED.has(s(p, "backdrop")) ? "repeating-radial-gradient(140% 90% at 10% 110%, rgba(0,0,0,0) 0 26px, rgba(0,0,0,.07) 26px 30px), " : ""}linear-gradient(${backdrop.join(", ")})` : undefined,
      }}
    >
      <div onPointerDown={onDrag} style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "grab" }}>
        <div style={{ transform: `translateY(${-page * height + (drag ?? 0)}px)`, transition: drag === null ? `transform .55s ${SPRING}` : "none" }}>
          {words.map((w, i) => {
            const d = still ? 0 : Math.min(1, Math.abs(i * height - (page * height - (drag ?? 0))) / Math.max(1, height));
            return (
            <div key={i} style={{ opacity: 1 - 0.6 * d, scale: String(1 - 0.08 * d), transition: drag === null ? `opacity .45s ${SPRING}, scale .55s ${SPRING}` : "none", height, display: "flex", flexDirection: "column", alignItems: rail ? "flex-start" : "center", justifyContent: "center", gap: 12, padding: rail ? "0 84px 0 28px" : "0 32px", textAlign: rail ? "left" : "center" }}>
              <span style={{ fontFamily: ff(serif ? 'ui-serif, "New York", Georgia, serif' : undefined), fontSize: ts(44), fontWeight: fw(600), letterSpacing: serif ? -0.5 : -1 }}>{w.word}</span>
              {w.phonetic && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    rt.haptic("light", e.currentTarget);
                    setSpoken((x) => x + 1);
                  }}
                  style={{ ...btn, display: "inline-flex", gap: 4, fontSize: ts(14), padding: "4px 10px", borderRadius: cr(999), background: backdrop ? "rgba(255,255,255,.18)" : "rgba(120,120,128,.12)", fontFamily: "inherit" }}
                >
                  {w.phonetic}
                  <span key={spoken} style={{ display: "grid", animation: spoken ? `spb-wp-pulse .5s ${BOUNCE}` : undefined }}><Glyph name="speaker.wave.2" size={14} /></span>
                </button>
              )}
              <span style={{ fontSize: ts(15), opacity: 0.9 }}>{w.meaning}</span>
            </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, top: 20, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        {streak ? (
          <div style={{ padding: 14, borderRadius: cr(20), background: "color-mix(in srgb, var(--ios-bg, #fff) 82%, transparent)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", color: "var(--ios-label)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: ts(15), fontWeight: fw(600) }}>{streak}</span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <span style={{ color: "var(--ios-accent)", display: "grid" }}><Glyph name="flame" size={30} /></span>
              {WEEKDAYS.map((d, i) => (
                <span key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: ts(11), fontWeight: fw(i === day ? 700 : 400) }}>{d}</span>
                  <span className="spwp-day" style={{ animationDelay: `${0.1 + i * 0.04}s`, width: 24, height: 24, borderRadius: cr(12), display: "grid", placeItems: "center", background: i <= day ? "var(--ios-accent)" : "rgba(120,120,128,.2)", color: "#fff" }}>
                    {i <= day && <Glyph name="checkmark" size={12} strokeWidth={3} />}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : goal > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ts(12), padding: "6px 12px", borderRadius: cr(999), background: backdrop ? "rgba(255,255,255,.18)" : "var(--ios-fill2)" }}>
            <Glyph name="bookmark" size={13} />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{saved.length}/{goal}</span>
            <span style={{ width: 60, height: 4, borderRadius: cr(2), background: "rgba(120,120,128,.3)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.min(1, saved.length / goal) * 100}%`, background: "currentColor", transition: `width .4s ${SPRING}` }} />
            </span>
          </div>
        ) : null}
      </div>
      <div style={rail ? { position: "absolute", right: 12, bottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 } : { position: "absolute", left: 0, right: 0, bottom: 12, display: "flex", justifyContent: "center", gap: 24 }}>
        <button type="button" style={btn} aria-label="Share" onClick={(e) => rt.haptic("light", e.currentTarget)}><Glyph name="square.and.arrow.up" size={24} /></button>
        <button type="button" style={btn} aria-label="Like" onClick={(e) => toggle(page, liked, setLiked, "like", e.currentTarget)}>
          <span key={bounce.startsWith("like") ? bounce : "l"} style={{ display: "grid", animation: bounce.startsWith("like") ? `spb-wp-pulse .45s ${BOUNCE}` : undefined }}>
            <Glyph name={liked.includes(page) ? "heart.fill" : "heart"} size={24} style={liked.includes(page) ? { fill: "currentColor" } : undefined} />
          </span>
        </button>
        <button type="button" style={btn} aria-label="Save" onClick={(e) => toggle(page, saved, setSaved, "save", e.currentTarget)}>
          <span key={bounce.startsWith("save") ? bounce : "s"} style={{ display: "grid", animation: bounce.startsWith("save") ? `spb-wp-pulse .45s ${BOUNCE}` : undefined }}>
            <Glyph name="bookmark" size={24} style={saved.includes(page) ? { fill: "currentColor" } : undefined} />
          </span>
        </button>
      </div>
      <style>{"@keyframes spb-wp-pulse{0%{transform:scale(.8)}60%{transform:scale(1.12)}100%{transform:none}}@keyframes spwp-day{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}@keyframes spwp-fade{from{opacity:0}to{opacity:1}}.spwp-day{animation:spwp-day .28s cubic-bezier(.23,1,.32,1) both}@media (prefers-reduced-motion: reduce){.spwp-day{animation-name:spwp-fade}}"}</style>
    </div>
  );
};
