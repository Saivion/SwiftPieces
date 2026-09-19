"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "../cn.js";

type Props = { webm?: string; mp4?: string; poster?: string; title: string; className?: string; aspect?: string };

/** Pre-rendered simulator loop from R2. Plays only in view, respects reduced motion, never autoplays off-screen. */
export function PreviewVideo({ webm, mp4, poster, title, className, aspect = "aspect-[4/3]" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) el.play().catch(() => {}); else el.pause(); }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if ((!webm && !mp4) || failed) {
    return (
      <div className={cn("flex w-full items-center justify-center rounded-[var(--radius)] bg-surface-2 text-sm text-muted", aspect, className)} role="img" aria-label={`${title} preview not available`}>
        Preview coming soon
      </div>
    );
  }
  return (
    <video ref={ref} className={cn("w-full rounded-[var(--radius)] bg-black object-cover", aspect, className)} poster={poster} muted loop playsInline preload="metadata" aria-label={`${title} preview`} onError={() => setFailed(true)}>
      {webm ? <source src={webm} type="video/webm" /> : null}
      {mp4 ? <source src={mp4} type="video/mp4" /> : null}
    </video>
  );
}
