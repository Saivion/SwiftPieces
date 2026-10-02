// Builds for the free catalog's flows: several screens linked the way the app really moves, with
// screens in step order (the flow strip and the Map read them in this order).
import type { CatalogBuilder } from "../../core/catalog.js";
import { app, body, caption, col, flex, footnote, group, headline, nd, row, space, title } from "./kit.js";

const onboarding = app({
  name: "Cadence",
  look: "studio",
  screens: (l) => [
    {
      key: "welcome", name: "WelcomeView", props: { scrolls: false, position: "center", spacing: 18 },
      children: [
        space(6),
        nd("page-carousel", { titles: "Plan the week, Build small habits, See your progress", art: "ocean", height: 360 }),
        nd("text", { text: "Your week, in one calm view.", style: "title", weight: "bold" }),
        body("Three priorities, gentle nudges and a Monday you can see coming."),
        flex(),
        nd("elastic-button", { title: "Get started", icon: "arrow.right", link: l.to("permissions") }),
      ],
    },
    {
      key: "permissions", name: "PermissionsView", props: { title: "Stay on track", spacing: 18 },
      children: [
        body("Cadence nudges you at the right moment: before a habit, never during a meeting."),
        group([
          nd("row", { icon: "bell", iconColor: "red", title: "A nudge before each habit", accessory: "none" }),
          nd("row", { icon: "moon", iconColor: "indigo", title: "Quiet during Focus", accessory: "none" }),
          nd("row", { icon: "chart.bar", iconColor: "blue", title: "A Sunday summary", accessory: "none" }),
        ]),
        nd("permission-sheet", {}),
        nd("button", { title: "Continue", link: l.to("personalize") }),
        nd("button", { title: "Not now", style: "plain", size: "regular", link: l.to("personalize") }),
      ],
    },
    {
      key: "personalize", name: "PersonalizeView", props: { title: "What matters?", spacing: 18 },
      children: [
        body("Pick a few. You can change them any time."),
        nd("filter-rail", { options: "Sleep, Fitness, Focus, Reading, Mindfulness, Cooking", multiple: true }),
        nd("slider", { label: "Minutes a day", value: 20, step: 5, showsValue: true }),
        nd("toggle", { label: "Weekend mode", isOn: false }),
        nd("button", { title: "Continue", link: l.sheet("paywall") }),
      ],
    },
    {
      key: "paywall", name: "PaywallView", props: { spacing: 14, detent: "large" },
      children: [
        nd("image", { art: "bloom", aspect: "16:9", symbol: "crown", radius: 24 }),
        title("Try Cadence Pro"),
        body("Seven days free, then pick what suits you."),
        nd("choice", { title: "Yearly", subtitle: "$59.99 a year", trailing: "$4.99/mo", badge: "Best value", group: "plan", selected: true }),
        nd("choice", { title: "Monthly", subtitle: "$9.99 a month", trailing: "$9.99/mo", group: "plan" }),
        nd("elastic-button", { title: "Start free trial", icon: "arrow.right", link: l.root("home") }),
        nd("button", { title: "Maybe later", style: "plain", size: "regular", link: l.root("home") }),
      ],
    },
    {
      key: "home", name: "HomeView", props: { title: "Today" },
      children: [
        nd("card", { icon: "sparkles", title: "Welcome to Cadence", subtitle: "Your first week starts now. Three habits, one calm plan.", action: "" }),
        nd("task-row", { title: "Morning walk", due: "7:30 AM", priority: "none" }),
        nd("task-row", { title: "Read 20 pages", due: "Tonight", priority: "medium" }),
        nd("task-row", { title: "Lights out by 11", due: "11 PM", priority: "low" }),
      ],
    },
  ],
});

const signIn = app({
  name: "Northwind",
  screens: (l) => [
    {
      key: "welcome", name: "WelcomeView", props: { scrolls: false, position: "center", spacing: 18 },
      children: [
        flex(),
        nd("symbol", { icon: "sparkles", size: 30, badge: "circle" }),
        nd("text-reveal", { text: "Everything your team shares, in one place.", highlights: "in one place", size: 36 }),
        body("Notes, files and decisions, searchable in a second."),
        flex(),
        nd("button", { title: "Sign in", link: l.to("signin") }),
        nd("apple-sign-in", { label: "continue", style: "white" }),
      ],
    },
    {
      key: "signin", name: "SignInView", props: { title: "Sign in" },
      children: [
        nd("input", { label: "Email", placeholder: "you@example.com", icon: "envelope", content: "email" }),
        nd("input", { label: "Password", placeholder: "Password", icon: "lock", content: "password", secure: true }),
        nd("button", { title: "Forgot password?", style: "plain", size: "small", fullWidth: false, link: l.sheet("reset") }),
        nd("button", { title: "Sign in", link: l.root("home") }),
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
      key: "home", name: "HomeView", props: { title: "Inbox" },
      children: [
        nd("search-field", { placeholder: "Search notes and files" }),
        group([
          nd("row", { icon: "doc.text", iconColor: "blue", title: "Q3 planning", value: "2h" }),
          nd("row", { icon: "folder", iconColor: "orange", title: "Brand assets", value: "Yesterday" }),
          nd("row", { icon: "bubble.left", iconColor: "green", title: "Launch retro", value: "Mon" }),
        ]),
      ],
    },
  ],
});

const checkout = app({
  name: "Maison",
  screens: (l) => [
    {
      key: "product", name: "ProductView", props: { spacing: 14 },
      children: [
        nd("image", { art: "citrus", aspect: "4:3", radius: 24 }),
        row({}, [col({ spacing: 2 }, [headline("Linen Lounge Chair"), footnote("Oak · Stonewashed linen")]), flex(), nd("text", { text: "$640", style: "title3", weight: "semibold" })]),
        nd("stepper", { label: "Quantity", value: 1, min: 1, max: 5 }),
        nd("button", { title: "Add to bag", icon: "bag", link: l.to("bag") }),
      ],
    },
    {
      key: "bag", name: "BagView", props: { title: "Bag" },
      children: [
        group([
          nd("row", { icon: "bag", iconColor: "orange", title: "Linen Lounge Chair", value: "$640", accessory: "none" }),
          nd("row", { icon: "shippingbox", iconColor: "blue", title: "Delivery", value: "Free", accessory: "none" }),
        ]),
        row({}, [headline("Total"), flex(), nd("text", { text: "$640", style: "title3", weight: "bold" })]),
        nd("button", { title: "Continue to payment", link: l.to("pay") }),
      ],
    },
    {
      key: "pay", name: "PaymentView", props: { title: "Pay" },
      children: [
        nd("choice", { title: "Apple Pay", subtitle: "Visa ending 4242", group: "method", selected: true }),
        nd("choice", { title: "Card", subtitle: "Mastercard ending 0197", icon: "creditcard", group: "method" }),
        space(8),
        nd("hold-to-confirm", { title: "Hold to pay $640", icon: "lock", committedTitle: "Paid" }),
        nd("button", { title: "See confirmation", style: "plain", size: "regular", link: l.to("done") }),
      ],
    },
    {
      key: "done", name: "ConfirmationView", props: { scrolls: false },
      children: [nd("outcome-screen", { outcome: "success", eyebrow: "Order 4821", title: "It's on its way", message: "Your chair ships tomorrow. We'll send tracking as soon as it leaves.", primaryTitle: "Done" })],
    },
  ],
});

const tabApp = app({
  name: "Shelf",
  shell: "tabs",
  screens: (l) => [
    {
      key: "home", name: "HomeView", props: { title: "Home" }, tab: { title: "Home", icon: "house" },
      children: [
        nd("card", { icon: "book", title: "Continue reading", subtitle: "The Overstory · 42% · 3 hours left", action: "Open", link: l.to("detail") }),
        group([
          nd("row", { icon: "star", iconColor: "yellow", title: "Recommended for you", link: l.to("detail") }),
          nd("row", { icon: "clock", iconColor: "orange", title: "Recently added", link: l.to("detail") }),
        ]),
      ],
    },
    {
      key: "detail", name: "BookView", props: { title: "The Overstory" },
      children: [
        nd("image", { art: "forest", aspect: "3:4", radius: 16 }),
        nd("progress", { value: 42, label: "42% read" }),
        nd("expandable-text", { text: "A sweeping novel of activism and natural-world power, told through nine people whose lives are drawn together by trees." }),
      ],
    },
    {
      key: "library", name: "LibraryView", props: { title: "Library" }, tab: { title: "Library", icon: "book" },
      children: [
        nd("segmented", { options: "Books, Audio, Saved", selected: 0, label: "Show" }),
        group([
          nd("row", { icon: "book", iconColor: "blue", title: "The Overstory", value: "42%", link: l.to("detail") }),
          nd("row", { icon: "book", iconColor: "green", title: "Piranesi", value: "Done", link: l.to("detail") }),
          nd("row", { icon: "headphones", iconColor: "purple", title: "Braiding Sweetgrass", value: "2h", link: l.to("detail") }),
        ]),
      ],
    },
    {
      key: "account", name: "AccountView", props: { title: "Account" }, tab: { title: "Account", icon: "person" },
      children: [
        group([
          nd("row", { icon: "person", iconColor: "gray", title: "Profile" }),
          nd("row", { icon: "bell", iconColor: "red", title: "Notifications", accessory: "toggle", isOn: true }),
        ]),
      ],
    },
  ],
});

const settingsFlow = app({
  name: "Northwind",
  screens: (l) => [
    {
      key: "settings", name: "SettingsView", props: { title: "Settings", background: "grouped", padding: 20, spacing: 20 },
      children: [
        group([
          nd("row", { icon: "bell", iconColor: "red", title: "Notifications", link: l.to("notifications") }),
          nd("row", { icon: "paintpalette", iconColor: "purple", title: "Appearance", link: l.to("appearance") }),
          nd("row", { icon: "lock", iconColor: "blue", title: "Privacy", accessory: "chevron" }),
        ]),
        nd("confirm-sheet", {}),
      ],
    },
    {
      key: "notifications", name: "NotificationsView", props: { title: "Notifications", background: "grouped", padding: 20 },
      children: [
        group([
          nd("row", { icon: "bell", iconColor: "red", title: "Allow notifications", accessory: "toggle", isOn: true }),
          nd("row", { icon: "envelope", iconColor: "blue", title: "Email digests", accessory: "toggle", isOn: false }),
          nd("picker", { label: "Summary", options: "Daily, Weekly, Never", selected: 1 }),
        ]),
        caption("Notifications arrive quietly during Focus."),
      ],
    },
    {
      key: "appearance", name: "AppearanceView", props: { title: "Appearance", background: "grouped", padding: 20 },
      children: [
        nd("segmented", { options: "Light, Dark, Auto", selected: 2, label: "Theme" }),
        group([
          nd("slider", { label: "Text size", value: 50, step: 10 }),
          nd("toggle", { label: "Bold text", isOn: false }),
        ]),
      ],
    },
  ],
});

const subscriptionApp = app({
  name: "Cadence",
  look: "candy",
  screens: (l) => [
    {
      key: "welcome", name: "WelcomeView", props: { scrolls: false, position: "center", spacing: 20 },
      children: [
        flex(),
        nd("symbol", { icon: "sparkles", size: 30, badge: "circle", color: "accent" }),
        nd("text-reveal", { text: "Every habit, one calm plan.", highlights: "one calm plan", size: 38 }),
        body("Small daily steps, a gentle nudge, and a week you can see at a glance."),
        flex(),
        nd("elastic-button", { title: "Start free trial", icon: "arrow.right", link: l.to("plans") }),
      ],
    },
    {
      key: "plans", name: "PlansView", props: { title: "Choose a plan" },
      children: [
        body("Try everything free for 7 days. Cancel anytime."),
        nd("choice", { title: "Yearly", subtitle: "$59.99 a year after your free week", trailing: "$1.15/wk", badge: "Best value", group: "plan", selected: true }),
        nd("choice", { title: "Monthly", subtitle: "$9.99 a month after your free week", trailing: "$9.99", group: "plan" }),
        nd("button", { title: "Start my free week", link: l.root("home") }),
        caption("Renews automatically. Manage it anytime in Settings."),
      ],
    },
    {
      key: "home", name: "HomeView", props: { title: "Today" },
      children: [
        nd("card", { icon: "sparkles", title: "Your week", subtitle: "Four of five habits done. One to go today.", action: "" }),
        nd("task-row", { title: "Morning walk", due: "Done at 7:40", priority: "none", status: "completed" }),
        nd("task-row", { title: "Read 20 pages", due: "Tonight", priority: "medium" }),
        nd("task-row", { title: "No screens after 10", due: "10 PM", priority: "low" }),
      ],
    },
  ],
});

const financeApp = app({
  name: "Ledgerly",
  look: "studio",
  screens: (l) => [
    {
      key: "welcome", name: "WelcomeView", props: { scrolls: false, position: "center", spacing: 20 },
      children: [
        flex(),
        nd("symbol", { icon: "creditcard", size: 30, badge: "circle", color: "accent" }),
        nd("text-reveal", { text: "Money, finally in focus.", highlights: "in focus", size: 38 }),
        body("Every account, every bill and every goal in one calm place."),
        flex(),
        nd("elastic-button", { title: "Get started", icon: "arrow.right", link: l.root("wallet") }),
      ],
    },
    {
      key: "wallet", name: "WalletView", props: { title: "Wallet" },
      children: [
        nd("live-stat", { label: "Balance", value: 12480.55, format: "currency", delta: 3.2 }),
        nd("ring-breakdown", { slices: "Housing: 1450, Food: 620, Transport: 310, Leisure: 270" }),
        group([
          nd("row", { icon: "cart", iconColor: "orange", title: "Groceries", value: "−$64.20", accessory: "none" }),
          nd("row", { icon: "bolt", iconColor: "yellow", title: "Electricity", value: "−$82.00", accessory: "none" }),
          nd("row", { icon: "creditcard", iconColor: "green", title: "Salary", value: "+$3,200", accessory: "none" }),
        ]),
        nd("button", { title: "Send money", icon: "paperplane", link: l.to("send") }),
      ],
    },
    {
      key: "send", name: "SendView", props: { title: "Send" },
      children: [
        nd("filter-rail", { options: "Maya, Leo, Sam, Priya, Jordan" }),
        nd("amount-field", { label: "Send to Maya", amount: 45 }),
        nd("hold-to-confirm", { title: "Hold to send", icon: "paperplane", committedTitle: "Sent" }),
        caption("Arrives instantly. No fees between Ledgerly accounts."),
      ],
    },
  ],
});

const aiApp = app({
  name: "Nimbus",
  look: "neon",
  screens: (l) => [
    {
      key: "welcome", name: "WelcomeView", props: { scrolls: false, position: "center", spacing: 20 },
      children: [
        flex(),
        nd("symbol", { icon: "sparkles", size: 30, badge: "circle", color: "accent" }),
        nd("text-reveal", { text: "Ask anything. Get it done.", highlights: "Get it done", size: 38 }),
        body("Nimbus reads your notes, drafts replies and plans your week."),
        flex(),
        nd("elastic-button", { title: "Start chatting", icon: "arrow.right", link: l.root("chat") }),
      ],
    },
    {
      key: "chat", name: "ChatView", props: { title: "Nimbus", toolbarIcon: "gearshape", toolbarLink: l.sheet("settings") },
      children: [
        nd("text", { text: "Good morning. What should we tackle?", style: "title3", weight: "semibold" }),
        nd("prompt-chips", { suggestions: "Summarize my inbox, Draft a reply, Plan my week, Find action items" }),
        nd("streaming-reply", {}),
        nd("input", { label: "", placeholder: "Ask Nimbus…", icon: "sparkles", content: "none" }),
      ],
    },
    {
      key: "settings", name: "SettingsView", props: { title: "Settings", detent: "both" },
      children: [
        group([
          nd("row", { icon: "bell", iconColor: "red", title: "Notifications", accessory: "toggle", isOn: true }),
          nd("row", { icon: "shield", iconColor: "blue", title: "Keep chats private", accessory: "toggle", isOn: true }),
          nd("picker", { label: "Model", options: "Fast, Balanced, Deep", selected: 1 }),
        ]),
        nd("button", { title: "Done", style: "tinted", link: "back" }),
      ],
    },
  ],
});

const travelApp = app({
  name: "Wayfare",
  look: "sol",
  screens: (l) => [
    {
      key: "welcome", name: "WelcomeView", props: { scrolls: false, position: "center", spacing: 20 },
      children: [
        flex(),
        nd("symbol", { icon: "globe", size: 30, badge: "circle", color: "accent" }),
        nd("text-reveal", { text: "Go somewhere new.", highlights: "somewhere new", size: 38 }),
        body("Hand-picked stays, honest prices and a plan that fits in your pocket."),
        flex(),
        nd("elastic-button", { title: "Plan a trip", icon: "arrow.right", link: l.root("explore") }),
      ],
    },
    {
      key: "explore", name: "ExploreView", props: { title: "Explore" },
      children: [
        nd("filter-rail", { options: "All, Beaches, Cities, Mountains, Food" }),
        nd("image", { art: "sunset", aspect: "4:3", title: "Lisbon · 5 nights", caption: "From $640", link: l.to("trip") }),
        nd("image", { art: "forest", aspect: "4:3", title: "Kyoto · 7 nights", caption: "From $1,180", link: l.to("trip") }),
      ],
    },
    {
      key: "trip", name: "TripView", props: { title: "Lisbon" },
      children: [
        nd("expandable-text", { text: "Five nights in Alfama, a short walk from the river. Breakfast on the terrace, a sunset tram ride and a day in Sintra with a local guide. Flights and transfers are booked together, so everything moves as one plan.", lineLimit: 3 }),
        nd("status-timeline", { steps: "Flights booked, Hotel confirmed, Check in, Enjoy Lisbon", current: 1 }),
        nd("commit-button", { title: "Book the trip", successTitle: "Booked" }),
      ],
    },
  ],
});

export const builds: Record<string, CatalogBuilder> = {
  onboarding, "sign-in": signIn, checkout, "tab-app": tabApp, settings: settingsFlow,
  "subscription-app": subscriptionApp, "finance-app": financeApp, "ai-app": aiApp, "travel-app": travelApp,
};
