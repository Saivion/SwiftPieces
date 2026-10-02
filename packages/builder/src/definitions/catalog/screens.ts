// Builds for the free catalog's screens. Each is a small app: the screen itself, plus any screen a
// tap on it opens (a pushed detail, a presented sheet), so every button leads somewhere real.
import type { CatalogBuilder } from "../../core/catalog.js";
import { app, body, caption, col, flex, footnote, group, heading, headline, nd, row, section, space, stat, title } from "./kit.js";

const onboarding = app({
  name: "Cadence",
  look: "studio",
  screens: (l) => [
    {
      key: "welcome", name: "WelcomeView", props: { scrolls: false, position: "center", spacing: 18 },
      children: [
        space(8),
        nd("page-carousel", { titles: "Plan the week, Build small habits, See your progress", art: "ocean", height: 380 }),
        nd("text", { text: "Your week, in one calm view.", style: "title", weight: "bold" }),
        body("Three priorities, gentle nudges and a Monday you can see coming."),
        flex(),
        nd("elastic-button", { title: "Get started", icon: "arrow.right", link: l.to("next") }),
        nd("button", { title: "I already have an account", style: "plain", size: "regular" }),
      ],
    },
    {
      key: "next", name: "SetupView", props: { title: "Set up" },
      children: [
        body("That's the welcome. The full first run, with permissions and a paywall, is in Flows."),
        group([
          nd("row", { icon: "bell", iconColor: "red", title: "Reminders", accessory: "toggle", isOn: true }),
          nd("row", { icon: "calendar", iconColor: "orange", title: "Week starts on", value: "Monday", accessory: "none" }),
        ]),
        nd("button", { title: "Done", style: "tinted", link: "back" }),
      ],
    },
  ],
});

const login = app({
  name: "Northwind",
  screens: (l) => [
    {
      key: "login", name: "LoginView", props: { alignment: "leading", spacing: 16 },
      children: [
        nd("symbol", { icon: "sparkles", size: 26, badge: "rounded" }),
        title("Welcome back"),
        body("Sign in to pick up where you left off."),
        space(4),
        nd("input", { label: "Email", placeholder: "you@example.com", icon: "envelope", content: "email" }),
        nd("input", { label: "Password", placeholder: "Password", icon: "lock", content: "password", secure: true }),
        nd("button", { title: "Forgot password?", style: "plain", size: "small", fullWidth: false, link: l.sheet("reset") }),
        nd("button", { title: "Sign in", link: l.to("signedIn") }),
        nd("apple-sign-in", { style: "white" }),
        row({ spacing: 4 }, [footnote("New here?"), nd("button", { title: "Create an account", style: "plain", size: "small", fullWidth: false })]),
      ],
    },
    {
      key: "reset", name: "ResetPasswordView", props: { title: "Reset password", detent: "medium" },
      children: [
        body("We'll email you a link to choose a new password."),
        nd("input", { label: "", placeholder: "you@example.com", icon: "envelope", content: "email" }),
        nd("button", { title: "Send link", link: "back" }),
      ],
    },
    {
      key: "signedIn", name: "WelcomeHomeView", props: { title: "Today" },
      children: [
        nd("card", { icon: "checkmark.circle.fill", title: "You're signed in", subtitle: "This is where your app begins. Go back to try the form again.", action: "" }),
      ],
    },
  ],
});

const signUp = app({
  name: "Northwind",
  screens: (l) => [
    {
      key: "signup", name: "SignUpView", props: { title: "Create account" },
      children: [
        body("It takes less than a minute."),
        nd("form-field", { label: "Name", prompt: "", icon: "person", content: "name" }),
        nd("form-field", { label: "Email", prompt: "you@example.com", icon: "envelope", content: "email", help: "We send a sign-in link here." }),
        nd("secure-entry", { label: "Password" }),
        nd("commit-button", { title: "Create account", successTitle: "Welcome" }),
        caption("By continuing you agree to the Terms and Privacy Policy."),
      ],
    },
  ],
});

const profile = app({
  name: "Folio",
  screens: (l) => [
    {
      key: "profile", name: "ProfileView", props: { title: "Profile", alignment: "center", toolbarIcon: "gearshape", toolbarLink: l.to("settings") },
      children: [
        nd("avatar", { initials: "SR", size: 88, color: "indigo", status: "online" }),
        col({ alignment: "center", spacing: 4 }, [
          nd("text", { text: "Sam Rivera", style: "title2", weight: "bold" }),
          footnote("@samrivera · Lisbon"),
        ]),
        row({ spacing: 10 }, [stat("128", "Posts"), stat("4.2k", "Followers"), stat("310", "Following")]),
        nd("button", { title: "Edit profile", style: "tinted", link: l.sheet("edit") }),
        group([
          nd("row", { icon: "bookmark", iconColor: "blue", title: "Saved", value: "24", link: l.to("saved") }),
          nd("row", { icon: "clock", iconColor: "orange", title: "History", link: l.to("saved") }),
          nd("row", { icon: "shield", iconColor: "green", title: "Privacy", link: l.to("settings") }),
        ]),
      ],
    },
    {
      key: "edit", name: "EditProfileView", props: { title: "Edit profile", detent: "large" },
      children: [
        nd("avatar", { initials: "SR", size: 64, color: "indigo" }),
        nd("form-field", { label: "Name", prompt: "Sam Rivera", icon: "person", content: "name" }),
        nd("form-field", { label: "Username", prompt: "samrivera", icon: "person", content: "username" }),
        nd("expandable-text", { text: "Designer and weekend climber. Writing about calm software, good coffee and the long way home through Alfama." }),
        nd("button", { title: "Save", link: "back" }),
      ],
    },
    {
      key: "saved", name: "SavedView", props: { title: "Saved" },
      children: [
        nd("image", { art: "sunset", aspect: "16:9", title: "Lisbon at dusk", caption: "Saved from Travel" }),
        nd("image", { art: "forest", aspect: "16:9", title: "Sintra trail", caption: "Saved from Outdoors" }),
      ],
    },
    {
      key: "settings", name: "ProfileSettingsView", props: { title: "Settings", background: "grouped" },
      children: [
        group([
          nd("row", { icon: "bell", iconColor: "red", title: "Notifications", accessory: "toggle", isOn: true }),
          nd("row", { icon: "lock", iconColor: "blue", title: "Private account", accessory: "toggle", isOn: false }),
        ]),
      ],
    },
  ],
});

const settings = app({
  name: "Northwind",
  screens: (l) => [
    {
      key: "settings", name: "SettingsView", props: { title: "Settings", background: "grouped", spacing: 20, padding: 20 },
      children: [
        group([
          row({ spacing: 14 }, [
            nd("avatar", { initials: "AK", size: 52, color: "orange" }),
            col({ spacing: 2 }, [headline("Ada Kowalski"), footnote("Apple Account, iCloud and more")]),
          ]),
        ]),
        group([
          nd("row", { icon: "bell", iconColor: "red", title: "Notifications", accessory: "toggle", isOn: true }),
          nd("row", { icon: "moon", iconColor: "indigo", title: "Focus", link: l.to("focus") }),
          nd("picker", { label: "Appearance", options: "Automatic, Light, Dark", selected: 0 }),
        ]),
        group([
          nd("row", { icon: "lock", iconColor: "blue", title: "Privacy & Security", link: l.to("focus") }),
          nd("row", { icon: "bubble.left", iconColor: "green", title: "Help & Feedback" }),
          nd("row", { icon: "globe", iconColor: "gray", title: "About", value: "2.4", accessory: "none" }),
        ]),
        nd("confirm-sheet", {}),
      ],
    },
    {
      key: "focus", name: "FocusView", props: { title: "Focus", background: "grouped", padding: 20 },
      children: [
        body("Silence notifications while you work, sleep or drive."),
        group([
          nd("row", { icon: "moon", iconColor: "indigo", title: "Do Not Disturb", accessory: "toggle", isOn: false }),
          nd("row", { icon: "bed.double", iconColor: "teal", title: "Sleep", accessory: "toggle", isOn: true }),
          nd("row", { icon: "person", iconColor: "orange", title: "Personal", accessory: "toggle", isOn: false }),
        ]),
      ],
    },
  ],
});

const home = app({
  name: "Daybook",
  shell: "tabs",
  screens: (l) => [
    {
      key: "home", name: "HomeView", props: { title: "Good morning", toolbarIcon: "bell", toolbarLink: l.to("detail") }, tab: { title: "Home", icon: "house" },
      children: [
        nd("story-strip", {}),
        nd("image", { art: "dusk", aspect: "4:3", title: "Slow mornings", caption: "A 6-minute read", link: l.to("detail") }),
        headline("Recent"),
        group([
          nd("row", { icon: "doc.text", iconColor: "blue", title: "Weekly review", value: "Sun", link: l.to("detail") }),
          nd("row", { icon: "calendar", iconColor: "red", title: "Planning session", value: "Mon", link: l.to("detail") }),
          nd("row", { icon: "leaf", iconColor: "green", title: "Garden notes", value: "Tue", link: l.to("detail") }),
        ]),
      ],
    },
    {
      key: "search", name: "SearchTabView", props: { title: "Search" }, tab: { title: "Search", icon: "magnifyingglass" },
      children: [
        nd("search-field", { placeholder: "Stories, notes, people" }),
        nd("filter-rail", { options: "All, Stories, Notes, People" }),
        group([
          nd("row", { icon: "clock", iconColor: "gray", title: "Morning routines", link: l.to("detail") }),
          nd("row", { icon: "clock", iconColor: "gray", title: "Lisbon guide", link: l.to("detail") }),
        ]),
      ],
    },
    {
      key: "you", name: "YouView", props: { title: "You", alignment: "center" }, tab: { title: "You", icon: "person" },
      children: [
        nd("avatar", { initials: "JL", size: 80, color: "teal" }),
        heading("Jun Lee"),
        row({ spacing: 10 }, [stat("42", "Entries"), stat("12", "Streak"), stat("5", "Shared")]),
      ],
    },
    {
      key: "detail", name: "StoryView", props: { title: "Slow mornings" },
      children: [
        nd("image", { art: "dusk", aspect: "16:9" }),
        body("The first hour sets the tone. Keep it quiet: light, water, one page, and nothing that asks for a reply."),
        nd("reaction-toggle", {}),
      ],
    },
  ],
});

const dashboard = app({
  name: "Ledgerly",
  screens: () => [
    {
      key: "dash", name: "DashboardView", props: { title: "Overview" },
      children: [
        nd("segmented", { options: "Week, Month, Year", selected: 0, label: "Range" }),
        nd("live-stat", { label: "Revenue", value: 48250.4, format: "currency", delta: 12.4 }),
        nd("chart", { values: "4, 7, 5, 9, 6, 8, 3", labels: "Mon, Tue, Wed, Thu, Fri, Sat, Sun", height: 180 }),
        headline("Where it goes"),
        nd("ring-breakdown", { slices: "Housing: 1450, Food: 620, Transport: 310, Leisure: 270" }),
      ],
    },
  ],
});

const paywall = app({
  name: "Cadence",
  look: "candy",
  screens: (l) => [
    {
      key: "paywall", name: "PaywallView", props: { spacing: 14 },
      children: [
        nd("image", { art: "bloom", aspect: "16:9", symbol: "crown", radius: 24 }),
        title("Unlock Cadence Pro"),
        body("Everything you need to build habits that stick."),
        group([
          nd("row", { icon: "checkmark", iconColor: "green", title: "Unlimited habits", accessory: "none" }),
          nd("row", { icon: "bell", iconColor: "orange", title: "Smart reminders", accessory: "none" }),
          nd("row", { icon: "chart.bar", iconColor: "blue", title: "Weekly insights", accessory: "none" }),
        ]),
        nd("choice", { title: "Yearly", subtitle: "$59.99 a year after a 7-day trial", trailing: "$4.99/mo", badge: "Best value", group: "plan", selected: true }),
        nd("choice", { title: "Monthly", subtitle: "$9.99 a month", trailing: "$9.99/mo", group: "plan" }),
        nd("elastic-button", { title: "Start free trial", icon: "arrow.right", link: l.to("thanks") }),
        row({ spacing: 16 }, [nd("button", { title: "Restore purchases", style: "plain", size: "small", fullWidth: false }), flex(), nd("button", { title: "Terms", style: "plain", size: "small", fullWidth: false })]),
      ],
    },
    {
      key: "thanks", name: "WelcomeProView", props: { scrolls: false },
      children: [nd("outcome-screen", { outcome: "success", eyebrow: "Cadence Pro", title: "You're in", message: "Your 7-day trial has started. We'll remind you two days before it ends.", primaryTitle: "Let's go" })],
    },
  ],
});

const product = app({
  name: "Maison",
  screens: (l) => [
    {
      key: "product", name: "ProductView", props: { spacing: 14 },
      children: [
        nd("page-carousel", { titles: "Front, Side, Detail", art: "citrus", height: 340 }),
        row({ spacing: 8 }, [nd("tag", { text: "New" }), nd("tag", { text: "Free returns", style: "outlined", tint: "gray" })]),
        heading("Linen Lounge Chair"),
        row({}, [nd("text", { text: "$640", style: "title3", weight: "semibold" }), flex(), nd("rating-scrub", { rating: 4, labels: false, size: 20, readOnly: true })]),
        nd("expandable-text", { text: "Oak frame, stonewashed linen and a seat deep enough to fold your legs into. Assembled in ten minutes with one tool, and the covers come off for washing." }),
        nd("stepper", { label: "Quantity", value: 1, min: 1, max: 5 }),
        nd("toast", {}),
      ],
    },
  ],
});

const sendMoney = app({
  name: "Ledgerly",
  look: "studio",
  screens: () => [
    {
      key: "send", name: "SendView", props: { title: "Send" },
      children: [
        nd("filter-rail", { options: "Maya, Leo, Sam, Priya, Jordan" }),
        nd("amount-field", { label: "Send to Maya", amount: 45 }),
        nd("form-field", { label: "Note", prompt: "Dinner on Friday", icon: "pencil", content: "none" }),
        nd("hold-to-confirm", { title: "Hold to send", icon: "paperplane", committedTitle: "Sent" }),
        footnote("Arrives instantly. No fees between Ledgerly accounts."),
      ],
    },
  ],
});

const search = app({
  name: "Wayfare",
  screens: (l) => [
    {
      key: "search", name: "SearchView", props: { title: "Search" },
      children: [
        nd("search-field", { placeholder: "Cities, stays, experiences" }),
        nd("filter-rail", { options: "All, Stays, Food, Tours, Nature" }),
        section("Recent"),
        group([
          nd("row", { icon: "clock", iconColor: "gray", title: "Lisbon in spring", link: l.to("result") }),
          nd("row", { icon: "clock", iconColor: "gray", title: "Kyoto ryokans", link: l.to("result") }),
          nd("row", { icon: "clock", iconColor: "gray", title: "Hiking near Porto", link: l.to("result") }),
        ]),
        section("Top results"),
        nd("image", { art: "sunset", aspect: "16:9", title: "Alfama, Lisbon", caption: "Tiled streets and river light", link: l.to("result") }),
      ],
    },
    {
      key: "result", name: "ResultView", props: { title: "Alfama" },
      children: [
        nd("image", { art: "sunset", aspect: "4:3" }),
        body("The oldest neighbourhood in Lisbon: steep lanes, tram 28 and fado drifting out of doorways after dark."),
        nd("button", { title: "Save to trip", icon: "bookmark", style: "tinted" }),
      ],
    },
  ],
});

const nowPlaying = app({
  name: "Tempo",
  screens: () => [
    {
      key: "player", name: "NowPlayingView", props: { scrolls: false, spacing: 18, appearance: "dark" },
      children: [
        space(6),
        nd("image", { art: "dusk", aspect: "1:1", radius: 28, symbol: "music.note" }),
        col({ spacing: 2 }, [nd("text", { text: "Northern Lights", style: "title2", weight: "bold" }), body("Aurora Hall")]),
        nd("slider", { label: "Timeline", value: 34 }),
        row({ spacing: 0 }, [
          flex(),
          nd("button", { title: "", icon: "backward.fill", style: "plain", size: "large", fullWidth: false }),
          flex(),
          nd("button", { title: "", icon: "play.fill", style: "filled", size: "large", fullWidth: false, shape: "capsule" }),
          flex(),
          nd("button", { title: "", icon: "forward.fill", style: "plain", size: "large", fullWidth: false }),
          flex(),
        ]),
        nd("slider", { label: "Volume", value: 60, minIcon: "speaker.wave.2", maxIcon: "speaker.wave.2" }),
      ],
    },
  ],
});

const discover = app({
  name: "Kindred",
  screens: () => [
    {
      key: "discover", name: "DiscoverView", props: { title: "Discover", scrolls: false, position: "top" },
      children: [nd("swipe-deck", {}), row({ spacing: 16 }, [flex(), nd("reaction-toggle", { icon: "heart", count: 128 }), flex()])],
    },
  ],
});

const notifications = app({
  name: "Relay",
  screens: () => [
    {
      key: "list", name: "NotificationsView", props: { title: "Notifications" },
      children: [
        row({}, [section("Today"), flex(), nd("menu", { label: "", icon: "ellipsis.circle", items: "Mark all as read, Mute for an hour, Settings", destructive: "Clear all" })]),
        nd("swipe-action-row", {}),
        nd("swipe-action-row", {}),
        nd("swipe-action-row", {}),
      ],
    },
  ],
});

const tasks = app({
  name: "Margin",
  look: "press",
  screens: (l) => [
    {
      key: "today", name: "TodayView", props: { title: "Today", toolbarIcon: "plus", toolbarLink: l.sheet("new") },
      children: [
        nd("progress", { value: 40, label: "2 of 5 done" }),
        nd("filter-rail", { options: "All, Work, Personal, Errands" }),
        nd("task-row", { title: "Review the launch checklist", due: "Today, 5 PM", priority: "high" }),
        nd("task-row", { title: "Reply to design feedback", due: "Today", priority: "medium" }),
        nd("task-row", { title: "Book the dentist", due: "Done", priority: "none", status: "completed" }),
        nd("task-row", { title: "Buy oat milk", due: "Tomorrow", priority: "low" }),
        nd("button", { title: "New task", icon: "plus", style: "tinted", link: l.sheet("new") }),
      ],
    },
    {
      key: "new", name: "NewTaskView", props: { title: "New task", detent: "both" },
      children: [
        nd("form-field", { label: "Title", prompt: "What needs doing?", icon: "pencil", content: "none" }),
        nd("segmented", { options: "Low, Medium, High", selected: 1, label: "Priority" }),
        nd("toggle", { label: "Remind me", isOn: true }),
        nd("button", { title: "Add task", link: "back" }),
      ],
    },
  ],
});

const assistant = app({
  name: "Nimbus",
  look: "neon",
  screens: () => [
    {
      key: "chat", name: "AssistantView", props: { title: "Nimbus" },
      children: [
        nd("text", { text: "Good morning. What should we tackle?", style: "title3", weight: "semibold" }),
        nd("prompt-chips", { suggestions: "Summarize my inbox, Draft a reply, Plan my week, Find action items" }),
        nd("thinking-state", { presentation: "sheen", text: "Reading your notes" }),
        nd("streaming-reply", {}),
        nd("input", { label: "", placeholder: "Ask Nimbus…", icon: "sparkles", content: "none" }),
      ],
    },
  ],
});

const booking = app({
  name: "Wayfare",
  look: "sol",
  screens: () => [
    {
      key: "book", name: "BookingView", props: { title: "Your stay" },
      children: [
        nd("image", { art: "citrus", aspect: "16:9", title: "Casa do Rio", caption: "Alfama · Lisbon" }),
        nd("date-range-picker", {}),
        nd("stepper", { label: "Guests", value: 2, min: 1, max: 8 }),
        headline("Budget per night"),
        nd("range-slider", {}),
        nd("commit-button", { title: "Book the stay", successTitle: "Booked" }),
      ],
    },
  ],
});

const emptyState = app({
  name: "Ledgerly",
  screens: (l) => [
    {
      key: "empty", name: "InvoicesView", props: { scrolls: false },
      children: [nd("outcome-screen", { outcome: "empty", eyebrow: "Invoices", title: "No invoices yet", message: "Invoices you send to clients show up here, with their status.", primaryTitle: "New invoice", link: l.to("new") })],
    },
    {
      key: "new", name: "NewInvoiceView", props: { title: "New invoice" },
      children: [
        nd("form-field", { label: "Client", prompt: "Acme Studio", icon: "person", content: "name" }),
        nd("amount-field", { label: "Amount", amount: 1200, size: "compact" }),
        nd("commit-button", { title: "Send invoice", successTitle: "Sent" }),
      ],
    },
  ],
});

const loading = app({
  name: "Signal",
  screens: () => [
    {
      key: "loading", name: "LoadingView", props: { title: "Loading", refreshable: true },
      children: [
        nd("skeleton-loader", { shape: "rounded", height: 150 }),
        nd("skeleton-loader", { shape: "text", lines: 3 }),
        nd("progress", { value: 62, label: "Syncing 62%" }),
        nd("thinking-state", { presentation: "dots", text: "Crunching the numbers" }),
        row({ spacing: 16 }, [nd("status-morph", { state: "success" }), col({ spacing: 2 }, [headline("Backup"), footnote("Tap the icon to change its state.")])]),
        nd("commit-button", { title: "Reload", successTitle: "Up to date" }),
      ],
    },
  ],
});

export const builds: Record<string, CatalogBuilder> = {
  onboarding, login, "sign-up": signUp, profile, settings, home, dashboard, paywall, product, "send-money": sendMoney,
  search, "now-playing": nowPlaying, discover, notifications, tasks, assistant, booking, "empty-state": emptyState, loading,
};
