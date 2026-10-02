// The split-bills remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in split-bills.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "split-bills", title: "Split Bills", category: "Finance",
    summary: "A group's shared expenses, who owes whom and the group's photos as tabs, an offline notice over expenses waiting to sync, a sheet to split a new one with its receipts and a currency picker inside it.",
    description: "A shared expenses app in six screens, in the Swift Pieces look, in light and dark. Expenses, balances and photos are peers behind a floating dock, each with a designed header whose + opens the add sheet: the weekend's total rolling in over expenses you swipe, what you're owed with settling up asked once in a sheet and who paid as house-colour blocks, and the weekend's photos as a collage over a grid you hold and drag across to pick a run of them. A sync row leads to expenses kept on the phone while offline, under a notice that says so once: the app's inline error state. Adding an expense is a sheet with the amount first, receipts in a tray that loads each one, the payer on a chip rail and parts you scrub; its currency is a push inside the sheet with a live conversion. Signal red marks the primary action; actions are pills, cards 24, tiles 16. Built from Screen Header, Odometer, Swipe Action Row, Confirm Sheet, Color Block List, Photo Mosaic, Drag Select Grid, Attachment Tray, Amount Field, Form Field, Filter Rail, Scrub Stepper, Commit Button, Search Field and Live Stat.",
    try: ["Swipe an expense to archive or flag it", "Switch to Balances in the dock and settle up", "In Photos, hold a photo and drag across the grid", "Open the sync row to see what waits offline", "Tap +, add a receipt, then scrub the parts", "Open Currency and pick one"],
    interactions: ["tabs", "push", "sheet", "type", "tap", "hold", "drag", "select", "swipe", "scrub", "press", "loading", "spring", "haptic"],
    components: ["screen-header", "odometer", "swipe-action-row", "confirm-sheet", "color-block-list", "photo-mosaic", "drag-select-grid", "attachment-tray", "amount-field", "form-field", "filter-rail", "scrub-stepper", "commit-button", "search-field", "live-stat"],
    keywords: ["swiftui split bills", "swiftui expenses", "swiftui photo multi select", "swiftui offline state", "swiftui receipt attachments", "swiftui currency picker"],
    steps: [
      { title: "Expenses", transition: "start" },
      { title: "Balances", transition: "tab" },
      { title: "Photos", transition: "tab" },
      { title: "Offline", transition: "push" },
      { title: "New expense", transition: "sheet", note: ".sheet(isPresented:) with a form" },
      { title: "Currency", transition: "push" },
    ],
  },
  moves: [
    ["Each tab opens with the group's header and a + for the add sheet; the total rolls in large and centred on a card.", "Expenses are rows you swipe, grouped by day with the day's total as quiet meta."],
    ["Where you stand rolls in centred, with settling up asked once in a sheet right under it.", "Who paid reads as house-colour blocks, one per person."],
    ["The weekend opens as a collage of solid blocks; under it every photo sits in one grid that scrolls on its own.", "Hold a photo, then drag sideways to paint a run of them, back to unpaint; Select and Done sit on the grid."],
    ["Offline is said once, by a notice at the top, so the list under it stays calm.", "The expenses waiting on this iPhone sit apart from what's already shared."],
    ["The amount comes first, big; receipts ride in a tray that loads each one, the payer is a chip rail, parts are steppers you tap, hold or scrub.", "Adding shows loading, then a check, in place."],
    ["Currency is a push inside the sheet with its own back; the converted amount rolls in with the day's move, and a pick returns to the expense."],
  ],
};
