// Builds for the free catalog's UI elements: one component family per screen, each member shown
// live with a short label, so you can compare them by using them.
import type { CatalogBuilder } from "../../core/catalog.js";
import type { ScreenNode } from "../../core/schema.js";
import { app, body, caption, group, nd, row, type Links, type ScreenSpec } from "./kit.js";

/** A family on one screen: a title, a line of context, then labelled specimens. */
const family = (name: string, view: string, intro: string, specimens: Array<[string, ScreenNode]> | ((l: Links) => Array<[string, ScreenNode]>), extraScreens?: (l: Links) => ScreenSpec[]) =>
  app({
    name,
    screens: (l) => [
      {
        key: "main", name: view, props: { title: name, spacing: 14 },
        children: [body(intro), ...(typeof specimens === "function" ? specimens(l) : specimens).flatMap(([label, node]) => [caption(label.toUpperCase(), { weight: "semibold" }), node])],
      },
      ...(extraScreens ? extraScreens(l) : []),
    ],
  });

const buttons = family("Buttons", "ButtonsView", "Press them. Each one answers differently.", [
  ["Filled", nd("button", { title: "Continue" })],
  ["Tinted and plain", row({ spacing: 10 }, [nd("button", { title: "Tinted", style: "tinted", fullWidth: false, size: "regular" }), nd("button", { title: "Plain", style: "plain", fullWidth: false, size: "regular" })])],
  ["Liquid Glass", row({ spacing: 10 }, [nd("button", { title: "", icon: "chevron.left", style: "glass", fullWidth: false, tint: "primary" }), nd("button", { title: "Edit", style: "glass", fullWidth: false, tint: "primary" }), nd("button", { title: "", icon: "ellipsis", style: "glass", fullWidth: false, tint: "primary" })])],
  ["Glass Bar", nd("glass-bar", { title: "Details", leading: "back", trailing: "two", trailingIcon: "square.and.arrow.up", trailingIcon2: "ellipsis" })],
  ["Elastic Button", nd("elastic-button", { title: "Reserve a table", icon: "arrow.right" })],
  ["Commit Button", nd("commit-button", { title: "Save changes", successTitle: "Saved" })],
  ["Hold To Confirm", nd("hold-to-confirm", { title: "Hold to delete", icon: "trash", committedTitle: "Deleted" })],
  ["Sign in with Apple", nd("apple-sign-in", { style: "white" })],
]);

const cards = family("Cards", "CardsView", "Tap, flip and tilt.", [
  ["Card", nd("card", { icon: "sparkles", title: "Weekly summary", subtitle: "Three priorities, two open loops, one clear Monday.", action: "Open" })],
  ["Image", nd("image", { art: "ocean", aspect: "16:9", title: "Cliff walk", caption: "Algarve · 6 km" })],
  ["Flip Card", nd("flip-card", {})],
  ["Motion Card", nd("motion-card", { height: 180 }, [nd("text", { text: "Tilt me", style: "title2", weight: "bold", color: "black" })])],
  ["Parallax Card", nd("parallax-card", {})],
]);

const textFields = family("Text Fields", "TextFieldsView", "Every one of these takes typing.", [
  ["Text field", nd("input", { label: "Email", placeholder: "you@example.com", icon: "envelope" })],
  ["Form Field", nd("form-field", { label: "Full name", prompt: "", icon: "person", content: "name" })],
  ["Secure Entry", nd("secure-entry", { label: "Password" })],
  ["Search field", nd("search-field", { placeholder: "Search" })],
  ["Token Field", nd("token-field", {})],
  ["Amount Field", nd("amount-field", { label: "Amount", amount: 25, size: "compact" })],
  ["Address Field", nd("address-field", {})],
  ["Signature Pad", nd("signature-pad", {})],
  ["Location Picker", nd("location-picker", { height: 380 })],
]);

const toggles = family("Toggles and Selection", "SelectionView", "Pick one, flip one.", [
  ["Toggle", group([nd("toggle", { label: "Notifications", isOn: true }), nd("toggle", { label: "Location", isOn: false, tint: "blue" })])],
  ["Segmented control", nd("segmented", { options: "Day, Week, Month", selected: 1, label: "Range" })],
  ["Glass Segments", nd("glass-segments", {})],
  ["Option cards", nd("vstack", { spacing: 8 }, [nd("choice", { title: "Standard", subtitle: "3–5 days", trailing: "Free", group: "ship", selected: true }), nd("choice", { title: "Express", subtitle: "Tomorrow", trailing: "$9", group: "ship" })])],
  ["Reaction Toggle", nd("reaction-toggle", {})],
]);

const sliders = family("Sliders and Steppers", "SlidersView", "Drag, step and scrub.", [
  ["Slider", nd("slider", { label: "Volume", value: 60, minIcon: "speaker.wave.2", maxIcon: "speaker.wave.2" })],
  ["Expanding Track", nd("expanding-track", {})],
  ["Range Slider", nd("range-slider", {})],
  ["Stepper", nd("stepper", { label: "Guests", value: 2 })],
  ["Scrub Stepper", nd("scrub-stepper", { label: "Nights", value: 3 })],
]);

const menus = family("Menus and Pickers", "MenusView", "Open, choose, done.", [
  ["Picker (menu)", group([nd("picker", { label: "Sort by", options: "Newest, Popular, Price" })])],
  ["Menu", row({}, [body("More actions"), nd("spacer"), nd("menu", {})])],
  ["Glass Action Menu", nd("glass-action-menu", {})],
]);

const lists = family(
  "Lists and Rows", "ListsView", "Swipe, check and scroll.",
  (l) => [
    ["Rows", group([nd("row", { icon: "bell", iconColor: "red", title: "Notifications" }), nd("row", { icon: "moon", iconColor: "indigo", title: "Focus", value: "On" })])],
    ["Task Row", nd("task-row", { title: "Send the proposal", due: "Today, 4 PM", priority: "high" })],
    ["Swipe Action Row", nd("swipe-action-row", {})],
    ["Status Timeline", nd("status-timeline", { steps: "Ordered, Packed, Shipped, Delivered", current: 2 })],
    ["Paged List", nd("paged-list", {})],
    ["Whole-screen lists", group([
      nd("row", { icon: "bubble.left", iconColor: "blue", title: "Follow Scroll", value: "Chat", link: l.to("chat") }),
      nd("row", { icon: "square.grid.3x3", iconColor: "orange", title: "Drag Select Grid", value: "Photos", link: l.to("grid") }),
      nd("row", { icon: "textformat.abc", iconColor: "green", title: "Index Scrubber", value: "Contacts", link: l.to("contacts") }),
    ])],
  ],
  () => [
    { key: "chat", name: "ThreadView", props: { title: "Maya", scrolls: false }, children: [nd("follow-scroll", {})] },
    { key: "grid", name: "PhotosView", props: { title: "Photos", scrolls: false }, children: [nd("drag-select-grid", {})] },
    { key: "contacts", name: "ContactsView", props: { title: "Contacts", scrolls: false }, children: [nd("index-scrubber", {})] },
  ],
);

const tabs = family("Tabs and Docks", "TabsView", "Switch between views.", [
  ["Tracking Tabs", nd("tracking-tabs", {})],
  ["Segmented control", nd("segmented", { options: "Posts, Replies, Likes", selected: 0, label: "Show" })],
  ["Floating Dock", row({}, [nd("spacer"), nd("floating-dock", { items: "Home, Search, Inbox, Profile" }), nd("spacer")])],
]);

const sheets = family(
  "Sheets and Alerts", "SheetsView", "Present, drag, dismiss.",
  (l) => [
    ["Sheet with detents", nd("button", { title: "Show filters", style: "tinted", icon: "slider.horizontal.3", link: l.sheet("half") })],
    ["Confirm Sheet", nd("confirm-sheet", {})],
    ["Permission Sheet", nd("permission-sheet", {})],
    ["Toast", nd("toast", {})],
    ["Spotlight Tour", nd("button", { title: "Take the tour", style: "tinted", icon: "sparkles", link: l.to("tour") })],
  ],
  () => [
    { key: "half", name: "FiltersView", props: { title: "Filters", detent: "both" }, children: [body("Drag me up to full height, or down to dismiss."), nd("toggle", { label: "Open now", isOn: true }), nd("slider", { label: "Distance", value: 40 }), nd("button", { title: "Show 24 places", link: "back" })] },
    { key: "tour", name: "TourView", props: { title: "Notes" }, children: [nd("spotlight-tour", {})] },
  ],
);

const charts = family("Charts and Numbers", "ChartsView", "Scrub and tap for exact values.", [
  ["Bar Chart", nd("chart", {})],
  ["Scrub Chart", nd("scrub-chart", {})],
  ["Ring Breakdown", nd("ring-breakdown", {})],
  ["Live Stat", nd("live-stat", {})],
  ["Odometer", nd("odometer", {})],
  ["Activity Heatmap", nd("activity-heatmap", {})],
]);

const feedback = family("Loading and Feedback", "FeedbackView", "How an app says what's happening.", [
  ["Progress", nd("vstack", { spacing: 12 }, [nd("progress", { value: 64, label: "Uploading" }), nd("progress", { style: "circular", indeterminate: true })])],
  ["Skeleton Loader", nd("skeleton-loader", { shape: "text", lines: 3 })],
  ["Status Morph", nd("status-morph", {})],
  ["Thinking State", nd("thinking-state", {})],
  ["Rating Scrub", nd("rating-scrub", {})],
]);

const text = family("Text and Type", "TextView", "Type that moves.", [
  ["Text styles", nd("vstack", { spacing: 4 }, [nd("text", { text: "Large Title", style: "largeTitle", weight: "bold" }), nd("text", { text: "Headline", style: "headline" }), nd("text", { text: "Body text reads at 17 points.", style: "body" }), nd("text", { text: "Footnote", style: "footnote", color: "secondary" })])],
  ["Text Reveal", nd("text-reveal", { size: 32 })],
  ["Picture Headline", nd("picture-headline", { size: 30 })],
  ["Expandable Text", nd("expandable-text", {})],
  ["Streaming Reply", nd("streaming-reply", {})],
  ["Tags", row({ spacing: 8 }, [nd("tag", { text: "New" }), nd("tag", { text: "Popular", style: "filled", tint: "orange" }), nd("tag", { text: "Beta", style: "outlined", tint: "gray" })])],
  ["SF Symbols", row({ spacing: 14 }, [nd("symbol", { icon: "sparkles", size: 22, badge: "rounded" }), nd("symbol", { icon: "heart.fill", size: 22, badge: "circle", color: "pink" }), nd("symbol", { icon: "bolt", size: 22, badge: "circle", color: "yellow" }), nd("symbol", { icon: "leaf", size: 22, color: "green" })])],
]);

const media = family("Media", "MediaView", "Swipe the carousels, tap a story.", [
  ["Image", nd("image", { art: "bloom", aspect: "16:9", title: "Spring collection" })],
  ["Page carousel", nd("page-carousel", { height: 240 })],
  ["Depth Carousel", nd("depth-carousel", {})],
  ["Story Strip", nd("story-strip", {})],
  ["Link Preview", nd("link-preview", {})],
  ["Attachment Tray", nd("attachment-tray", {})],
  ["Photo Cropper", nd("photo-cropper", {})],
  ["Fan Stack", nd("fan-stack", {})],
  ["Avatars", row({ spacing: 10 }, [nd("avatar", { initials: "AK", color: "orange", status: "online" }), nd("avatar", { initials: "JL", color: "teal" }), nd("avatar", { initials: "SR", color: "indigo", status: "busy" }), nd("avatar", { symbol: "person", color: "gray" })])],
]);

export const builds: Record<string, CatalogBuilder> = {
  buttons, cards, "text-fields": textFields, toggles, sliders, menus, lists, tabs, sheets, charts, feedback, text, media,
};
