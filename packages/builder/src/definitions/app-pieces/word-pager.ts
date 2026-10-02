// Word Pager: one word per full screen, paged vertically like a feed. The word set large, how it
// sounds (tap to hear it), what it means, and actions to like, save and share, in a row along the
// bottom or a rail down the side. Pages ease in as they settle (the one leaving dims and shrinks), and
// the streak's days settle in one after another (a fade under reduced motion). The "surface"
// backdrop is the theme's card fill, so the pager reads in light and dark alike.
// Saved words count toward a daily goal; an optional streak card sits on top.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, modifiers, num, str } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";
import { arrayArg, construct, rgb } from "./emit-link-action.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const I = (d: number) => INDENT.repeat(d);

/** Backdrops behind the words, top to bottom. Plain uses the screen's own ground. */
export const BACKDROPS: Record<string, string[]> = {
  ember: ["#FF7A3C", "#C2140E", "#2A0506"],
  azure: ["#4D8DFF", "#1D3E9E", "#0A1030"],
  graphite: ["#2A2A2E", "#141416", "#070708"],
  canyon: ["#C9774F", "#A3492E", "#6B2819"],
  sea: ["#9CCFD0", "#5E9FA3", "#2F6468"],
  dusk: ["#F4B8A0", "#B77A9B", "#4B3A6B"],
  night: ["#3A4150", "#232833", "#101217"],
};

export type PagerWord = { word: string; phonetic: string; meaning: string };

/** "word | phonetic | meaning; …" */
export function pagerWords(p: Props): PagerWord[] {
  const out = s(p, "words").split(";").map((w) => w.split("|").map((x) => x.trim())).filter((w) => w[0]).slice(0, 12)
    .map(([word, phonetic = "", meaning = ""]) => ({ word, phonetic, meaning }));
  return out.length ? out : [{ word: "Word", phonetic: "", meaning: "" }];
}

export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const STRUCT = (): string[] => [
  "/// One word per screen, paged vertically: the word, how it sounds, what it means, and actions.",
  "private struct WordPager: View {",
  `${I(1)}struct Word: Identifiable {`,
  `${I(2)}let id: Int`,
  `${I(2)}let word: String`,
  `${I(2)}var phonetic = ""`,
  `${I(2)}var meaning = ""`,
  `${I(1)}}`,
  `${I(1)}let words: [Word]`,
  `${I(1)}/// A gradient behind the words, or none for the screen's own background.`,
  `${I(1)}var backdrop: [Color] = []`,
  `${I(1)}/// The theme's card fill behind the words, in place of a gradient.`,
  `${I(1)}var surface = false`,
  `${I(1)}var radius: CGFloat = 28`,
  `${I(1)}var goal = 5`,
  `${I(1)}var streakTitle = ""`,
  `${I(1)}var streakDay = 0`,
  `${I(1)}var height: CGFloat = 640`,
  `${I(1)}/// The word in a serif instead of the system face.`,
  `${I(1)}var serif = false`,
  `${I(1)}/// Actions in a rail down the trailing side, with the word set leading.`,
  `${I(1)}var rail = false`,
  `${I(1)}@State private var current: Int? = 0`,
  `${I(1)}@State private var liked: Set<Int> = []`,
  `${I(1)}@State private var saved: Set<Int> = []`,
  `${I(1)}@State private var spoken = 0`,
  `${I(1)}@State private var shown = false`,
  `${I(1)}@Environment(\\.accessibilityReduceMotion) private var reduceMotion`,
  `${I(1)}private let weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]`,
  "",
  `${I(1)}var body: some View {`,
  `${I(2)}ZStack {`,
  `${I(3)}if surface {`,
  `${I(4)}Rectangle().fill(.fill.tertiary)`,
  `${I(3)}} else if !backdrop.isEmpty {`,
  `${I(4)}LinearGradient(colors: backdrop, startPoint: .top, endPoint: .bottom)`,
  `${I(3)}}`,
  `${I(3)}ScrollView(.vertical) {`,
  `${I(4)}LazyVStack(spacing: 0) {`,
  `${I(5)}ForEach(words) { word in`,
  `${I(6)}page(word)`,
  `${I(7)}.containerRelativeFrame(.vertical)`,
  `${I(7)}.scrollTransition { content, phase in`,
  `${I(8)}content`,
  `${I(9)}.opacity(phase.isIdentity || reduceMotion ? 1 : 0.4)`,
  `${I(9)}.scaleEffect(phase.isIdentity || reduceMotion ? 1 : 0.92)`,
  `${I(7)}}`,
  `${I(5)}}`,
  `${I(4)}}`,
  `${I(4)}.scrollTargetLayout()`,
  `${I(3)}}`,
  `${I(3)}.scrollTargetBehavior(.paging)`,
  `${I(3)}.scrollPosition(id: $current)`,
  `${I(3)}.scrollIndicators(.hidden)`,
  `${I(3)}VStack {`,
  `${I(4)}header`,
  `${I(4)}Spacer()`,
  `${I(4)}actions.frame(maxWidth: .infinity, alignment: rail ? .trailing : .center)`,
  `${I(3)}}`,
  `${I(3)}.padding(.top, 20).padding(.horizontal, 12).padding(.bottom, 16)`,
  `${I(2)}}`,
  `${I(2)}.foregroundStyle(backdrop.isEmpty || surface ? Color.primary : Color.white)`,
  `${I(2)}.frame(minHeight: height, maxHeight: .infinity)`,
  `${I(2)}.clipShape(.rect(cornerRadius: backdrop.isEmpty && !surface ? 0 : radius, style: .continuous))`,
  `${I(2)}.sensoryFeedback(.selection, trigger: current)`,
  `${I(2)}.sensoryFeedback(.impact(weight: .light), trigger: spoken)`,
  `${I(2)}.sensoryFeedback(.success, trigger: saved.count)`,
  `${I(2)}.onAppear { shown = true }`,
  `${I(1)}}`,
  "",
  `${I(1)}private func page(_ word: Word) -> some View {`,
  `${I(2)}VStack(alignment: rail ? .leading : .center, spacing: 12) {`,
  `${I(3)}Text(word.word).font(.system(size: 44, weight: .semibold, design: serif ? .serif : .default))`,
  `${I(3)}if !word.phonetic.isEmpty {`,
  `${I(4)}Button { spoken += 1 } label: {`,
  `${I(5)}HStack(spacing: 4) {`,
  `${I(6)}Text(word.phonetic)`,
  `${I(6)}Image(systemName: "speaker.wave.2")`,
  `${I(5)}}`,
  `${I(5)}.font(.subheadline)`,
  `${I(5)}.padding(.horizontal, 10)`,
  `${I(5)}.padding(.vertical, 4)`,
  `${I(5)}.background(.ultraThinMaterial, in: .capsule)`,
  `${I(4)}}`,
  `${I(4)}.buttonStyle(.plain)`,
  `${I(3)}}`,
  `${I(3)}Text(word.meaning).font(.subheadline)`,
  `${I(2)}}`,
  `${I(2)}.multilineTextAlignment(rail ? .leading : .center)`,
  `${I(2)}.padding(.leading, rail ? 28 : 32)`,
  `${I(2)}.padding(.trailing, rail ? 84 : 32)`,
  `${I(2)}.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: rail ? .leading : .center)`,
  `${I(1)}}`,
  "",
  `${I(1)}@ViewBuilder private var header: some View {`,
  `${I(2)}if !streakTitle.isEmpty {`,
  `${I(3)}VStack(spacing: 8) {`,
  `${I(4)}Text(streakTitle).font(.subheadline.weight(.semibold))`,
  `${I(4)}HStack(spacing: 6) {`,
  `${I(5)}Image(systemName: "flame.fill").font(.title).foregroundStyle(Color.accentColor)`,
  `${I(5)}ForEach(weekdays.indices, id: \\.self) { day in`,
  `${I(6)}VStack(spacing: 4) {`,
  `${I(7)}Text(weekdays[day]).font(.caption2.weight(day == streakDay ? .bold : .regular))`,
  `${I(7)}Circle()`,
  `${I(8)}.fill(day <= streakDay ? Color.accentColor : Color.secondary.opacity(0.2))`,
  `${I(8)}.frame(width: 24, height: 24)`,
  `${I(8)}.scaleEffect(shown || reduceMotion ? 1 : 0.95)`,
  `${I(8)}.opacity(shown ? 1 : 0)`,
  `${I(8)}.animation(.easeOut(duration: 0.28).delay(0.1 + Double(day) * 0.04), value: shown)`,
  `${I(8)}.overlay {`,
  `${I(9)}if day <= streakDay { Image(systemName: "checkmark").font(.caption2.bold()).foregroundStyle(.white) }`,
  `${I(8)}}`,
  `${I(6)}}`,
  `${I(5)}}`,
  `${I(4)}}`,
  `${I(3)}}`,
  `${I(3)}.foregroundStyle(.primary)`,
  `${I(3)}.padding(14)`,
  `${I(3)}.background(.regularMaterial, in: .rect(cornerRadius: 20))`,
  `${I(2)}} else if goal > 0 {`,
  `${I(3)}HStack(spacing: 8) {`,
  `${I(4)}Image(systemName: "bookmark")`,
  `${I(4)}Text("\\(saved.count)/\\(goal)").monospacedDigit()`,
  `${I(4)}ProgressView(value: min(Double(saved.count) / Double(goal), 1)).frame(width: 60)`,
  `${I(3)}}`,
  `${I(3)}.font(.caption)`,
  `${I(3)}.padding(.horizontal, 12)`,
  `${I(3)}.padding(.vertical, 6)`,
  `${I(3)}.background(.ultraThinMaterial, in: .capsule)`,
  `${I(2)}}`,
  `${I(1)}}`,
  "",
  `${I(1)}private var actions: some View {`,
  `${I(2)}let id = current ?? 0`,
  `${I(2)}let layout = rail ? AnyLayout(VStackLayout(spacing: 16)) : AnyLayout(HStackLayout(spacing: 24))`,
  `${I(2)}return layout {`,
  `${I(3)}ShareLink(item: words.first { $0.id == id }?.word ?? "") { Image(systemName: "square.and.arrow.up") }`,
  `${I(3)}Button { toggle(id, in: &liked) } label: { Image(systemName: liked.contains(id) ? "heart.fill" : "heart") }`,
  `${I(3)}Button { toggle(id, in: &saved) } label: { Image(systemName: saved.contains(id) ? "bookmark.fill" : "bookmark") }`,
  `${I(2)}}`,
  `${I(2)}.font(.title2)`,
  `${I(2)}.frame(minWidth: 44, minHeight: 44)`,
  `${I(2)}.buttonStyle(.plain)`,
  `${I(2)}.symbolEffect(.bounce, value: liked.count + saved.count)`,
  `${I(1)}}`,
  "",
  `${I(1)}private func toggle(_ id: Int, in set: inout Set<Int>) {`,
  `${I(2)}if set.contains(id) { set.remove(id) } else { set.insert(id) }`,
  `${I(1)}}`,
  "}",
];

export const wordPager: SwiftPieceDefinition = {
  id: "word-pager",
  name: "Word Pager",
  category: "pieces",
  description: "One word per full screen, paged vertically like a feed: the word set large, how it sounds, what it means, and actions to like, save and share. Saved words fill a daily goal.",
  availability: "free",
  preview: { component: "word-pager", chunk: "app-pieces" },
  icon: "textformat",
  concepts: ["scrollview", "foreach", "state", "gesture"],
  interactions: ["swipe", "tap", "toggle", "haptic"],
  anatomy: [
    { part: "Words", props: ["words"] },
    { part: "Backdrop", props: ["backdrop", "height"] },
    { part: "Layout", props: ["design", "actions"] },
    { part: "Goal", props: ["goal"] },
    { part: "Streak", props: ["streakTitle", "streakDay"] },
  ],
  properties: [
    text("words", "Words", "sonder | ˈsɒndər | (n.) the sense that every passer-by has a life as full as yours; laconic | ləˈkɒnɪk | (adj.) using very few words; verdant | ˈvɜːrdənt | (adj.) green with growing plants", { maxLength: 600, hint: "word | how it sounds | meaning, separated by semicolons." }),
    select("backdrop", "Backdrop", "plain", opts(["plain", "Plain"], ["surface", "Card surface"], ["ember", "Ember"], ["azure", "Azure"], ["graphite", "Graphite"], ["canyon", "Canyon"], ["sea", "Sea"], ["dusk", "Dusk"], ["night", "Night"])),
    select("design", "Word type", "default", opts(["default", "System"], ["serif", "Serif"])),
    select("actions", "Actions", "row", opts(["row", "Row along the bottom"], ["rail", "Rail down the side"])),
    number("goal", "Daily goal", 5, 0, 20, 1, { hint: "Saved words count toward it. 0 hides it." }),
    text("streakTitle", "Streak card", "", { maxLength: 50, hint: "A week's streak on top. Leave empty for none." }),
    number("streakDay", "Streak through", 0, 0, 6, 1, { when: { prop: "streakTitle", notEquals: [""] }, hint: "0 is Monday." }),
    number("height", "Height", 640, 320, 900, 1, { group: "layout", hint: "Its smallest height; it grows to fill a screen that doesn't scroll." }),
    number("radius", "Corner radius", 28, 0, 40, 1, { group: "shape", hint: "For a backdrop or the card surface." }),
  ],
  variants: [
    { id: "daily", label: "Word of the day", props: { backdrop: "plain", goal: 5 } },
    { id: "streak", label: "Streak", props: { backdrop: "ember", streakTitle: "Three days in a row", streakDay: 2, goal: 0, actions: "rail" } },
    { id: "sea", label: "Azure", props: { backdrop: "azure", goal: 3, height: 520 } },
  ],
  states: [{ id: "one", label: "One word", props: { words: "laconic | ləˈkɒnɪk | (adj.) using very few words" } }],
  swift: {
    imports: [],
    emit(p, ctx) {
      ctx.declare("WordPager", STRUCT());
      const words = pagerWords(p).map((w, i) => {
        const args = [`id: ${i}`, `word: ${str(w.word)}`, w.phonetic && `phonetic: ${str(w.phonetic)}`, w.meaning && `meaning: ${str(w.meaning)}`].filter(Boolean);
        return `.init(${args.join(", ")})`;
      });
      const backdrop = BACKDROPS[s(p, "backdrop")];
      const streak = s(p, "streakTitle").trim();
      const lines = construct("WordPager", [
        arrayArg("words", words),
        backdrop && `backdrop: [${backdrop.map(rgb).join(", ")}]`,
        s(p, "backdrop") === "surface" && "surface: true",
        p.radius !== undefined && n(p, "radius") !== 28 && `radius: ${num(n(p, "radius"))}`,
        n(p, "goal") !== 5 && `goal: ${num(n(p, "goal"))}`,
        streak && `streakTitle: ${str(streak)}`,
        streak && n(p, "streakDay") > 0 && `streakDay: ${num(n(p, "streakDay"))}`,
        n(p, "height") !== 640 && `height: ${num(n(p, "height"))}`,
        s(p, "design") === "serif" && "serif: true",
        s(p, "actions") === "rail" && "rail: true",
      ]);
      return { lines: modifiers(lines, []) };
    },
  },
};
