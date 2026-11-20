"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Button, Arrow } from "@/components/ui/button";
import { GrainStage } from "@/components/visual/grain-stage";
import { sectionBody } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/** A callout beside the phone while its chapter is up; `at` places it against the device column. */
export type StageChip = { label: string; at: CSSProperties };

export type StageChapter = {
  id: string;
  /** Small line over the title. */
  kick: string;
  /** The chapter's name in the right-hand index. */
  tick: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
  chips?: StageChip[];
  /** The recording the phone plays: public/pro-stage/<loop>.mp4, .webm and .webp (its first frame). */
  loop: string;
  alt: string;
  /** How large the grain sun sits behind the phone (1 = 520px), and how the phone leans. */
  sun?: number;
  lean?: string;
};

/**
 * The Stage (Saivion's pick, 2026-11-19, "S stage for all"), as on pro.swiftpieces.com: one phone
 * pinned on a round Signature grain sun while the page tells one story in chapters around it. The copy
 * on the left, the screen, the callouts and the index on the right change together on scroll.
 *
 * Free never ships Pro's code, so the phone plays short recordings of Pro's screens and games
 * (public/pro-stage), each with its first frame as the poster. From lg the section is tall and its
 * frame sticks under the navbar; below lg nothing pins and each chapter's copy is followed by its own
 * phone. The copy renders once for both, so the first title stays the page's only h1.
 */
export function ProStage({ seed, chapters }: { seed: string; chapters: StageChapter[] }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0, 1]));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    let frame = 0;
    const read = () => {
      frame = 0;
      if (!wide.matches) return;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(0.999, Math.max(0, -r.top / span));
      const i = Math.floor(p * chapters.length);
      setActive(i);
      setSeen((s) => (s.has(i) && s.has(i + 1) ? s : new Set([...s, i, i + 1])));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [chapters.length]);

  const now = chapters[active] ?? chapters[0];
  const n = chapters.length;

  return (
    <section ref={ref} className="relative lg:h-[calc(var(--chapters)*82svh+18svh)]" style={{ "--chapters": n } as CSSProperties}>
      <div className="lg:sticky lg:top-[var(--nav-h)] lg:h-[calc(100svh-var(--nav-h))] lg:overflow-hidden">
        <Container className="lg:grid lg:h-full lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_150px] lg:items-center lg:gap-8">
          <div className="relative lg:z-10 lg:h-[380px]">
            {chapters.map((c, i) => {
              const Title = i === 0 ? "h1" : "h2";
              const on = i === active;
              return (
                <article
                  key={c.id}
                  className={cn(
                    "pt-14 pb-4 first:pt-10 lg:absolute lg:inset-0 lg:flex lg:flex-col lg:justify-center lg:p-0 lg:transition-[opacity,translate] lg:duration-700 lg:ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    on ? "lg:translate-y-0 lg:opacity-100" : "lg:pointer-events-none lg:translate-y-5 lg:opacity-0",
                  )}
                >
                  <p className="flex items-center gap-2 text-[13px] text-muted tabular-nums">
                    <span className="font-medium text-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span>/ {String(n).padStart(2, "0")}</span>
                    <span aria-hidden>·</span>
                    {c.kick}
                  </p>
                  <Title className="mt-4 text-[36px] leading-[1.04] font-normal tracking-[-0.04em] text-balance sm:text-[44px] lg:text-[48px] lg:tracking-[-0.045em]">{c.title}</Title>
                  <p className={cn("mt-4 max-w-[400px]", sectionBody)}>{c.body}</p>
                  {c.action ? (
                    <div className="mt-7">
                      <Button href={c.action.href}>{c.action.label} <Arrow /></Button>
                    </div>
                  ) : null}
                  {/* Phones and tablets: the chapter's screen right under its words. */}
                  <div className="relative mt-10 grid place-items-center py-6 lg:hidden">
                    <Sun seed={`${seed}-${c.id}`} className="size-[min(86vw,420px)]" />
                    <Phone className="relative w-[min(60vw,250px)]">
                      <Loop chapter={c} />
                    </Phone>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop: the pinned phone on its sun, the chapter's recording faded in over the last. */}
          <div className="relative hidden h-full place-items-center lg:grid">
            <Sun seed={seed} className="size-[min(520px,calc((100svh-var(--nav-h))*0.78))] transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ transform: `scale(${now.sun ?? 1})` }} />
            <div className="relative transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ transform: now.lean ?? "none" }}>
              <Phone className="w-[min(290px,calc((100svh-var(--nav-h))*0.38))]">
                {chapters.map((c, i) =>
                  seen.has(i) ? (
                    <div key={c.id} className={cn("absolute inset-0 transition-opacity duration-500", i === active ? "opacity-100" : "opacity-0")} aria-hidden={i !== active}>
                      <Loop chapter={c} playing={i === active} />
                    </div>
                  ) : null,
                )}
              </Phone>
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {chapters.map((c, i) =>
                (c.chips ?? []).map((chip) => (
                  <span
                    key={`${c.id}-${chip.label}`}
                    className={cn(
                      "absolute inline-flex h-8 items-center gap-2 rounded-[13.5px] bg-background pr-3 pl-1.5 text-[13px] font-medium whitespace-nowrap text-foreground shadow-[0_12px_30px_-12px_rgba(0,0,0,.35),0_0_0_1px_var(--line)] transition-[opacity,translate] duration-500",
                      i === active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                    )}
                    style={chip.at}
                  >
                    <span className="grid size-5 place-items-center rounded-[8.4px] bg-foreground text-[11px] text-background">✓</span>
                    {chip.label}
                  </span>
                )),
              )}
            </div>
          </div>

          {/* Desktop: where you are in the story. */}
          <ol aria-hidden className="hidden justify-items-end gap-3.5 lg:grid">
            {chapters.map((c, i) => (
              <li key={c.id} className={cn("flex items-center gap-3 text-[13px] transition-colors duration-300", i === active ? "text-foreground" : "text-subtle")}>
                {c.tick}
                <span className={cn("h-[2px] rounded-full transition-all duration-500", i === active ? "w-[54px] bg-foreground" : "w-[26px] bg-[var(--line-strong)]")} />
              </li>
            ))}
          </ol>
        </Container>
      </div>
    </section>
  );
}

/** A plain device: a dark band and bezel around a recording that already carries its own status bar. */
function Phone({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[46px] bg-[#1b1b1d] p-[3px] shadow-[0_50px_90px_-30px_rgb(0_0_0/0.7),0_18px_40px_-18px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(255_255_255/0.16)]", className)}>
      <div className="rounded-[43px] bg-black p-[6px]">
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[37px] bg-black">{children}</div>
      </div>
    </div>
  );
}

/**
 * One chapter's recording. It shows its first frame until it nears the viewport, then plays muted on a
 * loop; under Reduce Motion it stays on that frame. On desktop only the chapter that is up plays.
 */
function Loop({ chapter, playing = true }: { chapter: StageChapter; playing?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [still, setStill] = useState(false);
  const base = `/pro-stage/${chapter.loop}`;

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || still) return;
    if (near && playing) v.play().catch(() => {});
    else v.pause();
  }, [near, playing, still]);

  return (
    <video
      ref={ref}
      className="absolute inset-0 size-full object-cover object-top"
      poster={`${base}.webp`}
      muted
      loop
      playsInline
      preload={near ? "auto" : "none"}
      aria-label={chapter.alt}
    >
      <source src={`${base}.webm`} type="video/webm" />
      <source src={`${base}.mp4`} type="video/mp4" />
    </video>
  );
}

/** The round Signature grain behind the phone: the page's one disc of colour. */
function Sun({ seed, className, style }: { seed: string; className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden className={cn("absolute top-1/2 left-1/2 isolate -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full", className)} style={style}>
      <div className="absolute inset-0">
        <GrainStage seed={seed} kind="brand" core={[0.5, 0.95, 0.8, 1]} />
      </div>
    </div>
  );
}

/** The library in numbers, one hairline grid under the story. */
export function StageCounts({ items }: { items: { value: string; label: string }[] }) {
  return (
    <section className="relative py-12 sm:py-[68px]">
      <Container>
        <dl className="grid grid-cols-2 border-t border-[var(--line)] sm:grid-cols-4">
          {items.map((it) => (
            <div key={it.label} className="flex items-baseline gap-3 border-b border-[var(--line)] py-6 pr-4 [&:not(:nth-child(4n+1))]:sm:border-l [&:not(:nth-child(4n+1))]:sm:pl-5">
              <dt className="sr-only">{it.label}</dt>
              <dd className="contents">
                <span className="text-[34px] leading-none tracking-[-0.04em] sm:text-[40px]">{it.value}</span>
                <span className="text-[13.5px] text-muted">{it.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
