// Cover Shelf: a titled row of large book covers that scrolls sideways, with a Browse button, the
// way reading apps lay out recommendations. Covers swing in one after another; tapping a cover lifts
// it forward with a selection tick; Browse follows its link with a light impact.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call } from "../../core/swift.js";
import { link, number, text } from "../shared.js";
import { BOOK_COVER_SWIFT, coverArgs } from "./book-cover.js";
import { data, records, swiftHex } from "./data-kit.js";
import { linkAction } from "./nav-action.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");
const n = (p: Record<string, unknown>, k: string) => Number(p[k] ?? 0);

const SWIFT = [
  "private struct CoverShelf: View {",
  "    let title: String",
  "    var action = \"Browse\"",
  "    let covers: [BookCover]",
  "    var ink: Color = .accentColor",
  "    var browse: (() -> Void)? = nil",
  "    @State private var lifted: Int?",
  "    @State private var browsed = 0",
  "",
  "    var body: some View {",
  "        VStack(alignment: .leading, spacing: 12) {",
  "            HStack(alignment: .firstTextBaseline) {",
  "                Text(title).font(.headline).foregroundStyle(.primary)",
  "                Spacer()",
  "                if !action.isEmpty {",
  "                    Button(action) { browsed += 1; browse?() }",
  "                        .buttonStyle(.plain)",
  "                        .font(.subheadline.weight(.medium))",
  "                        .foregroundStyle(ink)",
  "                }",
  "            }",
  "            ScrollView(.horizontal, showsIndicators: false) {",
  "                HStack(spacing: 8) {",
  "                    ForEach(covers.indices, id: \\.self) { i in",
  "                        covers[i]",
  "                            .scaleEffect(lifted == i ? 1.05 : 1)",
  "                            .zIndex(lifted == i ? 1 : 0)",
  "                            .onTapGesture { withAnimation(.spring(duration: 0.3, bounce: 0.2)) { lifted = lifted == i ? nil : i } }",
  "                    }",
  "                }",
  "                .padding(.vertical, 8)",
  "                .padding(.horizontal, 4)",
  "            }",
  "        }",
  "        .sensoryFeedback(.selection, trigger: lifted)",
  "        .sensoryFeedback(.impact(weight: .light), trigger: browsed)",
  "    }",
  "}",
];

export const coverShelf: SwiftPieceDefinition = {
  id: "cover-shelf",
  name: "Cover Shelf",
  category: "pieces",
  description: "A titled row of large book covers that scrolls sideways, with a Browse button. Tap a cover to lift it forward.",
  availability: "free",
  preview: { component: "cover-shelf", chunk: "app-pieces" },
  icon: "book",
  concepts: ["state", "scrollview"],
  anatomy: [
    { part: "Header", props: ["title", "action"] },
    { part: "Covers", props: ["books", "coverWidth"] },
    { part: "Interaction", props: ["link"] },
  ],
  interactions: ["tap", "scroll", "push", "haptic"],
  variants: [
    { id: "large", label: "Large covers", props: { coverWidth: 132 } },
    { id: "small", label: "Small covers", props: { coverWidth: 90 } },
  ],
  states: [{ id: "noaction", label: "No button", props: { action: "" } }],
  properties: [
    text("title", "Title", "Picked for you"),
    text("action", "Button", "Browse"),
    data("books", "Books", "The Lamplighter's Ledger | Nell Ashby; Salt Year | Ruth Calder; Orchard at the Edge | Theo Marsh; Nine Quiet Rooms | Ines Duarte", { hint: "Title | author, separated by semicolons." }),
    number("coverWidth", "Cover width", 132, 70, 180),
    link(),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("BookCover", BOOK_COVER_SWIFT);
      ctx.declare("CoverShelf", SWIFT);
      const books = records(s(p, "books"), 10);
      const w = Math.round(n(p, "coverWidth") || 132);
      const act = linkAction(ctx, p.link);
      return {
        lines: call("CoverShelf", [
          ["title", ctx.str(s(p, "title"))],
          s(p, "action") !== "Browse" && ["action", ctx.str(s(p, "action"))],
          ["covers", `[${books.map(([t = "", a = ""], i) => coverArgs(t, a, w, swiftHex, ctx.str, Math.min(i, 8) * 0.04)).join(", ")}]`],
          act && ["browse", `{ ${act} }`],
        ]),
      };
    },
  },
};
