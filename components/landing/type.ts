/**
 * The landing page's type scale. Small and quiet on purpose: one display size for the hero, one heading
 * size for every section (a dark lead and a muted continuation in the same line), and one body size.
 * The visuals carry each point; the words only name it.
 */
export const display = "text-[26px] leading-[1.2] font-normal tracking-[-0.02em] text-balance sm:text-[30px] lg:text-[32px] lg:tracking-[-0.025em]";
export const heading = "text-[20px] leading-[1.32] font-normal tracking-[-0.012em] text-balance sm:text-[22px]";
export const body = "text-[15px] leading-[24px] text-pretty text-muted";
export const small = "text-[13px] leading-[20px] text-muted";
/** Every section sits this far from its neighbours. */
export const gap = "py-10 sm:py-14";
/** The tinted ground a visual sits on: paper one step off the page. */
export const ground = "rounded-[24px] bg-surface";
/** A window or card lifted off the ground. */
export const raised = "rounded-[14px] border border-[var(--line)] bg-surface-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_48px_-28px_rgb(0_0_0/0.22)]";
