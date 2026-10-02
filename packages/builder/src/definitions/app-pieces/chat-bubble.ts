// Chat Bubble: one message in a conversation, as a soft rounded bubble on the leading side (the
// other person or a helper) or the trailing side (you). It can write itself in word by word as
// it arrives; tapping it shows when it was sent.
import type { SwiftPieceDefinition } from "../../core/schema.js";
import { call } from "../../core/swift.js";
import { bool, opts, select, text } from "../shared.js";
import { swiftHex } from "./data-kit.js";

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "");

export const BUBBLES: Record<string, { label: string; fill: string; ink: string; light?: [fill: string, ink: string] }> = {
  ink: { label: "Ink (the surface, light and dark)", fill: "#1C1C1F", ink: "#FFFFFF", light: ["#FFFFFF", "#141414"] },
  signal: { label: "Signal", fill: "#FF0000", ink: "#FFFFFF" },
  azure: { label: "Azure", fill: "#4D8DFF", ink: "#FFFFFF" },
  dusk: { label: "Dusk violet", fill: "#3B3452", ink: "#FFFFFF" },
  graphite: { label: "Graphite (light and dark)", fill: "#2C2C2E", ink: "#FFFFFF", light: ["#E6E4DE", "#141414"] },
  mist: { label: "Mist", fill: "#EEEEF3", ink: "#111111" },
  blue: { label: "Blue", fill: "#2F7CF6", ink: "#FFFFFF" },
  sage: { label: "Sage", fill: "#DDEBDD", ink: "#111111" },
};

const SWIFT = [
  "private struct ChatBubble: View {",
  "    let text: String",
  "    var outgoing = false",
  "    var fill: Color = .indigo",
  "    var ink: Color = .white",
  "    /// The bubble in light mode, for the fills that follow the appearance.",
  "    var lightFill: Color? = nil",
  "    var lightInk: Color? = nil",
  "    var reveal = false",
  "    var sent = \"\"",
  "    @State private var shownWords = Int.max",
  "    @State private var showsTime = false",
  "    @Environment(\\.colorScheme) private var scheme",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "    @State private var shown = false",
  "",
  "    var body: some View {",
  "        let words = text.split(separator: \" \")",
  "        let light = scheme == .light",
  "        VStack(alignment: outgoing ? .trailing : .leading, spacing: 4) {",
  "            Button {",
  "                withAnimation(.easeOut(duration: 0.2)) { showsTime.toggle() }",
  "            } label: {",
  "                Text(words.prefix(shownWords).joined(separator: \" \"))",
  "                    .font(.body)",
  "                    .multilineTextAlignment(.leading)",
  "                    .foregroundStyle(light ? (lightInk ?? ink) : ink)",
  "                    .padding(.horizontal, 16)",
  "                    .padding(.vertical, 12)",
  "                    .background(light ? (lightFill ?? fill) : fill, in: .rect(cornerRadius: 20, style: .continuous))",
  "            }",
  "            .buttonStyle(ChatBubblePress())",
  "            .scaleEffect(shown || reduceMotion ? 1 : 0.95, anchor: outgoing ? .bottomTrailing : .bottomLeading)",
  "            .opacity(shown ? 1 : 0)",
  "            if showsTime && !sent.isEmpty {",
  "                Text(sent).font(.caption2).foregroundStyle(.secondary).transition(.opacity)",
  "            }",
  "        }",
  "        .frame(maxWidth: .infinity, alignment: outgoing ? .trailing : .leading)",
  "        .padding(outgoing ? .leading : .trailing, 44)",
  "        .sensoryFeedback(.selection, trigger: showsTime)",
  "        .task {",
  "            guard !shown else { return }",
  "            withAnimation(.easeOut(duration: reduceMotion ? 0.2 : 0.28)) { shown = true }",
  "            guard reveal, !reduceMotion else { return }",
  "            shownWords = 0",
  "            for i in 1...max(words.count, 1) {",
  "                try? await Task.sleep(for: .milliseconds(70))",
  "                withAnimation(.easeOut(duration: 0.15)) { shownWords = i }",
  "            }",
  "        }",
  "    }",
  "}",
  "",
  "private struct ChatBubblePress: ButtonStyle {",
  "    func makeBody(configuration: Configuration) -> some View {",
  "        configuration.label",
  "            .scaleEffect(configuration.isPressed ? 0.97 : 1)",
  "            .animation(.easeOut(duration: configuration.isPressed ? 0.12 : 0.2), value: configuration.isPressed)",
  "    }",
  "}",
];

export const chatBubble: SwiftPieceDefinition = {
  id: "chat-bubble",
  name: "Chat Bubble",
  category: "pieces",
  description: "One message as a soft bubble on the leading (them) or trailing (you) side. It can write itself in word by word; tap to see when it was sent.",
  availability: "free",
  preview: { component: "chat-bubble", chunk: "app-pieces" },
  icon: "bubble.left",
  concepts: ["state", "async"],
  anatomy: [
    { part: "Message", props: ["text", "sent"] },
    { part: "Side", props: ["side"] },
    { part: "Bubble", props: ["fill"] },
    { part: "Motion", props: ["reveal"] },
  ],
  interactions: ["tap", "spring", "haptic"],
  variants: [
    { id: "them", label: "Incoming", props: { side: "leading", fill: "ink" } },
    { id: "you", label: "Outgoing", props: { side: "trailing", fill: "signal" } },
  ],
  states: [{ id: "typing", label: "Writing in", props: { reveal: true } }],
  properties: [
    text("text", "Message", "Morning. Tell me what's on today and I'll sort it into a plan.", { maxLength: 400 }),
    select("side", "Side", "leading", opts(["leading", "Leading (them)"], ["trailing", "Trailing (you)"])),
    select("fill", "Bubble", "ink", opts(...Object.entries(BUBBLES).map(([id, v]) => [id, v.label] as [string, string]))),
    bool("reveal", "Write in word by word", false),
    text("sent", "Sent", "8:02 AM"),
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("ChatBubble", SWIFT);
      const b = BUBBLES[s(p, "fill")] ?? BUBBLES.ink;
      return {
        lines: call("ChatBubble", [
          ["text", ctx.str(s(p, "text"))],
          s(p, "side") === "trailing" && ["outgoing", "true"],
          ["fill", swiftHex(b.fill)],
          ["ink", swiftHex(b.ink)],
          b.light && ["lightFill", swiftHex(b.light[0])],
          b.light && ["lightInk", swiftHex(b.light[1])],
          p.reveal === true && ["reveal", "true"],
          s(p, "sent").trim() && ["sent", ctx.str(s(p, "sent").trim())],
        ]),
      };
    },
  },
};
