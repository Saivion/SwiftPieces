// The build for the water-streak remix: its screens, from registry components. See water-streak.ts.
// Shape lock: actions are pills, cards 24, tiles 16.
import type { CatalogBuilder } from "../../../core/catalog.js";
import type { ScreenNode } from "../../../core/schema.js";
import { app, body, col, flex, nd, row } from "../kit.js";

const DRINKS = "Water, Sparkling, Tea, Smoothie";

/** A section header: the title on the left, a quiet figure or hint on the right. */
const head = (title: string, meta: string): ScreenNode =>
  row({ spacing: 8, alignment: "bottom" }, [nd("text", { text: title, style: "title3", weight: "semibold" }), flex(), nd("text", { text: meta, style: "footnote", color: "secondary" })]);

/** A card on the app's rhythm: radius 24, padding 16. */
const card = (children: ScreenNode[], extra: Record<string, string | number> = {}) =>
  nd("vstack", { style: "card", padding: 16, radius: 24, spacing: 12, ...extra }, children);

/** A past day in the collection: a small mascot with its own look, and the day and how full it got. */
const pastDay = (expression: string, level: number, day: string) =>
  nd("mascot", { size: 60, motion: "still", expression, level, caption: day });

/** A logged drink: what, when and how much, swipe left to take it back. */
const logged = (drink: string, note: string, when: string) =>
  nd("swipe-action-row", { title: drink, subtitle: note, detail: when, avatar: false, leading: "none", trailing: "delete" });

/** Two challenge tiles side by side; a tap joins one (a check), a second tap leaves it. */
const tiles = (items: string, colors: string) =>
  nd("color-block-list", { items, colors, layout: "tiles", gap: 12, radius: 16, height: 140, selectable: true });

export const build: CatalogBuilder = app({
  name: "Tide",
  look: "pieces",
  screens: (l) => [
    {
      key: "today", name: "TodayView", props: { title: "", alignment: "center", spacing: 24, padding: 16 },
      children: [
        nd("screen-header", {
          eyebrow: "Tuesday · 5 days in a row", title: "Hydration", emphasis: "2 L goal", emphasisStyle: "muted", stacked: "yes", size: 34,
          trailing: "two", icon: "calendar", link: l.to("streak"), icon2: "square.grid.2x2", link2: l.to("widgets"), leadWeight: "bold" }),
        nd("layer-fill", { shape: "blob", items: DRINKS, layers: "Water: 250, Tea: 250, Water: 500, Sparkling: 330, Smoothie: 200", goal: 2000, unit: " ml", serving: 250, readout: "large", height: 300 }),
        nd("elastic-button", { title: "Today's summary", icon: "chevron.right", iconPosition: "trailing", style: "raised", link: l.to("character") }),
      ],
    },
    {
      key: "widgets", name: "WidgetsView", props: { title: "Widgets", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        head("Medium", "Tap a drink to log"),
        card([
          nd("layer-fill", { shape: "glass", items: "Water, Tea, Smoothie", layers: "Water: 500, Tea: 250, Sparkling: 330", goal: 2000, unit: " ml", serving: 250, readout: "small", height: 170 }),
        ], { spacing: 0 }),
        head("Small", "Glanceable"),
        row({ spacing: 12 }, [
          card([nd("layer-fill", { shape: "blob", items: "", layers: "Water: 750, Smoothie: 300", goal: 2000, unit: " ml", readout: "small", height: 88 })], { spacing: 0 }),
          card([nd("layer-fill", { shape: "drop", items: "", layers: "Sparkling: 330, Water: 500, Tea: 400", goal: 2000, unit: " ml", readout: "small", height: 88 })], { spacing: 0 }),
        ]),
        nd("live-stat", { label: "ml today · 62% of your goal", value: 1240, format: "number", delta: 18, sparkline: true }),
        nd("text", { text: "Press and hold your Home Screen, tap +, then search for Tide.", style: "footnote", color: "secondary" }),
      ],
    },
    {
      key: "streak", name: "StreakView", props: { title: "Streak", alignment: "leading", spacing: 24, padding: 16, toolbarIcon: "trophy", toolbarLink: l.to("challenges") },
      children: [
        nd("streak-calendar", { month: "September", days: 30, firstWeekday: 1, today: 22, runs: "2-5, 7, 9-12, 14-16, 18-22", colors: "azure, blush, azure, ember, sky", partial: "6, 13", record: 14, todayNote: "1.7 L so far · 85% of your goal" }),
        nd("vstack", { spacing: 12, padding: 0 }, [
          head("Today's drinks", "Swipe to undo"),
          nd("vstack", { spacing: 8, padding: 0 }, [
            logged("Water", "250 ml", "8:40 PM"),
            logged("Tea", "200 ml", "4:15 PM"),
            logged("Sparkling", "330 ml", "1:05 PM"),
          ]),
        ]),
      ],
    },
    {
      key: "challenges", name: "ChallengesView", props: { title: "Challenges", alignment: "leading", spacing: 24, padding: 16 },
      children: [
        card([
          head("In progress", "3 underway"),
          row({ spacing: 4 }, [
            nd("mascot", { size: 76, level: 60, expression: "calm", caption: "Less caffeine" }),
            nd("mascot", { size: 76, level: 35, expression: "wow", caption: "Tea week" }),
            nd("mascot", { size: 76, level: 85, expression: "grin", caption: "7-day hydrate" }),
          ]),
        ]),
        nd("tracking-tabs", { titles: "Drink more, Cut back, Finished", counts: "", selected: 0, indicator: "tangerine" }, [
          nd("vstack", { spacing: 12, padding: 0 }, [
            tiles("7 days: Morning glass, 21 days: Two litres", "sky, blush"),
            tiles("10 days: Lunch glass, 14 days: Desk bottle", "sage, butter"),
          ]),
          nd("vstack", { spacing: 12, padding: 0 }, [
            tiles("14 days: No soda, 10 days: Evening decaf", "lilac, sand"),
            tiles("30 days: Dry month, 7 days: One coffee", "sky, sage"),
          ]),
          nd("vstack", { alignment: "center", spacing: 12, padding: 24 }, [
            nd("mascot", { size: 88, motion: "calm", expression: "sleepy" }),
            nd("text", { text: "Nothing finished yet", style: "title3", weight: "semibold", alignment: "center" }),
            body("Tea week wraps up on Sunday. It lands here with its days kept.", { alignment: "center" }),
          ]),
        ]),
      ],
    },
    {
      key: "character", name: "DayView", props: { title: "Tuesday 22", alignment: "center", spacing: 24, padding: 16 },
      children: [
        col({ alignment: "center", spacing: 12 }, [
          nd("text-reveal", { text: "Goal met", highlights: "", size: 28, alignment: "center", unit: "characters", preset: "rise" }),
          nd("mascot", { size: 168, motion: "lively", expression: "grin", level: 100, label: "105%", caption: "2.1 L of 2 L · tap to celebrate" }),
        ]),
        card([
          head("This week", "5 of 7 days"),
          row({ spacing: 4 }, [pastDay("calm", 72, "Wed"), pastDay("grin", 100, "Thu"), pastDay("wow", 48, "Fri"), pastDay("smile", 90, "Sat")]),
          row({ spacing: 4 }, [pastDay("grin", 100, "Sun"), pastDay("smile", 100, "Mon"), pastDay("calm", 30, "Tue"), pastDay("sleepy", 0, "Wed")]),
        ]),
        nd("elastic-button", { title: "Share", icon: "square.and.arrow.up", iconPosition: "leading", style: "signal", link: l.sheet("share") }),
      ],
    },
    {
      key: "share", name: "ShareView", props: { title: "", alignment: "leading", spacing: 24, padding: 16, detent: "large" },
      children: [
        nd("screen-header", { eyebrow: "Tuesday 22", title: "Share your day", emphasis: "", emphasisStyle: "bold", size: 34, trailing: "icon", icon: "xmark", link: "back", leadWeight: "bold"}),
        nd("motion-card", { fill: "signal", radius: 24, height: 440, maxAngle: 12 }, [
          row({ spacing: 8 }, [
            col({ spacing: 0 }, [nd("text", { text: "TUESDAY", style: "caption", weight: "bold", color: "onAccent" }), nd("text", { text: "In drinks", style: "title", weight: "black", color: "onAccent" })]),
            flex(),
            nd("text", { text: "2.1 L", style: "title2", weight: "black", color: "onAccent" }),
          ]),
          nd("layer-fill", { shape: "glass", items: "", layers: "Water: 500, Tea: 200, Water: 250, Sparkling: 330, Smoothie: 300, Water: 500", goal: 2000, readout: "hidden", height: 300 }),
        ]),
        nd("commit-button", { title: "Share", successTitle: "Shared", link: "back" }),
      ],
    },
  ],
});
