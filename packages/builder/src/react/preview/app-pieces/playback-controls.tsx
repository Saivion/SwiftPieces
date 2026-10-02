"use client";
// Playback Controls (definitions/app-pieces/playback-controls.ts): time runs while it plays, the
// scrubber drags, the skip buttons jump with a tick, and play and pause swap with a medium impact.
// The mini bar opens its link (the full player) when tapped anywhere but its buttons. The play button
// (the accent, the screen's one primary action) settles in from 0.95 with a fade and dips to 0.97 when
// pressed; each skip icon bounces when tapped (a plain fade under reduced motion).
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { clock } from "../../../definitions/app-pieces/playback-controls.js";
import { coverStyle } from "../../../definitions/app-pieces/cover-grid.js";
import { b, fillStyle, n, paint, s, useAxis, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { injectStyle } from "../primitives.js";
import { BOUNCE, SPRING, useDrag, useLive, useRuntime, useTap } from "../runtime.js";

injectStyle("spa-playback-css", `@keyframes sppc-in{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes sppc-fade{from{opacity:0}to{opacity:1}}
@keyframes sppc-bounce{0%{transform:scale(1)}35%{transform:scale(.8)}100%{transform:scale(1)}}
@media (prefers-reduced-motion: reduce){.sppc-anim{animation-name:sppc-fade!important}.sppc-skip{animation:none!important}}`);

function Skip({ back, seconds, size, onTap }: { back: boolean; seconds: number; size: number; onTap: (e: ReactMouseEvent<HTMLDivElement>) => void }) {
  const Icon = back ? RotateCcw : RotateCw;
  const [taps, setTaps] = useState(0);
  return (
    <div role="button" aria-label={back ? `Back ${seconds} seconds` : `Forward ${seconds} seconds`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setTaps((t) => t + 1); onTap(e); }} style={{ position: "relative", width: Math.max(44, size + 10), height: Math.max(44, size + 10), flex: "none", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ios-label)" }}>
      <span key={taps} className="sppc-skip" style={{ position: "relative", display: "grid", placeItems: "center", animation: taps ? `sppc-bounce .3s ${BOUNCE}` : undefined }}>
        <Icon size={size} strokeWidth={1.6} />
        <span style={{ position: "absolute", fontSize: ts(Math.round(size * 0.32)), fontWeight: fw(700), top: "52%", transform: "translateY(-50%)" }}>{seconds}</span>
      </span>
    </div>
  );
}

export const PlaybackControls: Renderer = ({ p, box, fill, scheme }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const open = useTap(p.link, "light");
  const dur = Math.max(60, n(p, "duration"));
  const [elapsed, setElapsed] = useLive(Math.min(dur, Math.max(0, n(p, "elapsed"))));
  const [playing, setPlaying] = useLive(b(p, "playing"));
  const [scrubbing, setScrubbing] = useState(false);
  const [pop, setPop] = useState(false);
  const [miniDown, setMiniDown] = useState(false);
  const tint = s(p, "tint") === "accent" ? "var(--ios-accent)" : paint(s(p, "tint"), scheme);
  const back = Number(s(p, "skipBack")) || 10;
  const fwd = Number(s(p, "skipForward")) || 30;
  const mini = s(p, "style") === "mini";

  useEffect(() => {
    if (!playing || scrubbing) return;
    const id = window.setInterval(() => setElapsed((v) => Math.min(dur, v + 1)), 1000);
    return () => window.clearInterval(id);
  }, [playing, scrubbing, dur, setElapsed]);

  const toggle = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    rt.haptic("medium", e.currentTarget);
    setPlaying((v) => !v);
    setPop(true);
    setTimeout(() => setPop(false), 120);
  };
  const skip = (dir: number, secs: number) => (e: ReactMouseEvent<HTMLDivElement>) => {
    rt.haptic("selection", e.currentTarget);
    setElapsed((v) => Math.min(dur, Math.max(0, v + dir * secs)));
  };
  const onScrub = useDrag({
    slop: 0,
    onStart: (i) => {
      setScrubbing(true);
      setElapsed(Math.max(0, Math.min(1, i.x / Math.max(1, i.el.offsetWidth))) * dur);
    },
    onMove: (i) => setElapsed(Math.max(0, Math.min(1, i.x / Math.max(1, i.el.offsetWidth))) * dur),
    onEnd: (i) => {
      setScrubbing(false);
      rt.haptic("selection", i.el);
    },
  });
  const frac = elapsed / dur;
  const PlayIcon = playing ? Pause : Play;

  if (mini) {
    const art = accentize(coverStyle("pieces", Math.round(n(p, "art"))));
    return (
      <div
        {...box}
        role="button"
        onClick={(e) => open(e)}
        onPointerDown={() => setMiniDown(true)}
        onPointerUp={() => setMiniDown(false)}
        onPointerLeave={() => setMiniDown(false)}
        style={{
          scale: miniDown ? "0.97" : "1", transition: "scale .12s ease-out",
          ...box.style, display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 4px 12px", borderRadius: cr(999), cursor: "pointer",
          background: scheme === "dark" ? "rgba(44,44,48,.92)" : "rgba(255,255,255,.94)", boxShadow: "0 6px 24px rgba(0,0,0,.12), 0 0 0 .5px rgba(0,0,0,.06)",
          ...fillStyle(fill, axis), alignSelf: axis === "v" ? "stretch" : undefined,
        }}
      >
        <span style={{ flex: "none", width: 40, height: 40, borderRadius: cr(8), background: art.bg, boxShadow: `inset 0 -12px 0 color-mix(in srgb, ${art.accent} 33%, transparent)`, marginRight: 4 }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: ts(14), lineHeight: "18px", fontWeight: fw(500), color: "var(--ios-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s(p, "title")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 44, height: 3, borderRadius: cr(2), background: "var(--ios-fill2)", overflow: "hidden" }}>
              <span style={{ display: "block", width: `${frac * 100}%`, height: "100%", background: tint }} />
            </span>
            <span style={{ fontSize: ts(11), color: "var(--ios-label2)", fontVariantNumeric: "tabular-nums" }}>-{clock(dur - elapsed)}</span>
          </div>
        </div>
        <Skip back seconds={back} size={20} onTap={skip(-1, back)} />
        <div role="button" aria-label={playing ? "Pause" : "Play"} onPointerDown={(e) => e.stopPropagation()} onClick={toggle} style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", cursor: "pointer" }}>
          <span className="sppc-anim" style={{ width: 32, height: 32, borderRadius: cr("50%"), background: tint, color: "#fff", display: "grid", placeItems: "center", transform: pop ? "scale(.97)" : "none", transition: "transform .12s ease-out", animation: "sppc-in .28s cubic-bezier(.23,1,.32,1) backwards" }}>
            <PlayIcon size={14} fill="currentColor" strokeWidth={0} style={{ marginLeft: playing ? 0 : 2 }} />
          </span>
        </div>
        <Skip back={false} seconds={fwd} size={20} onTap={skip(1, fwd)} />
      </div>
    );
  }

  return (
    <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", gap: 18, color: "var(--ios-label)", ...fillStyle(fill, axis), alignSelf: axis === "v" ? "stretch" : undefined }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: ts(22), lineHeight: "28px", fontWeight: fw(700) }}>{s(p, "title")}</div>
        {s(p, "show").trim() ? <div style={{ fontSize: ts(15), lineHeight: "20px", color: "var(--ios-label2)" }}>{s(p, "show")}</div> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div role="slider" aria-valuenow={Math.round(elapsed)} onPointerDown={onScrub} style={{ position: "relative", height: 24, cursor: "pointer", touchAction: "pan-y" }}>
          <span style={{ position: "absolute", left: 0, right: 0, top: 10, height: scrubbing ? 7 : 4, marginTop: scrubbing ? -1.5 : 0, borderRadius: cr(4), background: "var(--ios-fill2)", overflow: "hidden", transition: `height .25s ${SPRING}` }}>
            <span style={{ display: "block", width: `${frac * 100}%`, height: "100%", background: tint }} />
          </span>
          <span style={{ position: "absolute", top: 12, left: `${frac * 100}%`, width: scrubbing ? 20 : 12, height: scrubbing ? 20 : 12, borderRadius: cr("50%"), background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.3)", transform: "translate(-50%, -50%)", transition: `width .25s ${BOUNCE}, height .25s ${BOUNCE}` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ts(12), color: "var(--ios-label2)", fontVariantNumeric: "tabular-nums" }}>
          <span>{clock(elapsed)}</span>
          <span>-{clock(dur - elapsed)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
        <Skip back seconds={back} size={34} onTap={skip(-1, back)} />
        <div role="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className="sppc-anim" style={{ width: 80, height: 80, borderRadius: cr("50%"), background: tint, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", transform: pop ? "scale(.97)" : "none", transition: "transform .12s ease-out", animation: "sppc-in .28s cubic-bezier(.23,1,.32,1) backwards" }}>
          <PlayIcon size={30} fill="currentColor" strokeWidth={0} style={{ marginLeft: playing ? 0 : 4 }} />
        </div>
        <Skip back={false} seconds={fwd} size={34} onTap={skip(1, fwd)} />
      </div>
    </div>
  );
};
