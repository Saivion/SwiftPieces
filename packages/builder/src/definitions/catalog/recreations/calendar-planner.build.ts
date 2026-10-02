// The build for the calendar-planner remix: its screens, from registry components. See calendar-planner.ts.
// Drawn after the calendar that inspired it: titles in capitals over a spaced date, section labels as
// small spaced capitals, a centred event, the sky before the curve. Every screen sits on the Style's
// own background and cards, so the app changes as one when the Style does.
// Shape lock: actions are pills, cards 16, tiles 16.
import type { CatalogBuilder } from "../../../core/catalog.js";
import type { Props, ScreenNode } from "../../../core/schema.js";
import { app, col, flex, nd, row, space } from "../kit.js";

/** One day of the week on the screen's own ground: split from the next by a hairline, the picked day in an accent tile. */
const day = (weekday: string, date: number, events: string, extra: Props = {}): ScreenNode =>
  nd("agenda-day", { weekday, date, events, height: 104, surface: "ground", ...extra });

/** A section label: small spaced capitals, quiet. */
const caps = (text: string): ScreenNode => nd("text", { text: text.toUpperCase(), style: "footnote", weight: "semibold", tracking: 1.5, color: "secondary" });

/** A day's title: the weekday in capitals over its date, spaced. */
const dayTitle = (weekday: string, date: string, alignment = "leading"): ScreenNode =>
  col({ spacing: 2, alignment }, [
    nd("text", { text: weekday.toUpperCase(), style: "largeTitle", weight: "bold", alignment }),
    nd("text", { text: date.toUpperCase(), style: "callout", tracking: 1.5, alignment }),
  ]);

/** A card: the Style's card surface. */
const card = (children: ScreenNode[], extra: Props = {}): ScreenNode => nd("vstack", { spacing: 12, style: "card", padding: 16, radius: 16, ...extra }, children);

/** A full-width stack with no fill of its own (tabs pages stretch to the phone's width). */
const stack = (children: ScreenNode[], spacing = 12): ScreenNode => nd("tint-panel", { fill: "clear", fade: false, radius: 0, minHeight: 0, padding: 0, spacing }, children);

/** An event on its own card. */
const plan = (title: string, detail: string, tint: string, extra: Props = {}): ScreenNode => card([nd("event-line", { title, detail, tint, ...extra })]);

/** The week's plans in one list, for the Friday screen's Week page. */
const weekLine = (title: string, detail: string, tint: string, extra: Props = {}): ScreenNode => plan(title, detail, tint, extra);

export const build: CatalogBuilder = app({
  name: "Daybook",
  look: "pieces",
  screens: (l) => [
    {
      // The week: one ground from the header down, days split by hairlines, the month running up the dates.
      key: "week", name: "WeekView", props: { title: "", padding: 0, spacing: 0 },
      children: [
        nd("tint-panel", { fill: "clear", fade: false, radius: 0, minHeight: 0, padding: 20, spacing: 0 }, [
          nd("screen-header", { eyebrow: "Week 42 · 9 plans", title: "October", emphasis: "12 – 18", emphasisStyle: "muted", leadWeight: "bold", stacked: "no", size: 34, trailing: "two", icon: "calendar", link: l.to("month"), icon2: "plus", link2: l.sheet("new") }),
        ]),
        day("MON", 12, "Standup with design | 9:30 → 9:45 AM | azure", { height: 84 }),
        day("TUE", 13, "Renew passport | | sky", { selected: true, height: 84 }),
        day("WED", 14, "Call the landlord | 12:15 PM | blush; Pottery class | 7:00 → 9:00 PM | ember", { sideLabel: "OCTOBER", sideTint: "signal" }),
        day("THU", 15, "", { height: 76, empty: "Nothing planned" }),
        day("FRI", 16, "Nadia's birthday | All day | blush; Studio visit | 2:00 → 3:30 PM | azure", { link: l.to("friday") }),
        day("SAT", 17, "Lunch at Olmo | 12:30 → 2:00 PM · Dock Street | ember", { link: l.sheet("event") }),
        day("SUN", 18, "Farmers market | 9:00 → 10:30 AM | azure", { link: l.to("sunday") }),
      ],
    },
    {
      // An event: a sheet with everything centred, from what and when down to when to leave.
      key: "event", name: "EventView", props: { padding: 24, spacing: 12, alignment: "center", detent: "large" },
      children: [
        space(8),
        nd("text", { text: "Lunch at Olmo", style: "largeTitle", weight: "bold", alignment: "center" }),
        col({ spacing: 4, alignment: "center" }, [
          nd("text", { text: "12:30 – 2:00 PM", style: "title2", weight: "semibold", alignment: "center" }),
          nd("text", { text: "SATURDAY 17 OCTOBER", style: "footnote", tracking: 1.5, alignment: "center" }),
        ]),
        nd("text", { text: "With Theo, and free until the market on Sunday", style: "body", alignment: "center" }),
        space(4),
        nd("mini-map", { place: "Olmo", style: "ink", height: 150 }),
        col({ spacing: 2, alignment: "center" }, [
          nd("text", { text: "Dock Street 14", style: "title3", weight: "semibold", alignment: "center" }),
          nd("text", { text: "Harbourside, second floor", style: "subheadline", color: "secondary", alignment: "center" }),
        ]),
        nd("flip-card", { frontEyebrow: "Getting there", frontTitle: "Leave by 12:08", frontDetail: "22 min on foot · tap for other ways", frontFill: "sand", backEyebrow: "Other ways", backText: "9 minutes by bike, or the number 4 tram from Pier Road at 12:14.", backDetail: "Both get you there by 12:25", backFill: "sky", height: 164 }),
        nd("toast", { trigger: "Directions", triggerStyle: "prominent", fullWidth: true, message: "Walking route ready", detail: "Leave by 12:08 to sit down at 12:30", style: "success", icon: "location", actionTitle: "", position: "top" }),
      ],
    },
    {
      // A day at a glance: the day in capitals, then each section under a spaced label.
      key: "sunday", name: "SundayView", props: { title: "", padding: 20, spacing: 12, alignment: "leading", toolbarIcon: "calendar", toolbarLink: l.to("month") },
      children: [
        dayTitle("Sunday", "18 October"),
        space(12),
        caps("Schedule"),
        plan("Farmers market", "9:00 → 10:30 AM", "azure"),
        plan("Call Mum", "6:00 PM", "blush"),
        space(8),
        caps("Weather"),
        card([
          row({ spacing: 16, alignment: "center" }, [
            nd("symbol", { icon: "sun.max", size: 44, color: "yellow" }),
            col({ spacing: 2 }, [
              nd("text", { text: "21°", style: "title", weight: "bold" }),
              nd("text", { text: "Clearing by noon with a light westerly in Harbourside", style: "subheadline" }),
            ]),
          ]),
          nd("elastic-button", { title: "Hour by hour", icon: "arrow.right", iconPosition: "trailing", style: "raised", fullWidth: false, link: l.to("weather") }),
        ]),
        space(8),
        caps("To-do"),
        plan("Return library books", "Before 5 PM", "blush", { todo: true }),
        plan("Book a haircut", "Anytime", "sky", { todo: true }),
        space(8),
        caps("Coming up"),
        card([
          row({ spacing: 12, alignment: "top" }, [
            nd("symbol", { icon: "airplane", size: 24 }),
            col({ spacing: 4 }, [
              nd("text", { text: "Lisbon on Thursday", style: "headline" }),
              nd("text", { text: "7:40 AM from Terminal 2 · check-in opens Wednesday", style: "subheadline", color: "secondary" }),
            ]),
          ]),
        ]),
      ],
    },
    {
      // The forecast: the sky and the number first, then the curve you scrub.
      key: "weather", name: "WeatherView", props: { title: "", padding: 20, spacing: 12, alignment: "center" },
      children: [
        space(8),
        nd("symbol", { icon: "sun.max", size: 72, color: "yellow" }),
        nd("text", { text: "21°", style: "largeTitle", weight: "light", alignment: "center" }),
        nd("text", { text: "Dry all day with a light westerly in Harbourside", style: "title3", alignment: "center" }),
        nd("text", { text: "SUNDAY 18 OCTOBER", style: "footnote", tracking: 1.5, color: "secondary", alignment: "center" }),
        space(4),
        nd("tracking-tabs", { titles: "Temperature, Rain, Wind", counts: "", selected: 0, indicator: "tangerine" }, [
          nd("area-scrub", { values: "12, 12, 13, 14, 16, 18, 19, 20, 21, 21, 20, 19, 18, 16, 15, 14, 13, 13", hour: 15.5, unit: "°", note: "Dry all day", tint: "sky", height: 320 }),
          nd("area-scrub", { values: "0, 0, 5, 10, 10, 5, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0", hour: 9, unit: "%", note: "Showers by 9, then dry", tint: "azure", height: 320 }),
          nd("area-scrub", { values: "8, 8, 9, 10, 12, 13, 14, 14, 13, 12, 12, 11, 10, 9, 9, 8, 8, 8", hour: 12, unit: " km/h", note: "Westerly all day", tint: "teal", height: 320 }),
        ]),
      ],
    },
    {
      // A day's hours: the all-day plan as a chip, then the schedule hour by hour.
      key: "friday", name: "FridayView", props: { title: "", padding: 20, spacing: 12, alignment: "leading" },
      children: [
        dayTitle("Friday", "16 October"),
        space(4),
        nd("tracking-tabs", { titles: "Day, Week, Month", counts: "2, 9, 14", selected: 0, indicator: "tangerine" }, [
          stack([
            caps("All day"),
            nd("event-line", { title: "Nadia's birthday", detail: "", tint: "blush", style: "chip" }),
            space(4),
            caps("Schedule"),
            nd("hour-timeline", { start: 9, end: 17, hourHeight: 64, events: "Deep work | 9.5 | 11.5 | azure; Studio visit | 14 | 15.5 | ember", now: 12.4 }),
          ]),
          stack([
            weekLine("Standup with design", "Mon · 9:30 → 9:45 AM", "azure"),
            weekLine("Renew passport", "Tue · anytime", "sky"),
            weekLine("Call the landlord", "Wed · 12:15 PM", "blush"),
            weekLine("Pottery class", "Wed · 7:00 → 9:00 PM", "ember"),
            weekLine("Studio visit", "Fri · 2:00 → 3:30 PM", "azure"),
            weekLine("Lunch at Olmo", "Sat · 12:30 → 2:00 PM", "ember", { link: l.sheet("event") }),
            weekLine("Farmers market", "Sun · 9:00 → 10:30 AM", "azure", { link: l.to("sunday") }),
          ], 8),
          nd("day-picker", { layout: "month", days: 31, offset: 3, selected: 16, today: 13, marked: "2, 6, 9, 14, 20, 27, 29", busy: "16, 18, 22", tint: "signal" }),
        ]),
      ],
    },
    {
      // The month: the year and month as one line, busy days on discs, the picked day's plans below.
      key: "month", name: "MonthView", props: { title: "", spacing: 20, padding: 20, alignment: "leading" },
      children: [
        nd("screen-header", { eyebrow: "14 plans · 3 busy days", title: "2026", emphasis: "OCTOBER", emphasisStyle: "accent", leadWeight: "regular", stacked: "no", size: 34, trailing: "none" }),
        nd("day-picker", { layout: "month", days: 31, offset: 3, selected: 22, today: 13, marked: "2, 6, 9, 14, 20, 27, 29", busy: "16, 18, 22", tint: "signal" }),
        col({ spacing: 2 }, [
          nd("text", { text: "THURSDAY OCT 22", style: "title3", weight: "bold", tracking: 1 }),
          caps("9 days from today"),
        ]),
        nd("event-line", { title: "Dentist", detail: "8:40 AM", tint: "azure" }),
        nd("event-line", { title: "Book club at Ines's", detail: "7:30 PM", tint: "blush" }),
        space(4),
        caps("Later in October"),
        nd("event-line", { title: "Half-term away", detail: "27–29 Oct · Coast cottage", tint: "ember" }),
        nd("event-line", { title: "Pay rent", detail: "30 Oct", tint: "azure" }),
        space(4),
        nd("glass-action-menu", { items: "Event, Reminder, Invite", triggerIcon: "plus", arrangement: "arc", alignment: "trailing" }),
      ],
    },
    {
      // A new event from the week's +: a short form on a sheet, where the place is an Address Field that
      // suggests as you type and settles into a checked address with its postcode.
      key: "new", name: "NewEventView", props: { title: "", padding: 20, spacing: 16, alignment: "leading", detent: "large" },
      children: [
        nd("screen-header", { eyebrow: "Week 43", title: "New", emphasis: "event", emphasisStyle: "muted", leadWeight: "bold", stacked: "no", size: 34, trailing: "icon", icon: "xmark", link: "back" }),
        nd("form-field", { label: "Title", prompt: "Dinner with Nadia", icon: "pencil", content: "none", limit: 40 }),
        caps("When"),
        card([
          nd("day-picker", { layout: "week", start: 19, selected: 24, today: 0, marked: "20, 22", tint: "signal" }),
          nd("divider"),
          row({ spacing: 8 }, [nd("text", { text: "7:30 → 9:30 PM", style: "headline" }), flex(), nd("text", { text: "2 hours", style: "subheadline", color: "secondary" })]),
        ]),
        caps("Where"),
        nd("address-field", { label: "Add a place", countries: "", region: "london", allowsUnverified: true, phase: "empty", query: "Orchard" }),
        nd("commit-button", { title: "Add event", successTitle: "Added", link: "back" }),
      ],
    },
  ],
});
