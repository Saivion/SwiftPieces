// The app library: which App Store apps it covers and the SwiftPieces pattern paired with each.
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
  {
    slug: "hevy", trackId: 1458862350, pattern: "flows/workout-log", name: "Hevy",
    screens: [
      { shot: 3, step: 0, title: "Routines to start" },
      { shot: 1, step: 1, title: "Logging sets" },
      { shot: 4, step: 3, title: "Friends' workouts" },
      { shot: 7, step: 4, title: "Profile and weekly hours" },
      { shot: 2, step: 5, title: "An exercise's progress" },
    ],
  },
  {
    slug: "mercury-weather", trackId: 1621800675, pattern: "flows/weather-forecast", name: "Mercury Weather",
    screens: [
      { shot: 1, step: 0, title: "A sunny day" },
      { shot: 0, step: 1, title: "Rain on the way" },
      { shot: 2, step: 5, title: "The days at a glance" },
      { shot: 5, step: 4, title: "A trip's forecast" },
      { shot: 7, step: 6, title: "Widgets" },
    ],
  },
  {
    slug: "zero", trackId: 1168348542, pattern: "flows/fasting-timer",
    screens: [
      { shot: 1, step: 0, title: "The fasting ring" },
      { shot: 2, step: 5, title: "Snapping a meal" },
      { shot: 4, step: 4, title: "A protein score" },
      { shot: 5, step: 4, title: "Water for the day" },
      { shot: 7, step: 6, title: "Challenges" },
    ],
  },
  {
    slug: "rise", trackId: 1453884781, pattern: "flows/sleep-energy",
    screens: [
      { shot: 1, step: 0, title: "Sleep debt" },
      { shot: 2, step: 1, title: "The energy curve" },
      { shot: 4, step: 2, title: "Habits timed to energy" },
      { shot: 5, step: 3, title: "The calendar by energy" },
      { shot: 3, step: 5, title: "Wind-down tools" },
    ],
  },
  {
    slug: "huckleberry", trackId: 1169136078, pattern: "flows/baby-tracker",
    screens: [
      { shot: 0, step: 0, title: "Tracker cards and the next nap" },
      { shot: 5, step: 1, title: "Nursing, left and right" },
      { shot: 7, step: 2, title: "Logging a diaper" },
      { shot: 1, step: 3, title: "The week's sleep" },
      { shot: 3, step: 4, title: "Sleep trends" },
      { shot: 4, step: 5, title: "Asking the assistant" },
    ],
  },
  {
    slug: "i-am-sober", trackId: 672904239, pattern: "flows/sobriety-counter",
    screens: [
      { shot: 1, step: 0, title: "The sober counter" },
      { shot: 4, step: 3, title: "Pledge, review and a challenge" },
      { shot: 3, step: 4, title: "The daily pledge" },
      { shot: 5, step: 6, title: "The group's pledges" },
      { shot: 6, step: 6, title: "A milestone post" },
    ],
  },
  {
    slug: "endel", trackId: 1346247457, pattern: "flows/focus-soundscapes",
    screens: [
      { shot: 2, step: 0, title: "A soundscape playing" },
      { shot: 0, step: 0, title: "Quiet controls under the scene" },
      { shot: 5, step: 1, title: "Your guide through the day" },
      { shot: 7, step: 5, title: "Relax" },
      { shot: 4, step: 6, title: "Sleep" },
    ],
  },
  {
    slug: "session", trackId: 1521432881, pattern: "flows/focus-timer", name: "Session",
    screens: [
      { shot: 0, step: 0, title: "The dial and an intention" },
      { shot: 1, step: 1, title: "Picking a category" },
      { shot: 3, step: 3, title: "Reflecting on a session" },
      { shot: 5, step: 4, title: "The weekly report" },
    ],
  },
  {
    slug: "opal", trackId: 1497465230, pattern: "flows/screen-time",
    screens: [
      { shot: 0, step: 0, title: "Less screen time than usual" },
      { shot: 5, step: 0, title: "A score in three gauges" },
      { shot: 3, step: 1, title: "Late-night insights" },
      { shot: 2, step: 2, title: "Blocked apps and rules" },
      { shot: 4, step: 4, title: "A one-tap focus timer" },
      { shot: 1, step: 6, title: "The block screen" },
    ],
  },
  {
    slug: "things", trackId: 904237743, pattern: "flows/task-manager",
    screens: [
      { shot: 0, step: 0, title: "Lists, areas and projects" },
      { shot: 1, step: 1, title: "Today and This Evening" },
      { shot: 2, step: 2, title: "Upcoming, day by day" },
      { shot: 3, step: 3, title: "A new to-do with a checklist" },
      { shot: 4, step: 4, title: "A project in headings" },
    ],
  },
  {
    slug: "letterboxd", trackId: 1054271011, pattern: "flows/film-diary",
    screens: [
      { shot: 0, step: 1, title: "A film and its ratings" },
      { shot: 1, step: 2, title: "Watched, like, rate" },
      { shot: 2, step: 3, title: "The diary by month" },
      { shot: 3, step: 4, title: "A review" },
      { shot: 4, step: 6, title: "A numbered list" },
    ],
  },
  {
    slug: "vivino", trackId: 414461255, pattern: "flows/wine-ratings",
    screens: [
      { shot: 1, step: 1, title: "Scanning a label" },
      { shot: 3, step: 2, title: "A wine and your match" },
      { shot: 5, step: 4, title: "Food pairings" },
      { shot: 2, step: 5, title: "Your taste by style" },
      { shot: 6, step: 0, title: "Best offers for you" },
    ],
  },
  {
    slug: "stats-fm", trackId: 1526912392, pattern: "flows/listening-stats", name: "stats.fm",
    screens: [
      { shot: 0, step: 0, title: "Now playing and top artists" },
      { shot: 6, step: 1, title: "Top tracks and their moves" },
      { shot: 4, step: 2, title: "An artist's numbers" },
      { shot: 5, step: 3, title: "The year against last year" },
      { shot: 1, step: 4, title: "History by day" },
      { shot: 3, step: 6, title: "A friend's audio features" },
    ],
  },
  {
    slug: "partiful", trackId: 1662982304, pattern: "flows/party-invites",
    screens: [
      { shot: 0, step: 1, title: "The event page and RSVP" },
      { shot: 5, step: 2, title: "Blasts and reactions" },
      { shot: 1, step: 3, title: "Picking a flyer" },
      { shot: 2, step: 4, title: "Sharing the link" },
      { shot: 6, step: 5, title: "Tickets and payouts" },
      { shot: 4, step: 6, title: "Trending near you" },
    ],
  },
  {
    slug: "slopes", trackId: 643351983, pattern: "flows/ski-tracker",
    screens: [
      { shot: 1, step: 0, title: "Recording on the trail map" },
      { shot: 2, step: 1, title: "Nearby friends" },
      { shot: 3, step: 2, title: "The day summed up" },
      { shot: 6, step: 3, title: "Replaying a run" },
      { shot: 7, step: 4, title: "One run's profile" },
      { shot: 4, step: 6, title: "The season against its goal" },
    ],
  },
  {
    slug: "runna", trackId: 1594204443, pattern: "flows/running-plan",
    screens: [
      { shot: 0, step: 0, title: "The plan and this week" },
      { shot: 1, step: 2, title: "Live coaching" },
      { shot: 5, step: 3, title: "A recorded run" },
      { shot: 4, step: 4, title: "Your activities" },
      { shot: 2, step: 5, title: "Plans for any goal" },
      { shot: 3, step: 6, title: "Your plan is ready" },
    ],
  },
  {
    slug: "merlin", trackId: 773457673, pattern: "flows/bird-id", name: "Merlin Bird ID",
    screens: [
      { shot: 2, step: 1, title: "Sound ID listening" },
      { shot: 7, step: 2, title: "A species and its range" },
      { shot: 5, step: 3, title: "Step-by-step questions" },
      { shot: 6, step: 4, title: "Framing a photo" },
      { shot: 3, step: 5, title: "Birds likely near you" },
    ],
  },
  {
    slug: "sky-guide", trackId: 576588894, pattern: "flows/stargazing",
    screens: [
      { shot: 7, step: 0, title: "Tonight and the visible planets" },
      { shot: 4, step: 2, title: "A planet up close" },
      { shot: 3, step: 3, title: "A space station pass" },
      { shot: 6, step: 4, title: "Events to plan for" },
      { shot: 5, step: 6, title: "Astronomy news" },
    ],
  },
  {
    slug: "finch", trackId: 1528595748, pattern: "flows/self-care-pet",
    screens: [
      { shot: 3, step: 2, title: "Off on an adventure" },
      { shot: 1, step: 3, title: "Goals with a buddy" },
      { shot: 4, step: 3, title: "Encouraging a buddy" },
      { shot: 2, step: 3, title: "Sending good vibes" },
      { shot: 5, step: 4, title: "Self-care progress" },
      { shot: 6, step: 5, title: "A month's streak" },
    ],
  },
  {
    slug: "parcel", trackId: 375589283, pattern: "flows/package-tracker",
    screens: [
      { shot: 0, step: 0, title: "Deliveries by days to go" },
      { shot: 1, step: 1, title: "A delivery's history and route" },
      { shot: 4, step: 2, title: "The route, day by day" },
      { shot: 3, step: 3, title: "Adding a tracking number" },
      { shot: 2, step: 4, title: "Widgets" },
    ],
  },
  {
    slug: "bear", trackId: 1016366447, pattern: "flows/markdown-notes",
    screens: [
      { shot: 1, step: 0, title: "Tags in the sidebar" },
      { shot: 0, step: 2, title: "A note with a table and a link" },
      { shot: 4, step: 3, title: "Statistics and outline" },
      { shot: 6, step: 4, title: "Search with matches lit up" },
      { shot: 3, step: 5, title: "Themes" },
      { shot: 7, step: 6, title: "Locked notes" },
    ],
  },
  {
    slug: "paku", trackId: 1534130193, pattern: "flows/air-quality",
    screens: [
      { shot: 6, step: 0, title: "The map of sensors" },
      { shot: 4, step: 0, title: "Switching what the map shows" },
      { shot: 0, step: 1, title: "A sensor's last 24 hours" },
      { shot: 5, step: 4, title: "Alert settings" },
      { shot: 1, step: 5, title: "Lock Screen and Live Activity" },
      { shot: 3, step: 5, title: "Home Screen widgets" },
    ],
  },
];
