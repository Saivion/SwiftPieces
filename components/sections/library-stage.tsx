"use client";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { cn } from "@/lib/cn";

/**
 * A piece running live in a frame of any shape: pieces are composed on a 4:3 stage, so the stage is
 * fitted inside the frame (never cropped) on the same ground; backgrounds (`fill`) paint the whole
 * frame. Size the frame with `className` (a height, `flex-1`, or an aspect class). `bleed` lifts the
 * clip off the piece's own 4:3 stage, so a piece wider than it (Depth Carousel's neighbouring pages)
 * runs out to the frame's edges in a wide frame.
 */
export function PieceStage({ name, fill, bleed, className }: { name: string; fill?: boolean; bleed?: boolean; className?: string }) {
  return (
    <PreviewFrame aspect="" tone={fill ? "black" : "dark"} className={cn("rounded-[17px]", className)}>
      {fill ? (
        <PiecePreview name={name} />
      ) : (
        <div className={cn("absolute top-1/2 left-1/2 aspect-[4/3] w-[min(100cqw,133.333cqh)] -translate-x-1/2 -translate-y-1/2 [container-type:size]", bleed && "[&>div]:overflow-visible!")}>
          <PiecePreview name={name} />
        </div>
      )}
    </PreviewFrame>
  );
}
