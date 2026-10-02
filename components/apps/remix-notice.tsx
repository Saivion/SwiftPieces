import { CornerTicks } from "@/components/sections/feature-row";
import { cn } from "@/lib/cn";

/** What the App Library's screens are, in three short points: reference, our own look, yours to remix. */
export const REMIX_POINTS = [
  { title: "Inspiration, not copies", body: "App Store screenshots are shown for reference. Every screen we run is an original remix." },
  { title: "The Swift Pieces look", body: "Our colours, type and red mascot, with our own copy and data. No logos, their characters or brand colours." },
  { title: "Yours to remix", body: "Change anything in the Playground. What you publish is yours to make your own." },
] as const;

export function RemixNotice({ className }: { className?: string }) {
  return (
    <aside aria-label="About these remixes" className={cn("frame-dashed relative [--grid-line:var(--card-border)]", className)}>
      <CornerTicks />
      <ul className="grid gap-5 p-5 sm:grid-cols-3 sm:gap-8 lg:px-7">
        {REMIX_POINTS.map((p) => (
          <li key={p.title}>
            <p className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
              <span aria-hidden className="size-1.5 flex-none rounded-full bg-accent" />
              {p.title}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
