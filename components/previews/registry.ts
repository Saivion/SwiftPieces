/** Names that have a web recreation. Server-safe (no client imports). */
export const previewNames = new Set([
  "TextReveal", "GlassText", "Silk", "TouchGrid",
  "GlassSurface", "GlassActionMenu", "GlassSegments", "ElasticButton", "CommitButton", "HoldToConfirm",
  "FanStack", "TimerDial", "ExpandingTrack", "ScrubStepper", "FilterRail", "SecureEntry", "FlipCard",
  "ParallaxCard", "MotionCard", "SwipeDeck", "SwipeActionRow", "DepthCarousel", "TaskRow", "StatusTimeline",
  "StretchHeader", "TrackingTabs", "FloatingDock", "Toast", "ConfirmSheet", "PermissionSheet",
  "ReactionToggle", "RatingScrub", "StatusMorph", "SkeletonLoader", "OutcomeScreen", "DragToDismiss", "ScrubChart",
  "RingBreakdown", "LiveStat", "Odometer", "StreamingReply", "ThinkingState", "PromptChips", "CodeBlock",
  "PhotoViewer", "StoryStrip",
  "AssistantOrb", "ThoughtOrb",
  "RangeSlider", "DateRangePicker", "TokenField", "AmountField", "FormField", "ExpandableText", "PagedList",
]);
export const hasPreview = (name: string) => previewNames.has(name);
