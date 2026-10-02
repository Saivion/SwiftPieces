import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * An iPhone drawn in CSS: a titanium band, a black bezel, the Dynamic Island, a status bar and the side
 * buttons, with the screen on the dark preview stage so a live piece sits on it the way it would in a
 * dark-mode app. It stays dark in both site themes (.stage-dark), like a real device on a bright stage. Size it by width; the
 * height follows the 9:19.5 screen. Children fill the screen below the status bar.
 */
export function IPhone({ children, className, screenClassName }: { children: ReactNode; className?: string; screenClassName?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "stage-dark relative rounded-[48px] bg-[#1b1b1d] p-[3px] shadow-[0_50px_90px_-30px_rgb(0_0_0/0.75),0_18px_40px_-18px_rgb(0_0_0/0.55),inset_0_0_0_1px_rgb(255_255_255/0.16)]",
        className,
      )}
    >
      {/* Side buttons: action and volume on the left, the side button on the right. */}
      <span className="absolute top-[92px] -left-[3px] h-[22px] w-[3px] rounded-l-[2px] bg-[#2a2a2c]" />
      <span className="absolute top-[128px] -left-[3px] h-[40px] w-[3px] rounded-l-[2px] bg-[#2a2a2c]" />
      <span className="absolute top-[176px] -left-[3px] h-[40px] w-[3px] rounded-l-[2px] bg-[#2a2a2c]" />
      <span className="absolute top-[140px] -right-[3px] h-[64px] w-[3px] rounded-r-[2px] bg-[#2a2a2c]" />
      <div className="rounded-[45px] bg-black p-[7px]">
        <div className={cn("relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[38px] bg-[var(--pv-bg,#121212)] text-[var(--pv-text,#f4f3ef)]", screenClassName)}>
          <StatusBar />
          <div className="relative min-h-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** 9:41, the Dynamic Island, and signal, Wi-Fi and battery, drawn to the system's proportions. */
function StatusBar() {
  return (
    <div className="relative flex h-[46px] shrink-0 items-center justify-between px-[26px] pt-[6px] text-[13px] font-semibold tracking-[-0.01em]">
      <span className="tabular-nums">9:41</span>
      <span className="absolute top-[10px] left-1/2 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-[5px]">
        <svg viewBox="0 0 18 12" className="h-[10px] w-[16px]" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-[10px] w-[14px]" fill="currentColor">
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.3-1.4A10.5 10.5 0 0 0 8 .3 10.5 10.5 0 0 0 .7 3.2L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.7c1.3 0 2.5.5 3.4 1.3l1.3-1.4A6.8 6.8 0 0 0 8 4a6.8 6.8 0 0 0-4.7 1.8l1.3 1.4c.9-.8 2.1-1.3 3.4-1.3Zm0 3.6c.5 0 .9.2 1.2.5L8 11.7 6.8 10c.3-.3.7-.5 1.2-.5Z" />
        </svg>
        <svg viewBox="0 0 27 12" className="h-[11px] w-[25px]" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="19" height="8" rx="2.2" fill="currentColor" />
          <path d="M24.5 4v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}
