// The budget-envelopes remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in budget-envelopes.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "budget-envelopes", title: "Budget Envelopes", category: "Finance",
    summary: "An envelope budget app in the SwiftPieces look: a rolling total over budgets as colour blocks, one budget as a panel, a keypad expense, spending by day or by note, a reset rhythm and a transfer.",
    description: "An envelope budget app in six screens, in the SwiftPieces look, light or dark. Budgets opens on a two-weight header with round transfer and new-budget buttons over a centred card where what's left rolls in above a spent bar and the one primary action, then every envelope as a colour block you swipe for edit and delete (one already over). A budget pushes in under its own title as a panel with what's left, a ring of the days to go and an accent add button, over the latest spends as swipeable rows. Spending pushes in with a month summary over swipeable pages by day, by note and an honest empty refunds page. Sheets carry their own close: a keypad expense under what's left today and this month, a reset-rhythm picker that saves in place, and a transfer from one budget block to another. Actions are pills, cards 24, tiles 16. Built from Screen Header, Odometer, Elastic Button, Color Block List, Balance Panel, Swipe Action Row, Number Pad, Stat Grid, Tracking Tabs, Text Reveal, Choice and Commit Button.",
    try: ["Swipe a budget left, then tap Groceries", "Tap the balance to see today, then swipe a spend away", "Press Add expense and type an amount on the keypad", "Open Spending and swipe to By note", "Press + in the header, pick a rhythm and Save", "Press the transfer button and move money"],
    interactions: ["tap", "press", "swipe", "drag", "push", "sheet", "select", "spring", "haptic"],
    components: ["screen-header", "odometer", "elastic-button", "color-block-list", "balance-panel", "swipe-action-row", "number-pad", "stat-grid", "tracking-tabs", "text-reveal", "choice", "commit-button"],
    keywords: ["swiftui budget app", "swiftui number pad", "swiftui envelope budget", "swiftui swipe actions"],
    steps: [
      { title: "Budgets", transition: "start" },
      { title: "Budget", transition: "push" },
      { title: "Add expense", transition: "sheet", note: ".sheet(isPresented:) with a keypad" },
      { title: "History", transition: "push" },
      { title: "Reset rhythm", transition: "sheet" },
      { title: "Transfer", transition: "sheet" },
    ],
  },
  moves: [
    ["A centred card leads: what's left rolls in large, a thin bar shows how much is spent, and the one primary action sits under it.", "Each envelope is a colour block with what's left; swipe left for edit and delete, and one already over shows it plainly."],
    ["The budget is the whole screen: tap the balance to roll between the month and today.", "A ring of the days left sits under the money, and the latest spend is a row you swipe away."],
    ["What's left today and this month sit as two cards right above the keypad, so the cost is in view.", "Digits push in cents-first with a tick each; the tick key saves with a success tap."],
    ["The month's total sits over pages by day, by note and refunds, so switching view really regroups the spends.", "Every spend is a line you swipe away; the refunds page says what will land there instead of sitting blank."],
    ["One question, rising in word by word: pick how the budget resets, each option saying when.", "Save rhythm shows loading, then a check, then closes the sheet."],
    ["From and to are the two budgets' own colour cards with an arrow between, so moving money reads as moving between cards."],
  ],
};
