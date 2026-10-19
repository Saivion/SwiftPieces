import Link from "next/link";
import { Arrow } from "@/components/ui/button";
import { Sketch } from "./sketch";
import { CARD, tintStyle, type ChangelogEntry } from "./changelog-grid";
import { changelog, changelogPath } from "@/lib/changelog";
import { cn } from "@/lib/cn";

/**
 * What's new: the first thing in every docs page's right column, above "On this page", opening the
 * changelog. Its icon is the latest update's own drawing on its pastel, as on the update's card, so
 * the button changes with each release. The same glass as the Pro and Sponsors cards below it.
 */
export function WhatsNewButton() {
  const latest = changelog[0];
  if (!latest) return null;
  return (
    <Link
      href={changelogPath()}
      className="group docs-glass mb-7 flex items-center gap-3 rounded-full py-2 pr-4 pl-2 outline-1 -outline-offset-1 outline-transparent transition-[outline-color] duration-300 hover:outline-[var(--card-border-hover)]"
    >
      <span className="changelog-tint grid size-8 shrink-0 place-items-center rounded-full" style={tintStyle(latest.tint)}>
        <Sketch kind={latest.visual} seed={1} icon className="size-[22px] text-[#141414]" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-tight font-medium tracking-[-0.01em] text-foreground">What&apos;s new</span>
      <Arrow className="size-3.5 shrink-0 text-subtle transition-colors duration-300 group-hover:text-foreground" />
    </Link>
  );
}

/**
 * The changelog's lead card: the latest update large, its drawing beside what it brought. Side by
 * side once the docs column is wide enough (container query), stacked above that.
 */
export function LatestUpdate({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="@container">
      <Link href={changelogPath(entry.slug)} className={cn(CARD, "grid @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]")}>
        <div className="changelog-tint relative grid aspect-[16/9] place-items-center rounded-[16px] @2xl:aspect-auto @2xl:min-h-[300px]" style={tintStyle(entry.tint)}>
          <span className="absolute top-3 left-3 inline-flex h-5 items-center rounded-full bg-[#141414] px-2 text-[11px] font-semibold text-[#fff]">Latest</span>
          <Sketch kind={entry.visual} seed={1} className="h-[44%] w-auto text-[#141414] transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
        <div className="flex flex-col p-5 @2xl:p-7">
          <p className="text-[12px] leading-none text-subtle">{entry.date} · {entry.points.length} changes</p>
          <h3 className="mt-4 text-[26px] leading-[1.15] font-normal tracking-[-0.03em] text-balance text-foreground">{entry.title}</h3>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted">{entry.summary}</p>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[13px] font-semibold text-foreground">
            Read the update
            <Arrow className="size-3.5" />
          </span>
        </div>
      </Link>
    </div>
  );
}
