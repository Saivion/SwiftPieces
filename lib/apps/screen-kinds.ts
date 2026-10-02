// What kind of screen each remixed screen is, for the App Library's "Browse by screen": one kind per
// screen, keyed by app slug, one entry per step of the app's remix, in step order. Hand-kept, like
// screen-tags.ts: when a remix gains, loses or reorders a screen, update its line here too (the
// directory refuses to build when a line and its remix disagree).

export const SCREEN_KIND_INFO = {
  home: { title: "Home and today", about: "The first screen: what matters now, at a glance." },
  list: { title: "Lists and libraries", about: "Collections, feeds and queues you scroll, sort and swipe." },
  detail: { title: "Detail screens", about: "One thing in full: a recipe, a flight, a plant, a budget." },
  input: { title: "Add and log", about: "Entries, pickers and sheets that make adding something quick." },
  calendar: { title: "Calendars and timelines", about: "Days, weeks and months laid out in time." },
  stats: { title: "Stats and charts", about: "Trends and totals you can read at a glance and scrub." },
  progress: { title: "Goals and streaks", about: "Progress, challenges and the streak that brings you back." },
  session: { title: "Sessions and players", about: "Full-screen moments: guided breathing, focus timers, cooking and playback." },
  map: { title: "Maps and places", about: "Locations, routes and pins you drag." },
  social: { title: "Friends and sharing", about: "Circles, feeds, chats and cards made to share." },
  discover: { title: "Search and discovery", about: "Finding the next thing: search, browse and picks for you." },
  tools: { title: "Tools and settings", about: "Converters, scanners, widgets and the options sheet." },
} as const;

export type ScreenKind = keyof typeof SCREEN_KIND_INFO;

export const SCREEN_KINDS: Record<string, ScreenKind[]> = {
  "gentler-streak": ["home", "stats", "stats", "stats", "calendar"],
  "how-we-feel": ["input", "list", "calendar", "list", "social", "input"],
  stoic: ["home", "home", "input", "stats", "session", "list"],
  tiimo: ["home", "session", "input"],
  lungy: ["home", "session", "session", "session", "session", "stats"],
  timepage: ["calendar", "detail", "calendar", "stats", "calendar", "calendar", "input"],
  storygraph: ["list", "discover", "stats", "progress", "social", "progress"],
  mela: ["list", "detail", "session", "tools", "calendar", "list"],
  sunlitt: ["home", "map", "map", "map", "stats", "list"],
  daylio: ["input", "input", "input", "list", "stats", "calendar"],
  flighty: ["home", "detail", "detail", "social", "input"],
  "pocket-casts": ["list", "session", "tools", "list", "list"],
  pennies: ["home", "detail", "input", "list", "tools", "input"],
  planta: ["home", "detail", "tools", "tools", "tools", "social"],
  vocabulary: ["home", "session", "discover", "list", "input", "progress"],
  habitify: ["home", "stats", "tools", "detail", "input"],
  tricount: ["home", "stats", "list", "list", "input", "tools"],
  waterllama: ["home", "tools", "progress", "progress", "progress", "social"],
  tripsy: ["calendar", "detail", "tools", "map", "social", "social", "stats"],
  sofa: ["list", "list", "discover", "list", "session", "calendar", "stats"],
};
