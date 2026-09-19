import { blocks, ink } from "@/components/previews/palette";
import { getRecentVisits, VISIT_WINDOW_DAYS } from "@/lib/visits";

/** Below this the line hides: "7 visits" undersells more than showing nothing at all. */
const MIN_TO_SHOW = 100;

/**
 * The avatars are drawn, not photographed, and carry no faces or names. The visits are anonymous,
 * so the stack reads as "people have been here" without pretending to be particular people. The
 * accent red is left out on purpose; it belongs to the one action above.
 */
const AVATARS = [blocks.sand, blocks.sky, blocks.butter, blocks.sage, blocks.lilac];

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Social proof under the hero action: a stack of drawn avatars and the site's real visit count from
 * Cloudflare Web Analytics. Renders nothing until the analytics secrets are set, or while the count
 * is still small, so forks and fresh deploys never show an awkward number.
 */
export async function VisitorProof() {
  const visits = await getRecentVisits();
  if (visits === null || visits < MIN_TO_SHOW) return null;
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="flex -space-x-2">
        {AVATARS.map((fill, i) => (
          <span key={i} className="grid size-7 place-items-center overflow-hidden rounded-full ring-2 ring-[var(--background)]" style={{ background: fill }}>
            <svg viewBox="0 0 28 28" className="size-full">
              <circle cx="14" cy="11.5" r="4.6" fill={ink} fillOpacity={0.55} />
              <path d="M5.5 28c0-5.2 3.8-8.8 8.5-8.8s8.5 3.6 8.5 8.8z" fill={ink} fillOpacity={0.55} />
            </svg>
          </span>
        ))}
      </div>
      <p className="text-[13px] text-muted">
        <span className="font-semibold text-foreground tabular-nums">{compact.format(visits)}</span> visits in the last {VISIT_WINDOW_DAYS} days
      </p>
    </div>
  );
}
