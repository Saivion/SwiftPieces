import type { CSSProperties } from "react";
import { stills, type StillPiece } from "@/components/landing/stills";
import { cn } from "@/lib/cn";

/** A piece's still in the site's theme: the light one on paper, the dark one in dark mode. */
export function Still({ s, className, alt = true }: { s: StillPiece; className?: string; alt?: boolean }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.light} alt={alt ? `${s.title}, a SwiftPieces component` : ""} loading="lazy" decoding="async" className={cn("hidden [html.light_&]:block", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.dark} alt="" aria-hidden loading="lazy" decoding="async" className={cn("[html.light_&]:hidden", className)} />
    </>
  );
}

/** A still on a raised tile with a hairline: the unit the wall is built from. */
export function Tile({ s, className, style, tabIndex, alt }: { s: StillPiece; className?: string; style?: CSSProperties; tabIndex?: number; alt?: boolean }) {
  return (
    <a href={s.href} style={style} tabIndex={tabIndex} className={cn("block overflow-hidden rounded-[18px] bg-surface-2 p-1 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_40px_-26px_rgb(0_0_0/0.35)] ring-1 ring-[var(--line)]", className)}>
      <Still s={s} alt={alt} className="aspect-[4/3] w-full rounded-[14px] object-cover" />
    </a>
  );
}

/** The pieces on the wall, read across: neighbours differ in colour and kind. */
const WALL = [
  "MotionCard", "ScrubChart", "SwipeDeck", "ReactionToggle", "TimerDial", "ParallaxCard", "ActivityHeatmap", "CommitButton",
  "RingBreakdown", "AmountField", "FlipCard", "RatingScrub", "StatusTimeline", "QRCode", "PictureHeadline", "LiquidSwitch",
  "OutcomeScreen", "ElasticButton", "WalletStack", "SelectMenu", "LiveStat", "FilterRail", "TaskRow", "PromptChips",
];

/**
 * The hero's visual: the library as a wall laid back in perspective, eight columns drifting in turns up
 * and down, fading out at every edge. Stills, not live previews, so it costs images and one CSS
 * animation per column. Each column repeats its pieces so the half-height loop never shows a seam; only
 * the first run is reachable by keyboard and screen readers.
 */
export function HeroWall({ className }: { className?: string }) {
  const all = stills(WALL);
  const cols = Array.from({ length: 8 }, (_, c) => all.filter((_, i) => i % 8 === c));
  return (
    <div
      className={cn(
        "relative h-[440px] overflow-hidden sm:h-[560px] lg:h-[640px]",
        "[mask-image:linear-gradient(to_bottom,transparent,black_10%,black_72%,transparent),linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [mask-composite:intersect]",
        className,
      )}
    >
      <div className="absolute inset-0 origin-top scale-[0.58] sm:scale-[0.85] lg:scale-100">
      <div className="absolute top-[-40px] left-1/2 flex origin-top gap-4" style={{ transform: "translateX(-50%) perspective(2400px) rotateX(40deg) rotateZ(-18deg)" }}>
        {cols.map((col, c) => (
          <div key={c} className={cn("wall-col flex w-[230px] shrink-0 flex-col gap-4", c % 2 === 1 && "wall-rev")} style={{ "--d": `${70 + c * 6}s`, marginTop: c % 2 ? -100 : 0 } as CSSProperties}>
            {[0, 1, 2, 3].flatMap((run) => col.map((s) => <Tile key={`${run}-${s.name}`} s={s} alt={run === 0} tabIndex={run === 0 ? undefined : -1} />))}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
