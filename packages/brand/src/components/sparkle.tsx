import { cn } from "../cn.js";
/** Four-point sparkle used on primary calls to action. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn("size-4", className)} fill="currentColor">
      <path d="M8 0.5c.4 3.9 3.6 7.1 7.5 7.5-3.9.4-7.1 3.6-7.5 7.5C7.6 11.6 4.4 8.4.5 8 4.4 7.6 7.6 4.4 8 .5Z" />
    </svg>
  );
}
