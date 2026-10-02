"use client";
// Breath Scene: tap to start or pause; the scene swells on the in-breath and settles on the out-
// breath, with a haptic at each turn. Drag sideways to turn orbs, leaves and branches.
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ADAPTIVE_PALETTES, breathPalette, chromeInset, pillInk, scatter, wavePoint } from "../../../definitions/app-pieces/breath-scene.js";
import { MASCOT_INK, MASCOT_PATH } from "../../../definitions/app-pieces/mascot.js";
import { b, fillStyle, n, s, useAxis, type Renderer, cr, fw, ts, ACCENT, accentize } from "../env.js";
import { Glyph } from "../../icons.js";
import { useDrag, useRuntime, useTap } from "../runtime.js";
import { reducedMotion } from "../primitives.js";
import { EASE_OUT, PRESS_TRANSITION, enter, press, useHaptic } from "./wellbeing-shared.js";
import { useEdgeBleed } from "./edge-bleed.js";

export const BreathScene: Renderer = (r) => {
  const scene = s(r.p, "scene") || "orbs";
  const pal = accentize(breathPalette(s(r.p, "palette"), r.scheme));
  const dark = r.scheme === "dark";
  const baseH = n(r.p, "height") || 620;
  // Filling the screen, the scene grows to take a screen that doesn't scroll (its height is then its
  // smallest), so a session runs the whole phone; it is drawn at the height it gets.
  const [grown, setGrown] = useState(baseH);
  const fills = b(r.p, "fillsScreen");
  const h = fills ? Math.max(baseH, grown) : baseH;
  const seconds = n(r.p, "seconds") || 4;
  const box = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const axis = useAxis();
  const bleeds = b(r.p, "bleed");
  const bleed = useEdgeBleed(rootRef, bleeds, pal.ground);
  const close = useTap(s(r.p, "closeLink"));
  const finish = useTap(s(r.p, "finishLink"));
  const next = useTap(s(r.p, "nextLink"));
  const [liked, setLiked] = useState(false);
  const [w, setW] = useState(393);
  useLayoutEffect(() => {
    if (box.current?.offsetWidth) setW(box.current.offsetWidth);
    const el = box.current;
    if (!fills || !el) return;
    const ro = new ResizeObserver(() => setGrown(el.offsetHeight || baseH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // It breathes on its own as soon as it appears (a tap pauses), except in a still picture of the
  // screen or with reduced motion, where it waits for a tap like the Swift does.
  const rt = useRuntime();
  const [playing, setPlaying] = useState(() => r.p.autoplay !== false && !rt.still && !reducedMotion());
  const [clock, setClock] = useState(0);
  const [angle, setAngle] = useState(0);
  const base = useRef(0);
  const haptic = useHaptic();
  const lastPhase = useRef(true);

  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now();
    let id = 0;
    const tick = (now: number) => {
      setClock((now - t0) / 1000);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const cycle = clock % (seconds * 2);
  const inhaling = cycle < seconds;
  const progress = inhaling ? cycle / seconds : 1 - (cycle - seconds) / seconds;
  const breath = playing && !reducedMotion() ? (1 - Math.cos(progress * Math.PI)) / 2 : 0.5;
  useEffect(() => {
    if (playing && lastPhase.current !== inhaling) haptic(inhaling ? "increase" : "decrease", box.current);
    lastPhase.current = inhaling;
  }, [inhaling, playing, haptic]);

  // A flick keeps the scene turning, easing out from the release velocity (as the Swift does).
  const spin = useRef(0);
  useEffect(() => () => cancelAnimationFrame(spin.current), []);
  const drag = useDrag({
    axis: "x",
    onStart: () => {
      cancelAnimationFrame(spin.current);
      base.current = angle;
    },
    onMove: ({ dx }) => setAngle(base.current + dx / 120),
    onEnd: ({ dx, vx }) => {
      if (Math.abs(dx) > 8) haptic("selection", box.current);
      const v0 = vx / 120;
      if (reducedMotion() || Math.abs(v0) < 0.2) return;
      const from = base.current + dx / 120;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = (now - t0) / 1000;
        setAngle(from + (v0 * (1 - Math.exp(-3 * t))) / 3);
        if (t < 1.6) spin.current = requestAnimationFrame(step);
      };
      spin.current = requestAnimationFrame(step);
    },
  });
  const toggle = () => {
    setClock(0);
    setPlaying((v) => !v);
    haptic("light", box.current);
  };
  const phase = inhaling ? s(r.p, "inhale") : s(r.p, "exhale");
  const cx = w / 2;
  const cy = h / 2;

  let art: ReactNode = null;
  if (scene === "rings") {
    const rings = Array.from({ length: 9 }, (_, k) => {
      const rr = w * 0.5 * (0.42 + k * 0.075) * (0.9 + 0.1 * breath);
      return <circle key={k} cx={cx} cy={cy} r={rr} fill="none" stroke={pal.ink} strokeOpacity={0.5 - k * 0.045} strokeWidth={1} />;
    });
    art = (
      <>
        {rings}
        <circle cx={cx} cy={cy} r={w * 0.5 * 0.33 * (0.86 + 0.14 * breath)} fill={pal.ink} />
      </>
    );
  } else if (scene === "orbs") {
    art = (
      <>
        <defs>
          {Array.from({ length: 6 }, (_, k) => (
            <radialGradient key={k} id={`spb-orb-${r.node.id}-${k}`} cx="0.32" cy="0.3" r="0.8">
              <stop offset="0" stopColor={pal.glow} />
              <stop offset="1" stopColor={pal.ink} />
            </radialGradient>
          ))}
        </defs>
        {Array.from({ length: 6 }, (_, k) => {
          const a = k * 2.3 + angle;
          const d = w * (0.1 + k * 0.055);
          const rr = w * (0.24 - k * 0.02) * (0.82 + 0.25 * breath);
          return <circle key={k} cx={cx + Math.cos(a) * d} cy={cy + Math.sin(a) * d * 1.3} r={rr} fill={`url(#spb-orb-${r.node.id}-${k})`} />;
        })}
      </>
    );
  } else if (scene === "bloom") {
    // Petals open on the in-breath and fold on the out; a drag turns the flower (as the Swift does).
    const length = w * (0.24 + 0.14 * breath);
    const gid = `spb-petal-${r.node.id}`;
    art = (
      <>
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={pal.ink} />
            <stop offset="1" stopColor={pal.glow} />
          </linearGradient>
        </defs>
        {[0, 1].flatMap((layer) =>
          Array.from({ length: 8 }, (_, k) => {
            const len = length * (layer === 0 ? 1.12 : 1);
            const rot = ((k * Math.PI) / 4 + (layer === 0 ? Math.PI / 8 : 0) + angle) * (180 / Math.PI);
            return <ellipse key={`${layer}-${k}`} cx={0} cy={-len / 2} rx={len * 0.27} ry={len / 2} transform={`translate(${cx} ${cy}) rotate(${rot})`} fill={layer === 0 ? pal.glow : `url(#${gid})`} fillOpacity={layer === 0 ? 0.45 : 1} />;
          }),
        )}
        <circle cx={cx} cy={cy} r={w * 0.07 * (0.9 + 0.2 * breath)} fill={pal.glow} />
      </>
    );
  } else if (scene === "pillows") {
    // Three soft cushions, the widest at the bottom, that swell and part as the breath comes in.
    const rise = 0.9 + 0.2 * breath;
    const gid = `spb-pillow-${r.node.id}`;
    art = (
      <>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pal.glow} />
            <stop offset="1" stopColor={pal.ink} />
          </linearGradient>
        </defs>
        {[0.78, 0.62, 0.46].map((f, k) => {
          // Sized for a phone-shaped scene: a taller one (a whole-screen session) keeps the stack's proportions.
          const hh = Math.min(h, w * 1.45);
          const pw = w * f * rise;
          const ph = hh * 0.16 * rise;
          const y = cy + (1 - k) * hh * (0.14 + 0.06 * breath);
          return (
            <g key={k}>
              <ellipse cx={cx} cy={y + ph * 0.51} rx={pw * 0.42} ry={ph * 0.15} fill="#000" fillOpacity={0.18} />
              <rect x={cx - pw / 2} y={y - ph / 2} width={pw} height={ph} rx={ph * 0.45} fill={`url(#${gid})`} />
            </g>
          );
        })}
      </>
    );
  } else if (scene === "tide") {
    // Water rises with the in-breath and ebbs with the out; a drag rolls the waves.
    const level = h * (0.78 - 0.42 * breath);
    art = Array.from({ length: 3 }, (_, k) => {
      const top = level + k * h * 0.07;
      const pts = Array.from({ length: 49 }, (_, i) => {
        const f = i / 48;
        return `${w * f},${top + Math.sin(f * Math.PI * 2.5 + k * 1.4 + angle + breath * Math.PI) * h * 0.022}`;
      });
      return <polygon key={k} points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={k === 0 ? pal.glow : pal.ink} fillOpacity={k === 0 ? 0.55 : 0.55 + k * 0.2} />;
    });
  } else if (scene === "leaves") {
    art = Array.from({ length: 110 }, (_, k) => {
      const a = scatter(k, 1) * Math.PI * 2 + angle;
      const d = Math.sqrt(scatter(k, 2)) * w * 0.66 * (0.7 + 0.4 * breath);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d * 1.5;
      const rot = ((scatter(k, 3) * Math.PI * 2 + angle) * 180) / Math.PI;
      return <ellipse key={k} cx={0} cy={0} rx={8 + scatter(k, 8) * 10} ry={3 + scatter(k, 8) * 3.5} transform={`translate(${x} ${y}) rotate(${rot})`} fill={k % 3 === 0 ? pal.glow : pal.ink} fillOpacity={0.45 + scatter(k, 4) * 0.5} />;
    });
  } else if (scene === "wave") {
    const ridge = [[0, 0.62], [0.18, 0.3], [0.3, 0.42], [0.46, 0.12], [0.62, 0.34], [0.8, 0.26], [1, 0.44], [1, 1], [0, 1]].map(([x, y]) => `${x * w},${y * h}`).join(" ");
    const dot = wavePoint(breath, w, h);
    art = (
      <>
        <polygon points={ridge} fill={pal.ink} fillOpacity={0.55} />
        {Array.from({ length: 140 }, (_, k) => {
          const x = scatter(k, 5) * w;
          const y = scatter(k, 6) * h;
          return <line key={k} x1={x} y1={y} x2={x + 9} y2={y - 4} stroke={pal.glow} strokeOpacity={0.35} strokeWidth={1.5} />;
        })}
        <path d={`M ${w * 0.1} ${h * 0.5} C ${w * 0.58} ${h * 0.54} ${w * 0.5} ${h * 0.2} ${w * 0.98} ${h * 0.2}`} fill="none" stroke={pal.glow} strokeOpacity={0.9} strokeWidth={12} strokeLinecap="round" />
        <circle cx={dot.x} cy={dot.y} r={13} fill={pal.label} />
      </>
    );
  } else if (scene === "branches") {
    art = Array.from({ length: 15 }, (_, k) => {
      const col = k % 3;
      const row = Math.floor(k / 3);
      const bx = w * (0.14 + col * 0.36 + (row % 2 ? 0.12 : 0));
      const by = h * (0.2 + row * 0.2);
      const len = h * (0.1 + scatter(k, 7) * 0.05);
      const rot = (((breath - 0.5) * 0.3 + Math.sin(angle + k) * 0.08) * 180) / Math.PI;
      const forks = [[0.45, -0.6], [0.6, 0.55], [1, -0.35], [1, 0.35]].map(([at, sp]) => `M 0 ${-len * at} L ${Math.sin(sp) * len * 0.45} ${-len * at - Math.cos(sp) * len * 0.45}`).join(" ");
      return <path key={k} d={`M 0 0 L 0 ${-len} ${forks}`} transform={`translate(${bx} ${by}) rotate(${rot})`} stroke={pal.ink} strokeWidth={3} strokeLinecap="round" fill="none" />;
    });
  }

  const label = { color: pal.label, fontWeight: fw(600), fontSize: ts(17) } as const;
  const curve = Math.max(0, n(r.p, "curve"));
  const closes = !!s(r.p, "closeLink");
  const finishTitle = s(r.p, "finish").trim();
  const likes = b(r.p, "likes") && !finishTitle;
  const rounds = Math.max(0, Math.round(n(r.p, "rounds")));
  const round = Math.min(rounds, Math.max(1, Math.round(n(r.p, "round") || 1)));
  const nextTitle = s(r.p, "next").trim();
  // Controls over the scene: frosted, in the scene's label colour, pressing to 0.97; taps on them
  // never reach the scene's play and pause.
  const glass = { all: "unset", boxSizing: "border-box", height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: cr(22), background: "rgba(0,0,0,.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: pal.label, cursor: "pointer", transition: PRESS_TRANSITION } as const;
  // A control's tap follows its link (with its own light tap) and never reaches the scene.
  const stop = (fn: (e: { currentTarget: Element }) => void) => (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    fn(e);
  };
  const top = bleeds ? 56 : 16;
  /** Where the controls over the scene end, so the phase label sits under them. */
  const chromeBottom = chromeInset(r.p);
  const foot = (fills ? 44 : 28) + curve;
  const chrome = (
    <>
      {closes || finishTitle || likes ? (
        <div style={{ position: "absolute", top, left: 20, right: 20, display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "none" }}>
          {closes ? (
            <button type="button" aria-label="Close" {...press} onClick={stop(close)} style={{ ...glass, width: 44, pointerEvents: "auto" }}><Glyph name="xmark" size={18} strokeWidth={2.4} /></button>
          ) : <span />}
          {finishTitle ? (
            <button type="button" {...press} onClick={stop(finish)} style={{ ...glass, padding: "0 18px", fontSize: ts(15), fontWeight: fw(600), pointerEvents: "auto" }}>{finishTitle}</button>
          ) : likes ? (
            <button type="button" aria-label={liked ? "Remove from favourites" : "Add to favourites"} aria-pressed={liked} {...press} onClick={(e) => { e.stopPropagation(); haptic("light", e.currentTarget); setLiked((v) => !v); }} style={{ ...glass, width: 44, pointerEvents: "auto" }}>
              <span key={liked ? "on" : "off"} style={{ display: "grid", animation: liked && !reducedMotion() ? `spbs-pop .35s ${EASE_OUT}` : undefined }}><Glyph name={liked ? "heart.fill" : "heart"} size={20} strokeWidth={2.2} /></span>
            </button>
          ) : <span />}
        </div>
      ) : null}
      {rounds > 0 ? (
        <div style={{ position: "absolute", top: top + (closes || finishTitle || likes ? 56 : 0), left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", color: pal.label }}>
          <span style={{ fontSize: ts(13), fontWeight: fw(600), letterSpacing: ".02em", fontVariantNumeric: "tabular-nums" }}>Round {round} of {rounds}</span>
          <span style={{ width: 120, height: 4, borderRadius: cr(2), background: "rgba(255,255,255,.28)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(round / rounds) * 100}%`, borderRadius: cr(2), background: pal.label }} />
          </span>
        </div>
      ) : null}
      {nextTitle ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: foot, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <button type="button" {...press} onClick={stop(next)} style={{ ...glass, height: 52, padding: "0 24px", borderRadius: cr(26), background: "rgba(255,255,255,.92)", color: ADAPTIVE_PALETTES.has(s(r.p, "palette") || "signal") ? "#141414" : pillInk(pal), fontSize: ts(17), fontWeight: fw(600), boxShadow: "0 8px 24px rgba(0,0,0,.18)", pointerEvents: "auto" }}>
            {nextTitle}
            <Glyph name="arrow.right" size={17} strokeWidth={2.4} />
          </button>
        </div>
      ) : null}
      <style>{"@keyframes spbs-pop{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}"}</style>
    </>
  );
  const coach = s(r.p, "coach").trim();
  const hint = s(r.p, "hint").trim();
  return (
    <div
      {...r.box}
      ref={rootRef}
      style={{
        ...r.box.style, position: "relative", alignSelf: "stretch", ...(fills ? { minHeight: baseH, flex: "1 1 auto", marginBottom: -34 } : { height: h }), overflow: "hidden", borderRadius: curve ? 0 : cr(n(r.p, "radius") || undefined), background: pal.ground, userSelect: "none", touchAction: "pan-y", cursor: "pointer",
        clipPath: curve ? `path("M 0 0 H ${w} V ${h} Q ${w / 2} ${h - curve * 2} 0 ${h} Z")` : undefined,
        ...fillStyle(r.fill, axis), ...bleed.style,
      }}
    >
      {bleed.strip}
      <div ref={box} onPointerDown={drag} onClick={toggle} style={{ position: "absolute", inset: 0 }}>
        <svg width={w} height={h} data-spw-anim="rise" style={{ ...enter("rise").style, position: "absolute", inset: 0 }} aria-hidden>{art}</svg>
        {scene === "rings" ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: ADAPTIVE_PALETTES.has(s(r.p, "palette") || "signal") && s(r.p, "palette") !== "night" ? "#fff" : pal.ground, fontWeight: fw(700), fontSize: ts(15), letterSpacing: 4 }}>{phase.toUpperCase()}</div>
        ) : scene === "wave" ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: h * 0.47 - 11, textAlign: "center", ...label }}>{phase}</div>
        ) : scene === "bloom" || scene === "pillows" ? (
          playing ? <div style={{ position: "absolute", left: 0, right: 0, top: Math.max(h * 0.09, chromeBottom + 28) - 11, textAlign: "center", ...label }}>{phase}</div> : null
        ) : scene === "branches" || scene === "tide" ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: Math.max(h * 0.3, chromeBottom + 56) - 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {b(r.p, "showsBar") ? (
              <span style={{ width: w * 0.36, height: 8, borderRadius: cr(4), background: `color-mix(in srgb, ${pal.label} 30%, transparent)`, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(inhaling || !playing ? 0 : 1 - breath) * 100}%`, background: pal.label, borderRadius: cr(4) }} />
              </span>
            ) : null}
            <span style={label}>{phase}</span>
          </div>
        ) : playing ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", ...label }}>{phase}</div>
        ) : null}
        {scene !== "rings" && b(r.p, "showsPlay") ? (
          <div className="spb-anim" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, opacity: playing ? 0 : 1, transform: `scale(${playing ? 0.95 : 1})`, transition: `transform .25s ${EASE_OUT}, opacity .2s`, pointerEvents: "none" }}>
            {hint ? <span style={{ color: pal.label, opacity: 0.85, fontSize: ts(12) }}>{hint}</span> : null}
            <span style={{ width: 88, height: 88, borderRadius: cr(44), background: "rgba(255,255,255,.9)", boxShadow: "0 4px 12px rgba(0,0,0,.12)", display: "grid", placeItems: "center", color: pal.ink }}>
              <Glyph name="play.fill" size={34} />
            </span>
          </div>
        ) : null}
        {coach ? (
          <div style={{ position: "absolute", left: 20, bottom: nextTitle ? foot + 72 : 20 + curve, maxWidth: w * 0.82, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg aria-hidden viewBox="0 0 100 100" width={38} height={38} style={{ flex: "none" }}>
              <path d={MASCOT_PATH} fill={ACCENT} />
              <circle cx="40" cy="44" r="4.5" fill={MASCOT_INK} />
              <circle cx="60" cy="44" r="4.5" fill={MASCOT_INK} />
              <path d="M42 58Q50 66 58 58" fill="none" stroke={MASCOT_INK} strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <span style={{ padding: "12px 16px", borderRadius: cr(16), background: dark ? "rgba(0,0,0,.92)" : "rgba(255,255,255,.92)", boxShadow: `inset 0 0 0 1px ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, color: dark ? "#fff" : "#000", fontSize: ts(15), lineHeight: 1.35 }}>{coach}</span>
          </div>
        ) : null}
      </div>
      {chrome}
    </div>
  );
};
