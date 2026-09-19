import { ProsePage } from "@/components/ui/prose-page";
export const metadata = { title: "Changelog" };
export default function ChangelogPage() {
  return (
    <ProsePage label="Changelog" title="What shipped." lead="Every piece, fix and API change, newest first.">
      <h2>September 2026 · 0.3</h2>
      <ul>
        <li>The library was re-audited against a premium standard: hard to recreate, designed before it moves, iPhone-first. 48 generic pieces were removed, 47 were redesigned and renamed for the experience they deliver, and 7 signature pieces were added: Swipe Deck, Floating Dock, Hold to Confirm, Task Row, Confirm Sheet, Weight Wave and Photo Viewer.</li>
        <li>51 pieces across 14 categories that describe interaction value: Text, Backgrounds, Glass, Controls, Inputs, Cards, Lists, Navigation, Sheets, Feedback, Motion, Data, AI and Media.</li>
        <li>Every interactive piece now designs its states (pressed, dragging, loading, success, error, expanded) and its haptics; every background ships quiet named palettes.</li>
      </ul>
      <h2>September 2026 · 0.2</h2>
      <ul>
        <li>73 new free pieces, taking the library to 98 across 17 categories: buttons, inputs, cards, lists, navigation, overlays, loading, feedback, motion, charts, AI, foundations and states join text, backgrounds, effects and Liquid Glass.</li>
        <li>New Liquid Glass helpers: <code>GlassSurface</code>, one modifier that renders real glass on iOS 26 and a Material fallback below it, and <code>ConcentricCorners</code> for container-relative corner radii.</li>
        <li>The old "Components" category is gone; Confetti now lives in Feedback. Category metadata has one source of truth, so the docs sidebar, filters, MCP and CLI stay in sync.</li>
        <li>Every piece still type-checks alone against the iOS 26 SDK in Swift 6 mode and compiles together in the preview app.</li>
      </ul>
      <h2>September 2026 · 0.1</h2>
      <ul>
        <li>25 free pieces across text, backgrounds, effects, components and Liquid Glass.</li>
        <li>Registry protocol at <code>/r/[name].json</code>, <code>llms.txt</code>, and the <code>swiftpieces</code> CLI with <code>init</code>, <code>add</code>, <code>list</code>.</li>
        <li>Every piece type-checked against the iOS 26 SDK in CI.</li>
      </ul>
    </ProsePage>
  );
}
