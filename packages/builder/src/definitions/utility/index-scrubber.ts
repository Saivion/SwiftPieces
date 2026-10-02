// Index Scrubber: an A to Z rail beside a long sectioned list. The emitter writes a grouped list in a
// ScrollView inside a ScrollViewReader and calls `.indexScrubber(_:proxy:index:missing:)` exactly as
// registry/swift/navigation/IndexScrubber.swift declares it, with a small sample model that groups names
// by their first letter.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, indent, list, modifiers, num, str } from "../../core/swift.js";
import { number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);

export const CONTACTS =
  "Aiko Tanaka, Amara Okafor, Anders Lind, Beatriz Souza, Bram de Vries, Camille Roche, Chen Wei, Cora Whitfield, Dalia Haddad, Dmitri Volkov, Elena Petrova, Emeka Obi, Farah Siddiqui, Felix Brandt, Grace Holloway, Hana Kobayashi, Hugo Marchetti, Ines Castillo, Isla Mackenzie, Jonah Reyes, Julia Novak, Kofi Mensah, Leila Farouk, Liam Gallagher, Lucia Ferraro, Mateo Alvarez, Maya Lindqvist, Mira Sato, Nadia Rahman, Noor Aziz, Oscar Bergman, Priya Raman, Rafael Duarte, Rosa Delgado, Sofia Esposito, Soren Dahl, Tariq Nasser, Uma Iyer, Vera Lindgren, Wren Calloway, Yusuf Demir, 4th Floor Reception";
export const COUNTRIES =
  "Argentina, Australia, Austria, Belgium, Brazil, Canada, Chile, Colombia, Denmark, Egypt, Estonia, Finland, France, Germany, Ghana, Greece, Iceland, India, Ireland, Italy, Japan, Kenya, Latvia, Mexico, Morocco, Nepal, Netherlands, Norway, Peru, Portugal, Rwanda, Senegal, Spain, Sweden, Thailand, Uganda, Uruguay, Vietnam, Zambia";
export const GLOSSARY =
  "Anchor, Binding, Closure, Environment, Frame, Gesture, Haptic, Identity, Layout, Modifier, Observable, Preference, Safe area, Scene, Task, Transaction, View builder";

/** The item cap, the same in the renderer and the generated list. */
export const MAX_ITEMS = 80;

/** Names grouped by first letter, digits and symbols under "#", sorted like the generated `grouped`. */
export function groupItems(items: string[]): Array<{ title: string; names: string[] }> {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const first = item.normalize("NFD").replace(/\p{M}/gu, "").charAt(0).toUpperCase();
    const key = /\p{L}/u.test(first) ? first : "#";
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return [...map.entries()]
    .map(([title, names]) => ({ title, names: [...names].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => (a.title === "#" ? 1 : b.title === "#" ? -1 : a.title.localeCompare(b.title)));
}

export const definition: SwiftPieceDefinition = {
  id: "index-scrubber",
  name: "Index Scrubber",
  category: "pieces",
  description: "An A to Z rail beside a long list. Touch or drag it to jump to a section, with a big letter beside your finger and a tick for each new section. Letters with nothing under them are dimmed.",
  availability: "free",
  preview: { component: "index-scrubber", chunk: "pieces-utility" },
  source: { registry: "free", name: "IndexScrubber" },
  docs: "/docs/components/navigation/index-scrubber",
  icon: "list.bullet",
  concepts: ["scrollview", "foreach", "modifier", "gesture", "state"],
  interactions: ["drag", "tap", "scroll", "haptic", "transition"],
  properties: [
    text("items", "Items", CONTACTS, { hint: "One per comma. Grouped by first letter; digits and symbols go under #.", maxLength: 1200 }),
    select("index", "Index", "alphabet", opts(["alphabet", "Whole alphabet"], ["sections", "Only sections"]), { hint: "The whole alphabet dims letters without a section; only sections lists the ones you have." }),
    select("missing", "Empty letters", "dimmed", opts(["dimmed", "Dimmed"], ["hidden", "Hidden"]), { hint: "What the whole alphabet does with letters that have no section." }),
    number("height", "Height", 540, 280, 760, 10, { group: "layout", hint: "A short list collapses the rail with dots, like landscape." }),
  ],
  variants: [
    { id: "contacts", label: "Contacts", props: { items: CONTACTS, index: "alphabet", missing: "dimmed" } },
    { id: "countries", label: "Countries", props: { items: COUNTRIES, index: "alphabet", missing: "hidden" } },
    { id: "glossary", label: "Glossary", props: { items: GLOSSARY, index: "sections", missing: "dimmed" } },
  ],
  states: [
    { id: "full", label: "Full rail", props: { height: 540 } },
    { id: "collapsed", label: "Collapsed rail", props: { height: 300 } },
    { id: "empty", label: "No sections", props: { items: "" } },
  ],
  anatomy: [
    { part: "List", props: ["items", "height"] },
    { part: "Rail", props: ["index", "missing"] },
  ],
  swift: {
    imports: [],
    emit(p, ctx) {
      // A sample model: names grouped by first letter. In your app, use your own sections with ids equal to their titles.
      ctx.declare("IndexedGroup", [
        "/// A sample section model for the index scrubber: names grouped by first letter, digits and symbols under #.",
        "struct IndexedGroup: Identifiable {",
        `${INDENT}let title: String`,
        `${INDENT}let names: [String]`,
        `${INDENT}var id: String { title }`,
        "",
        `${INDENT}static func grouped(_ names: [String]) -> [IndexedGroup] {`,
        `${INDENT}${INDENT}Dictionary(grouping: names) { name -> String in`,
        `${INDENT}${INDENT}${INDENT}let first = String(name.prefix(1)).folding(options: .diacriticInsensitive, locale: nil).uppercased()`,
        `${INDENT}${INDENT}${INDENT}return first.first?.isLetter == true ? first : "#"`,
        `${INDENT}${INDENT}}`,
        `${INDENT}${INDENT}.map { IndexedGroup(title: $0.key, names: $0.value.sorted()) }`,
        `${INDENT}${INDENT}.sorted { ($0.title == "#" ? "~" : $0.title) < ($1.title == "#" ? "~" : $1.title) }`,
        `${INDENT}}`,
        "}",
      ]);
      const items = list(p.items, MAX_ITEMS);
      const sections = ctx.state("sections", "", `IndexedGroup.grouped([${items.map(str).join(", ")}])`);
      const index = s(p, "index") === "sections" ? ".sections" : ".alphabet";
      const hidden = index === ".alphabet" && s(p, "missing") === "hidden";

      const row = modifiers(["Text(name)"], ["frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)", "padding(.leading, 20)"]);
      const header = modifiers(["Text(group.title)"], [
        "font(.subheadline.weight(.bold))",
        "foregroundStyle(.secondary)",
        "frame(maxWidth: .infinity, alignment: .leading)",
        "padding(.horizontal, 20)",
        "padding(.vertical, 6)",
        "background(.background)",
      ]);
      const section = [
        "Section {",
        ...indent(call("ForEach", [[null, "group.names"], ["id", "\\.self"]], row).map((l, i) => (i === 0 ? l.replace(" {", " { name in") : l))),
        "} header: {",
        ...indent(header),
        "}",
      ];
      const stack = call("LazyVStack", [["alignment", ".leading"], ["spacing", "0"], ["pinnedViews", ".sectionHeaders"]], [
        ...call("ForEach", [[null, sections]], section).map((l, i) => (i === 0 ? l.replace(" {", " { group in") : l)),
      ]);
      const scroller = modifiers(call("ScrollView", [], stack), [
        `indexScrubber(${sections}.map(\\.title), proxy: proxy${index === ".sections" ? ", index: .sections" : ", index: .alphabet"}${hidden ? ", missing: .hidden" : ""})`,
      ]);
      const reader = call("ScrollViewReader", [], scroller).map((l, i) => (i === 0 ? l.replace(" {", " { proxy in") : l));
      return { lines: modifiers(reader, [`frame(height: ${num(n(p, "height"))})`]) };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
