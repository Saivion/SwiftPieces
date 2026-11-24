"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => setR(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return r;
}

/** Steps an index every `ms` (after `delay`), forever. */
export function useTick(n: number, ms: number, delay = 0) {
  const reduced = useReduced();
  const [i, setI] = useState(0);
  const [go, setGo] = useState(delay === 0);
  useEffect(() => {
    if (go) return;
    const t = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(t);
  }, [go, delay]);
  useEffect(() => {
    if (reduced || !go) return;
    const t = setTimeout(() => setI((v) => (v + 1) % n), ms);
    return () => clearTimeout(t);
  }, [i, n, ms, reduced, go]);
  return [i, setI] as const;
}

/** One panel at a time; the incoming one enters with `enter` (a CSS animation class). */
export function Swap({ panels, ms, delay = 0, enter = "dx-wipe", className }: { panels: ReactNode[]; ms: number; delay?: number; enter?: string; className?: string }) {
  const [i] = useTick(panels.length, ms, delay);
  const prev = (i - 1 + panels.length) % panels.length;
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (i !== 0) setMoved(true);
  }, [i]);
  return (
    <div className={cn("relative", className)}>
      {/* The outgoing piece stays underneath while the next one wipes in over it. */}
      {moved ? <div key={`p${prev}`} className="absolute inset-0">{panels[prev]}</div> : null}
      <div key={`p${i}`} className={cn("absolute inset-0", moved && enter)}>{panels[i]}</div>
    </div>
  );
}

/** Sets data-s on a box, stepping through `ms` holds, looped. CSS reveals by step. */
export function Steps({ ms, className, children, style }: { ms: number[]; className?: string; children: ReactNode; style?: CSSProperties }) {
  const reduced = useReduced();
  const [s, setS] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setS((v) => (v + 1) % ms.length), ms[s]);
    return () => clearTimeout(t);
  }, [s, ms, reduced]);
  return <div data-s={reduced ? ms.length - 1 : s} className={className} style={style}>{children}</div>;
}

/** B's hero: a row of cards, the one in the middle on show, neighbours set back. */
export function Carousel({ panels, captions, ms, className }: { panels: ReactNode[]; captions: ReactNode[]; ms: number; className?: string }) {
  const n = panels.length;
  const [i, setI] = useTick(n, ms, 600);
  return (
    <div className={cn("relative", className)}>
      <div className="relative mx-auto h-full">
        {panels.map((p, k) => {
          let d = k - i;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              data-d={Math.max(-3, Math.min(3, d))}
              className="dx-car absolute top-0 left-1/2"
              aria-label={`Show piece ${k + 1}`}
              tabIndex={d === 0 ? -1 : 0}
            >
              {Math.abs(d) <= 2 ? p : null}
            </button>
          );
        })}
      </div>
      <div className="dx-car-cap relative mt-6 flex justify-center">
        <div key={i} className="dx-rise">{captions[i]}</div>
      </div>
    </div>
  );
}

/** Types a string char by char, keyed so it restarts when the text changes. */
export function Typed({ text, speed = 38, className }: { text: string; speed?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
  }, [text]);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), speed);
    return () => clearTimeout(t);
  }, [n, text, speed]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      <span className="dx-caret" aria-hidden />
    </span>
  );
}

/** C's hero: the command names a piece, its code and live preview follow. */
export function SourceHero({ names, codes, previews, ms }: { names: string[]; codes: ReactNode[]; previews: ReactNode[]; ms: number }) {
  const [i, setI] = useTick(names.length, ms, 400);
  return (
    <div className="dx-c-hero">
      <div className="dx-c-cmd">
        <span className="dx-c-prompt">$</span> npx swiftpieces add <Typed text={names[i]} className="dx-c-name" />
      </div>
      <div className="dx-c-window">
        <div className="dx-c-tabs">
          {names.map((n, k) => (
            <button key={n} type="button" data-on={k === i || undefined} onClick={() => setI(k)} className="dx-c-tab">
              {n}.swift
            </button>
          ))}
        </div>
        <div className="dx-c-split">
          <div key={`c${i}`} className="dx-c-code dx-lines">{codes[i]}</div>
          <div className="dx-c-canvas">
            <div key={`p${i}`} className="dx-pop size-full">{previews[i]}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** C's library: a file tree on the left, the selected file's piece on the right; walks the tree by itself. */
export function Tree({ groups, previews, ms }: { groups: { title: string; files: { name: string; i: number }[] }[]; previews: ReactNode[]; ms: number }) {
  const [i, setI] = useTick(previews.length, ms, 0);
  return (
    <div className="dx-c-tree">
      <div className="dx-c-files">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="dx-c-folder">▾ {g.title.toLowerCase()}/</p>
            {g.files.map((f) => (
              <button key={f.name} type="button" data-on={f.i === i || undefined} onMouseEnter={() => setI(f.i)} onClick={() => setI(f.i)} className="dx-c-file">
                {f.name}.swift
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="dx-c-view">
        <div key={i} className="dx-pop size-full">{previews[i]}</div>
      </div>
    </div>
  );
}

/** A's index: rows; hovering one floats its piece beside the pointer. */
export function IndexRows({ rows, previews }: { rows: ReactNode[]; previews: ReactNode[] }) {
  const [on, setOn] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div
      ref={ref}
      className="relative"
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseLeave={() => setOn(null)}
    >
      {rows.map((r, k) => (
        <div key={k} onMouseEnter={() => setOn(k)} data-on={on === k || undefined} className="dx-a-row">
          {r}
        </div>
      ))}
      <div className="pointer-events-none absolute z-10 w-[300px] transition-opacity duration-200 max-lg:hidden" style={{ left: pos.x + 28, top: pos.y - 110, opacity: on === null ? 0 : 1 }}>
        {on !== null ? <div key={on} className="dx-pop">{previews[on]}</div> : null}
      </div>
    </div>
  );
}

/** D's hero: pieces scattered on the table fly into a phone's slots, hold, scatter, and the next app builds. */
export function Assemble({ apps, ms = 5200, className }: { apps: ReactNode[]; ms?: number; className?: string }) {
  const reduced = useReduced();
  const [app, setApp] = useState(0);
  const [phase, setPhase] = useState<"out" | "in">("out");
  useEffect(() => {
    if (reduced) {
      setPhase("in");
      return;
    }
    const t = setTimeout(
      () => {
        if (phase === "out") setPhase("in");
        else {
          setPhase("out");
          setTimeout(() => setApp((a) => (a + 1) % apps.length), 900);
        }
      },
      phase === "out" ? 700 : ms,
    );
    return () => clearTimeout(t);
  }, [phase, ms, apps.length, reduced]);
  return (
    <div data-phase={phase} className={cn("dx-d-assemble", className)}>
      {apps.map((a, k) => (
        <div key={k} className="dx-d-app" data-on={k === app || undefined}>
          {a}
        </div>
      ))}
    </div>
  );
}

/** Counts up to a number once it scrolls into view. */
export function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 1400);
        setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref} className={className}>{v}</span>;
}

/** Tabs that walk by themselves; the panel under them follows. */
export function Tabs({ labels, panels, ms, className, tabClass }: { labels: string[]; panels: ReactNode[]; ms: number; className?: string; tabClass?: string }) {
  const [i, setI] = useTick(panels.length, ms, 0);
  return (
    <div className={className}>
      <div className="dx-tabs" role="tablist">
        {labels.map((l, k) => (
          <button key={l} type="button" role="tab" aria-selected={k === i} data-on={k === i || undefined} onClick={() => setI(k)} className={tabClass}>
            {l}
            <span className="dx-tab-fill" style={{ animationDuration: `${ms}ms` }} />
          </button>
        ))}
      </div>
      <div key={i} className="dx-rise">{panels[i]}</div>
    </div>
  );
}
