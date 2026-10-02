// Builds for the free catalog's interactions: one behaviour per screen, with just enough around it
// to try it properly, and a line saying what to do.
import type { CatalogBuilder } from "../../core/catalog.js";
import type { Props, ScreenNode } from "../../core/schema.js";
import { app, body, caption, flex, footnote, group, headline, nd, row, section, type Links, type ScreenSpec } from "./kit.js";

/** One interaction on a screen: a short heading, the instruction, then the thing itself. */
const demo = (name: string, view: string, instruction: string, content: ScreenNode[] | ((l: Links) => ScreenNode[]), opts: { props?: Props; more?: (l: Links) => ScreenSpec[]; look?: string } = {}) =>
  app({
    name,
    look: opts.look,
    screens: (l) => [
      { key: "main", name: view, props: { title: name, spacing: 16, ...opts.props }, children: [body(instruction), ...(typeof content === "function" ? content(l) : content)] },
      ...(opts.more ? opts.more(l) : []),
    ],
  });

const swipeCards = demo("Swipe Cards", "SwipeCardsView", "Drag a card. Let go early and it springs back; pass the edge and it flies.", [nd("swipe-deck", {})], { props: { scrolls: false, position: "top" } });

const swipeActions = demo("Swipe Actions", "SwipeActionsView", "Swipe a row to the left to reveal what you can do.", [nd("swipe-action-row", {}), nd("swipe-action-row", {}), nd("swipe-action-row", {})]);

const holdToConfirm = demo("Hold to Confirm", "HoldView", "Press and keep holding. Let go early and it rewinds.", [
  flex(),
  nd("hold-to-confirm", { title: "Hold to delete", icon: "trash", committedTitle: "Deleted" }),
  nd("hold-to-confirm", { title: "Hold to send $120", icon: "paperplane", committedTitle: "Sent", style: "butter" }),
  flex(),
], { props: { scrolls: false } });

const pullToRefresh = demo("Pull to Refresh", "InboxView", "Scroll to the top, then pull down past it.", [
  group([
    nd("row", { icon: "envelope", iconColor: "blue", title: "Design review", value: "9:41" }),
    nd("row", { icon: "envelope", iconColor: "blue", title: "Invoice #4821", value: "8:02" }),
    nd("row", { icon: "envelope", iconColor: "blue", title: "Weekend plans", value: "Yesterday" }),
    nd("row", { icon: "envelope", iconColor: "blue", title: "Your order shipped", value: "Mon" }),
    nd("row", { icon: "envelope", iconColor: "blue", title: "Team offsite", value: "Sun" }),
  ]),
  caption("In SwiftUI this is one modifier: .refreshable { await reload() }"),
], { props: { refreshable: true } });

const sheets = demo("Sheets and Detents", "SheetsView", "Open a sheet. Drag the half-height one up; swipe either down to dismiss.", (l) => [
  nd("button", { title: "Half-height sheet", style: "tinted", icon: "chevron.down", link: l.sheet("half") }),
  nd("button", { title: "Full-height sheet", icon: "arrow.up", link: l.sheet("full") }),
  footnote("Half height uses .presentationDetents([.medium, .large]). The screen behind recedes for a full-height sheet."),
], {
  more: () => [
    { key: "half", name: "HalfSheetView", props: { title: "Nearby", detent: "both" }, children: [body("Drag up for the full list."), group([nd("row", { icon: "cup.and.saucer", iconColor: "orange", title: "Copenhagen Coffee", value: "2 min" }), nd("row", { icon: "fork.knife", iconColor: "red", title: "Taberna", value: "6 min" }), nd("row", { icon: "book", iconColor: "blue", title: "Bookshop", value: "9 min" })])] },
    { key: "full", name: "FullSheetView", props: { title: "New note", detent: "large" }, children: [nd("form-field", { label: "Title", prompt: "Untitled", icon: "pencil", content: "none" }), nd("expandable-text", { text: "Sheets that take the full height push the screen behind them back, so you always know there's something underneath." }), nd("button", { title: "Done", link: "back" })] },
  ],
});

const pushNavigation = demo("Push and Swipe Back", "FirstView", "Tap a row to go deeper. Come back with the back button or a swipe from the left edge.", (l) => [
  group([nd("row", { icon: "folder", iconColor: "blue", title: "Projects", link: l.to("second") }), nd("row", { icon: "folder", iconColor: "orange", title: "Archive", link: l.to("second") })]),
], {
  more: (l) => [
    { key: "second", name: "SecondView", props: { title: "Projects" }, children: [body("One level down."), group([nd("row", { icon: "doc.text", iconColor: "green", title: "Launch plan", link: l.to("third") }), nd("row", { icon: "doc.text", iconColor: "green", title: "Brand refresh", link: l.to("third") })])] },
    { key: "third", name: "ThirdView", props: { title: "Launch plan" }, children: [body("Two levels down. Swipe from the left edge, slowly, and watch the screen underneath follow."), nd("status-timeline", { steps: "Brief, Design, Build, Ship", current: 2 })] },
  ],
});

const springPress = demo("Springy Press", "SpringView", "Press and hold each one, then let go.", [
  section("System button"),
  nd("button", { title: "Continue" }),
  section("Elastic Button"),
  nd("elastic-button", { title: "Reserve a table", icon: "arrow.right" }),
  nd("elastic-button", { title: "Bouncier", icon: "sparkles", style: "block:sky" }),
  caption("The spring is .spring(response:dampingFraction:). Lower damping, more bounce."),
]);

const dragDial = demo("Drag a Dial", "DialView", "Drag around the dial. Go slowly to feel each tick.", [flex(), row({}, [flex(), nd("timer-dial", {}), flex()]), flex()], { props: { scrolls: false } });

const scrub = demo("Scrub to Set", "ScrubView", "Slide a finger across each one.", [
  section("Stepper"),
  nd("scrub-stepper", { label: "Guests", value: 4 }),
  section("Rating"),
  nd("rating-scrub", {}),
  section("Chart"),
  nd("scrub-chart", {}),
]);

const expand = demo("Expand in Place", "ExpandView", "Open each one. The layout makes room.", [
  group([nd("disclosure", { title: "What's included" }), nd("disclosure", { title: "Shipping and returns" })]),
  nd("expandable-text", {}),
  nd("flip-card", {}),
]);

const loadingToSuccess = demo("Loading to Success", "LoadingView", "Tap the button, then tap the icon.", [
  nd("commit-button", { title: "Save changes", successTitle: "Saved" }),
  row({ spacing: 16 }, [nd("status-morph", { state: "success", captions: true }), flex()]),
]);

const haptics = demo("Haptics", "HapticsView", "Each moment has its own feedback. Watch where it fires.", [
  section("Impact · a switch"),
  group([nd("toggle", { label: "Airplane mode", isOn: false })]),
  section("Selection · each step"),
  nd("scrub-stepper", { label: "Volume", value: 5 }),
  section("Success · a commit"),
  nd("hold-to-confirm", { title: "Hold to confirm", icon: "checkmark", committedTitle: "Done" }),
]);

const menus = demo("Menus", "MenusView", "Open each menu, then choose or tap away.", [
  row({}, [headline("Project"), flex(), nd("menu", {})]),
  group([nd("picker", { label: "Sort by", options: "Newest, Oldest, Name" })]),
  nd("glass-action-menu", {}),
]);

const streamingText = demo("Streaming Text", "StreamingView", "Watch it arrive. Tap the reply to stream it again.", [nd("thinking-state", { presentation: "dots", text: "Thinking" }), nd("streaming-reply", {})], { look: "neon" });

const paging = demo("Paging Carousels", "PagingView", "Swipe the pages, then scroll the depth carousel.", [nd("page-carousel", { titles: "Snap, One page, At a time", art: "bloom", height: 260 }), nd("depth-carousel", {})]);

const tabSwitching = app({
  name: "Tab Bar",
  shell: "tabs",
  screens: (l) => [
    { key: "a", name: "ListenView", props: { title: "Listen" }, tab: { title: "Listen", icon: "headphones" }, children: [body("Open a playlist, switch tabs, then come back. It's still open."), group([nd("row", { icon: "music.note", iconColor: "pink", title: "Morning focus", link: l.to("detail") }), nd("row", { icon: "music.note", iconColor: "purple", title: "Late night", link: l.to("detail") })])] },
    { key: "detail", name: "PlaylistView", props: { title: "Morning focus" }, children: [nd("image", { art: "dusk", aspect: "1:1", symbol: "music.note" }), body("12 songs · 48 minutes")] },
    { key: "b", name: "BrowseView", props: { title: "Browse" }, tab: { title: "Browse", icon: "square.grid.2x2" }, children: [nd("image", { art: "citrus", aspect: "16:9", title: "New this week" }), nd("image", { art: "ocean", aspect: "16:9", title: "Calm" })] },
    { key: "c", name: "SearchTabView", props: { title: "Search" }, tab: { title: "Search", icon: "magnifyingglass" }, children: [nd("search-field", { placeholder: "Artists, songs, podcasts" })] },
  ],
});

const toasts = demo("Toasts", "ToastsView", "Trigger a toast. Let it go, or swipe it away.", [nd("toast", {}), footnote("A toast never blocks the screen. It says something happened and gets out of the way.")]);

const stretchyHeader = app({
  name: "Trailhead",
  screens: () => [
    {
      key: "trail", name: "TrailView", props: { scrolls: false, padding: 0, spacing: 0 },
      children: [
        nd("stretch-header", {}, [
          body("A granite staircase beside two waterfalls, with mist that reaches the trail in spring."),
          group([
            nd("row", { icon: "figure.walk", iconColor: "green", title: "Distance", value: "5.4 mi", accessory: "none" }),
            nd("row", { icon: "arrow.up.right", iconColor: "orange", title: "Elevation", value: "1,000 ft", accessory: "none" }),
            nd("row", { icon: "clock", iconColor: "blue", title: "Time", value: "3.5 h", accessory: "none" }),
          ]),
          nd("expandable-text", { text: "Start early: by mid-morning the Mist Trail fills up and the steps stay wet. Bring a rain layer, and turn around at Vernal Fall if the rock is slick." }),
        ]),
      ],
    },
  ],
});

export const builds: Record<string, CatalogBuilder> = {
  "stretchy-header": stretchyHeader,
  "swipe-cards": swipeCards, "swipe-actions": swipeActions, "hold-to-confirm": holdToConfirm, "pull-to-refresh": pullToRefresh,
  sheets, "push-navigation": pushNavigation, "spring-press": springPress, "drag-dial": dragDial, scrub, expand,
  "loading-to-success": loadingToSuccess, haptics, menus, "streaming-text": streamingText, paging, "tab-switching": tabSwitching, toasts,
};
