/** Names that have a web recreation. Server-safe (no client imports). */
export const previewNames = new Set([
  "TextReveal", "GlassText", "WeightWave", "Aurora", "Silk", "Grain", "TouchGrid",
  "AmbientMesh", "GlassSurface", "GlassActionMenu", "GlassSegments", "ElasticButton", "CommitButton", "HoldToConfirm",
  "FanStack", "TimerDial", "ExpandingTrack", "ScrubStepper", "FilterRail", "SecureEntry", "FlipCard",
  "ParallaxCard", "MotionCard", "SwipeDeck", "SwipeActionRow", "PullToRefresh", "DepthCarousel", "TaskRow", "StatusTimeline",
  "StretchHeader", "TrackingTabs", "FloatingDock", "Toast", "ConfirmSheet", "PermissionSheet",
  "ReactionToggle", "RatingScrub", "StatusMorph", "SkeletonLoader", "OutcomeScreen", "DragToDismiss", "ScrubChart",
  "RingBreakdown", "LiveStat", "Odometer", "StreamingReply", "ThinkingState", "PromptChips", "CodeBlock",
  "PhotoViewer", "StoryStrip",
  "AssistantOrb", "ThoughtOrb",
]);
export const hasPreview = (name: string) => previewNames.has(name);
