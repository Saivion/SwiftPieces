"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/** Web-equivalent animated previews, keyed by Swift type name. Loaded lazily per chunk. */
const map: Record<string, ComponentType> = {
  TextReveal: dynamic(() => import("./text").then((m) => m.TextRevealPreview)),
  GlassText: dynamic(() => import("./text").then((m) => m.GlassTextPreview)),
  Silk: dynamic(() => import("./backgrounds").then((m) => m.SilkPreview)),
  TouchGrid: dynamic(() => import("./backgrounds").then((m) => m.TouchGridPreview)),
  GlassSurface: dynamic(() => import("./glass").then((m) => m.GlassSurfacePreview)),
  GlassActionMenu: dynamic(() => import("./glass").then((m) => m.GlassActionMenuPreview)),
  GlassSegments: dynamic(() => import("./glass").then((m) => m.GlassSegmentsPreview)),
  ElasticButton: dynamic(() => import("./controls").then((m) => m.ElasticButtonPreview)),
  CommitButton: dynamic(() => import("./controls").then((m) => m.CommitButtonPreview)),
  HoldToConfirm: dynamic(() => import("./controls").then((m) => m.HoldToConfirmPreview)),
  FanStack: dynamic(() => import("./controls").then((m) => m.FanStackPreview)),
  TimerDial: dynamic(() => import("./controls").then((m) => m.TimerDialPreview)),
  ExpandingTrack: dynamic(() => import("./inputs").then((m) => m.ExpandingTrackPreview)),
  ScrubStepper: dynamic(() => import("./inputs").then((m) => m.ScrubStepperPreview)),
  FilterRail: dynamic(() => import("./inputs").then((m) => m.FilterRailPreview)),
  SecureEntry: dynamic(() => import("./inputs").then((m) => m.SecureEntryPreview)),
  FlipCard: dynamic(() => import("./cards").then((m) => m.FlipCardPreview)),
  ParallaxCard: dynamic(() => import("./cards").then((m) => m.ParallaxCardPreview)),
  MotionCard: dynamic(() => import("./cards").then((m) => m.MotionCardPreview)),
  SwipeDeck: dynamic(() => import("./cards").then((m) => m.SwipeDeckPreview)),
  SwipeActionRow: dynamic(() => import("./lists").then((m) => m.SwipeActionRowPreview)),
  DepthCarousel: dynamic(() => import("./lists").then((m) => m.DepthCarouselPreview)),
  TaskRow: dynamic(() => import("./lists").then((m) => m.TaskRowPreview)),
  StatusTimeline: dynamic(() => import("./lists").then((m) => m.StatusTimelinePreview)),
  StretchHeader: dynamic(() => import("./navigation").then((m) => m.StretchHeaderPreview)),
  TrackingTabs: dynamic(() => import("./navigation").then((m) => m.TrackingTabsPreview)),
  FloatingDock: dynamic(() => import("./navigation").then((m) => m.FloatingDockPreview)),
  Toast: dynamic(() => import("./sheets").then((m) => m.ToastPreview)),
  ConfirmSheet: dynamic(() => import("./sheets").then((m) => m.ConfirmSheetPreview)),
  PermissionSheet: dynamic(() => import("./sheets").then((m) => m.PermissionSheetPreview)),
  ReactionToggle: dynamic(() => import("./feedback").then((m) => m.ReactionTogglePreview)),
  RatingScrub: dynamic(() => import("./feedback").then((m) => m.RatingScrubPreview)),
  StatusMorph: dynamic(() => import("./feedback").then((m) => m.StatusMorphPreview)),
  SkeletonLoader: dynamic(() => import("./feedback").then((m) => m.SkeletonLoaderPreview)),
  OutcomeScreen: dynamic(() => import("./feedback").then((m) => m.OutcomeScreenPreview)),
  DragToDismiss: dynamic(() => import("./motion").then((m) => m.DragToDismissPreview)),
  ScrubChart: dynamic(() => import("./data").then((m) => m.ScrubChartPreview)),
  RingBreakdown: dynamic(() => import("./data").then((m) => m.RingBreakdownPreview)),
  LiveStat: dynamic(() => import("./data").then((m) => m.LiveStatPreview)),
  Odometer: dynamic(() => import("./data").then((m) => m.OdometerPreview)),
  StreamingReply: dynamic(() => import("./ai").then((m) => m.StreamingReplyPreview)),
  ThinkingState: dynamic(() => import("./ai").then((m) => m.ThinkingStatePreview)),
  PromptChips: dynamic(() => import("./ai").then((m) => m.PromptChipsPreview)),
  CodeBlock: dynamic(() => import("./ai").then((m) => m.CodeBlockPreview)),
  PhotoViewer: dynamic(() => import("./media").then((m) => m.PhotoViewerPreview)),
  StoryStrip: dynamic(() => import("./media").then((m) => m.StoryStripPreview)),
  AssistantOrb: dynamic(() => import("./ai").then((m) => m.AssistantOrbPreview)),
  ThoughtOrb: dynamic(() => import("./ai").then((m) => m.ThoughtOrbPreview)),
};

export function PiecePreview({ name }: { name: string }) {
  const C = map[name];
  if (!C) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-sm text-muted">{name}</span>
      </div>
    );
  }
  return <C />;
}
