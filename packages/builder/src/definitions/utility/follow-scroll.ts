// Follow Scroll: a chat, log or feed that stays pinned to the newest item while the reader is at the
// bottom and counts new items into a "3 new" pill once they scroll up. The emitter calls
// `FollowScroll(_:isFollowing:alwaysFollow:newItemLabel:style:row:onReachTop:empty:)` exactly as
// registry/swift/lists/FollowScroll.swift declares it, over a sample model the screen owns as state (its
// own thread when the screen sets one), with a `.task` that keeps new items arriving so the generated
// screen follows on its own. The reader's bubbles take the accent, the Style's in a themed app.
import { house, swiftRGB } from "../../core/palette.js";
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, indent, modifiers, num } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;
const s = (p: Props, k: string) => String(p[k] ?? "");

/** Sample thread and replies, shared with the renderer so the Playground and the generated app say the same thing. */
export const FS_LINES = [
  "Boarding in ten, gate 32", "Grabbed you a flat white", "Seats 14A and 14B", "They moved us to gate 35",
  "Running, save my spot", "Made it. Window or aisle?", "Window please", "Landing at 6:40 local",
  "Taxi or train?", "Train, it's faster at rush hour", "Dinner at Tasca do Rio at 8?", "Booked for four, under Maya",
];
export const FS_REPLIES = ["Just parked, coming up", "Table by the window", "Order the clams for me", "Five minutes away", "Found it, the blue door?", "Priya is running late"];
export const FS_ENDPOINTS = ["GET /api/orders", "POST /api/cart", "GET /api/menu", "GET /api/profile", "PUT /api/orders/42", "GET /health"];
/** Whether sample message `id` is the reader's own. Arrivals from the `.task` are always someone else's. */
export const fsIsMine = (id: number) => ((id % 3) + 3) % 3 === 1;

/** The most messages a sample thread or its replies keep, and the longest a message can be. */
const FS_MAX_LINES = 24;
const FS_MAX_LENGTH = 140;

/** A thread typed as "First | Second | Third", trimmed and capped; empty or blank falls back to the given list. */
function fsList(value: unknown, fallback: string[]): string[] {
  const out = String(value ?? "").split("|").map((x) => x.trim().slice(0, FS_MAX_LENGTH)).filter(Boolean).slice(0, FS_MAX_LINES);
  return out.length ? out : fallback;
}

/** The sample thread and the replies that keep arriving: the screen's own when it has them, else the defaults. */
export type FsThread = { lines: string[]; replies: string[] };
export const fsThread = (p: Props): FsThread => ({ lines: fsList(p.thread, FS_LINES), replies: fsList(p.replies, FS_REPLIES) });

const at = (list: string[], id: number) => list[((id % list.length) + list.length) % list.length];
export const fsLine = (id: number, thread: FsThread = { lines: FS_LINES, replies: FS_REPLIES }) => at(thread.lines, id);
export const fsReply = (id: number, thread: FsThread = { lines: FS_LINES, replies: FS_REPLIES }) => at(thread.replies, id);
/** One sample log line, the same text `LogLine.sample` builds in Swift. */
export function fsLog(id: number) {
  const k = Math.abs(id);
  const t = 14 * 3600 + 2 * 60 + k * 7;
  const hh = String(Math.floor(t / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor(t / 60) % 60).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  const status = k % 9 === 4 ? 500 : 200;
  return `${hh}:${mm}:${ss}  ${FS_ENDPOINTS[k % FS_ENDPOINTS.length]}  ${status}  ${(k * 37) % 180 + 12} ms`;
}

const arr = (xs: string[]) => `[${xs.map((x) => JSON.stringify(x)).join(", ")}]`;

export const definition: SwiftPieceDefinition = {
  id: "follow-scroll",
  name: "Follow Scroll",
  category: "pieces",
  description: "A chat or live log that stays on the newest item while you're at the bottom. Scroll up to read and nothing moves: new items count into a \"3 new\" pill that jumps you back. Older items load at the top without losing your place.",
  availability: "free",
  preview: { component: "follow-scroll", chunk: "pieces-utility" },
  source: { registry: "free", name: "FollowScroll" },
  docs: "/docs/components/lists/follow-scroll",
  icon: "bubble.left",
  concepts: ["scrollview", "state", "foreach", "async", "closure", "binding"],
  interactions: ["scroll", "tap", "loading", "haptic", "transition"],
  properties: [
    select("kind", "Content", "chat", opts(["chat", "Chat thread"], ["log", "Live log"])),
    number("messages", "Items at start", 18, 0, 80, 1, { group: "state", hint: "0 starts empty and shows the empty state until the first item arrives." }),
    number("arrival", "New item every (s)", 3, 0, 10, 0.5, { group: "interaction", hint: "How often the sample feed adds an item. 0 stops new items." }),
    select("label", "Pill text", "short", opts(["short", "Short (3 new)"], ["long", "Long (3 new messages)"])),
    bool("alwaysFollowMine", "My messages always follow", true, { group: "interaction", hint: "Your own sent messages scroll into view even when you've scrolled up." }),
    bool("loadsOlder", "Load older at the top", false, { group: "interaction", hint: "Scroll near the top and three pages of older items load, keeping your place." }),
    bool("showsJumpButton", "Jump button when far up", true, { group: "interaction", hint: "A round down-arrow button when you're a screen or more above the latest with nothing new." }),
    number("height", "Height", 520, 240, 760, 10, { group: "layout" }),
    number("followThreshold", "Follow distance", 48, 16, 160, 4, { level: "advanced", group: "interaction", hint: "How close to the bottom still counts as following, in points." }),
    text("thread", "Sample messages", FS_LINES.join(" | "), {
      maxLength: 1200, level: "advanced", when: { prop: "kind", equals: ["chat"] },
      hint: "The thread it opens on, separated by |. Every third message, starting with the second, is yours.",
    }),
    text("replies", "Arriving messages", FS_REPLIES.join(" | "), {
      maxLength: 600, level: "advanced", when: { prop: "kind", equals: ["chat"] },
      hint: "What keeps arriving from the others, separated by |.",
    }),
  ],
  variants: [
    { id: "chat", label: "Chat", props: { kind: "chat", messages: 18, arrival: 3, label: "short", loadsOlder: false } },
    { id: "log", label: "Live log", props: { kind: "log", messages: 30, arrival: 1, label: "long", loadsOlder: false, alwaysFollowMine: false } },
    { id: "history", label: "With history", props: { kind: "chat", messages: 12, arrival: 4, label: "long", loadsOlder: true } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { messages: 0 } },
    { id: "few", label: "A few items", props: { messages: 3 } },
    { id: "long", label: "Long thread", props: { messages: 60 } },
  ],
  anatomy: [
    { part: "Rows", props: ["kind", "messages", "thread", "replies"] },
    { part: "Following", props: ["arrival", "alwaysFollowMine", "followThreshold"] },
    { part: "Pill", props: ["label", "showsJumpButton"] },
    { part: "History", props: ["loadsOlder"] },
    { part: "Frame", props: ["height"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      const log = s(p, "kind") === "log";
      const count = Math.max(0, Math.round(n(p, "messages")));
      const arrival = n(p, "arrival");
      const threshold = n(p, "followThreshold");
      const model = log ? "LogLine" : "ChatMessage";
      const item = log ? "line" : "message";

      if (log) {
        ctx.declare("LogLine", [
          "/// A sample log line. Swap in your own Identifiable model.",
          "struct LogLine: Identifiable {",
          `${INDENT}let id: Int`,
          `${INDENT}let text: String`,
          "",
          `${INDENT}static let endpoints = ${arr(FS_ENDPOINTS)}`,
          "",
          `${INDENT}static func sample(_ id: Int) -> LogLine {`,
          `${INDENT}${INDENT}let k = abs(id)`,
          `${INDENT}${INDENT}let t = 14 * 3600 + 2 * 60 + k * 7`,
          `${INDENT}${INDENT}let time = String(format: "%02d:%02d:%02d", t / 3600 % 24, t / 60 % 60, t % 60)`,
          `${INDENT}${INDENT}let status = k % 9 == 4 ? 500 : 200`,
          `${INDENT}${INDENT}return LogLine(id: id, text: "\\(time)  \\(endpoints[k % endpoints.count])  \\(status)  \\((k * 37) % 180 + 12) ms")`,
          `${INDENT}}`,
          "}",
        ]);
      } else {
        const thread = fsThread(p);
        ctx.declare("ChatMessage", [
          "/// A sample chat message. Swap in your own Identifiable model.",
          "struct ChatMessage: Identifiable {",
          `${INDENT}let id: Int`,
          `${INDENT}let text: String`,
          `${INDENT}let isMine: Bool`,
          "",
          `${INDENT}static let lines = ${arr(thread.lines)}`,
          `${INDENT}static let replies = ${arr(thread.replies)}`,
          "",
          `${INDENT}static func sample(_ id: Int) -> ChatMessage {`,
          `${INDENT}${INDENT}ChatMessage(id: id, text: lines[(id % lines.count + lines.count) % lines.count], isMine: (id % 3 + 3) % 3 == 1)`,
          `${INDENT}}`,
          "",
          `${INDENT}static func reply(_ id: Int) -> ChatMessage {`,
          `${INDENT}${INDENT}ChatMessage(id: id, text: replies[id % replies.count], isMine: false)`,
          `${INDENT}}`,
          "}",
        ]);
      }

      const items = ctx.state(log ? "lines" : "messages", `[${model}]`, count > 0 ? `(0..<${num(count)}).map(${model}.sample)` : "[]");

      const noun = log ? "line" : "message";
      const args = [
        items,
        !log && b(p, "alwaysFollowMine") && "alwaysFollow: \\.isMine",
        s(p, "label") === "long" && `newItemLabel: { String(AttributedString(localized: "^[\\($0) new ${noun}](inflect: true)").characters) }`,
        (!b(p, "showsJumpButton") || threshold !== 48) &&
          `style: .init(${[threshold !== 48 && `followThreshold: ${num(threshold)}`, !b(p, "showsJumpButton") && "showsJumpButton: false"].filter(Boolean).join(", ")})`,
      ].filter((x): x is string => Boolean(x));

      // The reader's own bubbles (and a log's errors) take the accent: the Style's in a themed app.
      const accent = ctx.theme ? "Theme.accent" : swiftRGB(house.signal);
      const accentInk = ctx.theme ? "Theme.accentInk" : swiftRGB(house.ink);
      const row = log
        ? modifiers([`Text(${item}.text)`], [
            "font(.system(.footnote, design: .monospaced))",
            `foregroundStyle(${item}.text.contains("  500  ") ? ${accent} : Color.primary)`,
            "frame(maxWidth: .infinity, alignment: .leading)",
          ])
        : modifiers([`Text(${item}.text)`], [
            `foregroundStyle(${item}.isMine ? ${accentInk} : Color.primary)`,
            "padding(.horizontal, 14)",
            "padding(.vertical, 10)",
            `background(${item}.isMine ? ${accent} : Color(.secondarySystemFill), in: .rect(cornerRadius: ${num(ctx.corner(18))}, style: .continuous))`,
            `frame(maxWidth: .infinity, alignment: ${item}.isMine ? .trailing : .leading)`,
          ]);

      const lines = [`FollowScroll(${args.join(", ")}) { ${item} in`, ...indent(row)];
      if (b(p, "loadsOlder")) {
        lines.push(
          "} onReachTop: {",
          ...indent([
            "// Stand-in for your API: three pages of 12 older items, then the start of history.",
            "try? await Task.sleep(for: .seconds(1))",
            `let first = ${items}.first?.id ?? 0`,
            "guard first > -36 else { return }",
            `${items}.insert(contentsOf: (first - 12..<first).map(${model}.sample), at: 0)`,
          ]),
        );
      }
      if (count === 0) {
        lines.push(
          "} empty: {",
          ...indent([`ContentUnavailableView(${log ? '"No logs yet"' : '"No messages yet"'}, systemImage: ${log ? '"text.alignleft"' : '"bubble.left.and.bubble.right"'}, description: Text(${log ? '"New lines appear here as they arrive."' : '"Say hello to start the thread."'}))`]),
        );
      }
      lines.push("}");

      const out = modifiers(lines, [`frame(height: ${num(n(p, "height"))})`]);
      if (arrival > 0) {
        out.push(
          ".task {",
          ...indent([
            "// Stand-in for a live feed: a new item every few seconds.",
            "while !Task.isCancelled {",
            `${INDENT}try? await Task.sleep(for: .milliseconds(${num(Math.round(arrival * 1000))}))`,
            `${INDENT}let next = (${items}.last?.id ?? -1) + 1`,
            `${INDENT}${items}.append(${log ? "LogLine.sample(next)" : "ChatMessage.reply(next)"})`,
            "}",
          ]),
          "}",
        );
      }
      return { lines: out };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
