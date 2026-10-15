// The markdown-notes remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in markdown-notes.build.ts (Pro), loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "markdown-notes", title: "Markdown Notes", category: "Productivity",
    summary: "A Markdown notes app in the SwiftPieces look: a charcoal sidebar of nested tags, notes with their pictures, a note with a table, a link and to-dos, its statistics and outline, search with the word lit up, themes and type, and locked notes.",
    description: "A writing app in seven screens, in the SwiftPieces look, light or dark; actions are pills, cards 14, chips 8, note titles are set in serif and signal red is the writing accent. The sidebar stands on a full-bleed charcoal ground in both appearances: Notes, Todo, Today, Locked, Archive and Trash with their counts, then tags on coloured tiles, nested ones hanging off a guide line under their parent, with glass buttons to search and themes. A tag pushes its notes: a pinned note first, each with its picture or first word, a serif title, two lines of preview and the date, swiping to remove, and a glass button that blooms into Note, Sketch and Photo. The note itself reads like a page: tags as chips, a serif title, a photo, a bold line, headings with their Markdown level as a quiet chip, a table of facts, a link as a rich preview, to-dos that tick and the formatting row. The info sheet swipes between statistics, the outline and the notes that link here, with export in a menu. Search lights up every match as the results settle in, with special searches as chips; themes are colour tiles you pick over live type settings; locked notes keep their titles, show their body as a shimmer and open with Face ID. Built from Tint Panel, Screen Header, List Row, Search Field, Media Row, Glass Action Menu, Tag, Image, Link Preview, Task Row, Tracking Tabs, Stat Grid, Elastic Button, Menu, Filter Rail, Text Reveal, Color Block List, Picker, Slider, Decimal Stepper, Switch, Commit Button, Skeleton Loader and Toast.",
    try: ["Open the bears tag under science", "Swipe a note in the list, then open Polar bears", "Tick a to-do, then tap the info button", "Swipe from Statistics to Outline", "Search, and watch the matches light up", "Pick a theme, then unlock the thesis draft"],
    interactions: ["push", "sheet", "tap", "swipe", "select", "drag", "toggle", "menu", "hold", "haptic", "transition"],
    components: ["tint-panel", "screen-header", "row", "search-field", "media-row", "glass-action-menu", "tag", "image", "link-preview", "task-row", "tracking-tabs", "stat-grid", "elastic-button", "menu", "filter-rail", "text-reveal", "color-block-list", "picker", "slider", "decimal-stepper", "toggle", "commit-button", "skeleton-loader", "toast"],
    keywords: ["swiftui notes app", "swiftui markdown editor", "swiftui tag sidebar", "swiftui search highlight"],
    steps: [
      { title: "Sidebar", transition: "start" },
      { title: "Notes in a tag", transition: "push" },
      { title: "A note", transition: "push" },
      { title: "Note info", transition: "sheet" },
      { title: "Search", transition: "push" },
      { title: "Themes", transition: "sheet" },
      { title: "Locked notes", transition: "push" },
    ],
  },
  moves: [
    ["The sidebar is its own dark room in both appearances, so the library and the page never blur together.", "Every tag keeps one icon and colour; nested tags hang off a thin guide line under their parent, and each shows how many notes it holds."],
    ["A note in the list is its picture or first word, a serif title and two lines of what it says, so you find it by content, not by name.", "The pinned note sits first; swiping a row takes it away, and the glass button blooms into Note, Sketch and Photo."],
    ["The note is a page, not a form: serif headings carry their Markdown level as a quiet chip, tags are red chips and the link becomes a preview card.", "A table of facts and to-dos that tick sit in the flow; the formatting row waits at the end."],
    ["Statistics, outline and backlinks are pages under one sliding block, so the sheet stays short.", "Tapping a heading in the outline goes straight back to it; export lives in a menu."],
    ["Every match lights up as the result settles in, so you see why a note was found before opening it.", "Special searches like @todo and @locked are chips, and the count says where you are among the matches."],
    ["Themes are colour tiles with their names, picked with a tap; type settings sit under a live line of the note.", "Size slides, line height steps by a tenth and Use Paper confirms in place."],
    ["Locked notes keep their titles and show their body as a soft shimmer, so you know what's there without seeing it.", "Face ID unlocks with a toast that says when it locks again."],
  ],
};
