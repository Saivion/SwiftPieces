// Hub pages: one landing page per category (/components/cards) and a few cross-category topics
// (/components/animations). Each hub is the page search engines should rank for a broad query
// ("swiftui cards"), and the place every piece page links back up to.
//
// Everything here is written from the pieces' own descriptions: no claim a piece does not back up.
// Pure data plus one selector, so server and client code can both import it.
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { categories, type Category } from "@/lib/categories";

export type HubFaq = { q: string; a: string };

export type Hub = {
  slug: string;
  /** Category id for category hubs; topics select pieces with `pick`. */
  category?: Category;
  /** Pieces in a topic hub, in display order. */
  pick?: (items: RegistryIndexEntry[]) => RegistryIndexEntry[];
  /** Short name for links and breadcrumbs ("Cards"). */
  name: string;
  /** One line for directory rows. Category hubs default to the category description. */
  blurb?: string;
  /** Tab and search result title, before the " — Swift Pieces" suffix. Keep under ~45 characters. */
  title: string;
  /** The page's one h1. */
  h1: string;
  /** One or two sentences under the h1. */
  intro: string;
  /** Meta description, written for the result snippet. */
  description: string;
  /** "About" paragraphs under the grid. Plain text. */
  about: string[];
  faqs: HubFaq[];
  /** Guides that teach this topic, as [label, href]. */
  guides: [string, string][];
  /** Nearby hubs, by slug. */
  related: string[];
};

const ANIMATION_PIECES = [
  "TextReveal", "SwipeDeck", "FlipCard", "DepthCarousel", "Odometer", "StatusMorph", "ReactionToggle", "CommitButton",
  "ElasticButton", "DragToDismiss", "PromptChips", "OutcomeScreen", "StretchHeader", "TrackingTabs", "SkeletonLoader", "Silk",
];

const byNames = (names: string[]) => (items: RegistryIndexEntry[]) =>
  names.map((n) => items.find((i) => i.name === n)).filter((i): i is RegistryIndexEntry => Boolean(i));

export const hubs: Hub[] = [
  {
    slug: "text",
    category: "text",
    name: "Text",
    title: "SwiftUI Text Effects and Animations",
    h1: "SwiftUI text effects",
    intro: "Headlines that reveal word by word, Liquid Glass drawn on real glyph outlines, and paragraphs that clamp to a line limit with a real Read more.",
    description: "Free SwiftUI text effects for iOS: animated text reveal with highlights, Liquid Glass text and expandable Read more text. One Swift file each, no dependencies.",
    about: [
      "Text is where an app's tone shows first, and it is also where SwiftUI leaves the most to you. Text Reveal staggers a headline in by characters, words or lines from a baseline mask, then wipes highlight blocks behind the phrases that matter. Glass Text renders iOS 26 Liquid Glass on the actual glyph outlines, with a Material fallback below iOS 26 and a solid fill under Reduce Transparency.",
      "Expandable Text solves the everyday problem: it measures whether a paragraph is really truncated before it shows a more link, grows to full height without reflow, and VoiceOver always reads the whole text.",
    ],
    faqs: [
      { q: "How do I animate text in SwiftUI?", a: "For numbers, contentTransition(.numericText()) animates digit changes. For headlines, split the string into words or characters and animate each with a staggered delay, masking each line so glyphs rise from a baseline. Text Reveal packages that, with a stagger sized to land in under a second." },
      { q: "How do I add a Read more button to Text in SwiftUI?", a: "Measure the text at its line limit and at full height, and only show the link when the two differ. Expandable Text does that measurement, fades the end of the last line into the link and animates the height change." },
    ],
    guides: [["SwiftUI animations guide", "/docs/guides/swiftui-animations"], ["Liquid Glass guide", "/docs/liquid-glass"]],
    related: ["animations", "glass", "ai"],
  },
  {
    slug: "backgrounds",
    category: "backgrounds",
    name: "Backgrounds",
    title: "SwiftUI Animated Backgrounds and Shaders",
    h1: "SwiftUI animated backgrounds",
    intro: "Quiet, full-bleed atmospheres: a Metal silk shader lit by a movable light, and a Canvas dot grid that reacts to touch.",
    description: "Free animated SwiftUI backgrounds for iOS: a Metal shader silk surface with device-tilt lighting and an interactive Canvas dot grid with haptics.",
    about: [
      "A background should hold still enough to read over and move enough to feel alive. Silk is a slowly folding surface shaded from a real gradient normal in a Metal shader, with house fabrics, an adaptive standard style and optional device-tilt lighting. It ships as a .swift file and a .metal file; the shader compiles into your app's default library, so there is nothing to configure.",
      "Touch Grid is drawn with Canvas: dots swell and warm into a color under the finger, spring back on release, and a tap sends out one dissipating ripple.",
    ],
    faqs: [
      { q: "How do I use a Metal shader as a SwiftUI background?", a: "Add the .metal file to your app target so it compiles into the default Metal library, then apply it with colorEffect, distortionEffect or layerEffect through ShaderLibrary, driven by a TimelineView for time. Silk ships both files ready to drop in." },
      { q: "Do animated backgrounds drain battery?", a: "Continuous animation costs GPU time, so keep shaders simple, pause them when the view is off screen or the scene is inactive, and respect Reduce Motion. Both backgrounds here are built to stay light." },
    ],
    guides: [["SwiftUI animations guide", "/docs/guides/swiftui-animations"]],
    related: ["animations", "glass", "text"],
  },
  {
    slug: "glass",
    category: "glass",
    name: "Liquid Glass",
    title: "SwiftUI Liquid Glass Components (iOS 26)",
    h1: "SwiftUI Liquid Glass components",
    intro: "Liquid Glass done correctly on iOS 26, with a designed Material fallback on iOS 17 and later, so every piece ships to every user.",
    description: "Free SwiftUI Liquid Glass components for iOS 26: glass surface, segmented control and floating action menu, each with a Material fallback for iOS 17.",
    about: [
      "Liquid Glass arrived with iOS 26 and the API is small: glassEffect, GlassEffectContainer and glassEffectID. The hard parts are around it: gating every call with #available, grouping sibling glass in one container so it can morph, and designing the fallback that most of your users will still see.",
      "Glass Surface is the foundation: glass in a capsule, rect, circle or concentric shape, with a layered Material fallback that keeps the press response and specular edge. Glass Segments is a segmented control whose indicator you can grab and drag. Glass Action Menu long-presses open into actions you slide across and release to fire. Floating Dock and Glass Text also use glass on iOS 26.",
    ],
    faqs: [
      { q: "Does Liquid Glass work on iOS 17 or 18?", a: "No. glassEffect is iOS 26 only. Every glass piece here gates it with #available(iOS 26, *) and falls back to a Material surface on earlier versions, so the same file builds and runs from iOS 17." },
      { q: "What is GlassEffectContainer for?", a: "It renders sibling glass views as one layer, so their shapes blend when close and can morph into each other with glassEffectID. Without it, glass samples glass and the result looks muddy." },
      { q: "Is .liquidGlass a real SwiftUI modifier?", a: "No. Modifiers like .liquidGlassUltra or .fill(.liquidGlass) appear in tutorials but do not exist. The real surface is glassEffect(_:in:), Glass.regular, .clear and .identity, GlassEffectContainer, glassEffectID and the .glass button styles." },
    ],
    guides: [["Liquid Glass guide", "/docs/liquid-glass"]],
    related: ["navigation", "controls", "text"],
  },
  {
    slug: "controls",
    category: "controls",
    name: "Buttons and controls",
    title: "SwiftUI Buttons and Custom Controls",
    h1: "SwiftUI buttons and controls",
    intro: "Custom SwiftUI buttons with press depth, loading and success states, press-and-hold confirmation, plus a timer dial and a gesture-driven avatar stack.",
    description: "Free custom SwiftUI buttons and controls for iOS: animated button styles, an async loading button, hold to confirm, a timer dial and more. With haptics.",
    about: [
      "A button is the one control people touch most, so it is where missing detail shows. Elastic Button is a ButtonStyle that squashes toward the touch point, rubber-bands when dragged and springs back. Commit Button runs an async action through one phase: a capsule collapses into a spinner, then blooms into a success check, or shakes into an error that doubles as retry. Hold to Confirm guards destructive actions with a fill that sweeps while held, milestone haptics and a rewind on early release.",
      "Timer Dial is a countdown ring you set by dragging its knob, with a tick per step and a heavier detent every five seconds. Fan Stack spreads overlapping avatars apart and lets a drag scrub across them to pick one.",
    ],
    faqs: [
      { q: "How do I make a custom button style in SwiftUI?", a: "Conform to ButtonStyle and read configuration.isPressed in makeBody to change scale, color or shadow while pressed, animated with a spring. Apply it with .buttonStyle(YourStyle()). Elastic Button is a ready-made ButtonStyle that adds touch-point squash and drag stretch." },
      { q: "How do I show a loading state in a SwiftUI button?", a: "Model the action as a phase (idle, loading, success, error), disable the button while loading, and swap the label for a ProgressView. Commit Button does this with one animated shape and returns to idle on its own." },
      { q: "How do I add haptics to a SwiftUI button?", a: "On iOS 17 and later use .sensoryFeedback(.impact, trigger: value) on the button, where the trigger changes on tap. Every control here already fires the right feedback at the right moment." },
    ],
    guides: [["SwiftUI buttons guide", "/docs/guides/swiftui-buttons"], ["SwiftUI haptics guide", "/docs/guides/swiftui-haptics"]],
    related: ["haptics", "inputs", "feedback"],
  },
  {
    slug: "inputs",
    category: "inputs",
    name: "Inputs and forms",
    title: "SwiftUI Input Fields, Sliders and Forms",
    h1: "SwiftUI input fields and form controls",
    intro: "The inputs SwiftUI still leaves hard: a floating-label text field with validation, a password strength field, currency and token fields, a date range picker, and range sliders.",
    description: "Free SwiftUI inputs for iOS: floating label text field, password strength field, currency amount field, token field, date range picker and range slider.",
    about: [
      "Form Field is a text field whose label rests inside as a placeholder and glides up on focus, with a character limit, help text and validation that waits until you leave the field before it shows an error. Secure Entry adds a reveal toggle, a four-step strength bar and requirement chips. Amount Field formats currency live in the user's locale on a Decimal binding. Token Field turns entries into wrapping chips for tags and recipients, with paste of a whole list and inline suggestions.",
      "For picking values: Range Slider is a dual-thumb slider whose thumbs never cross, Expanding Track is a thumbless slider that swells under the finger, Scrub Stepper steps by tap, hold or a sideways scrub, Date Range Picker selects a start and end date on a paged month grid, and Filter Rail is a scrolling row of filter chips.",
    ],
    faqs: [
      { q: "Does SwiftUI have a range slider with two thumbs?", a: "No. SwiftUI's Slider has one thumb. Range Slider adds a dual-thumb control with step snapping, a minimum gap, thumbs that never cross, and a haptic on every step." },
      { q: "How do I make a floating label text field in SwiftUI?", a: "Overlay the label on the field and move and scale it up when the field is focused or has text, driven by @FocusState. Form Field does this and adds validation, a character counter and VoiceOver announcements." },
      { q: "How do I format currency input in SwiftUI?", a: "Keep the value as a Decimal and format it with the user's locale as digits arrive, rather than binding a TextField to a formatted string. Amount Field handles grouping, the decimal separator, symbol position and pasted amounts." },
    ],
    guides: [["SwiftUI haptics guide", "/docs/guides/swiftui-haptics"]],
    related: ["controls", "sheets", "lists"],
  },
  {
    slug: "cards",
    category: "cards",
    name: "Cards",
    title: "SwiftUI Cards: Swipe, Flip, Tilt and Parallax",
    h1: "SwiftUI cards",
    intro: "Cards with depth and gesture physics: a swipeable card stack, a 3D flip card, a card that tilts with the device, and a parallax image card.",
    description: "Free SwiftUI card components for iOS: a swipeable card stack, 3D flip card, device-tilt motion card and parallax image card. One file each, with haptics.",
    about: [
      "Swipe Deck is a gesture-driven card stack: the top card follows the finger and swings from its base, an outcome badge fades in for the direction you are heading, and a flick throws it left, right or up while the cards beneath rise. Flip Card turns by tap or by a sideways drag that scrubs the rotation, lifting toward you mid-turn.",
      "Motion Card tilts with the device's attitude through Core Motion, with a sheen and shadow that slide as it turns, and stops listening whenever the scene is not active. Parallax Card lets its image drift slower than the scroll while its caption block drifts slower still, so the card reads in layers.",
    ],
    faqs: [
      { q: "How do I make a swipeable card stack in SwiftUI?", a: "Stack the cards in a ZStack, attach a DragGesture to the top one, rotate it from a bottom anchor as it moves, and decide the throw from predictedEndTranslation so a flick counts. Swipe Deck does this over any Identifiable array and adds VoiceOver swipe actions." },
      { q: "How do I flip a card in SwiftUI?", a: "Rotate the container with rotation3DEffect around the y axis and swap which face is visible at 90 degrees, rotating the back face 180 degrees so its content is not mirrored. Flip Card also lets a drag scrub the rotation." },
    ],
    guides: [["SwiftUI cards guide", "/docs/guides/swiftui-cards"], ["SwiftUI animations guide", "/docs/guides/swiftui-animations"]],
    related: ["lists", "animations", "media"],
  },
  {
    slug: "lists",
    category: "lists",
    name: "Lists",
    title: "SwiftUI Lists, Carousels and Swipe Actions",
    h1: "SwiftUI lists and carousels",
    intro: "Rows and carousels with real behavior: custom swipe actions, a swipeable to-do row, a status timeline, a depth carousel and an infinite-scroll list.",
    description: "Free SwiftUI list components for iOS: custom swipe action rows, a swipeable task row, status timeline, depth paging carousel and an infinite scroll list.",
    about: [
      "Swipe Action Row wraps any row in a card with swipe actions drawn as solid blocks, a full swipe that arms with a haptic, and a shared binding that keeps one row open at a time. Task Row completes with a swipe right and a drawn check, snoozes or deletes with a swipe left, and reports reorder moves after a long-press lift.",
      "Paged List is async/await infinite scroll done properly: it prefetches before the end, never runs two loads at once, drops duplicate ids, ignores stale responses, and keeps loaded rows when a page fails. Depth Carousel pages cards that recede as they leave center, and Status Timeline shows order or delivery progress with a live step that breathes.",
    ],
    faqs: [
      { q: "How do I add infinite scroll to a SwiftUI list?", a: "Trigger the next page load from onAppear of a row a few items before the end, guard against concurrent loads, and de-duplicate by id. Paged List does this with skeleton rows, a retry chip and pull to refresh." },
      { q: "Can I use swipe actions outside a List in SwiftUI?", a: "The built-in swipeActions modifier only works inside List. Swipe Action Row works in any ScrollView or VStack and draws its own actions." },
    ],
    guides: [["SwiftUI loading states guide", "/docs/guides/swiftui-loading-states"], ["SwiftUI cards guide", "/docs/guides/swiftui-cards"]],
    related: ["cards", "navigation", "feedback"],
  },
  {
    slug: "navigation",
    category: "navigation",
    name: "Navigation",
    title: "SwiftUI Navigation: Tab Bars, Tabs and Headers",
    h1: "SwiftUI navigation components",
    intro: "A floating tab bar dock, paging tabs with a tracking indicator, and a stretchy parallax header for your own ScrollView and NavigationStack.",
    description: "Free SwiftUI navigation components for iOS: a floating tab bar dock, paging tabs with a scroll-tracking indicator and a stretchy header that pins to the nav bar.",
    about: [
      "Floating Dock is a custom tab bar on a solid surface: the selected item becomes a block with its label, a drag across the dock lifts each item with a name bubble, badges count in a pill, and the dock tucks away on scroll. Tracking Tabs sit over a paging ScrollView and move their indicator with fractional scroll progress, so it follows your finger rather than jumping.",
      "Stretch Header is a hero header for your own ScrollView and NavigationStack: it stretches on overscroll, shrinks its title toward the real navigation bar, and pins a stat row under the bar as a solid bar fades in.",
    ],
    faqs: [
      { q: "How do I make a custom tab bar in SwiftUI?", a: "Hide the system tab bar or drive your own selection state, then overlay a bar at the bottom safe area. Floating Dock is a complete custom tab bar with selection, badges, drag-to-select and hide on scroll." },
      { q: "How do I make a stretchy header in SwiftUI?", a: "Read the scroll offset of the header with onGeometryChange or a GeometryReader, grow its height and scale on negative offsets, and offset it to stay pinned. Stretch Header does this and hands the title off to the navigation bar." },
    ],
    guides: [["SwiftUI animations guide", "/docs/guides/swiftui-animations"]],
    related: ["glass", "lists", "sheets"],
  },
  {
    slug: "sheets",
    category: "sheets",
    name: "Sheets",
    title: "SwiftUI Sheets, Toasts and Confirmations",
    h1: "SwiftUI sheets and toasts",
    intro: "The moments that ask or tell: a confirmation sheet, a pre-permission sheet, and a toast with an undo action and a timer that pauses while touched.",
    description: "Free SwiftUI sheet components for iOS: a confirmation bottom sheet, a pre-permission request sheet and a toast notification with undo. Haptics included.",
    about: [
      "Confirm Sheet presents as a height-fitted bottom sheet or as an inline card you can drag away, with a loading primary action that lands on a success check before dismissing and a warning haptic for destructive choices. Permission Sheet explains a permission before the system prompt, spins while the system asks, and routes the button to Settings if the answer is no.",
      "Toast is a single toast card with a kind tile, an optional detail line, an Undo-style action and a thin timer that pauses while touched, placed inside the safe area so it clears the Dynamic Island and rides above the keyboard.",
    ],
    faqs: [
      { q: "How do I show a toast in SwiftUI?", a: "SwiftUI has no toast API. Overlay a view at the top or bottom of your root view, drive it from state, and dismiss it on a timer that pauses while touched. Toast does this with an action button and haptics." },
      { q: "How do I make a bottom sheet that fits its content in SwiftUI?", a: "Measure the content height and pass it to presentationDetents([.height(h)]). Confirm Sheet does the measurement for you." },
    ],
    guides: [["SwiftUI haptics guide", "/docs/guides/swiftui-haptics"]],
    related: ["feedback", "controls", "navigation"],
  },
  {
    slug: "feedback",
    category: "feedback",
    name: "Feedback",
    title: "SwiftUI Loading, Skeleton and Success States",
    h1: "SwiftUI feedback and loading states",
    intro: "Skeleton loading with a shimmer, a loading-to-checkmark morph, success and error screens, an animated like button and a scrubbable star rating.",
    description: "Free SwiftUI feedback components for iOS: skeleton loading with shimmer, loading to success checkmark animation, success and error screens, like button, star rating.",
    about: [
      "Skeleton Loader turns any layout into one quiet placeholder shape with a soft highlight sweeping on a shared clock, then hands off as content unblurs and rises row by row. Status Morph is one continuous stroke that spins while loading, closes into a ring and draws a check on success or a cross on failure. Outcome Screen gives success, failure and empty states one shared choreography, with async retry.",
      "Reaction Toggle is a like or save toggle that floods its capsule from the symbol outward and can roll a count. Rating Scrub is a star rating you tap or scrub, with the star under your finger lifting as you go.",
    ],
    faqs: [
      { q: "How do I make a skeleton loading view in SwiftUI?", a: "The quickest start is .redacted(reason: .placeholder) on your real layout, then a moving gradient mask for the shimmer. Skeleton Loader adds a synchronized sweep and a staged handoff to real content." },
      { q: "How do I animate a checkmark in SwiftUI?", a: "Draw the check as a Path and animate its trim(from:to:) from 0 to 1. Status Morph and Outcome Screen both draw their marks this way, joined to a loading ring." },
    ],
    guides: [["SwiftUI loading states guide", "/docs/guides/swiftui-loading-states"], ["SwiftUI haptics guide", "/docs/guides/swiftui-haptics"]],
    related: ["sheets", "controls", "ai"],
  },
  {
    slug: "motion",
    category: "motion",
    name: "Motion",
    title: "SwiftUI Gesture Modifiers with Physics",
    h1: "SwiftUI gesture and motion modifiers",
    intro: "Gesture modifiers with real physics you attach to your own views, starting with drag to dismiss for photos, cards and sheets.",
    description: "Free SwiftUI motion modifiers for iOS: drag to dismiss for photos, cards and sheets, with velocity-based springs, a styled scrim, haptics and Reduce Motion.",
    about: [
      "Drag to Dismiss is a modifier that lets a photo, card or sheet follow a two-axis drag, rounds and shrinks it with progress over a scrim, reports its phase so your UI can say release to close, then springs back or flies off along the drag vector past a distance or velocity threshold.",
      "For more motion across the library, see the animations collection: card stacks, flips, carousels, text reveals, number rolls and state morphs.",
    ],
    faqs: [
      { q: "How do I add drag to dismiss in SwiftUI?", a: "Track a DragGesture's translation, scale and fade the view with progress, and on release dismiss if the distance or predictedEndTranslation passes a threshold, otherwise spring back. Drag to Dismiss wraps this in one modifier." },
    ],
    guides: [["SwiftUI animations guide", "/docs/guides/swiftui-animations"]],
    related: ["animations", "media", "cards"],
  },
  {
    slug: "data",
    category: "data",
    name: "Data and charts",
    title: "SwiftUI Charts, Counters and Stat Tiles",
    h1: "SwiftUI charts and data components",
    intro: "Interactive charts you scrub with a finger, a donut chart, a rolling number counter and KPI tiles with live sparklines.",
    description: "Free SwiftUI data components for iOS: an interactive line and bar chart, scrubbable donut chart, rolling odometer number animation and KPI stat tiles.",
    about: [
      "Scrub Chart is a line or bar chart with a readout, a flag that rides the scrub rule, hold-and-drag range selection with delta and percent, and a range picker that morphs the line between datasets. Ring Breakdown is a donut chart you scrub around, with a haptic at each slice boundary and legend rows that light up with the slice.",
      "Odometer rolls each digit on its own slot like a mechanical counter, carrying from the low digits up so unchanged digits never move. Live Stat is a metric tile whose value rolls with a spring, with a sparkline you hold and scrub.",
    ],
    faqs: [
      { q: "Should I use Swift Charts or a custom chart?", a: "Swift Charts is the right default for standard plots. These pieces are for the interaction around a chart that finance and health apps need: scrubbing, range selection, morphing datasets and haptic slice boundaries." },
      { q: "How do I animate a number counting up in SwiftUI?", a: "For simple cases use contentTransition(.numericText()) with withAnimation. For a mechanical roll where only changed digits move, lay out each digit as its own vertical strip and offset it, which is what Odometer does." },
    ],
    guides: [["SwiftUI animations guide", "/docs/guides/swiftui-animations"]],
    related: ["feedback", "controls", "animations"],
  },
  {
    slug: "ai",
    category: "ai",
    name: "AI",
    title: "SwiftUI AI Chat Components",
    h1: "SwiftUI AI chat components",
    intro: "The surfaces an AI feature needs: a streaming reply, a thinking state, prompt suggestion chips, a code block and Siri-style orbs drawn in Metal.",
    description: "Free SwiftUI AI chat components for iOS: streaming text reply, thinking indicator, prompt suggestion chips, code block with syntax colors and Metal shader orbs.",
    about: [
      "Streaming Reply is the reply surface: text arrives token by token with a per-word fade and a cursor, inline code sits on blocks, and a long press lifts the message to copy or regenerate. Thinking State is the working placeholder, laid out like the reply it becomes, with an elapsed-seconds label. Prompt Chips is a snapping row of suggestions where the chosen chip morphs into the composer.",
      "Code Block renders code for chat replies with Swift syntax colors, collapse and expand, a wrap toggle and a copy pill, plus a streaming mode. Assistant Orb and Thought Orb are dark glass balls with a Siri-style voice wave inside, drawn by a Metal shader, whose palettes crossfade with the kind of work in progress.",
    ],
    faqs: [
      { q: "How do I stream text in SwiftUI like ChatGPT?", a: "Append tokens to a string in @State as they arrive from an AsyncSequence, and animate each new word in. Streaming Reply does this with a per-word fade and a block cursor, and exposes copy and regenerate." },
      { q: "Do these pieces include an AI model or API client?", a: "No. They are the interface only. Connect them to any model or API: Apple's Foundation Models framework, a server you run, or a hosted provider." },
    ],
    guides: [["SwiftUI loading states guide", "/docs/guides/swiftui-loading-states"], ["SwiftUI animations guide", "/docs/guides/swiftui-animations"]],
    related: ["feedback", "text", "backgrounds"],
  },
  {
    slug: "media",
    category: "media",
    name: "Media",
    title: "SwiftUI Photo Viewer and Stories",
    h1: "SwiftUI photo and media components",
    intro: "A full-screen photo viewer with pinch to zoom, and a Stories-style progress strip with hold to pause.",
    description: "Free SwiftUI media components for iOS: a full-screen photo viewer with pinch to zoom, double-tap zoom and drag to dismiss, and a Stories progress bar.",
    about: [
      "Photo Viewer is a full-screen photo surface with anchor-correct pinch zoom, momentum panning that settles into the bounds, double-tap zoom about the tap, paging between images, and pinch-out or drag-down to dismiss.",
      "Story Strip is a Stories-style segment strip with a built-in clock, a long-press hold that pauses it, tap zones for back and forward, and a manual progress mode when you own the timing.",
    ],
    faqs: [
      { q: "How do I add pinch to zoom on an image in SwiftUI?", a: "Combine MagnifyGesture for scale with a DragGesture for panning, anchor the zoom at the pinch location, and clamp the offset to the image bounds. Photo Viewer handles all of that plus double-tap zoom and paging." },
    ],
    guides: [["SwiftUI animations guide", "/docs/guides/swiftui-animations"]],
    related: ["motion", "cards", "navigation"],
  },
  {
    slug: "animations",
    pick: byNames(ANIMATION_PIECES),
    name: "Animations",
    blurb: "Springs, gesture physics, transitions and morphs, across every category.",
    title: "SwiftUI Animations: Free Animated Components",
    h1: "SwiftUI animations",
    intro: "Animated SwiftUI components with the motion already tuned: springs, gesture physics, transitions and morphs you copy into your app.",
    description: "Free animated SwiftUI components for iOS: card stacks, 3D flips, text reveals, rolling numbers, loading morphs and spring buttons. One Swift file each.",
    about: [
      "Good motion in SwiftUI is mostly springs and state: a spring that hands off the finger's velocity, transitions that agree on one clock, and an animation that respects Reduce Motion. Every piece in this collection is animated that way, and each one documents its spring values and thresholds in its notes.",
      "Start with Swipe Deck and Flip Card for gesture-driven motion, Text Reveal and Odometer for type and numbers, Status Morph and Commit Button for state changes, and Depth Carousel and Stretch Header for scroll-driven motion.",
    ],
    faqs: [
      { q: "What is the best animation to use in SwiftUI?", a: "Springs, in most cases. .spring(duration:bounce:) (iOS 17) is easy to tune, continues smoothly from a gesture's velocity and never ends abruptly. Use easing curves for fades and progress that should not overshoot." },
      { q: "Do these animations respect Reduce Motion?", a: "Yes. Each piece reads accessibilityReduceMotion and swaps large movement for fades or no motion, as described on its page." },
    ],
    guides: [["SwiftUI animations guide", "/docs/guides/swiftui-animations"], ["SwiftUI cards guide", "/docs/guides/swiftui-cards"]],
    related: ["cards", "motion", "haptics"],
  },
  {
    slug: "haptics",
    pick: (items) => items.filter((i) => i.tags.some((t) => t === "haptics" || t === "haptic")),
    name: "Haptics",
    blurb: "Pieces that tick, tap and confirm at the moment that matters.",
    title: "SwiftUI Haptic Feedback Components",
    h1: "SwiftUI components with haptic feedback",
    intro: "Every piece here fires haptics at the moment that matters: a threshold crossed, a detent reached, an action confirmed or refused.",
    description: "Free SwiftUI components with haptic feedback built in: buttons, sliders, dials, ratings, sheets and gestures that tick, tap and confirm with sensoryFeedback.",
    about: [
      "Haptics make a control feel physical, but only when they are sparing and exact. These pieces use sensoryFeedback (iOS 17) to mark real events: a selection tick as a slider steps, a heavier detent every five seconds on Timer Dial, rising taps as Hold to Confirm passes its milestones, and a solid impact when Swipe Deck throws a card.",
      "Each piece's notes say which feedback fires when, so you can keep the pattern consistent across your own screens.",
    ],
    faqs: [
      { q: "How do I add haptic feedback in SwiftUI?", a: "On iOS 17 and later, attach .sensoryFeedback(.selection, trigger: value) to a view; the feedback plays whenever the trigger value changes. For earlier versions, use UIImpactFeedbackGenerator or UISelectionFeedbackGenerator." },
      { q: "Which haptic should I use?", a: "Selection for stepping through values, impact for physical events like a snap or a throw, success, warning and error for outcomes. Keep them rare enough that each one means something." },
    ],
    guides: [["SwiftUI haptics guide", "/docs/guides/swiftui-haptics"], ["SwiftUI buttons guide", "/docs/guides/swiftui-buttons"]],
    related: ["controls", "inputs", "animations"],
  },
];

const bySlugMap = new Map(hubs.map((h) => [h.slug, h]));

export function getHub(slug: string): Hub | undefined {
  return bySlugMap.get(slug);
}

/** The pieces a hub shows, in order. */
export function hubItems(hub: Hub, items: RegistryIndexEntry[]): RegistryIndexEntry[] {
  if (hub.category) return items.filter((i) => i.category === hub.category);
  return hub.pick ? hub.pick(items) : [];
}

export const hubPath = (slug: string) => `/components/${slug}`;

/** The one line a directory row shows for a hub. */
export const hubBlurb = (hub: Hub) => hub.blurb ?? (hub.category ? categories[hub.category].description : "");

/** The category hub every piece page links up to. */
export const categoryHubPath = (category: Category) => hubPath(categories[category].slug);

export const categoryHubs = hubs.filter((h) => h.category);
export const topicHubs = hubs.filter((h) => !h.category);
