// The Free playground's configuration: what it offers, and the Pro components and templates it
// names but does not include. Free never reads the Pro registry (Rev 3 §3.2), so the teasers are a
// short hand-kept list, the same arrangement as lib/pro-screens.ts.
import type { TemplateDefinition } from "@swiftpieces/builder";
import { pro, site } from "@/lib/site";

export const PLAYGROUND_PATH = "/playground";
export const proBuilderUrl = `${site.proUrl}/builder`;

/** Playground link that opens with one component on screen (the piece's slug is its builder id). */
export const playgroundComponentHref = (id: string) => `${PLAYGROUND_PATH}?component=${encodeURIComponent(id)}`;
export const playgroundTemplateHref = (id: string) => `${PLAYGROUND_PATH}?template=${encodeURIComponent(id)}`;

/** Pro components listed, locked, at the foot of the Free component list. */
export const lockedComponents = [
  { id: "swipe-to-confirm", name: "Swipe To Confirm", description: "Slide to send, pay or confirm, with a haptic commit." },
  { id: "payment-card", name: "Payment Card", description: "A card that catches the light and flips to its CVV." },
  { id: "code-entry", name: "Code Entry", description: "Springing one-time-code digits with SMS autofill." },
  { id: "activity-rings", name: "Activity Rings", description: "Concentric progress rings with a center figure." },
  { id: "glass-paywall", name: "Glass Paywall", description: "Plans, features and a purchase button on glass." },
  { id: "calendar-strip", name: "Calendar Strip", description: "A week strip with event dots and a moving selection." },
];

/** Pro starting screens, shown locked in the template picker. Picking one goes to Pro. */
const proTemplate = (id: string, name: string, group: string, description: string): TemplateDefinition => ({
  id,
  name,
  group,
  description,
  availability: "pro",
  create: () => {
    throw new Error("Pro template");
  },
});

export const lockedTemplates: TemplateDefinition[] = [
  proTemplate("home", "Home", "App", "A feed home with a greeting, stats and a floating dock."),
  proTemplate("dashboard", "Dashboard", "App", "Live metrics, a breakdown ring and recent activity."),
  proTemplate("detail", "Detail", "App", "A product or article detail with a sticky action."),
  proTemplate("paywall", "Paywall", "Commerce", "Plans, features and a purchase button on glass."),
  proTemplate("checkout", "Checkout", "Commerce", "A payment card, an amount and swipe to pay."),
  proTemplate("verify", "Verify", "Account", "A one-time code screen with autofill."),
];

export const playgroundLinks = { pro: proBuilderUrl, pricing: pro.home };
