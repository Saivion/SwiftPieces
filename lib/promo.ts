import { pro } from "@/lib/site";

export type Promo = {
  /** Bump when the offer changes, so a visitor who closed the last one sees the next. */
  id: string;
  message: string;
  /** The bold part after the message: the hook. */
  emphasis?: string;
  /** Shorter message for phones, where the full line won't fit beside the pill. */
  short?: string;
  /** ISO time the offer ends. With it the bar counts down, and it leaves on its own at zero. */
  endsAt?: string;
  cta: { label: string; href: string };
};

/** localStorage key for a closed bar; PromoBoot reads the same key before first paint. */
export const promoKey = (id: string) => `sp-promo-${id}`;

/**
 * The announcement bar over the marketing pages (components/announce/promo-bar.tsx). No price here:
 * pricing lives on pro.swiftpieces.com (lib/pro-catalog.ts). Set to null to take the bar down.
 */
export const promo: Promo | null = {
  id: "pro-2026-10",
  message: "Every screen, flow, block and app template in SwiftPieces Pro, for good.",
  emphasis: "One payment.",
  short: "Every screen and template, in Pro.",
  cta: { label: "Get Pro", href: pro.home },
};
