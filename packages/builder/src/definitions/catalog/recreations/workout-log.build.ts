// The build for the workout-log remix: its screens, from registry components. See workout-log.ts.
// Shape lock: actions are pills, cards 20, tiles and cells 14. One accent (signal red) for the
// primary action; azure marks exercises and the numbers you beat, green a set that's done.
import type { CatalogBuilder } from "../../../core/catalog.js";
import type { ScreenNode } from "../../../core/schema.js";
import { app, caption, col, flex, footnote, nd, row } from "../kit.js";

const CARD = { style: "card", padding: 16, radius: 20 } as const;

/** A section's heading: the title on the leading edge, a quiet figure on the trailing one. */
const head = (title: string, meta: string): ScreenNode =>
  row({ spacing: 8, alignment: "bottom" }, [nd("text", { text: title, style: "title3", weight: "semibold" }), flex(), footnote(meta)]);

/** One exercise in the log, on its own card. */
const exercise = (props: Record<string, string | number | boolean>): ScreenNode => col({ ...CARD, spacing: 0, padding: 14 }, [nd("set-table", props)]);

/** A routine to start: its name, what's in it, and the start button. */
const routine = (name: string, lifts: string, meta: string, link: string): ScreenNode =>
  col({ ...CARD, spacing: 10 }, [
    row({ spacing: 8 }, [nd("text", { text: name, style: "headline" }), flex(), caption(meta)]),
    footnote(lifts, { lineLimit: 2 }),
    nd("elastic-button", { title: "Start routine", icon: "play.fill", iconPosition: "leading", style: "signal", link }),
  ]);

/** A workout in the feed: who, what, the figures, the lifts and a like. */
const post = (initials: string, color: string, who: string, when: string, title: string, figures: string, lifts: string, likes: number, liked: boolean): ScreenNode =>
  col({ ...CARD, spacing: 12 }, [
    row({ spacing: 10 }, [
      nd("avatar", { initials, size: 40, color }),
      col({ spacing: 0 }, [nd("text", { text: who, style: "headline" }), caption(when)]),
      flex(),
      nd("symbol", { icon: "ellipsis", size: 18, color: "secondary" }),
    ]),
    nd("text", { text: title, style: "title3", weight: "bold" }),
    nd("stat-grid", { items: figures, style: "plain", columns: 3, valueSize: 20 }),
    footnote(lifts, { lineLimit: 3 }),
    row({ spacing: 16 }, [
      nd("reaction-toggle", { icon: "heart", isOn: liked, count: likes, confirmation: "", fill: "tangerine", size: 22 }),
      nd("symbol", { icon: "bubble.left", size: 20, color: "secondary" }),
      flex(),
      nd("symbol", { icon: "square.and.arrow.up", size: 20, color: "secondary" }),
    ]),
  ]);

export const build: CatalogBuilder = app({
  name: "Plates",
  shell: "tabs",
  tabBar: "dock",
  look: "pieces",
  screens: (l) => [
    {
      key: "workout", name: "WorkoutView", tab: { title: "Workout", icon: "dumbbell" }, props: { title: "", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        nd("screen-header", { eyebrow: "Thursday · week 6 of your split", title: "Ready to", emphasis: "lift", emphasisStyle: "muted", stacked: "no", leadWeight: "bold", size: 34, trailing: "icon", icon: "plus", link: l.sheet("log") }),
        nd("elastic-button", { title: "Start an empty workout", icon: "plus", iconPosition: "leading", style: "raised", link: l.sheet("log") }),
        head("Routines", "4 of 4"),
        nd("filter-rail", { options: "Push pull legs, Upper lower, Home gym", multiple: false }),
        routine("Push Day", "Bench Press (Barbell), Incline Dumbbell Press, Cable Fly, Triceps Pushdown", "Last: Monday", l.sheet("log")),
        routine("Pull Day", "Deadlift (Barbell), Lat Pulldown (Cable), Seated Row, Hammer Curl", "Last: Tuesday", l.sheet("log")),
        routine("Leg Day", "Squat (Barbell), Romanian Deadlift, Leg Press, Calf Raise", "Last: Wednesday", l.sheet("log")),
      ],
    },
    {
      key: "log", name: "LogWorkoutView", props: { title: "", alignment: "leading", spacing: 16, padding: 16, detent: "large" },
      children: [
        nd("glass-bar", { title: "Push Day", leading: "close", leadingLink: "back", trailing: "text", trailingText: "Finish", trailingLink: l.to("done") }),
        nd("stat-grid", { items: "Duration | 38min | ; Volume | 4,210 kg | ; Sets | 9 |", style: "cards", columns: 3, valueSize: 22, radius: 14 }),
        exercise({ title: "Bench Press (Barbell)", note: "Pause the last rep on the chest.", sets: "W | 40 kg × 10 | 40 | 10 | done; 1 | 60 kg × 8 | 62.5 | 8 | done; 2 | 60 kg × 8 | 62.5 | 8 | done; 3 | 60 kg × 7 | 62.5 | 7 |", rest: 120, titleTint: "azure" }),
        exercise({ title: "Incline Dumbbell Press", sets: "1 | 22 kg × 10 | 24 | 10 | ; 2 | 22 kg × 10 | 24 | 9 | ; 3 | 22 kg × 9 | 24 | 8 |", rest: 90, titleTint: "azure" }),
        exercise({ title: "Cable Fly", sets: "1 | 15 kg × 12 | 15 | 12 | ; 2 | 15 kg × 12 | 15 | 12 |", rest: 60, titleTint: "azure" }),
        nd("elastic-button", { title: "Add exercise", icon: "plus", iconPosition: "leading", style: "raised" }),
        nd("hold-to-confirm", { title: "Hold to discard workout", icon: "trash", committedTitle: "Workout discarded", style: "standard", duration: 1.2 }),
      ],
    },
    {
      key: "done", name: "WorkoutDoneView", props: { title: "", alignment: "center", spacing: 20, padding: 16 },
      children: [
        nd("text-reveal", { text: "Workout done. Two records.", highlights: "Two records", size: 32, alignment: "center", unit: "words", preset: "rise" }),
        nd("glow-number", { value: 4210, caption: "kg lifted, 380 more than Monday", trend: "up", symbol: "trophy", palette: "signal", diameter: 240 }),
        nd("stat-grid", { items: "Duration | 52min | ; Sets | 12 | ; Records | 2 |", style: "tiles", columns: 3, valueSize: 22, radius: 14, tiles: "azure, blush, ember" }),
        col({ ...CARD, spacing: 8 }, [
          head("New records", "Bench Press"),
          nd("row", { icon: "trophy", iconColor: "orange", title: "Heaviest weight", value: "62.5 kg", accessory: "none" }),
          nd("row", { icon: "trophy", iconColor: "orange", title: "Best set volume", value: "62.5 kg × 8", accessory: "none" }),
        ]),
        nd("commit-button", { title: "Save workout", successTitle: "Saved to your profile", link: l.root("feed") }),
      ],
    },
    {
      key: "feed", name: "FeedView", tab: { title: "Home", icon: "house" }, props: { title: "", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        nd("screen-header", { eyebrow: "3 friends trained today", title: "Home", emphasis: "", stacked: "no", leadWeight: "bold", size: 34, trailing: "two", icon: "magnifyingglass", icon2: "bell", buttons: "fill" }),
        post("MA", "teal", "maya.lifts", "2 h ago", "Morning legs", "Time | 1h 05m | ; Volume | 8,240 kg | ; Records | 2 |", "4 sets Squat (Barbell) · 3 sets Romanian Deadlift · 3 sets Leg Press · See 2 more exercises", 24, true),
        post("JO", "indigo", "jonas_o", "Yesterday", "Pull, heavy week", "Time | 58m | ; Volume | 6,915 kg | ; Records | 1 |", "5 sets Deadlift (Barbell) · 4 sets Lat Pulldown (Cable) · 3 sets Hammer Curl", 11, false),
      ],
    },
    {
      key: "profile", name: "ProfileView", tab: { title: "Profile", icon: "person" }, props: { title: "", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        nd("screen-header", { eyebrow: "128 workouts · 42 followers", title: "Priya", emphasis: "Raman", emphasisStyle: "muted", stacked: "no", leadWeight: "bold", size: 34, trailing: "avatar", initials: "PR" }),
        col({ ...CARD, spacing: 12 }, [
          head("This week", "6 h 12 min"),
          nd("glass-segments", { options: "Duration, Volume, Reps", selected: 0, indicator: "glass", height: 36 }),
          nd("chart", { values: "3.2, 4.1, 2.5, 5.0, 4.4, 5.6, 6.2", labels: "Aug, , Sep, , , Oct, ", tint: "accent", height: 150, highlight: 6 }),
        ]),
        head("Dashboard", ""),
        row({ spacing: 12 }, [
          nd("card", { layout: "tile", icon: "chart.bar", title: "Statistics", subtitle: "Muscles and sets", value: "", action: "", tint: "azure", radius: 14, padding: 14, link: l.to("stats") }),
          nd("card", { layout: "tile", icon: "dumbbell", title: "Exercises", subtitle: "Records and graphs", value: "", action: "", tint: "orange", radius: 14, padding: 14, link: l.to("progress") }),
        ]),
        row({ spacing: 12 }, [
          nd("card", { layout: "tile", icon: "figure.walk", title: "Measures", subtitle: "Weight and body", value: "", action: "", tint: "green", radius: 14, padding: 14 }),
          nd("card", { layout: "tile", icon: "calendar", title: "Calendar", subtitle: "5-week streak", value: "", action: "", tint: "pink", radius: 14, padding: 14, link: l.to("stats") }),
        ]),
      ],
    },
    {
      key: "progress", name: "ExerciseView", props: { title: "Bench Press", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        nd("glass-segments", { options: "Summary, History, How to", selected: 0, indicator: "glass", height: 38 }),
        col({ ...CARD, spacing: 12 }, [
          row({ spacing: 8, alignment: "bottom" }, [col({ spacing: 0 }, [caption("ONE REP MAX", { weight: "semibold" }), nd("text", { text: "78.3 kg", style: "title", weight: "bold" })]), flex(), nd("tag", { text: "+6.1 kg", tint: "green", style: "tinted", icon: "arrow.up" })]),
          nd("compare-line", { current: "68, 69, 69, 70.5, 71, 72.5, 72, 74, 75.2, 76, 77.4, 78.3", reference: "", names: "One rep max", labels: "Jul, , , Aug, , , Sep, , , Oct, , ", marks: "70, 75", tint: "azure", fromZero: false, height: 180 }),
          nd("filter-rail", { options: "One rep max, Heaviest weight, Best set, Session volume", multiple: false }),
        ]),
        head("Personal records", "4"),
        nd("stat-grid", { items: "Heaviest weight | 62.5 kg | ; Best one rep max | 78.3 kg | ; Best set | 62.5 kg × 8 | ; Best session | 1,640 kg |", style: "cards", columns: 2, valueSize: 22, radius: 14 }),
      ],
    },
    {
      key: "stats", name: "StatisticsView", props: { title: "Statistics", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        col({ ...CARD, spacing: 12 }, [
          head("October", "5-week streak"),
          nd("activity-grid", { pattern: "3030300 0303030 3003300 3030030", layout: "calendar", weeks: 4, tint: "azure", today: 23 }),
        ]),
        col({ ...CARD, spacing: 12 }, [
          head("Sets per muscle", "Last 30 days"),
          nd("category-bars", { values: "38, 34, 30, 26, 22, 18, 12", labels: "chest, back, legs, shoulders, triceps, biceps, core", colors: "azure, sky, blue, indigo, violet, lavender, gray", axis: "Sets", caption: "Muscle group", height: 260 }),
        ]),
      ],
    },
  ],
});
