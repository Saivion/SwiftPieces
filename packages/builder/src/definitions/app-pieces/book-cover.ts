// A typographic book cover drawn from a title, shared by the book pieces (Book Row, Cover Shelf):
// a coloured ground, the title set large in stacked capitals, a rule and the author small at the
// foot. The palette is picked from the title, so the same book always gets the same cover. A cover
// swings open into place when it appears (from 0.95 with a fade, after `delay`, so a shelf can
// stagger them); a plain fade under reduced motion.

export type CoverStyle = { ground: string; ink: string; accent: string; serif: boolean };

/** The SwiftPieces sweep and house blocks, all in the system face. */
const COVERS: CoverStyle[] = [
  { ground: "#FF0000", ink: "#FFFFFF", accent: "#141416", serif: false },
  { ground: "#1C1C1F", ink: "#FFFFFF", accent: "#FF0000", serif: false },
  { ground: "#4D8DFF", ink: "#FFFFFF", accent: "#FFD976", serif: false },
  { ground: "#FFD976", ink: "#141416", accent: "#FF0000", serif: false },
  { ground: "#FF7A3C", ink: "#141416", accent: "#FFFFFF", serif: false },
  { ground: "#E9D5B3", ink: "#141416", accent: "#4D8DFF", serif: false },
  { ground: "#FF8FB8", ink: "#141416", accent: "#141416", serif: false },
  { ground: "#CDB8FF", ink: "#141416", accent: "#FF0000", serif: false },
  { ground: "#A9DCB7", ink: "#141416", accent: "#141416", serif: false },
  { ground: "#9CC2FF", ink: "#141416", accent: "#FF7A3C", serif: false },
];

export function coverStyle(title: string, palette = -1): CoverStyle {
  if (palette >= 0) return COVERS[palette % COVERS.length];
  let h = 7;
  for (const c of title) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

/** The title's type size on a cover of a width: large, but small enough that the longest word fits a line. */
export function coverTitleSize(title: string, width: number): number {
  const longest = Math.max(1, ...title.split(/\s+/).map((w) => w.length));
  return Math.min(width * 0.17, (width * 0.82) / (longest * 0.74));
}

/** Swift for the cover view. Declared once per file under the key "BookCover". */
export const BOOK_COVER_SWIFT = [
  "private struct BookCover: View {",
  "    let title: String",
  "    var author = \"\"",
  "    var ground: Color = .indigo",
  "    var ink: Color = .yellow",
  "    var accent: Color = .pink",
  "    var serif = false",
  "    var width: CGFloat = 96",
  "    var delay: Double = 0",
  "    @State private var shown = false",
  "    @Environment(\\.accessibilityReduceMotion) private var reduceMotion",
  "",
  "    private var titleSize: CGFloat {",
  "        let longest = CGFloat(title.split(separator: \" \").map(\\.count).max() ?? 1)",
  "        return min(width * 0.17, width * 0.82 / (max(longest, 1) * 0.74))",
  "    }",
  "",
  "    var body: some View {",
  "        VStack(alignment: .leading, spacing: width * 0.04) {",
  "            Text(title.uppercased())",
  "                .font(.system(size: titleSize, weight: serif ? .regular : .black, design: serif ? .serif : .default))",
  "                .foregroundStyle(ink)",
  "                .lineLimit(4)",
  "                .minimumScaleFactor(0.5)",
  "            Rectangle().fill(accent).frame(width: width * 0.35, height: max(width * 0.03, 2))",
  "            Spacer(minLength: 0)",
  "            Text(author.uppercased())",
  "                .font(.system(size: width * 0.075, weight: .semibold))",
  "                .tracking(1)",
  "                .foregroundStyle(ink.opacity(0.85))",
  "                .lineLimit(1)",
  "        }",
  "        .padding(width * 0.09)",
  "        .frame(width: width, height: width * 1.5, alignment: .topLeading)",
  "        .background(ground)",
  "        .clipShape(.rect(cornerRadius: 3))",
  "        .shadow(color: .black.opacity(0.2), radius: 4, x: 2, y: 3)",
  "        .rotation3DEffect(.degrees(shown || reduceMotion ? 0 : -12), axis: (x: 0, y: 1, z: 0), anchor: .leading, perspective: 0.6)",
  "        .scaleEffect(shown || reduceMotion ? 1 : 0.95)",
  "        .opacity(shown ? 1 : 0)",
  "        .onAppear { withAnimation(.easeOut(duration: 0.28).delay(delay)) { shown = true } }",
  "    }",
  "}",
];

/** `BookCover(...)` arguments for a title. */
export function coverArgs(title: string, author: string, width: number, swiftHex: (h: string) => string, str: (s: string) => string, delay = 0): string {
  const c = coverStyle(title);
  return `BookCover(title: ${str(title)}, author: ${str(author)}, ground: ${swiftHex(c.ground)}, ink: ${swiftHex(c.ink)}, accent: ${swiftHex(c.accent)}, serif: ${c.serif}, width: ${width}${delay > 0 ? `, delay: ${Math.round(delay * 100) / 100}` : ""})`;
}
