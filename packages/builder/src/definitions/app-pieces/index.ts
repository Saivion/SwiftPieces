// App pieces: components made for the app library's recreations, where a screen's signature
// visual had no component yet (a field of feeling bubbles, a mood face picker). One file per
// component (definitions/app-pieces/<id>.ts, renderer in react/preview/app-pieces/<id>.tsx),
// registered in the two lists below. They emit their SwiftUI inline (no registry source file),
// so Build and Open in Xcode work with nothing else to install.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { momentList } from "./moment-list.js";
import { sunPath } from "./sun-path.js";
import { routeRow } from "./route-row.js";
import { routeMap } from "./route-map.js";
import { focusStepsPiece } from "./focus-steps.js";
import { mediaRow } from "./media-row.js";
import { bubbleField } from "./bubble-field.js";
import { moodFaces } from "./mood-faces.js";
import { moodCalendar } from "./mood-calendar.js";
import { breathScene } from "./breath-scene.js";
import { iconToggles } from "./icon-toggles.js";
import { colorBlockList } from "./color-block-list.js";
import { numberPad } from "./number-pad.js";
import { balancePanel } from "./balance-panel.js";

import { statGrid } from "./stat-grid.js";
import { bandTrend } from "./band-trend.js";
import { metricStrip } from "./metric-strip.js";
import { glowNumber } from "./glow-number.js";
import { compareLine } from "./compare-line.js";
import { stageTimeline } from "./stage-timeline.js";
import { tintPanel } from "./tint-panel.js";
import { layerFill } from "./layer-fill.js";
import { cameraViewfinder } from "./camera-viewfinder.js";
import { photoMosaic } from "./photo-mosaic.js";

import { coverGrid } from "./cover-grid.js";
import { playbackControls } from "./playback-controls.js";
import { decimalStepper } from "./decimal-stepper.js";
import { streakCalendar } from "./streak-calendar.js";
import { dayPicker } from "./day-picker.js";
import { planRow } from "./plan-row.js";
import { focusRing } from "./focus-ring.js";
import { chatBubble } from "./chat-bubble.js";
import { wordPager } from "./word-pager.js";

import { quizChoices } from "./quiz-choices.js";

import { placeMap } from "./place-map.js";
import { agendaDay } from "./agenda-day.js";
import { eventLine } from "./event-line.js";
import { hourTimeline } from "./hour-timeline.js";
import { areaScrub } from "./area-scrub.js";
import { miniMap } from "./mini-map.js";
import { progressRingRow } from "./progress-ring-row.js";

import { activityGrid } from "./activity-grid.js";

import { countdownCard } from "./countdown-card.js";
import { bookRow } from "./book-row.js";
import { coverShelf } from "./cover-shelf.js";
import { categoryBars } from "./category-bars.js";
import { goalRing } from "./goal-ring.js";
import { mascot } from "./mascot.js";
import { screenHeader } from "./screen-header.js";
import { glassBar } from "./glass-bar.js";
import { feelingMark } from "./feeling-mark.js";
import { moodLine } from "./mood-line.js";
import { moodCount } from "./mood-count.js";
export const appPieceDefinitions: SwiftPieceDefinition[] = [momentList, sunPath, countdownCard, routeRow, routeMap, placeMap, streakCalendar, layerFill, focusStepsPiece, mediaRow, bubbleField, moodFaces, moodCalendar, breathScene, iconToggles, colorBlockList, numberPad, balancePanel, statGrid, bandTrend, metricStrip, glowNumber, compareLine, stageTimeline, tintPanel, cameraViewfinder, photoMosaic, coverGrid, playbackControls, decimalStepper, dayPicker, planRow, focusRing, chatBubble, wordPager, quizChoices, agendaDay, eventLine, hourTimeline, areaScrub, miniMap, progressRingRow, activityGrid, bookRow, coverShelf, categoryBars, goalRing, mascot, screenHeader, glassBar, feelingMark, moodLine, moodCount];
