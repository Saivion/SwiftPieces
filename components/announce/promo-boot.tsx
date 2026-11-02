import { promoKey } from "@/lib/promo";

/**
 * Runs before the page paints: if this browser closed the bar, or its offer has ended, `promo-off` on
 * <html> hides it and zeroes --promo-h (globals.css), so the navbar and its spacer never jump.
 *
 * The logic lives in a static file (public/promo-boot.js) rather than an inline script. It has no
 * `async` or `defer`, so the browser runs it where it sits, before the navbar below it paints. The
 * bar's key and end time go in as data attributes, which React escapes like any other attribute.
 */
export function PromoBoot({ id, endsAt }: { id: string; endsAt?: string }) {
  const end = endsAt ? Date.parse(endsAt) : 0;
  return <script src="/promo-boot.js" data-key={promoKey(id)} data-ends={end || undefined} />;
}
