"use client";
// Attachment Tray in the Playground: tap the add tile to "pick" two photos that load with a ring and settle
// into thumbnails, tap a failed tile to retry, tap a badge to remove. Seeded from the definition's props.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { house } from "../../../core/palette.js";
import { TRAY_SCENES } from "../../../definitions/utility/attachment-tray.js";
import { ACCENT, ACCENT_INK, cr, fillStyle, n, houseVar, s, ts, useAxis, type Renderer } from "../env.js";
import { BOUNCE, SPRING, useLive, useRuntime } from "../runtime.js";

type Phase = "loading" | "loaded" | "failed";
type Tile = { id: number; scene: number; phase: Phase; p: number; failsOnce?: boolean };

const PAPER = "#F4F3EF";
const KEYFRAMES = [
  "@keyframes spat-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}",
  "@keyframes spat-thumb{from{opacity:0;transform:scale(1.14)}to{opacity:1;transform:none}}",
  "@keyframes spat-spin{to{transform:rotate(360deg)}}",
  ".spat-row::-webkit-scrollbar{display:none}",
  "@media (prefers-reduced-motion: reduce){[data-spat-motion]{animation:none!important}}",
].join("");

function seed(photos: number, pending: string): Tile[] {
  const list: Tile[] = Array.from({ length: photos }, (_, i) => ({ id: i + 1, scene: i, phase: "loaded", p: 1 }));
  if (pending === "loading") list.push({ id: photos + 1, scene: photos, phase: "loading", p: 0.25 });
  if (pending === "failed") list.push({ id: photos + 1, scene: photos, phase: "failed", p: 0, failsOnce: false });
  return list;
}

function Scene({ scene }: { scene: number }) {
  const [sky, sun, land] = TRAY_SCENES[scene % TRAY_SCENES.length];
  const sunFill = sun === house.signal ? ACCENT : sun;
  return (
    <svg aria-hidden viewBox="150 0 900 900" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <rect x="0" y="0" width="1200" height="900" fill={sky} />
      <circle cx="610" cy="290" r="130" fill={sunFill} />
      <path d="M0 640 Q520 420 1200 560 L1200 900 L0 900 Z" fill={land} />
    </svg>
  );
}

function Ring({ p, size, indeterminate }: { p: number; size: number; indeterminate: boolean }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, color: "var(--h-text)" }}>
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth={2.6} />
      <g data-spat-motion style={{ transformOrigin: "12px 12px", transform: indeterminate ? undefined : "rotate(-90deg)", animation: indeterminate ? "spat-spin .9s linear infinite" : undefined }}>
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeDasharray={`${(indeterminate ? 0.28 : Math.max(p, 0.02)) * c} ${c}`} style={{ transition: "stroke-dasharray .25s ease-out" }} />
      </g>
    </svg>
  );
}

function Icon({ d, size, width = 3.4 }: { d: string; size: number; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <path d={d} />
    </svg>
  );
}

const pressable = (down: boolean): CSSProperties => ({ transform: down ? "scale(0.94)" : "none", transition: `transform .3s ${BOUNCE}` });

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const limit = Math.max(1, Math.round(n(p, "limit")));
  const side = Math.max(56, Math.min(110, n(p, "tileSize") || 76));
  const title = s(p, "title").trim() || "Add photos";
  const initial = useMemo(() => seed(Math.max(0, Math.min(12, Math.round(n(p, "photos")))), s(p, "pending")), [p.photos, p.pending]);
  const [tiles, setTiles] = useLive(initial);
  const [pressed, setPressed] = useState<string | null>(null);
  const next = useRef(100);
  const row = useRef<HTMLDivElement | null>(null);
  const still = rt.still === true;
  const remaining = Math.max(limit - tiles.length, 0);
  const full = remaining === 0;
  const loading = tiles.some((t) => t.phase === "loading");

  // Advances every loading tile's ring; a tile marked to fail does so halfway, once.
  useEffect(() => {
    if (!loading || still) return;
    const timer = setInterval(() => {
      setTiles((list) => list.map((t) => {
        if (t.phase !== "loading") return t;
        const p2 = t.p + 0.08 + ((t.id * 7) % 5) * 0.012;
        if (t.failsOnce && p2 > 0.5) return { ...t, phase: "failed", p: 0, failsOnce: false };
        return p2 >= 1 ? { ...t, phase: "loaded", p: 1 } : { ...t, p: p2 };
      }));
    }, 110);
    return () => clearInterval(timer);
  }, [loading, still, setTiles]);

  const add = (el: Element) => {
    if (full) return;
    const count = Math.min(2, remaining);
    const start = tiles.length;
    const added: Tile[] = Array.from({ length: count }, (_, k) => ({
      id: next.current++, scene: start + k, phase: "loading", p: k === 0 ? 0.05 : 0,
      // The second photo of a pick fails once, so Retry is always one tap away in the preview.
      failsOnce: k === 1,
    }));
    setTiles([...tiles, ...added]);
    rt.haptic("soft", el);
    requestAnimationFrame(() => row.current?.scrollTo({ left: row.current.scrollWidth, behavior: "smooth" }));
  };

  const remove = (id: number, el: Element) => {
    setTiles(tiles.filter((t) => t.id !== id));
    rt.haptic("rigid", el);
  };

  const retry = (id: number, el: Element) => {
    setTiles(tiles.map((t) => (t.id === id ? { ...t, phase: "loading", p: 0 } : t)));
    rt.haptic("selection", el);
  };

  const radius = cr(18) as string;
  const empty = tiles.length === 0;
  const disc = Math.round(side * (empty ? 0.46 : 0.4));

  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), minWidth: 0 }}>
      <style>{KEYFRAMES}</style>
      <div ref={row} className="spat-row" style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", padding: "6px 0", alignItems: "center" }}>
        <button
          type="button"
          aria-label={`${title}, ${full ? `limit reached, ${tiles.length} of ${limit}` : `${remaining} remaining`}`}
          disabled={full}
          onClick={(e) => add(e.currentTarget)}
          onPointerDown={() => setPressed("add")}
          onPointerUp={() => setPressed(null)}
          onPointerLeave={() => setPressed(null)}
          style={{
            flex: "none", height: side, width: empty ? undefined : side, padding: empty ? `0 ${Math.round(side * 0.3)}px 0 ${Math.round(side * 0.2)}px` : 0,
            display: "flex", flexDirection: empty ? "row" : "column", alignItems: "center", justifyContent: "center", gap: empty ? 12 : Math.round(side * 0.07),
            border: 0, borderRadius: radius, background: houseVar("field"), color: houseVar("text"), font: "inherit", cursor: full ? "default" : "pointer",
            ...pressable(pressed === "add" && !full),
          }}
        >
          <span style={{ width: disc, height: disc, borderRadius: "50%", display: "grid", placeItems: "center", background: ACCENT, color: ACCENT_INK, opacity: full ? 0.25 : 1, transition: "opacity .25s", flex: "none" }}>
            <Icon d="M12 6v12M6 12h12" size={Math.round(disc * 0.5)} />
          </span>
          {empty ? (
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "start" }}>
              <span style={{ fontSize: ts(15), fontWeight: 600, whiteSpace: "nowrap" }}>{title}</span>
              <span style={{ fontSize: ts(12), color: houseVar("muted") }}>Up to {limit}</span>
            </span>
          ) : (
            <span style={{ fontSize: ts(12), fontWeight: 600, fontVariantNumeric: "tabular-nums", color: full ? houseVar("text") : houseVar("muted") }}>{tiles.length}/{limit}</span>
          )}
        </button>

        {tiles.map((t, i) => {
          const failed = t.phase === "failed";
          const label = `Photo ${i + 1} of ${tiles.length}, ${t.phase === "loading" ? `loading, ${Math.round(t.p * 100)}%` : failed ? "couldn't load" : "loaded"}`;
          return (
            <div key={t.id} data-spat-motion style={{ position: "relative", flex: "none", width: side, height: side, animation: `spat-in .42s ${BOUNCE} both` }}>
              <div
                role={failed ? "button" : "img"}
                aria-label={label}
                onClick={failed ? (e) => retry(t.id, e.currentTarget) : undefined}
                onPointerDown={() => failed && setPressed(`t${t.id}`)}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                style={{
                  position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", background: houseVar("field"), display: "grid", placeItems: "center",
                  cursor: failed ? "pointer" : "default", ...pressable(pressed === `t${t.id}`),
                }}
              >
                {t.phase === "loaded" ? (
                  <div data-spat-motion style={{ position: "absolute", inset: 0, animation: still ? undefined : `spat-thumb .42s ${BOUNCE} both` }}><Scene scene={t.scene} /></div>
                ) : failed ? (
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(side * 0.07) }}>
                    <span style={{ width: Math.round(side * 0.3), height: Math.round(side * 0.3), borderRadius: "50%", display: "grid", placeItems: "center", background: ACCENT, color: ACCENT_INK }}>
                      <Icon d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" size={Math.round(side * 0.15)} width={3.2} />
                    </span>
                    <span style={{ fontSize: ts(12), fontWeight: 600, color: houseVar("text") }}>Retry</span>
                  </span>
                ) : (
                  <Ring p={t.p} size={Math.round(side * 0.3)} indeterminate={t.p < 0.04} />
                )}
              </div>
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={(e) => remove(t.id, e.currentTarget)}
                onPointerDown={() => setPressed(`x${t.id}`)}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                style={{ position: "absolute", top: 0, insetInlineEnd: 0, width: 44, height: 44, padding: 4, border: 0, background: "none", display: "flex", justifyContent: "flex-end", alignItems: "flex-start", cursor: "pointer" }}
              >
                <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: house.ink, color: PAPER, transform: pressed === `x${t.id}` ? "scale(0.82)" : "none", transition: `transform .25s ${SPRING}` }}>
                  <Icon d="M7 7l10 10M17 7L7 17" size={9} width={3.8} />
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
