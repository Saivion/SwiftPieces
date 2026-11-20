import type { CSSProperties, ReactNode } from "react";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { Still } from "@/components/landing/wall";
import type { StillPiece } from "@/components/landing/stills";
import { cn } from "@/lib/cn";

/**
 * A piece playing its live web preview (components/previews), with its still in the server HTML and
 * until the frame nears the viewport. The landing's visuals use this wherever a piece should move.
 */
export function Live({ s, className, aspect = "aspect-[4/3]" }: { s: StillPiece; className?: string; aspect?: string }) {
  return (
    <PreviewFrame aspect={aspect} className={cn("rounded-[14px]", className)} placeholder={<Still s={s} alt={false} className="size-full object-cover" />}>
      <PiecePreview name={s.name} />
    </PreviewFrame>
  );
}

/**
 * A live piece drawn at its natural size, then scaled into a small box and cropped to its middle.
 * Previews size their type to the stage, so a thumbnail rendered at thumbnail size reads as empty;
 * this keeps them looking like the piece, only smaller.
 */
export function Scaled({ s, w, h, zoom = 1, base = 400, className }: { s: StillPiece; w: number; h: number; zoom?: number; base?: number; className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden", className)} style={{ width: w, height: h }}>
      <span className="absolute top-1/2 left-1/2 block" style={{ width: base, height: base * 0.75, transform: `translate(-50%,-50%) scale(${(Math.max(w, (h * 4) / 3) * zoom) / base})` }}>
        <Live s={s} className="size-full rounded-none" aspect="" />
      </span>
    </span>
  );
}

/** The wall's raised tile, with the piece playing inside it. */
export function LiveTile({ s, className, style, tabIndex, alt = true }: { s: StillPiece; className?: string; style?: CSSProperties; tabIndex?: number; alt?: boolean }) {
  return (
    <a href={s.href} style={style} tabIndex={tabIndex} aria-label={alt ? `${s.title}, a SwiftPieces component` : undefined} aria-hidden={alt ? undefined : true} className={cn("block overflow-hidden rounded-[18px] bg-surface-2 p-1 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_40px_-26px_rgb(0_0_0/0.35)] ring-1 ring-[var(--line)]", className)}>
      <Live s={s} />
    </a>
  );
}

/** A phone in a thin black band. `island` off for recordings that carry their own status bar. */
export function Phone({ children, className, island = true }: { children: ReactNode; className?: string; island?: boolean }) {
  return (
    <div className={cn("relative shrink-0 rounded-[30px] bg-[#0b0b0b] p-[5px] shadow-[0_40px_70px_-28px_rgb(0_0_0/0.6)]", className)}>
      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[25px] bg-[var(--pv-bg)]">
        {children}
        {island ? <span aria-hidden className="absolute top-[7px] left-1/2 h-[14px] w-[30%] -translate-x-1/2 rounded-full bg-black" /> : null}
      </div>
    </div>
  );
}

/** A silent looping recording (a game being played, a Pro screen running). */
export function Loop({ src, poster, label }: { src: string; poster: string; label: string }) {
  return <video src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" aria-label={label} className="size-full object-cover" />;
}
