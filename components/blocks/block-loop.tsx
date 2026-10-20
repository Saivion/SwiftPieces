"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A Pro block in motion, where Free can't run Pro's preview: its still, with one pass of its live loop over it
 * (public/pro-blocks/<id>.webp, .webm and .mp4, recorded from Pro's own card stage by Pro's
 * scripts/block-loops.ts). The loop starts on the still's frame and ends on it again, so it repeats without a
 * seam and fades in over the still without a jump.
 *
 * The video loads only when it first plays, and it plays only on screen in a visible tab, once the motion
 * gate has opened (components/motion-gate.tsx) and never under Reduce Motion. Paused, it rewinds and hands
 * back to the still, which is also what paints first, what search and screen readers get, and all that shows
 * without JavaScript.
 */
export function BlockLoop({ still, loop, alt, eager = false, fit = "cover" }: { still: string; loop: string; alt: string; eager?: boolean; fit?: "cover" | "contain" }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = false;
    let open = Boolean(document.documentElement.dataset.motion);
    const sync = () => {
      if (onScreen && open && !reduce.matches && !document.hidden) void video.play().catch(() => {});
      else if (!video.paused) video.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    }, { threshold: 0.2 });
    io.observe(video);
    const gate = () => {
      open = true;
      sync();
    };
    window.addEventListener("sp:motion", gate, { once: true });
    reduce.addEventListener("change", sync);
    // The browser pauses video in a hidden tab and, for a video started from script, never resumes it.
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      window.removeEventListener("sp:motion", gate);
      reduce.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const media = cn("absolute inset-0 size-full", fit === "cover" ? "object-cover" : "object-contain");
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static still; next/image would re-encode it per width for no gain */}
      <img src={still} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" className={media} />
      <video
        ref={ref}
        aria-hidden
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setPlaying(true)}
        onPause={(e) => {
          e.currentTarget.currentTime = 0;
          setPlaying(false);
        }}
        className={cn(media, "transition-opacity duration-300", playing ? "opacity-100" : "opacity-0")}
      >
        <source src={`${loop}.webm`} type="video/webm" />
        <source src={`${loop}.mp4`} type="video/mp4" />
      </video>
    </>
  );
}
