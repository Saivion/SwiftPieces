import type { CSSProperties, ReactNode } from "react";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { cn } from "@/lib/cn";

/**
 * A skeleton app screen for the landing's iPhones: quiet placeholder blocks where an app's own content
 * would be, so the phone reads as a real screen and the one live piece in it is the thing you look at.
 * Blocks sit on the phone's dark stage (.stage-dark), a step up from its ground.
 */

const tone = { block: "bg-[#222224]", soft: "bg-[#1a1a1b]", strong: "bg-[#2c2c2e]" } as const;

/** One placeholder bar. `w` is a width (any CSS length), `h` a height in px. */
export function Bone({ w = "100%", h = 10, round, strong, className, style }: { w?: string | number; h?: number; round?: boolean; strong?: boolean; className?: string; style?: CSSProperties }) {
  return <span className={cn("block shrink-0", strong ? tone.strong : tone.block, round ? "rounded-full" : "rounded-[5px]", className)} style={{ width: w, height: h, ...style }} />;
}

/** A large title with a caption over it and a round button beside it: the top of most app screens. */
export function SkeletonHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-end justify-between px-4 pt-2 pb-4", className)}>
      <div className="flex flex-col gap-2">
        <Bone w={64} h={8} />
        <Bone w={132} h={18} strong />
      </div>
      <Bone w={30} h={30} round />
    </div>
  );
}

/** A list row: a round leading tile, two lines, a trailing value. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", className)}>
      <Bone w={34} h={34} round />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Bone w="62%" h={9} strong />
        <Bone w="40%" h={7} />
      </div>
      <Bone w={28} h={8} />
    </div>
  );
}

/** A form field: a label over a filled block. */
export function SkeletonField({ label = 54, className }: { label?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 px-4 py-1.5", className)}>
      <Bone w={label} h={7} />
      <div className={cn("flex h-11 items-center rounded-[12px] px-3.5", tone.soft)}>
        <Bone w="46%" h={8} />
      </div>
    </div>
  );
}

/** A content card: a block with lines under it. */
export function SkeletonCard({ h = 120, className }: { h?: number; className?: string }) {
  return (
    <div className={cn("mx-4 flex flex-col gap-2.5", className)}>
      <span className={cn("block rounded-[16px]", tone.soft)} style={{ height: h }} />
      <Bone w="70%" h={9} strong />
      <Bone w="48%" h={7} />
    </div>
  );
}

/** A row of pill chips. */
export function SkeletonChips({ widths = [58, 72, 50, 64], className }: { widths?: number[]; className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-hidden px-4", className)}>
      {widths.map((w, i) => <Bone key={i} w={w} h={26} round strong={i === 0} />)}
    </div>
  );
}

/** A grouped list: rows inside one rounded block, like Settings. */
export function SkeletonGroup({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("mx-4 overflow-hidden rounded-[16px]", tone.soft, className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-white/[0.04] px-3.5 py-3 last:border-b-0">
          <Bone w={26} h={26} className="rounded-[8px]!" strong />
          <Bone w={`${54 - i * 8}%`} h={9} />
          <span className="flex-1" />
          <Bone w={18} h={8} />
        </div>
      ))}
    </div>
  );
}

/** A tab bar at the foot of the screen. */
export function SkeletonTabs({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-around px-6 py-3", className)}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="flex flex-col items-center gap-1.5">
          <Bone w={20} h={20} round strong={i === 0} />
          <Bone w={26} h={5} />
        </span>
      ))}
    </div>
  );
}

/** A planner's week strip: seven day columns, a letter over a date, with today's column raised. */
export function SkeletonWeek({ today = 3, className }: { today?: number; className?: string }) {
  return (
    <div className={cn("flex justify-between px-4", className)}>
      {Array.from({ length: 7 }, (_, i) => {
        const on = i === today;
        // Plain spans rather than Bones: today's marks are a step lighter than the raised column under them.
        return (
          <span key={i} className={cn("flex h-[50px] w-[30px] flex-col items-center justify-center gap-2 rounded-[10px]", on && tone.strong)}>
            <span className={cn("block h-[5px] w-2 rounded-[5px]", on ? "bg-[#3a3a3d]" : tone.block)} />
            <span className={cn("block h-2 w-3 rounded-[5px]", on ? "bg-[#4a4a4e]" : tone.strong)} />
          </span>
        );
      })}
    </div>
  );
}

/** A section label over a list: a short caption and a quiet count at the right. */
export function SkeletonSection({ w = 54, className }: { w?: number; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-4 pt-4 pb-2.5", className)}>
      <Bone w={w} h={7} strong />
      <Bone w={18} h={7} />
    </div>
  );
}

/** A to-do in a list of them: a rounded row with the check ring, a title and, optionally, a tag. */
export function SkeletonTask({ title = "60%", tag, className }: { title?: string; tag?: boolean; className?: string }) {
  return (
    <div className={cn("mx-4 flex items-center gap-3 rounded-[12px] px-3 py-3.5", tone.soft, className)}>
      <span className="size-[17px] shrink-0 rounded-full border-2 border-[#2c2c2e]" />
      <Bone w={title} h={8} strong />
      <span className="flex-1" />
      {tag ? <Bone w={30} h={14} round /> : null}
    </div>
  );
}

/** A summary card over a list: a caption, a large figure and a line under it, and a week of bars. */
export function SkeletonStat({ bars = [36, 58, 44, 78, 52, 94, 30], className }: { bars?: number[]; className?: string }) {
  return (
    <div className={cn("mx-4 flex items-end justify-between rounded-[16px] px-4 py-3.5", tone.soft, className)}>
      <div className="flex flex-col gap-2">
        <Bone w={56} h={7} />
        <Bone w={98} h={18} strong />
        <Bone w={66} h={7} />
      </div>
      <div className="flex h-[46px] items-end gap-[5px]">
        {bars.map((h, i) => <span key={i} className={cn("w-[7px] rounded-[2px]", i === bars.indexOf(Math.max(...bars)) ? "bg-[#3a3a3d]" : tone.block)} style={{ height: `${h}%` }} />)}
      </div>
    </div>
  );
}

/** A pushed screen's bar: a back button, a centred title and a trailing action, for detail screens. */
export function SkeletonNav({ title = 96, className }: { title?: number; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-4 pt-1 pb-3", className)}>
      <Bone w={30} h={30} round />
      <Bone w={title} h={10} strong />
      <Bone w={30} h={30} round />
    </div>
  );
}

/** A place being booked: a photo tile, its name and area, and a rating at the right. */
export function SkeletonStay({ className }: { className?: string }) {
  return (
    <div className={cn("mx-4 flex items-center gap-3", className)}>
      <span className={cn("block size-[46px] shrink-0 rounded-[12px]", tone.strong)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Bone w="68%" h={9} strong />
        <Bone w="44%" h={7} />
      </div>
      <Bone w={30} h={14} round />
    </div>
  );
}

/** A booking bar at the foot: the total and a line under it, and a pill button to reserve. */
export function SkeletonBookingBar({ className }: { className?: string }) {
  return (
    <div className={cn("mx-4 flex items-center justify-between border-t border-white/[0.05] pt-3.5", className)}>
      <div className="flex flex-col gap-2">
        <Bone w={74} h={12} strong />
        <Bone w={52} h={7} />
      </div>
      <span className="block h-[40px] w-[112px] rounded-full bg-[#3a3a3d]" />
    </div>
  );
}

/** A log of past sessions in one rounded block: a date tile, a line or two, and the minutes at the right. */
export function SkeletonLog({ rows = 2, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("mx-4 overflow-hidden rounded-[16px]", tone.soft, className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-white/[0.04] px-3.5 py-3 last:border-b-0">
          <span className={cn("flex size-[32px] shrink-0 flex-col items-center justify-center gap-1 rounded-[9px]", tone.strong)}>
            <span className="block h-[4px] w-3 rounded-[5px] bg-[#3a3a3d]" />
            <span className="block h-[7px] w-3.5 rounded-[5px] bg-[#4a4a4e]" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone w={`${58 - i * 12}%`} h={8} strong />
            <Bone w="34%" h={6} />
          </div>
          <Bone w={38} h={16} round strong />
        </div>
      ))}
    </div>
  );
}

/**
 * Where the live piece goes: a band of the screen `h` px tall showing a live preview. Previews scale with
 * their frame's width, so the frame is drawn `scale` times the screen's width and centred; its ground is
 * cleared, so only the piece paints. `align` pins the frame to the band's top, centre or bottom, and the
 * band clips what falls outside it (a preview's own placeholder rows, for example) unless `bleed` is set.
 */
export function Slot({ name, h, scale = 1, aspect = "aspect-[4/3]", align = "center", bleed, className, children }: { name: string; h: number; scale?: number; aspect?: string; align?: "top" | "center" | "bottom"; bleed?: boolean; className?: string; children?: ReactNode }) {
  const inset = `${(-(scale - 1) / 2) * 100}%`;
  return (
    <div className={cn("relative shrink-0", bleed ? "overflow-visible" : "overflow-hidden", className)} style={{ height: h }}>
      <div
        className={cn("absolute", align === "top" ? "top-0" : align === "bottom" ? "bottom-0" : "top-1/2 -translate-y-1/2")}
        style={{ left: inset, right: inset }}
      >
        <PreviewFrame tone="clear" aspect={aspect} className="rounded-none!">
          <PiecePreview name={name} />
        </PreviewFrame>
      </div>
      {children}
    </div>
  );
}
