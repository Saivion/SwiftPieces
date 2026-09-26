// What each piece is called in a search box. The display names describe the experience
// ("Swipe Deck"); people search for the thing ("swiftui swipeable card stack"). A piece page's
// title and meta description pair the two, so the page reads as the brand and ranks as the query.
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { site } from "@/lib/site";
import { snippet } from "@/lib/seo";

/** Plain search phrase per piece, Title Case, without "SwiftUI". Keep each under ~32 characters. */
export const searchPhrase: Record<string, string> = {
  AssistantOrb: "Siri-Style AI Orb",
  CodeBlock: "Code Block with Syntax Colors",
  PromptChips: "AI Prompt Suggestion Chips",
  StreamingReply: "Streaming AI Chat Reply",
  ThinkingState: "AI Thinking Indicator",
  ThoughtOrb: "AI Status Orb",
  Silk: "Metal Shader Background",
  TouchGrid: "Interactive Dot Grid Background",
  FlipCard: "3D Flip Card",
  MotionCard: "Device Tilt Card",
  ParallaxCard: "Parallax Image Card",
  SwipeDeck: "Swipeable Card Stack",
  CommitButton: "Async Loading Button",
  ElasticButton: "Animated Button Style",
  FanStack: "Avatar Stack",
  HoldToConfirm: "Press and Hold Button",
  TimerDial: "Circular Timer Dial",
  LiveStat: "Stat Tile with Sparkline",
  Odometer: "Rolling Number Animation",
  RingBreakdown: "Interactive Donut Chart",
  ScrubChart: "Interactive Line Chart",
  OutcomeScreen: "Success and Error Screen",
  RatingScrub: "Star Rating Control",
  ReactionToggle: "Animated Like Button",
  SkeletonLoader: "Skeleton Loading Shimmer",
  StatusMorph: "Loading to Checkmark Animation",
  GlassActionMenu: "Liquid Glass Action Menu",
  GlassSegments: "Liquid Glass Segmented Control",
  GlassSurface: "Liquid Glass Surface",
  AmountField: "Currency Input Field",
  DateRangePicker: "Date Range Picker",
  ExpandingTrack: "Custom Slider",
  FilterRail: "Filter Chips Bar",
  FormField: "Floating Label Text Field",
  RangeSlider: "Range Slider with Two Thumbs",
  ScrubStepper: "Custom Stepper",
  SecureEntry: "Password Strength Field",
  TokenField: "Token Field for Tags",
  DepthCarousel: "Paging Carousel",
  PagedList: "Infinite Scroll List",
  StatusTimeline: "Order Status Timeline",
  SwipeActionRow: "Custom Swipe Actions",
  TaskRow: "Swipeable To-Do Row",
  PhotoViewer: "Pinch to Zoom Photo Viewer",
  StoryStrip: "Stories Progress Bar",
  DragToDismiss: "Drag to Dismiss Gesture",
  FloatingDock: "Floating Tab Bar",
  StretchHeader: "Stretchy Header",
  TrackingTabs: "Paging Tabs",
  ConfirmSheet: "Confirmation Bottom Sheet",
  PermissionSheet: "Permission Request Sheet",
  Toast: "Toast Notification with Undo",
  ExpandableText: "Expandable Read More Text",
  GlassText: "Liquid Glass Text Effect",
  TextReveal: "Animated Text Reveal",
};

/** Lowercases a phrase for use mid-sentence, keeping proper nouns and acronyms as written. */
function sentenceCase(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/\bai\b/g, "AI")
    .replace(/\bmetal\b/g, "Metal")
    .replace(/liquid glass/g, "Liquid Glass")
    .replace(/\bsiri\b/g, "Siri")
    .replace(/\b3d\b/g, "3D");
}

/** Search phrase for a piece, falling back to its display name. */
export function piecePhrase(item: Pick<RegistryIndexEntry, "name" | "title">): string {
  return searchPhrase[item.name] ?? item.title;
}

/**
 * The piece page's <title>: "Swipe Deck: SwiftUI Swipeable Card Stack". The layout template adds
 * " — Swift Pieces" when the whole thing still fits a result title; otherwise it is left off.
 */
export function pieceTitle(item: Pick<RegistryIndexEntry, "name" | "title">): { title: string; absolute: boolean } {
  const phrase = piecePhrase(item);
  const title = phrase.toLowerCase() === item.title.toLowerCase() ? `${item.title}: SwiftUI Component` : `${item.title}: SwiftUI ${phrase}`;
  return { title, absolute: `${title} — ${site.name}`.length > 64 };
}

/**
 * The meta description: what it is and for which iOS first, then the piece's own description,
 * cut at a word boundary. "Free SwiftUI swipeable card stack for iOS 17+. A gesture-driven…"
 */
export function pieceDescription(item: Pick<RegistryIndexEntry, "name" | "title" | "description" | "minIOSVersion">): string {
  const lead = `Free SwiftUI ${sentenceCase(piecePhrase(item))} for iOS ${item.minIOSVersion.replace(/\.0$/, "")}+.`;
  return snippet(`${lead} ${item.description}`, 155, { cut: true });
}
