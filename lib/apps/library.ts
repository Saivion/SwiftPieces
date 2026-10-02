// The app library: which App Store apps it covers and the Swift Pieces pattern paired with each.
// Hand-kept and reviewed. The App Store facts for each app (name, developer, icon, screenshots,
// rating) come from Apple's public lookup API, saved by scripts/fetch-app-store.mts into
// app-store.json and committed after review. Removing an app is deleting its line here.
//
// Rules (owner, 2026-09-27): niche and mid-tier apps only, never household names. The App Store
// material is always labeled as the developer's; the recreation is always labeled as ours and is
// never presented as the app's UI. Nothing third-party sits behind Pro.

export type LibraryApp = {
  /** URL segment: /apps/<slug>. */
  slug: string;
  trackId: number;
  /** The pattern recreation, as a catalog key ("screens/breathing-session"). */
  pattern: string;
  /** The app's short name, when the App Store name's tagline isn't split off by punctuation. */
  name?: string;
  /**
   * App Store screenshots we recreated, by position in the App Store's order: which step of the
   * pattern answers it, and in a few words what it shows. Marketing art (awards, reviews) is left
   * out. On the app page each one opens our running version beside it.
   */
  screens?: Array<{ shot: number; step: number; title: string }>;
};

export const LIBRARY: LibraryApp[] = [
  {
    slug: "gentler-streak", trackId: 1576857102, pattern: "flows/gentle-activity", name: "Gentler Streak",
    screens: [
      { shot: 0, step: 0, title: "Today against your range" },
      { shot: 4, step: 1, title: "Steps so far" },
      { shot: 1, step: 2, title: "Recovery signals" },
      { shot: 2, step: 3, title: "Last night's sleep" },
      { shot: 6, step: 4, title: "The month in review" },
    ],
  },
  {
    slug: "how-we-feel", trackId: 1562706384, pattern: "flows/feelings-journal",
    screens: [
      { shot: 0, step: 0, title: "Picking a feeling" },
      { shot: 1, step: 1, title: "Your log" },
      { shot: 2, step: 2, title: "The month, day by day" },
      { shot: 3, step: 3, title: "A toolkit" },
      { shot: 4, step: 4, title: "Your circle" },
    ],
  },
  {
    slug: "stoic", trackId: 1312926037, pattern: "flows/daily-journal", name: "Stoic",
    screens: [
      { shot: 1, step: 0, title: "The morning" },
      { shot: 2, step: 1, title: "Winding down" },
      { shot: 3, step: 2, title: "A writing prompt" },
      { shot: 4, step: 3, title: "A check-in and a trend" },
      { shot: 5, step: 4, title: "A breathing guide" },
      { shot: 7, step: 5, title: "Guided paths" },
    ],
  },
  {
    slug: "tiimo", trackId: 1480220328, pattern: "flows/visual-planner",
    screens: [
      { shot: 2, step: 0, title: "The day, by part" },
      { shot: 0, step: 0, title: "Today's plan" },
      { shot: 4, step: 2, title: "Planning with help" },
      { shot: 1, step: 2, title: "A brain dump, turned into tasks" },
      { shot: 5, step: 1, title: "A focus timer" },
    ],
  },
  {
    slug: "lungy", trackId: 1545223887, pattern: "flows/breathe-app",
    screens: [
      { shot: 6, step: 0, title: "An exercise, before you begin" },
      { shot: 1, step: 1, title: "The coach, mid-session" },
      { shot: 2, step: 2, title: "A scene you turn as you breathe" },
      { shot: 3, step: 3, title: "A scene that moves with the breath" },
      { shot: 7, step: 4, title: "Breathing out to fill a line" },
      { shot: 5, step: 5, title: "The summary, pace and pulse" },
    ],
  },
  {
    slug: "timepage", trackId: 989178902, pattern: "flows/calendar-planner",
    screens: [
      { shot: 0, step: 0, title: "The week, day by day" },
      { shot: 1, step: 1, title: "An event and where it is" },
      { shot: 2, step: 2, title: "A day at a glance" },
      { shot: 4, step: 3, title: "The day's forecast" },
      { shot: 3, step: 4, title: "A day's hours" },
      { shot: 7, step: 5, title: "The month" },
    ],
  },
  {
    slug: "storygraph", trackId: 1570489264, pattern: "flows/reading-tracker", name: "StoryGraph",
    screens: [
      { shot: 0, step: 0, title: "Your shelves" },
      { shot: 3, step: 1, title: "Picks for you" },
      { shot: 1, step: 2, title: "The year by mood" },
      { shot: 4, step: 3, title: "A daily reading goal" },
      { shot: 5, step: 4, title: "What friends are reading" },
      { shot: 7, step: 5, title: "Yearly challenges" },
    ],
  },
  {
    slug: "mela", trackId: 1548466041, pattern: "flows/recipe-cook",
    screens: [
      { shot: 1, step: 0, title: "Your recipes" },
      { shot: 0, step: 1, title: "A recipe" },
      { shot: 2, step: 2, title: "Cooking mode" },
      { shot: 5, step: 3, title: "Scale and convert" },
      { shot: 3, step: 4, title: "The week's meals" },
      { shot: 4, step: 5, title: "The shopping list" },
    ],
  },
  {
    slug: "sunlitt", trackId: 1628751457, pattern: "flows/sun-events",
    screens: [
      { shot: 4, step: 0, title: "Where the sun is now" },
      { shot: 2, step: 2, title: "Shadows across a city" },
      { shot: 5, step: 3, title: "A hill's shadow" },
      { shot: 1, step: 4, title: "The sun's path across the sky" },
      { shot: 3, step: 5, title: "The day's light, moment by moment" },
    ],
  },
  {
    slug: "daylio", trackId: 1194023242, pattern: "flows/mood-diary", name: "Daylio",
    screens: [
      { shot: 1, step: 0, title: "Logging the day" },
      { shot: 2, step: 1, title: "What filled the day" },
      { shot: 7, step: 2, title: "A guided note" },
      { shot: 3, step: 3, title: "Your entries" },
      { shot: 4, step: 4, title: "The month in review" },
      { shot: 5, step: 5, title: "The year, a dot a day" },
    ],
  },
  {
    slug: "flighty", trackId: 1358823008, pattern: "flows/flight-tracker",
    screens: [
      { shot: 1, step: 0, title: "Upcoming flights" },
      { shot: 7, step: 1, title: "A flight, end to end" },
      { shot: 3, step: 2, title: "The inbound plane" },
      { shot: 5, step: 3, title: "Friends in the air" },
    ],
  },
  {
    slug: "pocket-casts", trackId: 414834813, pattern: "flows/podcast-player", name: "Pocket Casts",
    screens: [
      { shot: 2, step: 0, title: "Your library" },
      { shot: 1, step: 1, title: "The player" },
      { shot: 3, step: 2, title: "Speed and sound" },
      { shot: 5, step: 3, title: "A playlist" },
      { shot: 4, step: 4, title: "The queue" },
    ],
  },
  {
    slug: "pennies", trackId: 916741290, pattern: "flows/budget-envelopes",
    screens: [
      { shot: 1, step: 0, title: "Your budgets" },
      { shot: 3, step: 1, title: "Left this month" },
      { shot: 2, step: 2, title: "Adding an expense" },
      { shot: 4, step: 3, title: "Spending history" },
      { shot: 5, step: 4, title: "Choosing how it resets" },
      { shot: 7, step: 5, title: "Moving money between budgets" },
    ],
  },
  {
    slug: "planta", trackId: 1410126781, pattern: "flows/plant-care",
    screens: [
      { shot: 7, step: 0, title: "Plants by room" },
      { shot: 1, step: 1, title: "A plant and today's care" },
      { shot: 2, step: 2, title: "Identifying a plant" },
      { shot: 3, step: 3, title: "A plant check-up" },
      { shot: 4, step: 4, title: "Measuring the light" },
      { shot: 5, step: 5, title: "The community" },
    ],
  },
  {
    slug: "vocabulary", trackId: 1084540807, pattern: "flows/word-practice",
    screens: [
      { shot: 0, step: 0, title: "The word of the day" },
      { shot: 3, step: 1, title: "Practice" },
      { shot: 4, step: 2, title: "Choosing a topic" },
      { shot: 6, step: 4, title: "Adding your own word" },
      { shot: 7, step: 5, title: "A daily streak" },
    ],
  },
  {
    slug: "habitify", trackId: 1111447047, pattern: "flows/habit-journal",
    screens: [
      { shot: 1, step: 0, title: "Today's habits" },
      { shot: 3, step: 1, title: "Four weeks of consistency" },
      { shot: 6, step: 2, title: "Synced readings" },
      { shot: 2, step: 3, title: "One habit's history" },
    ],
  },
  {
    slug: "tricount", trackId: 349866256, pattern: "flows/split-bills", name: "tricount",
    screens: [
      { shot: 2, step: 0, title: "A group's expenses" },
      { shot: 4, step: 1, title: "Who owes whom" },
      { shot: 0, step: 1, title: "Balances at a glance" },
      { shot: 7, step: 2, title: "The group's photos" },
      { shot: 6, step: 3, title: "Adding while offline" },
      { shot: 3, step: 4, title: "Splitting an expense" },
      { shot: 5, step: 5, title: "Picking a currency" },
    ],
  },
  {
    slug: "waterllama", trackId: 1454778585, pattern: "flows/water-streak", name: "Waterllama",
    screens: [
      { shot: 2, step: 0, title: "Today's drinks" },
      { shot: 3, step: 1, title: "Home screen widgets" },
      { shot: 7, step: 2, title: "The streak calendar" },
      { shot: 4, step: 3, title: "Challenges" },
      { shot: 5, step: 4, title: "The day, goal met" },
      { shot: 6, step: 5, title: "Sharing your day" },
    ],
  },
  {
    slug: "tripsy", trackId: 1429967544, pattern: "flows/trip-organizer",
    screens: [
      { shot: 2, step: 0, title: "A trip at a glance" },
      { shot: 1, step: 0, title: "The trip, with the next flight" },
      { shot: 4, step: 1, title: "A flight's details" },
      { shot: 5, step: 2, title: "Flight alerts" },
      { shot: 3, step: 3, title: "Saved places near the stay" },
      { shot: 7, step: 4, title: "Places friends added" },
      { shot: 6, step: 6, title: "Trip spending" },
    ],
  },
  {
    slug: "sofa", trackId: 1276554886, pattern: "flows/downtime-lists",
    screens: [
      { shot: 0, step: 0, title: "Your collections" },
      { shot: 1, step: 1, title: "What's underway" },
      { shot: 2, step: 2, title: "Search and popular picks" },
      { shot: 4, step: 4, title: "A listening queue" },
      { shot: 3, step: 5, title: "Coming up" },
      { shot: 6, step: 6, title: "Your year so far" },
    ],
  },
];
