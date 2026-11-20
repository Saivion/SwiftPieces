import type { Metadata } from "next";
import { Compare, proFaqs } from "@/components/sections/pro-landing";
import { Plans } from "@/components/sections/plans";
import { Questions } from "@/components/sections/questions";
import { ProStage, StageCounts, type StageChapter } from "@/components/sections/pro-stage";
import { pro } from "@/lib/site";
import { proCatalog, proCountsLabel, proGames } from "@/lib/pro-catalog";
import { getRegistryIndex } from "@/lib/registry";

// Pro overview on the free site. It never shows a price in the story: every CTA leads to
// pro.swiftpieces.com, where pricing and the plan live.
export const metadata: Metadata = {
  title: "SwiftPieces Pro",
  description: `SwiftPieces Pro: ${proCountsLabel} for SwiftUI, production-ready and delivered as source. See the plan and pricing on pro.swiftpieces.com.`,
  alternates: { canonical: pro.pricing },
};

const { screens, templates, flows, buildKit } = proCatalog;

/**
 * The Stage (Saivion's pick, 2026-11-19): the page tells one story around one pinned phone, from the
 * pieces Free gives you up to a whole app and a whole game, then a way to try it first.
 */
const chapters: StageChapter[] = [
  {
    id: "pieces", kick: "SwiftPieces Pro", tick: "Pro", sun: 1, loop: "spending-ring", alt: "A budget screen from SwiftPieces Pro, its ring being scrubbed",
    title: "Free gives you the pieces. Pro gives you the app.",
    body: `${screens} screens, ${flows.total} flows and ${templates} full app templates in SwiftUI, on the same design system as the free pieces, with the source.`,
    action: { label: "Get SwiftPieces Pro", href: pro.buy },
  },
  {
    id: "screens", kick: "Screens", tick: "Screens", sun: 0.86, lean: "rotate(-3deg)", loop: "wallet-stack", alt: "The Pro Wallet screen, its cards fanning out",
    title: "The screens they live on.",
    body: "Wallets, budgets, players, chats and dashboards, each a finished screen that already moves like a native app.",
    chips: [{ label: "Spring motion", at: { left: "2%", top: "28%" } }, { label: "Haptics", at: { right: "6%", top: "50%" } }, { label: "Light and dark", at: { left: "4%", top: "70%" } }],
  },
  {
    id: "flows", kick: "Flows", tick: "Flows", sun: 1.08, lean: "translateY(10px)", loop: "onboarding-stack", alt: "A Pro onboarding flow, its first steps moving in",
    title: "Then the journey around them.",
    body: "Welcome, sign in, permissions, a paywall and settings, wired screen to screen the way people move through an app.",
    chips: [{ label: "Welcome", at: { left: "4%", top: "24%" } }, { label: "Sign in", at: { right: "4%", top: "44%" } }, { label: "Paywall", at: { left: "2%", top: "66%" } }],
  },
  {
    id: "apps", kick: "Templates", tick: `${templates} apps`, sun: 1.16, lean: "rotate(3deg)", loop: "reading-now", alt: "The reading tracker template's Reading screen",
    title: "Then the whole app.",
    body: `${templates} app templates, from reading and finance to sleep, home and shop. Each one opens and runs in Xcode.`,
    chips: [{ label: "Xcode project", at: { right: "2%", top: "26%" } }, { label: "Your brand in one place", at: { left: "0%", top: "62%" } }],
  },
  {
    id: "games", kick: "SwiftPieces Games", tick: "Games", sun: 0.94, loop: "cairn", alt: "Cairn being played: river stones stacked on a misty loch",
    title: "Or a whole game.",
    body: `${proGames.list.length} complete iOS games in SwiftUI and Metal, with Game Center, a StoreKit 2 shop and the source.`,
    action: { label: "See the games", href: pro.games },
  },
  {
    id: "try", kick: "Playground", tick: "Try it", sun: 1.24, lean: "scale(.95)", loop: "device-hub", alt: "A smart home screen from Pro, its rooms switching",
    title: "Play with any of it first.",
    body: `Remix the apps in the Playground before you buy, then add the ${buildKit.total}-item Build Kit so your agent builds the rest to match.`,
    action: { label: "Open the Playground", href: "/apps" },
  },
];

export default function ProPage() {
  const counts = [
    { value: String(getRegistryIndex().length), label: "Free pieces" },
    { value: String(screens), label: "Pro screens" },
    { value: String(flows.total), label: "Flows" },
    { value: String(templates), label: "App templates" },
    { value: String(proCatalog.blocks), label: "Patterns" },
    { value: String(buildKit.total), label: "Build Kit pieces" },
    { value: String(proGames.list.length), label: "Games" },
    { value: "1", label: "Design system" },
  ];
  return (
    <div className="pro-page">
      <ProStage seed="free-pro-stage" chapters={chapters} />
      <StageCounts items={counts} />
      <Compare />
      <Plans />
      <Questions items={proFaqs} spacing="pb-24 sm:pb-32" stacked title="Questions before you buy" body="Licensing, updates and how Pro fits with Free." />
    </div>
  );
}
