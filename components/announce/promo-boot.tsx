import { promoKey } from "@/lib/promo";

/**
 * Runs before the page paints: if this browser closed the bar, or its offer has ended, `promo-off` on
 * <html> hides it and zeroes --promo-h (globals.css), so the navbar and its spacer never jump.
 */
export function PromoBoot({ id, endsAt }: { id: string; endsAt?: string }) {
  const end = endsAt ? Date.parse(endsAt) : 0;
  const js = `try{if(localStorage.getItem(${JSON.stringify(promoKey(id))})==="1"${end ? `||Date.now()>=${end}` : ""})document.documentElement.classList.add("promo-off")}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
