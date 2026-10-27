/**
 * The short description each piece's and free block's docs page shows under its title: one or two
 * lines, never the paragraph. The Swift header's `description` stays the full account, for the
 * registry, the CLI, the MCP server, llms.txt and structured data.
 *
 * scripts/build-registry.ts writes these into the generated docs frontmatter and stops the build
 * when a piece or block has none, when one runs past SUMMARY_MAX characters, or when a key names
 * nothing in the registry. Condense the full description; never claim what the piece does not do.
 */
export const SUMMARY_MAX = 150;

export const summaries: Record<string, string> = {
  // AI
  AssistantOrb: "A dark glass ball with a Siri-style voice wave inside, drawn by a Metal shader and locked to the thinking state.",
  PromptChips: "Liquid glass prompt chips above a composer that cascade in, then melt into the one you tap as it drops its text into the field.",
  SourceStack: "Citations for an AI answer: a pill of overlapping site badges that opens into a list of numbered source cards.",
  StreamingReply: "The AI reply in liquid glass: text that streams in word by word under a morphing phase label, with copy, regenerate and retry.",
  ThinkingState: "The assistant-is-working placeholder: a glass header with a breathing mark and elapsed seconds over dots, bars or a sheen.",
  ThoughtOrb: "A small glass orb with a voice wave whose colour follows the kind of work, and a glass status pill whose verb morphs as it changes.",

  // Backgrounds
  Silk: "A slowly folding silk surface shaded in Metal and lit by a movable light, in the house fabrics, with optional tilt lighting.",
  TouchGrid: "A dot grid that swells and warms in colour under the finger, springs back on release and sends a ripple out from a tap.",

  // Cards
  FlipCard: "A two-sided card you flip by tap or drag, scrubbing the turn and carrying the flick into the landing, with a lift and a moving shadow.",
  MotionCard: "A solid colour card that tilts with the device, catching a fixed light across its face and its glass chips, and settles flat when pressed.",
  ParallaxCard: "An image card whose picture and liquid glass caption drift at different speeds as you scroll, so the card reads in layers.",
  SwipeDeck: "A card stack you swipe: the top card follows the finger, a glass outcome badge stamps at the threshold and a flick throws it away.",
  WalletStack: "A wallet of passes stacked by their header strips: tap one to open its whole face and a real scannable code, then put it back.",

  // Buttons and controls
  CommitButton: "An async action button in liquid glass that runs through loading, success and error, with a progress bubble budding out of its end.",
  ElasticButton: "A button style that squashes toward the touch, stretches with the drag, deepens on a hold and springs back with the give you put in.",
  FanStack: "Overlapping avatars in glass bubbles that fan apart on tap and scrub under the finger, a name tag budding out of the one you hold.",
  HoldToConfirm: "A press-and-hold glass capsule for destructive actions that fills as you hold, ticks past milestones and confirms with a check.",
  LevelPicker: "A stepped slider for a few named levels: the red thumb rides a glass track, ticks at each stop and settles where a flick would land.",
  LiquidSwitch: "A toggle whose red fill pours across a glass track as the thumb crosses, swelling under the finger, with a drag that follows and flips.",
  TimerDial: "A countdown ring you set by dragging a glass knob around it, with a tick per step, a warning zone and start, pause and reset bubbles.",

  // Data and charts
  ActivityHeatmap: "A streak calendar in steps of red with a glass streak chip, and a scrub that lifts each day with a callout and a haptic tick.",
  LiveStat: "A metric tile whose value rolls with a spring, with a delta chip and a sparkline you scrub to read any point live.",
  Odometer: "A number whose digits roll on their own slots like a mechanical counter, with a glass delta chip that buds out after each change.",
  RangeLens: "An overview and detail chart for long series: drag and resize a glass lens over the whole range to read the window's average.",
  RingBreakdown: "A composition ring you scrub by dragging around it, lifting each slice with a haptic while its name and share morph in the centre.",
  ScrubChart: "A line or bar chart you scrub under a glass flag, hold to select a range, and switch with a glass picker that morphs the line.",

  // Feedback
  OutcomeScreen: "A success, failure or empty state in one choreography: a ring draws, floods and lands with a haptic, then a glass action rises.",
  RatingScrub: "A star rating you tap or scrub: the stars fill and rise under the finger while a glass readout rides along and the label morphs.",
  ReactionToggle: "A like or save toggle in liquid glass that floods with its tint, springs its symbol, rolls the count and buds a confirmation pill.",
  SkeletonLoader: "Placeholder bones and a modifier that turns any layout into one sweeping shape, then hands off as the content rises in.",
  StatusMorph: "One stroke that spins while loading, then closes into a ring and draws a check on success or a cross on failure.",

  // Liquid Glass
  GlassActionMenu: "Hold the glass trigger and its actions bud out of it along a line or an arc; slide across them and release to fire one.",
  GlassModeBar: "One liquid glass bar that turns into the mode you pick, its icons trading places with that mode's own controls.",
  GlassQuickAdd: "A liquid glass Quick add pill that grows into a menu of capture kinds, then re-forms in place into the capture you pick.",
  GlassSegments: "A segmented control whose glass indicator moves like liquid, stretching across and gathering in, and follows a scrub.",
  GlassSurface: "The SwiftPieces liquid glass as a modifier: any view on a glass shape, neighbours melted together, with fallbacks before iOS 26.",

  // Inputs and forms
  AddressField: "An address field whose suggestions pour out as a glass list and resolve into a structured address with street, city and coordinate.",
  AmountField: "A currency entry that formats live in the user's locale as each digit rolls in, pastes cleanly and refuses amounts over the limit.",
  ChoiceGroup: "Radio and checkbox rows on a glass card: one red drop flows from ring to ring, and checked boxes flood red with a popping check.",
  DateRangePicker: "A start-to-end date range picker on a paged month grid, the range pouring between two glass bubbles like liquid.",
  DateStrip: "A week of dates in a row from the user's calendar: the red pill flows to the day you tap, and swiping pages by week.",
  ExpandingTrack: "A thumbless glass slider that swells under the finger and buds a readout bubble that rides the edge, for a value or a range.",
  FilterRail: "A scrolling rail of glass filter chips for one pick or many, with a red puck that stretches between chips and a Clear chip.",
  FormField: "A liquid glass text field with a floating label, a clear bubble, a character counter and validation that waits until you leave.",
  InterestChips: "Wrapping glass chips for picking several things: each floods red as its check grows in, and a limit dims the rest and shakes refusals.",
  LocationPicker: "A map picker with a red pin that lifts while the map moves and drops into place, looking up the address under it on a glass card.",
  RangeSlider: "A dual-thumb slider: glass bubble thumbs joined by a tinted span, readout chips that merge as they meet, and steps that tick.",
  ScrubStepper: "A glass stepper you tap, hold to repeat or scrub sideways across, with buttons that melt into the pill at a bound.",
  SecureEntry: "A glass password field with a reveal bubble, a strength chip and requirement chips that turn sage with a check as each rule passes.",
  SignaturePad: "A signature field with smooth, velocity-weighted ink and a glass toolbar for undo and clear, exporting to PNG or vector PDF.",
  SwatchPicker: "A row of named color swatches whose selection ring flows to the one you tap, with a check in whichever ink reads on it.",
  TimeSlotPicker: "Bookable times as glass pills in a grid: the red selection flows across and down to the time you tap, and taken times shake.",
  TokenField: "A tag and recipient field where each entry buds out of the glass input as a chip, with checks, suggestions and backspace to remove.",

  // Lists
  DepthCarousel: "Paged cards that recede in depth as they leave the centre, over a glass page counter and a track you can scrub.",
  DragSelectGrid: "A photo and file grid where one drag selects a whole range like the system photo library, auto-scrolling at the edges with a tick per item.",
  FollowScroll: "A chat and feed container that stays pinned to the newest item, counting new ones into a glass pill once you scroll up to read.",
  PagedList: "An infinite-scroll list that prefetches and drops duplicate and stale pages, with a glass footer for loading, retry and the end.",
  StatusTimeline: "A vertical status timeline on glass nodes: the live one breathes, done ones stamp to a check, and details bud out of a node.",
  SwipeActionRow: "Any row in a glass card whose swipe actions bud out as tinted bubbles, with a full swipe that commits and one row open at a time.",
  TaskRow: "A task card whose glass check pops as it completes, with a priority chip, swipes to complete, snooze or delete, and drag to reorder.",

  // Media
  AttachmentTray: "An attachment strip for composers: a glass add tile opens the photo picker and each pick lands as a tile with a live progress ring.",
  LinkPreview: "A rich card for any URL that holds its size while it loads, then settles the page's image and title under a glass host chip.",
  NowPlaying: "A mini player that grows into the full player in one liquid glass motion, with scrubbing, skips and a drag to fold it back.",
  PhotoCropper: "A crop step for profile photos and posts with pinch, pan and aspect presets, rendering the crop off the main thread at full size.",
  PhotoViewer: "A full-screen photo viewer with anchored pinch zoom, momentum panning, paging and drag to dismiss under glass controls.",
  StoryStrip: "A Stories-style segment strip with its own clock, hold to pause, and tap zones for back and forward.",
  VoiceRecorder: "Hold to record a voice message: the glass mic swells into a recording capsule; slide to cancel or lock, let go to send.",
  WaveformScrub: "A voice note player whose waveform is the scrubber, with a glass time bubble that rides the finger and a playback speed chip.",

  // Motion
  DragToDismiss: "A modifier that lets a photo, card or sheet follow the drag, then springs it back or tosses it away at the speed of the flick.",

  // Navigation
  FloatingDock: "A floating glass dock where each item is its own bubble; drag across it to lift each item and read its name, release to switch.",
  IndexScrubber: "An A to Z index on a glass rail that jumps through a long list as you drag, with a letter bubble that follows the finger.",
  PageDots: "A page control whose red capsule pours from dot to dot, with tap and scrub to jump and an autoplay timer that fills the capsule.",
  ScrollIsland: "A floating glass island that names the section in view, rings in how much is read and opens into a contents panel on tap.",
  StepTrail: "A glass progress trail for checkout and setup flows, the red current step stretching to the next as you move on.",
  StretchHeader: "A hero header that stretches on overscroll, shrinks its title toward the navigation bar and pins a row of glass stat pills.",
  TrackingTabs: "Tabs on a glass track over paging content, with a tinted indicator that rides the scroll and title ink that turns under its edge.",

  // Sheets
  ConfirmSheet: "A confirmation card as a bottom sheet or an inline card, its confirm and cancel splitting out of one glass shape as it lands.",
  NoticeStack: "In-app notices stacked like notifications: the newest on top, a tap spreads the pile, and cards swipe away at your speed.",
  PermissionSheet: "A pre-permission sheet that previews what it brings as a stack of notification banners before the request.",
  SpotlightTour: "A first-run feature tour that dims the screen around each control, with a glass callout that steps from stop to stop.",
  Toast: "A single liquid glass toast with a tile tinted for its kind, a countdown ring that pauses on touch and an optional Undo.",

  // Text
  ExpandableText: "A paragraph clamped to a line limit that shows a glass more pill only when it is cut, and grows to full height without reflow.",
  GlassText: "Liquid Glass drawn on the actual letter shapes of a string, with fallbacks before iOS 26 and under Reduce Transparency.",
  PictureHeadline: "A headline with living pictures stuck between its words like a collage, each opening into a tilted sticker as the words rise.",
  TextReveal: "Reveals a headline by characters, words or lines, then grows a stroke of tinted glass behind the phrases that matter.",
};
