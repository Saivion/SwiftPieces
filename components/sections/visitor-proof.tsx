import { getRecentVisits, VISIT_WINDOW_DAYS } from "@/lib/visits";

/**
 * Below this the line hides: "7 visits" undersells more than showing nothing at all. A new site
 * sits under the floor for a while, and that looks exactly like a broken integration, so the floor
 * is a Worker var rather than a constant: set `SP_VISITS_MIN` to `0` to show the real number from
 * day one, or raise it before a launch. Anything unparseable falls back to the default.
 */
const DEFAULT_MIN_TO_SHOW = 100;

function minToShow(): number {
  // An empty var means "unset", not zero: Number("") is 0, which would quietly drop the floor.
  const raw = process.env.SP_VISITS_MIN?.trim();
  if (!raw) return DEFAULT_MIN_TO_SHOW;
  const configured = Number(raw);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_MIN_TO_SHOW;
}

/**
 * The avatars are drawn, not photographed, and carry no faces or names. The visits are anonymous,
 * so the stack reads as "people have been here" without pretending to be particular people.
 *
 * Site chrome, not component palette: `blocks` is the preview palette the pieces paint themselves
 * in, and five pastels read as a sixth component sitting under the hero rather than part of the
 * page. This is the page's own surface ramp instead, lifted in even steps so the overlap stays
 * legible. The accent red is left out on purpose: it belongs to the one action directly above.
 */
const AVATARS = [
  "rgb(255 255 255 / 0.07)",
  "rgb(255 255 255 / 0.10)",
  "rgb(255 255 255 / 0.13)",
  "rgb(255 255 255 / 0.16)",
  "rgb(255 255 255 / 0.19)",
];

/** The glyph, one step brighter than the disc it sits on so it reads at 28px without hard contrast. */
const GLYPH = "rgb(255 255 255 / 0.38)";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Social proof under the hero action: a stack of drawn avatars and the site's real visit count from
 * Cloudflare Web Analytics. Renders nothing until the analytics secrets are set, or while the count
 * is still under `SP_VISITS_MIN`, so forks and fresh deploys never show an awkward number. Both
 * silences say so in `wrangler tail`, so a hidden line is never mistaken for a broken one.
 */
export async function VisitorProof() {
  const visits = await getRecentVisits();
  if (visits === null) return null;
  const floor = minToShow();
  if (visits < floor) {
    // lib/visits.ts logs why a null happened; this logs the one case where the number was fine.
    console.warn(`[visits] hidden: ${visits} is under the SP_VISITS_MIN floor of ${floor}`);
    return null;
  }
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="flex -space-x-2">
        {AVATARS.map((fill, i) => (
          <span key={i} className="grid size-7 place-items-center overflow-hidden rounded-full ring-2 ring-[var(--background)]" style={{ background: fill }}>
            <svg viewBox="0 0 28 28" className="size-full">
              <circle cx="14" cy="11.5" r="4.6" fill={GLYPH} />
              <path d="M5.5 28c0-5.2 3.8-8.8 8.5-8.8s8.5 3.6 8.5 8.8z" fill={GLYPH} />
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
