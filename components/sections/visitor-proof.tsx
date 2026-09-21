import { getRecentVisits } from "@/lib/visits";
import { LiveVisits } from "@/components/sections/live-visits";

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
 *
 * Opaque, via color-mix rather than a white at low alpha. The discs overlap, and a translucent one
 * shows the disc beneath it through the overlap, which reads as a rendering fault rather than a
 * stack. color-mix resolves to a solid color while still deriving from the background token, so the
 * ramp stays one edit away from the theme instead of five hardcoded composites.
 */
const AVATARS = [7, 10, 13, 16, 19].map((pct) => `color-mix(in srgb, #fff ${pct}%, var(--background))`);

/**
 * The glyph, one step brighter than the disc it sits on so it reads at 28px without hard contrast.
 * Translucency is safe here: it composites against its own opaque disc, never the one behind it.
 */
const GLYPH = "rgb(255 255 255 / 0.38)";


/**
 * Social proof under the hero action: a stack of drawn avatars and the site's real all-time visit
 * count from Cloudflare Web Analytics.
 *
 * The count is kept current by `LiveVisits`, which polls /api/visits. This component only supplies
 * the starting value and the avatars. That split is what fixed the count disappearing: the value
 * rendered here comes from the Cloudflare build, which has no Worker secrets and so has no count,
 * and nothing used to correct it until the page revalidated.
 *
 * The floor still applies to the build-time value. A number under it is treated as "no starting
 * value" rather than as a reason to hide the line, because the live poll may well return one.
 */
export async function VisitorProof() {
  const visits = await getRecentVisits();
  const floor = minToShow();
  const initial = visits !== null && visits >= floor ? visits : null;
  if (visits !== null && visits < floor) {
    console.warn(`[visits] initial hidden: ${visits} is under the SP_VISITS_MIN floor of ${floor}`);
  }
  return (
    <LiveVisits initial={initial}>
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
    </LiveVisits>
  );
}
