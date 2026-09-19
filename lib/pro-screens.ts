// Pro screens that free pieces grow into (the `pro:` key in a piece header). Free never reads the Pro
// registry (Rev 3 §3.2), so this is a hand-maintained copy of the titles and one-line summaries.
// Refresh from SwiftPiecesPro/registry/__registry__/public.json when a mapped screen changes.
import { site } from "@/lib/site";

export const proScreens: Record<string, { title: string; summary: string }> = {
  "spending-ring": { title: "Budget", summary: "A budget overview around a ring you can scrub, with category limits and period switching." },
  "transaction-row": { title: "Activity", summary: "Account activity grouped by day, with rows that swipe to categorize, split or hide." },
  "dashboard-screen": { title: "Dashboard", summary: "A home dashboard with a collapsing greeting, live metrics, a scrubbable chart and activity." },
  "settings-screen": { title: "Settings", summary: "A settings home with a collapsing profile header, grouped rows, toggles and sign out." },
  "focus-timer": { title: "Focus", summary: "A focus session with a dial you drag to set minutes and a ring that drains as you work." },
  "mini-player": { title: "Now Playing", summary: "A music library with a floating player that grows into a full now-playing screen." },
  "depth-gallery": { title: "Gallery", summary: "A trip album that pages with depth, captions on color blocks, and a pinch to peek at the centred photo." },
  "onboarding-stack": { title: "Welcome", summary: "First-run pages as color posters with arch windows, where parallax and progress follow your finger." },
  "onboarding-flow": { title: "Onboarding", summary: "First run end to end: welcome pages, a permission step and a trial offer, then into the app." },
  "glass-paywall-screen": { title: "Purchase", summary: "A complete StoreKit 2 purchase: plans load, the purchase runs, success lands, the app unlocks." },
  "detent-sheet": { title: "Nearby", summary: "A map of places nearby with a Maps-style sheet that scrolls, snaps and hands off to its list." },
  "glass-sheet": { title: "Stay", summary: "A stay detail screen over full-bleed scenery, with a floating booking card that rises and flicks away." },
  "toast-stack": { title: "Notifications", summary: "An activity feed where new alerts land as a stack of toasts you can fan out and swipe away." },
  "command-palette": { title: "Search", summary: "A search screen with recent items and quick actions, and a fuzzy command palette with hold-and-slide to run." },
  "lens-tab-bar": { title: "Lessons", summary: "A language-learning home with a streak, today's goals as color blocks and a floating tab bar whose lens follows your finger." },
  "morph-nav": { title: "Reader", summary: "A long-read article with a serif headline and a floating pill that morphs into a reading toolbar." },
  "code-entry": { title: "Verify", summary: "A sign-in verification screen with springing digits, SMS autofill and a shake on a wrong code." },
  "swipe-to-confirm": { title: "Send Money", summary: "A transfer review with the recipient, a huge amount and a slide-to-send control that commits with a haptic." },
  "payment-card": { title: "Card Details", summary: "A card screen with a card that catches the light and flips to its CVV, plus limits and controls." },
  "hero-expand": { title: "Discover", summary: "A travel discover feed of story cards that expand into full-screen guides and pull back." },
  "ghost-state": { title: "Projects", summary: "A projects screen that starts as breathing ghost rows and hands off to your real projects." },
  "prompt-composer": { title: "Ask", summary: "An assistant home with a briefing, suggested prompts and a composer that grows, attaches and records." },
  "streaming-markdown": { title: "Research", summary: "A research answer that writes itself word by word, with sources and a follow-up bar." },
  "tool-execution-card": { title: "Agent Task", summary: "An agent task screen with a live timeline of tool calls, durations and expandable results." },
};

export const proScreenUrl = (id: string) => `${site.proUrl}/library/screens/${id}`;
