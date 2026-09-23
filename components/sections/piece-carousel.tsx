"use client";
import { useEffect, useState } from "react";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";

/**
 * The CLI row's visual: pieces side by side on a track. The active piece plays its first complete
 * beat, then the track slides and the next piece starts from its first frame (it is keyed, so it
 * remounts). The next piece always peeks in on the right.
 *
 * `ms` is where that beat ends in each preview's script in components/previews/: keep these in
 * step if a preview's timing changes, or the slide lands mid-gesture.
 */
const SLIDES = [
  { name: "FloatingDock", title: "Floating Dock", ms: 5600 }, // navigation.tsx: select, hover across, settle on tab 4 (4500)
  { name: "CommitButton", title: "Commit Button", ms: 5200 }, // controls.tsx commitSteps: idle → loading → saved
  { name: "FanStack", title: "Fan Stack", ms: 4600 }, // controls.tsx fanSteps: open, hover three, close
  { name: "HoldToConfirm", title: "Hold to Confirm", ms: 5800 }, // controls.tsx holdSteps: short, cancel, hold, done
  { name: "Toast", title: "Toast", ms: 4900 }, // sheets.tsx toastScript: the whole loop
  { name: "ElasticButton", title: "Elastic Button", ms: 4000 }, // controls.tsx elasticSteps: one press, deep and back
] as const;

const GAP = 16;

export function PieceCarousel() {
  const [i, setI] = useState(0);
  const [sliding, setSliding] = useState(false);
  const n = SLIDES.length;
  const at = (k: number) => SLIDES[(i + k) % n];

  useEffect(() => {
    // Reduced motion: hold on the first piece; its preview already honours the setting.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setSliding(true), SLIDES[i].ms);
    return () => clearTimeout(t);
  }, [i]);

  const advance = () => {
    setSliding(false);
    setI((v) => (v + 1) % n);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-[16px]">
        <div
          className="flex"
          style={{ gap: GAP, transform: sliding ? `translateX(calc(-72% - ${GAP}px))` : "none", transition: sliding ? "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)" : "none" }}
          onTransitionEnd={(e) => e.target === e.currentTarget && sliding && advance()}
        >
          {[0, 1, 2].map((k) => (
            <div key={`${(i + k) % n}-${k === 0 ? "active" : "rest"}`} className="w-[72%] shrink-0 overflow-hidden rounded-[16px] border border-white/[0.08] transition-opacity duration-500" style={{ opacity: k === 0 || (k === 1 && sliding) ? 1 : 0.45 }}>
              <PreviewFrame aspect="aspect-[4/3]" className="rounded-none!">
                <PiecePreview name={at(k).name} />
              </PreviewFrame>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-6">
        <p className="truncate font-mono text-[13px] text-muted"><span className="text-subtle">$</span> npx swiftpieces add <span className="text-foreground">{at(0).name}</span></p>
        <div className="flex shrink-0 items-center gap-1.5" aria-label={`${at(0).title}, ${i + 1} of ${n}`}>
          {SLIDES.map((s, k) => <span key={s.name} className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? "w-5 bg-foreground" : "w-1.5 bg-white/20"}`} />)}
        </div>
      </div>
    </div>
  );
}
