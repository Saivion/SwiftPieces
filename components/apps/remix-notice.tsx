import { cn } from "@/lib/cn";

/** What the App Library's screens are, in three short points: reference, our own look, yours to remix. */
export const REMIX_POINTS = [
  { title: "Inspiration, not copies", body: "App Store screenshots are shown for reference. Every screen we run is an original remix." },
  { title: "The SwiftPieces look", body: "Our colours, type and red mascot, with our own copy and data. No logos, their characters or brand colours." },
  { title: "Yours to remix", body: "Change anything in the Playground. What you publish is yours to make your own." },
] as const;

/** The three points on a tile of the tray colour, side by side from sm up. */
export function RemixNotice({ className }: { className?: string }) {
  return (
    <aside aria-label="About these remixes" className={cn("rounded-[22px] bg-surface", className)}>
      <ul className="grid gap-5 p-5 sm:grid-cols-3 sm:gap-8 sm:p-6 lg:px-7">
        {REMIX_POINTS.map((p) => (
          <li key={p.title}>
            <p className="flex items-center gap-2 text-[14.5px] font-medium tracking-[-0.01em] text-foreground">
              <span aria-hidden className="size-1.5 flex-none rounded-full bg-accent" />
              {p.title}
            </p>
            <p className="mt-1.5 text-[13.5px] leading-[21px] text-pretty text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
