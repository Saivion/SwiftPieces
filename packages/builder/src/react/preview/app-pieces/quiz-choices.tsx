"use client";
// Quiz Choices: pick an answer; right fills sage with a tick and a success tap, wrong shakes red
// with an error tap, and the result panel rises (0.3 s ease-out; a fade under reduced motion).
// Answers settle in from 0.95, 40 ms apart, and dip to 0.97 when pressed. Mirrors QuizChoices.
import { useState } from "react";
import { quizOptions } from "../../../definitions/app-pieces/quiz-choices.js";
import { Glyph } from "../../icons.js";
import { b, s, useAxis, type Renderer, cr, fw, ts } from "../env.js";
import { useLive, useRuntime } from "../runtime.js";

export const QuizChoices: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const { options, correct } = quizOptions(p);
  const [picked, setPicked] = useLive<number | null>(b(p, "answered") ? correct : null);
  const [shake, setShake] = useState(0);
  const [down, setDown] = useState<number | null>(null);
  const pick = (i: number, el: Element) => {
    setPicked(i);
    if (i === correct) rt.haptic("success", el);
    else {
      rt.haptic("error", el);
      setShake((x) => x + 1);
    }
  };
  const next = (el: Element) => {
    rt.haptic("light", el);
    if (!rt.act(s(p, "link"))) setPicked(null);
  };
  const idle = "var(--ios-fill)";
  const fill = (i: number) => (picked === null ? idle : i === correct ? "rgba(169,220,183,.5)" : i === picked ? "rgba(255,0,0,.4)" : idle);
  const right = picked === correct;
  return (
    <div {...r.box} style={{ ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 12, color: "var(--ios-label)" }}>
      <div style={{ minHeight: 120, marginBottom: 4, borderRadius: cr(24), background: "var(--ios-fill)", display: "grid", placeItems: "center", padding: 20, textAlign: "center", fontSize: ts(20), lineHeight: "25px", fontWeight: fw(600) }}>
        {s(p, "prompt")}
      </div>
      {options.map((o, i) => (
        <button
          key={`${i}-${i === picked ? shake : 0}`}
          type="button"
          className="spb-qc-anim"
          onClick={(e) => pick(i, e.currentTarget)}
          onPointerDown={() => setDown(i)}
          onPointerUp={() => setDown(null)}
          onPointerLeave={() => setDown(null)}
          style={{
            position: "relative", border: "none", borderRadius: cr(16), padding: "16px 18px", background: fill(i), color: "var(--ios-label)", cursor: "pointer",
            fontFamily: "inherit", fontSize: ts(17), fontWeight: fw(600), transition: "background .25s ease-out, scale .12s ease-out", scale: down === i ? "0.97" : "1",
            animation: i === picked && i !== correct && shake ? "spb-qc-shake .32s linear" : `spb-qc-in .28s cubic-bezier(.23,1,.32,1) ${Math.min(i, 8) * 0.04}s backwards`,
          }}
        >
          {picked !== null && i === correct && <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", display: "grid" }}><Glyph name="checkmark" size={17} strokeWidth={2.6} /></span>}
          {o}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {picked !== null && (
        <div key={String(right)} style={{ borderRadius: cr(24), background: "var(--ios-fill)", padding: 20, display: "flex", flexDirection: "column", gap: 8, animation: "spb-qc-rise .3s cubic-bezier(.23,1,.32,1)" }} className="spb-qc-panel">
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ts(17), fontWeight: fw(600) }}>
            <span style={{ color: right ? "#A9DCB7" : "#FF0000", display: "grid" }}><Glyph name={right ? "checkmark.circle.fill" : "xmark.circle.fill"} size={20} /></span>
            {right ? "Correct" : "Not quite"}
          </span>
          <span style={{ fontSize: ts(15), fontWeight: fw(600) }}>{options[correct]}</span>
          {s(p, "example").trim() && <span style={{ fontSize: ts(13), color: "var(--ios-label2)" }}>{s(p, "example")}</span>}
          <button type="button" onClick={(e) => next(e.currentTarget)} onPointerDown={() => setDown(-1)} onPointerUp={() => setDown(null)} onPointerLeave={() => setDown(null)} style={{ marginTop: 4, border: "none", borderRadius: cr(999), height: 48, background: "var(--ios-accent)", color: "var(--spb-accent-ink, #fff)", fontSize: ts(17), fontWeight: fw(600), cursor: "pointer", fontFamily: "inherit", scale: down === -1 ? "0.97" : "1", transition: "scale .12s ease-out" }}>
            {s(p, "nextTitle")}
          </button>
        </div>
      )}
      <style>{"@keyframes spb-qc-shake{0%,100%{transform:none}20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}@keyframes spb-qc-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes spb-qc-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}@keyframes spb-qc-fade{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion: reduce){.spb-qc-anim,.spb-qc-panel{animation-name:spb-qc-fade!important}}"}</style>
    </div>
  );
};
