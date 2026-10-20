// The build for the weather-forecast remix: its screens, from registry components. See weather-forecast.ts.
// A calm forecast on the theme's own ground, light and dark: no colour fields, no glows. One system
// on every screen:
// - Type: screen titles 34 bold (a screen-header on the two roots, the navigation large title on
//   pushed screens); one figure per screen in the reading, bold; section heads and the sky's words
//   title3 semibold; rows body; everything secondary footnote in the system secondary colour.
// - Shape lock: cards 24 (one card style, a head on each), actions are pills, nothing else rounds.
// - Colour: signal red only for the primary action and what's on; the forecast's own colours only
//   where they carry data (temperature from cold blue to hot red, rain in sky blue).
// - Rhythm: screen padding 16, 16 between sections, 16 inside a card, 12 between its parts.
import type { CatalogBuilder } from "../../../core/catalog.js";
import type { ScreenNode } from "../../../core/schema.js";
import { app, col, flex, footnote, nd, row } from "../kit.js";

/** The one card: the theme's surface, radius 24, its head first. */
const card = (children: ScreenNode[]): ScreenNode => nd("vstack", { style: "card", padding: 16, radius: 24, spacing: 12 }, children);

/** A card's head: the title on the leading edge, a quiet note on the trailing one. */
const head = (title: string, meta: string): ScreenNode =>
  row({ spacing: 8, alignment: "bottom" }, [nd("text", { text: title, style: "title3", weight: "semibold" }), flex(), footnote(meta)]);

/** The reading every forecast screen opens on: the figure, the sky in words, the numbers that qualify it. */
const reading = (figure: string, sky: string, detail: string): ScreenNode =>
  col({ spacing: 4 }, [
    nd("text-reveal", { text: figure, highlights: "", size: 72, alignment: "leading", unit: "characters", preset: "rise" }),
    nd("text", { text: sky, style: "title3", weight: "semibold" }),
    footnote(detail),
  ]);

/** A list row in a card: what on the leading edge, its reading on the trailing one. */
const line = (title: string, value: string, link?: string): ScreenNode =>
  nd("row", { icon: "none", title, value, accessory: link ? "chevron" : "none", ...(link ? { link } : {}) });

/** Rows in a card, split by hairlines. */
const rows = (lines: ScreenNode[]): ScreenNode[] => lines.flatMap((r, i) => (i ? [nd("divider"), r] : [r]));

const PUSHED = { alignment: "leading", spacing: 16, padding: 16 } as const;

const EIGHT_DAYS =
  "Today | sun.max | 14 | 27 | | Sunny until 6 PM, UV 7 at 1 PM, a light westerly; " +
  "Fri | cloud.sun | 15 | 25 | 10% | Clouds roll in after lunch, sunset 7:02 PM; " +
  "Sat | cloud.rain | 13 | 19 | 70% | Showers from 10 AM, 6 mm in all, wind 22 km/h; " +
  "Sun | cloud | 12 | 18 | 20% | Grey and still, a dry afternoon; " +
  "Mon | sun.max | 11 | 21 | | Bright and cool, the best day for a walk; " +
  "Tue | cloud.sun | 13 | 23 | | Warming up again; " +
  "Wed | sun.max | 15 | 26 | | Sunny and warm; " +
  "Thu | cloud.bolt | 16 | 22 | 40% | Storms possible late in the day";

export const build: CatalogBuilder = app({
  name: "Isobar",
  look: "pieces",
  screens: (l) => [
    {
      // Today: where you are, the reading, the next hours you drag through, the week on one scale.
      key: "today", name: "TodayView", props: { title: "", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        nd("screen-header", { eyebrow: "Thursday 15 October · Now", title: "Lisbon", emphasis: "Alfama", emphasisStyle: "muted", stacked: "no", leadWeight: "bold", size: 34, trailing: "two", icon: "list.bullet", link: l.sheet("places"), icon2: "calendar", link2: l.to("normals"), buttons: "fill" }),
        reading("24°", "Sunny and warm", "High 27° · Low 14° · Feels like 25°"),
        nd("stat-grid", { items: "Humidity | 41% | ; Wind | 12 km/h | ; UV index | 7 | ", style: "plain", columns: 3, valueSize: 22 }),
        card([
          head("Next 16 hours", "Drag to read"),
          nd("area-scrub", { values: "18, 20, 22, 24, 26, 27, 26, 25, 23, 21, 19, 18, 17, 16, 15, 14", startHour: 9, endHour: 24, hour: 18, unit: "°", note: "", tint: "ember", height: 220 }),
        ]),
        card([
          head("8 days", "Tap a day"),
          nd("forecast-range", { days: EIGHT_DAYS, now: "24", unit: "°", scale: "celsius" }),
        ]),
        card([
          head("Coming up", "This week"),
          ...rows([line("Saturday", "Rain from 10 AM", l.to("rain")), line("Tonight", "Clear, 14° by dawn", l.to("night"))]),
        ]),
      ],
    },
    {
      // Saturday: rain gets its own units, millimetres by the hour and the chance as a curve.
      key: "rain", name: "RainView", props: { title: "Saturday", ...PUSHED },
      children: [
        reading("17°", "Rain from 10 AM", "6 mm in all · 70% chance · Wind 22 km/h"),
        card([
          head("Rain by the hour", "mm"),
          nd("chart", { values: "0, 0, 0.4, 1.2, 1.8, 1.1, 0.8, 0.5, 0.2, 0", labels: "8, 9, 10, 11, 12, 1, 2, 3, 4, 5", tint: "cyan", height: 160, highlight: 4 }),
          footnote("Heaviest around noon, dry again by 5 PM."),
        ]),
        card([
          head("Chance of rain", "Drag to read"),
          nd("area-scrub", { values: "5, 10, 35, 70, 80, 75, 60, 45, 35, 30", startHour: 7, endHour: 16, hour: 14, unit: "%", note: "", tint: "sky", height: 200 }),
        ]),
        nd("toast", { trigger: "Alert me before it rains", triggerStyle: "prominent", fullWidth: true, message: "Rain alert on", detail: "A nudge 15 minutes before the first drops", style: "info", icon: "bell", actionTitle: "Undo", position: "top", duration: 3 }),
      ],
    },
    {
      // Tonight: only what matters after dark, and how cold it gets.
      key: "night", name: "TonightView", props: { title: "Tonight", ...PUSHED },
      children: [
        reading("16°", "Clear and still", "Low 14° by 6 AM · Moon 82% lit"),
        card([
          head("After dark", "Tap for a reminder"),
          nd("moment-list", { items: "Sunset | 7:04 PM | sunset; Last light | 7:31 PM | blue; -; Moonrise | 9:48 PM | dusk; -; First light | 6:58 AM | dawn; Sunrise | 7:24 AM | sunrise", warm: "signal", layout: "rail" }),
        ]),
        card([
          head("Overnight", "°C"),
          nd("compare-line", { current: "21, 19, 18, 17, 16, 16, 15, 15, 14, 14, 15", reference: "22, 21, 20, 19, 18, 18, 17, 17, 16, 16, 16", names: "Tonight, Last night", labels: "8 PM, , , 11, , , 2 AM, , , 5, ", marks: "15, 20", tint: "ember", referenceTint: "gray", legend: true, fromZero: false, height: 160 }),
        ]),
      ],
    },
    {
      // Places: a sheet with the saved places as a plain list and the trip under them.
      key: "places", name: "PlacesView", props: { title: "", alignment: "leading", spacing: 16, padding: 16, detent: "large" },
      children: [
        nd("screen-header", { eyebrow: "4 places · 1 trip", title: "Places", emphasis: "and trips", emphasisStyle: "muted", stacked: "no", leadWeight: "bold", size: 34, trailing: "two", icon: "square.grid.2x2", link: l.to("widgets"), icon2: "xmark", link2: "back", buttons: "fill" }),
        nd("search-field", { placeholder: "Add a city or an airport", showsCancel: false }),
        card([
          head("Saved", "4 places"),
          ...rows([line("Lisbon", "Sunny · 24°"), line("Copenhagen", "Showers · 11°"), line("Montréal", "Cloudy · 7°"), line("Kyoto", "Clear · 19°")]),
        ]),
        card([
          head("Trips", "In 7 days"),
          line("Copenhagen", "22–26 Oct", l.to("trip")),
        ]),
      ],
    },
    {
      // A trip: the forecast for exactly its days, and what to pack for them.
      key: "trip", name: "TripView", props: { title: "Copenhagen", ...PUSHED },
      children: [
        reading("11°", "Showers on and off", "Average high · Wed 22 to Sun 26 October"),
        card([
          head("Trip forecast", "5 days"),
          nd("forecast-range", { days: "Wed | cloud.rain | 7 | 12 | 60% | Showers until mid-afternoon; Thu | cloud | 6 | 11 | 20% | Grey and breezy; Fri | cloud.sun | 5 | 12 | | Brighter, a cold start; Sat | cloud.rain | 6 | 10 | 80% | Rain most of the day, 9 mm; Sun | sun.max | 4 | 11 | | Clear and crisp", now: "", showsNow: false, unit: "°", scale: "celsius" }),
        ]),
        card([
          head("Pack for it", "Tap to pack"),
          nd("icon-toggles", { labels: "Umbrella, Warm coat, Scarf, Sunglasses", icons: "umbrella, snowflake, wind, sun.max", selected: "0, 1", palette: "tint", tint: "accent", size: 52 }),
        ]),
      ],
    },
    {
      // The month against normal: the gap is the story, so it's the figure.
      key: "normals", name: "NormalsView", props: { title: "October", ...PUSHED },
      children: [
        reading("+2.4°", "Warmer than usual", "Lisbon · Daily highs against the 30-year normal"),
        card([
          head("Daily highs", "°C"),
          nd("compare-line", { current: "26, 25, 27, 24, 23, 25, 26, 27, 28, 26, 24, 23, 25, 26, 27", reference: "24, 24, 24, 23, 23, 23, 23, 23, 22, 22, 22, 22, 22, 21, 21", names: "This October, Normal", labels: "1, , , , , , , 8, , , , , , , 15", marks: "20, 25", tint: "ember", referenceTint: "gray", legend: true, fromZero: false, height: 200 }),
        ]),
        card([
          head("So far", "1–15 October"),
          nd("stat-grid", { items: "Average high | 25.5° | 23.1° is normal; Rain | 12 mm | 41 mm is normal; Sunny days | 11 | of 15; Warmest | 28° | on the 9th", style: "plain", columns: 2, valueSize: 22, noteIcon: "info.circle", noteTint: "gray" }),
        ]),
      ],
    },
    {
      // Widgets: the app's own readings, small, as they sit on the Home Screen.
      key: "widgets", name: "WidgetsView", props: { title: "Widgets", ...PUSHED },
      children: [
        row({ spacing: 16 }, [
          card([footnote("Lisbon", { weight: "semibold" }), nd("text", { text: "24°", style: "title", weight: "bold" }), footnote("Sunny · H 27° L 14°")]),
          card([footnote("Saturday", { weight: "semibold" }), nd("text", { text: "70%", style: "title", weight: "bold" }), footnote("Rain from 10 AM")]),
        ]),
        card([
          head("Lisbon", "4 days"),
          nd("forecast-range", { days: "Today | sun.max | 14 | 27 | | ; Fri | cloud.sun | 15 | 25 | 10% | ; Sat | cloud.rain | 13 | 19 | 70% | ; Sun | cloud | 12 | 18 | 20% | ", now: "24", unit: "°", scale: "celsius" }),
        ]),
        nd("toast", { trigger: "Add a widget", triggerStyle: "prominent", fullWidth: true, message: "Press and hold your Home Screen", detail: "Tap +, then search for Isobar", style: "info", icon: "square.grid.2x2", actionTitle: "", position: "top", duration: 4 }),
      ],
    },
  ],
});
