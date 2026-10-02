"use client";
// Mood Faces: five drawn faces; tap one and it springs up while the rest step back.
import { useRef } from "react";
import { MOOD_COLORS, moodLabels } from "../../../definitions/app-pieces/mood-faces.js";
import { b, font, n, s, type Renderer, cr } from "../env.js";
import { useLive, useRuntime } from "../runtime.js";
import { EASE_OUT, FaceGlyph, PRESS_TRANSITION, Root, enter, press, stagger, useHaptic } from "./wellbeing-shared.js";

export const MoodFaces: Renderer = (r) => {
  const labels = moodLabels(r.p.labels);
  const [selected, setSelected] = useLive<number>(n(r.p, "selected"));
  const size = n(r.p, "size") || 56;
  const color = s(r.p, "style") === "color";
  const stacked = s(r.p, "layout") === "stacked";
  const levels = s(r.p, "order") === "descending" ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
  const haptic = useHaptic();
  const rt = useRuntime();
  const pending = useRef<number | null>(null);
  const meter = s(r.p, "glyph") === "level";
  const only = b(r.p, "only");

  const pick = (level: number, el: Element) => {
    setSelected(level);
    haptic("selection", el);
    const link = s(r.p, "link");
    if (link) {
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => rt.act(link), 380);
    }
  };

  const face = (level: number) => {
    const picked = selected === level;
    const fill = color ? MOOD_COLORS[level] : null;
    return (
      <button
        key={level}
        type="button"
        aria-label={labels[level]}
        aria-pressed={picked}
        onClick={(e) => pick(level, e.currentTarget)}
        className="spb-anim"
        {...(only ? {} : press)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          minWidth: 44,
          minHeight: 44,
          transform: `scale(${only ? 1 : picked ? 1.1 : selected < 0 ? 1 : 0.94})`,
          opacity: only || selected < 0 || picked ? 1 : 0.55,
          transition: `transform .3s ${EASE_OUT}, opacity .2s, ${PRESS_TRANSITION}`,
        }}
      >
        <span
          data-spw-anim={only ? undefined : "pop"}
          style={{
            ...(only ? {} : enter("pop", stagger(levels.indexOf(level))).style),
            position: "relative",
            width: size,
            height: size,
            borderRadius: cr("50%"),
            background: meter ? `color-mix(in srgb, ${fill ?? "var(--ios-label)"} 20%, transparent)` : fill ?? "var(--ios-fill2)",
            outline: picked && (!fill || meter) && !only ? "2px solid var(--ios-label)" : undefined,
            outlineOffset: 2,
            display: "grid",
            placeItems: "center",
            overflow: meter ? "hidden" : undefined,
          }}
        >
          {meter ? (
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${((level + 1) / labels.length) * 100}%`, background: fill ?? "var(--ios-label)" }} />
          ) : (
            <FaceGlyph level={level} size={size} color={fill ? "rgba(0,0,0,.78)" : "var(--ios-label)"} />
          )}
        </span>
        {b(r.p, "showsLabels") ? <span style={{ ...font("caption", picked ? 600 : 400), color: picked ? "var(--ios-label)" : "var(--ios-label2)" }}>{labels[level]}</span> : null}
      </button>
    );
  };

  const gap = size * (stacked ? 0.14 : 0.18);
  if (b(r.p, "only") && selected >= 0) {
    return <Root r={r} style={{ pointerEvents: "none", display: "flex" }}>{face(selected)}</Root>;
  }
  return (
    <Root r={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap, userSelect: "none" }}>
      {stacked ? (
        <>
          <div style={{ display: "flex", gap }}>{levels.slice(0, 3).map(face)}</div>
          <div style={{ display: "flex", gap }}>{levels.slice(3).map(face)}</div>
        </>
      ) : (
        <div style={{ display: "flex", gap }}>{levels.map(face)}</div>
      )}
    </Root>
  );
};
