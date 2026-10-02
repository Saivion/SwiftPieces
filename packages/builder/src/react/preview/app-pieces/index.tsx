"use client";
// Renderers for the app pieces (definitions/app-pieces), one import per component. Loaded as
// their own chunk ("app-pieces") the first time a screen uses one.
import type { Renderer } from "../env.js";
import { MomentList } from "./moment-list.js";
import { SunPath } from "./sun-path.js";
import { CountdownCard } from "./countdown-card.js";
import { RouteRow } from "./route-row.js";
import { RouteMap } from "./route-map.js";
import { PlaceMap } from "./place-map.js";
import { StreakCalendar } from "./streak-calendar.js";
import { LayerFill } from "./layer-fill.js";
import { FocusSteps } from "./focus-steps.js";
import { MediaRow } from "./media-row.js";
import { BubbleField } from "./bubble-field.js";
import { MoodFaces } from "./mood-faces.js";
import { MoodCalendar } from "./mood-calendar.js";
import { BreathScene } from "./breath-scene.js";
import { IconToggles } from "./icon-toggles.js";
import { ColorBlockList } from "./color-block-list.js";
import { NumberPad } from "./number-pad.js";
import { BalancePanel } from "./balance-panel.js";

import { StatGrid } from "./stat-grid.js";
import { BandTrend } from "./band-trend.js";
import { MetricStrip } from "./metric-strip.js";
import { GlowNumber } from "./glow-number.js";
import { CompareLine } from "./compare-line.js";
import { StageTimeline } from "./stage-timeline.js";
import { TintPanel } from "./tint-panel.js";
import { CameraViewfinder } from "./camera-viewfinder.js";
import { PhotoMosaic } from "./photo-mosaic.js";

import { CoverGrid } from "./cover-grid.js";
import { PlaybackControls } from "./playback-controls.js";
import { DecimalStepper } from "./decimal-stepper.js";
import { DayPicker } from "./day-picker.js";
import { PlanRow } from "./plan-row.js";
import { FocusRing } from "./focus-ring.js";
import { ChatBubble } from "./chat-bubble.js";
import { WordPager } from "./word-pager.js";

import { QuizChoices } from "./quiz-choices.js";

import { AgendaDay } from "./agenda-day.js";
import { EventLine } from "./event-line.js";
import { HourTimeline } from "./hour-timeline.js";
import { AreaScrub } from "./area-scrub.js";
import { MiniMap } from "./mini-map.js";
import { ProgressRingRow } from "./progress-ring-row.js";

import { ActivityGrid } from "./activity-grid.js";

import { BookRow } from "./book-row.js";
import { CoverShelf } from "./cover-shelf.js";
import { CategoryBars } from "./category-bars.js";
import { GoalRing } from "./goal-ring.js";
import { Mascot } from "./mascot.js";
import { ScreenHeader } from "./screen-header.js";
import { GlassBar } from "./glass-bar.js";
import { FeelingMark } from "./feeling-mark.js";
import { MoodLine } from "./mood-line.js";
import { MoodCount } from "./mood-count.js";
export const appPieceRenderers: Record<string, Renderer> = { "moment-list": MomentList, "sun-path": SunPath, "countdown-card": CountdownCard, "route-row": RouteRow, "route-map": RouteMap, "place-map": PlaceMap, "streak-calendar": StreakCalendar, "layer-fill": LayerFill, "focus-steps": FocusSteps, "media-row": MediaRow, "bubble-field": BubbleField, "mood-faces": MoodFaces, "mood-calendar": MoodCalendar, "breath-scene": BreathScene, "icon-toggles": IconToggles, "color-block-list": ColorBlockList, "number-pad": NumberPad, "balance-panel": BalancePanel, "stat-grid": StatGrid, "band-trend": BandTrend, "metric-strip": MetricStrip, "glow-number": GlowNumber, "compare-line": CompareLine, "stage-timeline": StageTimeline, "tint-panel": TintPanel, "camera-viewfinder": CameraViewfinder, "photo-mosaic": PhotoMosaic, "cover-grid": CoverGrid, "playback-controls": PlaybackControls, "decimal-stepper": DecimalStepper, "day-picker": DayPicker, "plan-row": PlanRow, "focus-ring": FocusRing, "chat-bubble": ChatBubble, "word-pager": WordPager, "quiz-choices": QuizChoices, "agenda-day": AgendaDay, "event-line": EventLine, "hour-timeline": HourTimeline, "area-scrub": AreaScrub, "mini-map": MiniMap, "progress-ring-row": ProgressRingRow, "activity-grid": ActivityGrid, "book-row": BookRow, "cover-shelf": CoverShelf, "category-bars": CategoryBars, "goal-ring": GoalRing, mascot: Mascot, "screen-header": ScreenHeader, "glass-bar": GlassBar, "feeling-mark": FeelingMark, "mood-line": MoodLine, "mood-count": MoodCount };
