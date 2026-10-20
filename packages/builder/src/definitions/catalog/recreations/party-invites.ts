// The party-invites remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in party-invites.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "party-invites", title: "Party Invites", category: "Lifestyle",
    summary: "Party invites in the SwiftPieces look: your parties counting down, an event page on a plum ground with its flyer and an emoji RSVP, the activity feed with blasts and reactions, designing an invite, sharing the link, selling tickets and parties trending nearby.",
    description: "A party invite app in seven screens across two tabs on a floating dock, in the SwiftPieces look; actions are pills, cards 22, the flyer 32, emoji chips 14. Parties opens on the next one counting down on split-flap tiles, then everything you're invited to or hosting with your reply in emoji. An event stands on a plum ground with a blush glow: a square typographic flyer, the name rising in word by word, the date in rounded type, the hosts, and your RSVP as a glass pill across Going, Maybe and Can't go, over a fan of who's coming and the latest blast with its reactions. The activity feed holds the shared photo album, blasts, RSVPs and comments as bubbles with emoji chips, and a text blast you send to every guest. Designing a party is a sheet: the name, a flyer from a grid you search and filter by mood, an effect to play over the page and the day; Next goes to the share link, which previews as it will look in a chat, with past guests as chips and reminders on. Hosts sell tickets in tiers with what's sold, pause one with a switch and cash out with a confirming sheet. Explore maps what's trending nearby and marks the ones you're interested in. Built from Screen Header, Countdown Card, Filter Rail, Media Row, Elastic Button, Tint Panel, Cover Grid, Text Reveal, Avatar, Glass Segments, Fan Stack, Expandable Text, Tag, Attachment Tray, Chat Bubble, Input, Toast, Glass Bar, Form Field, Search Field, Icon Toggles, Day Picker, Commit Button, Link Preview, Token Field, Toggle, Odometer, Stat Grid, Progress, Confirm Sheet, Place Map and Reaction Toggle.",
    try: ["Open Disco in the Greenhouse from the countdown", "Slide your RSVP from Going to Maybe", "Open the activity and send a blast", "Tap + and pick a flyer and an effect", "Copy the share link, then sell tickets", "Cash out the payout", "Mark Date My Friend as interested on Explore"],
    interactions: ["tabs", "push", "sheet", "tap", "drag", "select", "toggle", "type", "press", "spring", "haptic"],
    components: ["screen-header", "countdown-card", "filter-rail", "media-row", "elastic-button", "tint-panel", "cover-grid", "text-reveal", "avatar", "glass-segments", "fan-stack", "expandable-text", "tag", "attachment-tray", "chat-bubble", "input", "toast", "glass-bar", "form-field", "search-field", "icon-toggles", "day-picker", "commit-button", "link-preview", "token-field", "toggle", "odometer", "stat-grid", "progress", "confirm-sheet", "place-map", "reaction-toggle"],
    keywords: ["swiftui party invite", "swiftui event page", "swiftui rsvp", "swiftui ticketing"],
    steps: [
      { title: "Your parties", transition: "start" },
      { title: "An event and your RSVP", transition: "push" },
      { title: "Activity and blasts", transition: "push" },
      { title: "Design an invite", transition: "sheet" },
      { title: "Share the link", transition: "push" },
      { title: "Tickets and payouts", transition: "push" },
      { title: "Explore nearby", transition: "tab" },
    ],
  },
  moves: [
    ["The next party leads as a picture card counting down on split-flap tiles; everything else is a row with your reply in emoji.", "Invites, hosting, drafts and past are chips, and throwing a party is one red pill or the header's plus."],
    ["The event is the page: a plum ground, a square flyer, the name rising in word by word and the date in rounded type.", "RSVP is a glass pill you slide between Going, Maybe and Can't go, over a fan of who's coming and the latest blast."],
    ["Photos lead in a tray anyone can add to; blasts, RSVPs and comments follow as bubbles, each with emoji chips for how people reacted.", "A blast is a box and one button, confirmed as a toast with an undo."],
    ["The sheet builds the invite top down: name, a flyer from a grid you search or filter by mood, an effect to play over the page, then the day.", "Next goes straight to sharing."],
    ["The link previews exactly as it will land in a chat, with one big copy button that confirms as a toast.", "Past guests come back as chips, reminders are one switch, and selling tickets is the next pill."],
    ["What's been earned rolls in as a counter, over three tiles for sold, checked in and promo codes.", "Each tier has its own bar and a switch to pause it; cashing out asks once in a sheet."],
    ["What's on nearby sits on a dark map, a pin per party in its category's colour.", "Each event names a friend who's interested and the count, with a star that marks you as interested too."],
  ],
};
