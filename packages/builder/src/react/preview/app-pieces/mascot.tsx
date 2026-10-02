"use client";
// Mascot in the preview: the same blob, eyes and mouth the Swift draws, on the same clock. Idle it
// breathes from the bottom and blinks every 4.2 s (lively also bobs and sways); a tap squashes it,
// grins for a moment and plays a medium haptic.
import { useEffect, useRef, useState } from "react";
import { EXPRESSIONS, MASCOT_INK, MASCOT_PATH, MOTIONS, expressionIndex, faceParts, mascotFill } from "../../../definitions/app-pieces/mascot.js";
import { n, s, type Renderer, fw, ts, accentize, useTheme } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { BOUNCE } from "../runtime.js";
import { LABEL2, WideRoot, useHaptic } from "./data-kit.js";

export const Mascot: Renderer = (r) => {
  // Style → Mascot: hidden keeps its place in the tree (to inspect) but draws nothing.
  const hidden = useTheme()?.mascot === "hidden";
  const size = n(r.p, "size") || 160;
  const fill = accentize(mascotFill(s(r.p, "color")));
  const motion = MOTIONS[s(r.p, "motion")] ?? 1;
  const level = Math.min(100, Math.max(0, r.p.level === undefined ? 100 : n(r.p, "level"))) / 100;
  const expression = EXPRESSIONS[expressionIndex(s(r.p, "expression"))];
  const label = s(r.p, "label").trim();
  const caption = s(r.p, "caption").trim();
  const [t, setT] = useState(0);
  const [squash, setSquash] = useState(false);
  const [cheering, setCheering] = useState(false);
  const haptic = useHaptic();
  const el = useRef<HTMLDivElement>(null);
  const clip = `spa-mascot-${r.node.id}`;

  useEffect(() => {
    if (motion === 0 || reducedMotion()) return;
    let raf = 0;
    const tick = (now: number) => {
      setT(now / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  const tap = () => {
    haptic("medium", el.current);
    setSquash(true);
    setCheering(true);
    window.setTimeout(() => setSquash(false), 120);
    window.setTimeout(() => setCheering(false), 700);
  };

  const rate = motion === 2 ? 3.2 : 1.6;
  const breathe = motion === 0 ? 0 : Math.sin(t * rate) * (motion === 2 ? 0.035 : 0.02);
  const blinking = motion !== 0 && t > 0 && t % 4.2 < 0.14;
  const tilt = motion === 2 ? Math.sin(t * 1.9) * 5 : 0;
  const bob = motion === 2 ? Math.sin(t * 3.8) * size * 0.02 : 0;
  const { closed, mouth } = faceParts(cheering ? "grin" : expression, blinking);
  const stroke = 3.5;

  if (hidden) return <WideRoot r={r} style={{ display: "none" }} />;
  return (
    <WideRoot r={r} hug={s(r.p, "width") === "hug"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: s(r.p, "width") === "hug" ? "none" : undefined }}>
      <div
        ref={el}
        role="button"
        aria-label={label || "Mascot"}
        onClick={tap}
        style={{
          width: size, height: size, cursor: "pointer", flex: "none", transformOrigin: "50% 100%",
          transform: `scale(${squash ? 1.14 : 1}, ${squash ? 0.86 : 1})`,
          transition: `transform ${squash ? "0.12s ease-out" : `0.55s ${BOUNCE}`}`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          style={{ display: "block", overflow: "visible", transformOrigin: "50% 100%", transform: `translateY(${bob}px) rotate(${tilt}deg) scale(${1 - breathe * 0.6}, ${1 + breathe})` }}
        >
          <defs>
            <clipPath id={clip}><rect x="0" y={100 - level * 100} width="100" height={level * 100} /></clipPath>
          </defs>
          <path d={MASCOT_PATH} fill={fill} opacity={level < 1 ? 0.24 : 1} />
          {level < 1 ? <path d={MASCOT_PATH} fill={fill} clipPath={`url(#${clip})`} /> : null}
          {[40, 60].map((x) =>
            closed ? (
              <path key={x} d={`M${x - 4.5} 44H${x + 4.5}`} stroke={MASCOT_INK} strokeWidth={stroke} strokeLinecap="round" />
            ) : (
              <circle key={x} cx={x} cy={44} r={4.5} fill={MASCOT_INK} />
            ),
          )}
          {mouth.kind === "ring" ? (
            <circle cx={mouth.center[0]} cy={mouth.center[1]} r={mouth.r} fill="none" stroke={MASCOT_INK} strokeWidth={stroke} />
          ) : (
            <path
              d={mouth.kind === "line" ? `M${mouth.from[0]} ${mouth.from[1]}L${mouth.to[0]} ${mouth.to[1]}` : `M${mouth.from[0]} ${mouth.from[1]}Q${mouth.control[0]} ${mouth.control[1]} ${mouth.to[0]} ${mouth.to[1]}`}
              fill="none"
              stroke={MASCOT_INK}
              strokeWidth={stroke}
              strokeLinecap="round"
              style={{ transition: "d .25s" }}
            />
          )}
        </svg>
      </div>
      {label ? <span style={{ fontSize: ts(Math.max(20, size * 0.18)), fontWeight: fw(700), fontVariantNumeric: "tabular-nums", color: "var(--ios-label)" }}>{label}</span> : null}
      {caption ? <span style={{ fontSize: ts(15), lineHeight: "20px", color: LABEL2, textAlign: "center" }}>{caption}</span> : null}
    </WideRoot>
  );
};
