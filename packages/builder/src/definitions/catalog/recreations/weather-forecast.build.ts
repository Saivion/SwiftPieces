// The build for the weather-forecast remix: its screens, from registry components. See weather-forecast.ts.
// Shape lock: actions are pills, cards 24, chips 14. Each screen stands on a full-bleed ground whose
// colour is the weather (ember glow for a warm day, navy for rain, plum for night); cards on it are
// the theme's ink surface, and the temperature colours are the forecast's own cold-to-hot scale.
import type { CatalogBuilder } from "../../../core/catalog.js";
import type { ScreenNode } from "../../../core/schema.js";
import { app, caption, col, flex, footnote, nd, row } from "../kit.js";

/** A screen's ground: a strong colour field, full bleed, tall enough to be the whole screen. */
const ground = (fill: string, glow: string, children: ScreenNode[]): ScreenNode =>
  nd("tint-panel", { fill, fade: true, glow, radius: 0, minHeight: 820, padding: 16, spacing: 16, alignment: "leading" }, children);

/** A card on the ground: the theme's ink surface, radius 24. */
const panel = (children: ScreenNode[], extra: Record<string, string | number> = {}): ScreenNode =>
  nd("tint-panel", { fill: "ink", fade: false, glow: "none", radius: 24, minHeight: 0, padding: 16, spacing: 12, ...extra }, children);

/** A card's heading: the title on the leading edge, a quiet note on the trailing one. */
const head = (title: string, meta: string): ScreenNode =>
  row({ spacing: 8, alignment: "bottom" }, [nd("text", { text: title.toUpperCase(), style: "footnote", weight: "semibold", color: "secondary" }), flex(), footnote(meta)]);

/** The big reading: the temperature in a light weight, the sky and the day's range under it. */
const hero = (temp: string, sky: string, range: string): ScreenNode =>
  col({ spacing: 0 }, [
    nd("text-reveal", { text: temp, highlights: "", size: 88, alignment: "leading", unit: "characters", preset: "rise" }),
    nd("text", { text: sky, style: "title3", weight: "semibold" }),
    footnote(range),
  ]);

const EIGHT_DAYS =
  "Today | sun.max | 14 | 27 | | Sunny until 6 PM, UV 7 at 1 PM, light breeze from the west; " +
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
      key: "today", name: "TodayView", props: { title: "", alignment: "leading", spacing: 0, padding: 0, navigationBar: "hidden" },
      children: [
        ground("ember", "ember", [
          nd("screen-header", { eyebrow: "Now · Alfama, Lisbon", title: "", emphasis: "", stacked: "no", size: 17, trailing: "two", icon: "globe", link: l.sheet("places"), icon2: "calendar", link2: l.to("normals"), buttons: "glass" }),
          hero("24°", "Sunny and warm", "High 27°, low 14° · feels like 25°"),
          nd("stat-grid", { items: "Humidity | 41% | ; Wind | 12 km/h | ; UV | 7 |", style: "tiles", columns: 3, valueSize: 22, radius: 14, tiles: "ember, blush, azure" }),
          panel([
            head("Next 16 hours", "Drag to read"),
            nd("area-scrub", { values: "18, 20, 22, 24, 26, 27, 26, 25, 23, 21, 19, 18, 17, 16, 15, 14", startHour: 9, endHour: 24, hour: 13, unit: "°", note: "UV 7 · no rain", tint: "orange", height: 220 }),
          ]),
          panel([
            head("8-day forecast", "Tap a day"),
            nd("forecast-range", { days: EIGHT_DAYS, now: "24", unit: "°", scale: "celsius" }),
          ]),
          row({ spacing: 12 }, [
            nd("elastic-button", { title: "Rain on Saturday", icon: "drop", iconPosition: "leading", style: "raised", link: l.to("rain") }),
            nd("elastic-button", { title: "Tonight", icon: "moon", iconPosition: "leading", style: "raised", link: l.to("night") }),
          ]),
        ]),
      ],
    },
    {
      key: "rain", name: "RainView", props: { title: "Saturday", alignment: "leading", spacing: 0, padding: 0 },
      children: [
        ground("navy", "azure", [
          hero("17°", "Rain from 10 AM", "6 mm in all · 70% chance · wind 22 km/h"),
          panel([
            head("Rain by the hour", "mm"),
            nd("chart", { values: "0, 0, 0.4, 1.2, 1.8, 1.1, 0.8, 0.5, 0.2, 0", labels: "8, 9, 10, 11, 12, 1, 2, 3, 4, 5", tint: "cyan", height: 170, highlight: 4 }),
            footnote("Heaviest around noon. Dry again by 5 PM."),
          ]),
          panel([
            head("Chance of rain", "Drag to read"),
            nd("area-scrub", { values: "5, 10, 35, 70, 80, 75, 60, 45, 30, 15, 10, 5", startHour: 7, endHour: 18, hour: 12, unit: "%", note: "Showers", tint: "azure", height: 200 }),
          ]),
          nd("toast", { trigger: "Tell me before it starts", triggerStyle: "raised", fullWidth: true, message: "Rain alert on", detail: "We'll nudge you 15 minutes before the first drops", style: "info", icon: "bell", actionTitle: "Undo", position: "top", duration: 3 }),
        ]),
      ],
    },
    {
      key: "night", name: "TonightView", props: { title: "Tonight", alignment: "leading", spacing: 0, padding: 0 },
      children: [
        ground("plum", "blush", [
          hero("16°", "Clear and still", "Low 14° by 6 AM · moon 82% lit"),
          panel([
            head("After dark", "Tap to set a reminder"),
            nd("moment-list", { items: "Sunset | 7:04 PM | sunset; Last light | 7:31 PM | dusk; -; Moonrise | 9:48 PM | blue; -; First light | 6:58 AM | dawn; Sunrise | 7:24 AM | sunrise", warm: "blush", layout: "rail" }),
          ]),
          panel([
            head("Overnight", "°"),
            nd("area-scrub", { values: "21, 19, 18, 17, 16, 16, 15, 15, 14, 14, 15", startHour: 20, endHour: 30, hour: 23, unit: "°", note: "Clear", tint: "violet", height: 180 }),
          ]),
        ]),
      ],
    },
    {
      key: "places", name: "PlacesView", props: { title: "", alignment: "leading", spacing: 16, padding: 16, detent: "large" },
      children: [
        nd("screen-header", { eyebrow: "3 places · 1 trip", title: "Places", emphasis: "and trips", emphasisStyle: "muted", stacked: "no", leadWeight: "bold", size: 34, trailing: "icon", icon: "xmark", link: "back" }),
        nd("search-field", { placeholder: "Add a city or an airport", showsCancel: false }),
        nd("color-block-list", { items: "Lisbon: 24° Sunny, Copenhagen: 11° Showers, Montréal: 7° Cloudy, Kyoto: 19° Clear", colors: "sand, sky, lilac, sage", eyebrows: "Here now, 3 h behind, 5 h ahead, 8 h ahead", header: "", layout: "list", height: 72, gap: 8, radius: 16, swipeActions: true, link: l.to("trip") }),
        row({ spacing: 8, alignment: "bottom" }, [nd("text", { text: "Upcoming trips", style: "title3", weight: "semibold" }), flex(), footnote("1")]),
        nd("countdown-card", { art: "ocean", eyebrow: "Trip · 22–26 Oct", title: "Copenhagen", detail: "Cool with showers · pack a coat", days: 7, height: 170, radius: 24, link: l.to("trip") }),
        row({ spacing: 12 }, [
          nd("elastic-button", { title: "Add a trip", icon: "airplane", iconPosition: "leading", style: "raised", link: l.to("trip") }),
          nd("elastic-button", { title: "Widgets", icon: "square.grid.2x2", iconPosition: "leading", style: "raised", link: l.to("widgets") }),
        ]),
      ],
    },
    {
      key: "trip", name: "TripView", props: { title: "Copenhagen", alignment: "leading", spacing: 0, padding: 0 },
      children: [
        ground("teal", "azure", [
          hero("11°", "Showers on and off", "Your trip · Wed 22 to Sun 26 October"),
          panel([
            head("Trip forecast", "5 days"),
            nd("forecast-range", { days: "Wed | cloud.rain | 7 | 12 | 60% | Showers until mid-afternoon; Thu | cloud | 6 | 11 | 20% | Grey and breezy; Fri | cloud.sun | 5 | 12 | | Brighter, cold start; Sat | cloud.rain | 6 | 10 | 80% | Rain most of the day, 9 mm; Sun | sun.max | 4 | 11 | | Clear and crisp", now: "", showsNow: false, unit: "°", scale: "celsius" }),
          ]),
          panel([
            head("Pack for it", ""),
            nd("icon-toggles", { labels: "umbrella, coat, scarf, sunglasses", icons: "drop, snowflake, wind, sun.max", selected: "0, 1", palette: "azure", size: 46 }),
          ]),
        ]),
      ],
    },
    {
      key: "normals", name: "NormalsView", props: { title: "October", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        nd("screen-header", { eyebrow: "Lisbon · this month against normal", title: "Warmer", emphasis: "than usual", emphasisStyle: "muted", stacked: "no", leadWeight: "bold", size: 34, trailing: "none" }),
        col({ style: "card", padding: 16, radius: 24, spacing: 12 }, [
          head("Daily highs", "°C"),
          nd("compare-line", { current: "26, 25, 27, 24, 23, 25, 26, 27, 28, 26, 24, 23, 25, 26, 27", reference: "24, 24, 24, 23, 23, 23, 23, 23, 22, 22, 22, 22, 22, 21, 21", names: "This October, Normal", labels: "1, , , , , , , 8, , , , , , , 15", marks: "20, 25", tint: "orange", referenceTint: "gray", legend: true, fromZero: false, height: 200 }),
        ]),
        nd("stat-grid", { items: "Average high | 25.5° | +2.4° on normal; Rain so far | 12 mm | 41 mm is normal; Sunny days | 11 | of 15; Warmest | 28° | the 9th", style: "cards", columns: 2, valueSize: 24, radius: 24, noteIcon: "info.circle" }),
        caption("Normals are the 30-year averages for this place and month."),
      ],
    },
    {
      key: "widgets", name: "WidgetsView", props: { title: "Widgets", alignment: "leading", spacing: 16, padding: 16 },
      children: [
        row({ spacing: 12 }, [
          panel([caption("LISBON"), nd("text", { text: "24°", style: "largeTitle", weight: "regular", design: "rounded" }), footnote("Sunny · 27° / 14°")], { padding: 14, spacing: 2 }),
          panel([caption("SATURDAY"), nd("text", { text: "70%", style: "largeTitle", weight: "regular", design: "rounded" }), footnote("Rain from 10 AM")], { padding: 14, spacing: 2 }),
        ]),
        panel([head("Lisbon", "4 days"), nd("forecast-range", { days: "Today | sun.max | 14 | 27 | | ; Fri | cloud.sun | 15 | 25 | 10% | ; Sat | cloud.rain | 13 | 19 | 70% | ; Sun | cloud | 12 | 18 | 20% | ", now: "24", unit: "°" })]),
        footnote("Press and hold the Home Screen, tap +, then search for Isobar."),
      ],
    },
  ],
});
