// The app library's recreations. Every app has <slug>.ts here: its catalog entry (what it is, its
// steps) and its moves (what makes each screen work), which lists, search, SEO and the locked
// previews read. Three apps are free (FREE_RECREATIONS): their screens are built in
// <slug>.build.ts, loaded the first time one opens. The rest are Pro's (owner's call, 2026-10-01):
// their builds live in the Pro repo (lib/apps) and reach a Pro session through the Pro API, so this
// open-source package never holds them. Adding an app is its entry here, plus a build here (free)
// or in Pro (Pro).
import type { CatalogBuilder, CatalogEntry } from "../../../core/catalog.js";
import type { Recreation } from "./types.js";
import { recreation as breatheApp } from "./breathe-app.js";
import { recreation as gentleActivity } from "./gentle-activity.js";
import { recreation as recipeCook } from "./recipe-cook.js";
import { recreation as sunEvents } from "./sun-events.js";
import { recreation as feelingsJournal } from "./feelings-journal.js";
import { recreation as flightTracker } from "./flight-tracker.js";
import { recreation as plantCare } from "./plant-care.js";
import { recreation as wordPractice } from "./word-practice.js";
import { recreation as dailyJournal } from "./daily-journal.js";
import { recreation as waterStreak } from "./water-streak.js";
import { recreation as downtimeLists } from "./downtime-lists.js";
import { recreation as calendarPlanner } from "./calendar-planner.js";
import { recreation as moodDiary } from "./mood-diary.js";
import { recreation as budgetEnvelopes } from "./budget-envelopes.js";
import { recreation as splitBills } from "./split-bills.js";
import { recreation as visualPlanner } from "./visual-planner.js";
import { recreation as readingTracker } from "./reading-tracker.js";
import { recreation as podcastPlayer } from "./podcast-player.js";
import { recreation as habitJournal } from "./habit-journal.js";
import { recreation as tripOrganizer } from "./trip-organizer.js";

const all: Recreation[] = [breatheApp, gentleActivity, recipeCook, sunEvents, feelingsJournal, flightTracker, plantCare, wordPractice, dailyJournal, waterStreak, downtimeLists, calendarPlanner, moodDiary, budgetEnvelopes, splitBills, visualPlanner, readingTracker, podcastPlayer, habitJournal, tripOrganizer];

/**
 * The recreations anyone can open (owner's call, 2026-10-01): a calendar, a podcast player and a
 * water tracker, three kinds of app and three looks. Moving an app between free and Pro moves its
 * build between this folder and the Pro repo's lib/apps/builds.
 */
export const FREE_RECREATIONS: readonly string[] = ["calendar-planner", "podcast-player", "water-streak"];

export const recreationEntries: CatalogEntry[] = all.map((r) => ({ ...r.entry, availability: FREE_RECREATIONS.includes(r.entry.slug) ? "free" : "pro", moves: r.moves }));

/** The free recreations' builds; the Pro ones are the Pro repo's. */
export const recreationBuilds: Record<string, () => Promise<{ build: CatalogBuilder }>> = {
  "calendar-planner": () => import("./calendar-planner.build.js"),
  "podcast-player": () => import("./podcast-player.build.js"),
  "water-streak": () => import("./water-streak.build.js"),
};
