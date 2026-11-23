"use client";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { font, ground } from "./palette";
import { SK, setFont } from "./moving-sketches";

/** The stage's colours, read from its CSS variables so the sketch follows the site theme. */
function readColors(el: HTMLElement) {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  const text = v("--pv-text", "#f4f3ef");
  const dark = /^#(f|e|d)/i.test(text) || text.startsWith("rgb(2");
  return {
    dark,
    page: v("--pv-bg", "#121212"),
    stage: v("--pv-bg", "#121212"),
    glass: dark ? "#2a2a2a" : "#ffffff",
    glasshi: dark ? "rgba(255,255,255,0.10)" : "#ffffff",
    trough: v("--pv-trough", dark ? "#3a3a3a" : "#e2e1dc"),
    dot: v("--pv-control", dark ? "#4a4a48" : "#c9c7c1"),
    text,
    muted: v("--pv-muted", "#a6a49f"),
    subtle: v("--pv-subtle", "#6f6d69"),
    line: v("--pv-line", "rgba(255,255,255,0.08)"),
    shadow: dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.10)",
    signal: "#ff0000",
  };
}

type Sketch = [number, (frame: Record<string, unknown>) => void];

/**
 * Runs one sketch on a canvas filling the preview: a square of 33 units centred in the stage, looping every
 * few seconds, paused off screen. Under Reduce Motion it draws one still at `still` seconds into the loop.
 */
function SketchCanvas({ name, still, zoom = 1 }: { name: string; still: number; zoom?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const [period, draw] = (SK as unknown as Record<string, Sketch>)[name];
    const x = cv.getContext("2d");
    if (!x) return;
    setFont(font.stack);
    let colors = readColors(cv), colorKey = colors.text, frameNo = 0, visible = true, raf = 0, size = "";
    let mem: Record<string, unknown> = {};
    const t0 = performance.now();
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; });
    io.observe(cv);
    const frame = (now: number) => {
      raf = reduced ? 0 : requestAnimationFrame(frame);
      if (!visible && !reduced) { mem.last = now; return; }
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
      if (!W || !H) return;
      if (`${W}x${H}` !== size) { size = `${W}x${H}`; cv.width = W; cv.height = H; mem = {}; }
      if (++frameNo % 30 === 1) { colors = readColors(cv); if (colors.text !== colorKey) { colorKey = colors.text; mem = {}; } }
      const S = Math.round(Math.min(W, H) * zoom), u = S / 33, t = reduced ? still : (now - t0) / 1000, lt = reduced ? still : t % period;
      const prev = mem.plt as number | undefined, wrap = prev !== undefined && lt < prev;
      const hit = (a: number) => prev !== undefined && (wrap ? a > prev || a <= lt : prev < a && a <= lt);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalAlpha = 1;
      x.globalCompositeOperation = "source-over";
      x.clearRect(0, 0, W, H);
      x.translate(Math.round((W - S) / 2), Math.round((H - S) / 2));
      let fingers: [number, number][] = [];
      const touch = (tx: number, ty: number, on: boolean) => { if (on) fingers = [[tx, ty]]; };
      draw({ x, S, u, t, lt, c: colors, touch, mem, hit, wrap, dt: Math.min(0.05, (now - ((mem.last as number) || now)) / 1000) });
      // The finger: a soft disc where the sketch says a tap or drag is happening.
      for (const [fx, fy] of fingers) {
        x.save();
        x.globalAlpha = 1;
        x.fillStyle = colors.dark ? "rgba(255,255,255,0.28)" : "rgba(20,20,20,0.18)";
        x.beginPath();
        x.arc(fx, fy, 1.7 * u, 0, Math.PI * 2);
        x.fill();
        x.restore();
      }
      mem.plt = lt;
      mem.last = now;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [name, still, zoom, reduced]);
  return (
    <div className="absolute inset-0" style={{ background: ground.bg }}>
      <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}

export const PhotoStackPreview = () => <SketchCanvas name="PhotoStack" still={2.4} />;
export const SnapshotPreview = () => <SketchCanvas name="Snapshot" still={2.6} />;
export const GenieDeletePreview = () => <SketchCanvas name="GenieDelete" still={1.4} />;
export const MiniPlayerPreview = () => <SketchCanvas name="MiniPlayer" still={3} />;
export const AlbumOpenPreview = () => <SketchCanvas name="AlbumOpen" still={3} />;
export const StackingScrollPreview = () => <SketchCanvas name="StackingScroll" still={3.6} />;
export const DraftMinimizePreview = () => <SketchCanvas name="DraftMinimize" still={0.6} />;
export const AvatarDropPreview = () => <SketchCanvas name="AvatarDrop" still={4} />;
export const VideoRotatePreview = () => <SketchCanvas name="VideoRotate" still={3} />;
export const MapExpandPreview = () => <SketchCanvas name="MapExpand" still={3.5} />;
export const BookPullPreview = () => <SketchCanvas name="BookPull" still={3.5} />;
export const VoiceDictationPreview = () => <SketchCanvas name="VoiceDictation" still={4} zoom={1.15} />;
export const SpoilerPreview = () => <SketchCanvas name="Spoiler" still={1} zoom={1.1} />;
export const MarkerPreview = () => <SketchCanvas name="Marker" still={4.5} zoom={1.1} />;
export const DistortionWavePreview = () => <SketchCanvas name="DistortionWave" still={2} />;
