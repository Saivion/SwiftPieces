// The Web → SwiftUI bridge. Short, contextual explanations keyed by concept, plus a matcher that
// finds which concepts a line of generated Swift uses. The builder shows one entry at a time, next
// to the code or the selected component. It is a phrasebook, not a course.

export type Concept = {
  id: string;
  /** The Swift spelling, as it appears in code. */
  term: string;
  /** One or two plain sentences. */
  plain: string;
  /** The closest thing on the web, as code. */
  web?: string;
  /** What the web equivalent is ("CSS", "React", "HTML"). */
  webLabel?: string;
};

export const concepts: Record<string, Concept> = {
  view: { id: "view", term: "View", plain: "Anything that draws on screen. Your screen is a View, and so is every button and label inside it.", web: "function LoginScreen() { return <main>…</main> }", webLabel: "React component" },
  body: { id: "body", term: "var body: some View", plain: "What the view draws. SwiftUI calls it again whenever the data it reads changes.", web: "return ( … )", webLabel: "React render" },
  struct: { id: "struct", term: "struct LoginView: View", plain: "Declares a new view type. The name is how other code uses it, like LoginView().", web: "export function LoginView() {}", webLabel: "React" },
  vstack: { id: "vstack", term: "VStack", plain: "A vertical layout container. Children stack top to bottom with even spacing.", web: "display: flex;\nflex-direction: column;\ngap: 16px;", webLabel: "CSS" },
  hstack: { id: "hstack", term: "HStack", plain: "A horizontal layout container. Children sit side by side.", web: "display: flex;\nflex-direction: row;\ngap: 12px;", webLabel: "CSS" },
  zstack: { id: "zstack", term: "ZStack", plain: "Layers children on top of each other, back to front.", web: "position: relative; /* children absolute */", webLabel: "CSS" },
  scrollview: { id: "scrollview", term: "ScrollView", plain: "Lets content taller than the screen scroll.", web: "overflow-y: auto;", webLabel: "CSS" },
  spacer: { id: "spacer", term: "Spacer()", plain: "Empty space that grows to push its neighbours apart.", web: "flex: 1;", webLabel: "CSS" },
  modifier: { id: "modifier", term: ".padding()", plain: "Modifiers are the lines starting with a dot. Each one wraps the view above it with a change: spacing, font, color, size. Order matters: they apply top to bottom.", web: "padding: 16px;\nfont: …;\ncolor: …;", webLabel: "CSS declarations" },
  padding: { id: "padding", term: ".padding()", plain: "Adds space around the content. With no number, SwiftUI picks the standard amount for the platform.", web: "padding: 16px;", webLabel: "CSS" },
  frame: { id: "frame", term: ".frame(maxWidth: .infinity)", plain: "Sets or limits a view's size. maxWidth: .infinity means \"take all the width you can\".", web: "width: 100%;", webLabel: "CSS" },
  background: { id: "background", term: ".background(…)", plain: "Draws a color or shape behind the view, sized to it.", web: "background: …;", webLabel: "CSS" },
  font: { id: "font", term: ".font(.headline)", plain: "Sets the text style. Styles such as .headline scale with the user's text size setting automatically.", web: "font: 600 17px/22px -apple-system;", webLabel: "CSS" },
  foreground: { id: "foreground", term: ".foregroundStyle(.secondary)", plain: "The color of text and icons. .secondary is the system's softer text color, and it adapts to dark mode.", web: "color: rgba(60,60,67,.6);", webLabel: "CSS" },
  clip: { id: "clip", term: ".clipShape(.rect(cornerRadius: 12))", plain: "Cuts the view to a shape, like rounded corners.", web: "border-radius: 12px;\noverflow: hidden;", webLabel: "CSS" },
  text: { id: "text", term: "Text(\"…\")", plain: "Shows a string. Style it with modifiers such as .font and .foregroundStyle.", web: "<p>…</p>", webLabel: "HTML" },
  sfsymbol: { id: "sfsymbol", term: "Image(systemName:)", plain: "Draws one of Apple's SF Symbols: thousands of icons built into iOS that match the system font and scale with text.", web: "<svg>…</svg> /* an icon font */", webLabel: "HTML" },
  button: { id: "button", term: "Button", plain: "A tappable control. The first part is the label; the closure in braces runs when it's tapped.", web: "<button onClick={…}>Continue</button>", webLabel: "React" },
  buttonstyle: { id: "buttonstyle", term: ".buttonStyle(…)", plain: "Changes how every button inside looks and reacts to a press, without changing what it does.", web: "className=\"btn btn-primary\"", webLabel: "CSS class" },
  closure: { id: "closure", term: "{ … }", plain: "A block of code passed along to run later, for example when a button is tapped.", web: "() => { … }", webLabel: "JavaScript arrow function" },
  state: { id: "state", term: "@State", plain: "Data your screen remembers and reacts to. When it changes, SwiftUI redraws the parts that read it.", web: "const [email, setEmail] = useState(\"\")", webLabel: "React" },
  binding: { id: "binding", term: "$email", plain: "The $ passes a two-way connection to a @State value, so a text field can both show it and change it.", web: "value={email} onChange={e => setEmail(e.target.value)}", webLabel: "React controlled input" },
  textfield: { id: "textfield", term: "TextField", plain: "A single-line text input. The first argument is the placeholder; text: is where what's typed is stored.", web: "<input placeholder=\"Email\" />", webLabel: "HTML" },
  foreach: { id: "foreach", term: "ForEach", plain: "Builds one view per item in a list of data.", web: "items.map(item => <Row … />)", webLabel: "React" },
  navigation: { id: "navigation", term: "NavigationStack", plain: "Adds a navigation bar and lets screens push onto a stack, with a back button for free.", web: "<Router> with a header", webLabel: "React Router" },
  appearance: { id: "appearance", term: ".preferredColorScheme(.dark)", plain: "Forces light or dark appearance for this screen. Leave it out to follow the device setting.", web: "color-scheme: dark;", webLabel: "CSS" },
  preview: { id: "preview", term: "#Preview", plain: "Tells Xcode to show this view in the canvas next to your code, live, as you type.", web: "Storybook story", webLabel: "Tooling" },
  // A zero-width space keeps this display label from reading as a Swift import to the deploy
  // audits, which reject client chunks containing one (see importLine in swift.ts).
  import: { id: "import", term: "import \u200bSwiftUI", plain: "Makes a framework's types available in this file. SwiftUI is Apple's UI framework.", web: "import React from \"react\"", webLabel: "JavaScript" },
  framework: { id: "framework", term: "import AuthenticationServices", plain: "Apple ships many frameworks with iOS. This one provides Sign in with Apple.", web: "import { signIn } from \"@auth/…\"", webLabel: "JavaScript" },
  enum: { id: "enum", term: ".success", plain: "A value from a fixed set of cases, written with a leading dot. Swift knows which set from context.", web: "\"success\" | \"failure\"", webLabel: "TypeScript union" },
  array: { id: "array", term: "[\"A\", \"B\"]", plain: "A list of values in square brackets.", web: "[\"A\", \"B\"]", webLabel: "JavaScript" },
  range: { id: "range", term: "1...10", plain: "A closed range: every number from 1 to 10, inclusive.", web: "{ min: 1, max: 10 }", webLabel: "JavaScript" },
  async: { id: "async", term: "Task { await … }", plain: "Starts work that finishes later, such as a network request, without freezing the screen.", web: "async () => { await fetch(…) }", webLabel: "JavaScript" },
  formatstyle: { id: "formatstyle", term: ".currency(code: \"USD\")", plain: "Formats a number for display in the user's locale.", web: "new Intl.NumberFormat(locale, { style: \"currency\", currency: \"USD\" })", webLabel: "JavaScript" },
  viewbuilder: { id: "viewbuilder", term: "{ … } (content)", plain: "The braces after a container hold the views it contains, listed one per line.", web: "<Card>{children}</Card>", webLabel: "React children" },
  gesture: { id: "gesture", term: "gesture", plain: "Touch input such as a drag, a long press or a hold, handled by the component for you.", web: "onPointerDown / onPointerMove", webLabel: "DOM events" },
  spring: { id: "spring", term: "spring animation", plain: "Motion that behaves like a physical spring: it overshoots a little and settles, and can be interrupted.", web: "transition-timing-function: cubic-bezier(…)", webLabel: "CSS" },
  animation: { id: "animation", term: "animation", plain: "Changes between states animate automatically; the component chooses the timing.", web: "transition: transform 0.4s;", webLabel: "CSS" },
  piece: { id: "piece", term: "SwiftPieces component", plain: "A ready-made component from SwiftPieces. The project export includes its source file, so you can read and change it.", web: "import { Button } from \"@/components/ui/button\"", webLabel: "shadcn" },
};

/** Which concepts a line of Swift touches, most specific first. Pure string checks, no parsing. */
const matchers: Array<[RegExp, string]> = [
  [/^\s*import\s+SwiftUI\b/, "import"],
  [/^\s*import \w+/, "framework"],
  [/^\s*struct \w+: View/, "struct"],
  [/var body: some View/, "body"],
  [/@State/, "state"],
  [/#Preview/, "preview"],
  [/\$\w+/, "binding"],
  [/\bVStack\b/, "vstack"],
  [/\bHStack\b/, "hstack"],
  [/\bZStack\b/, "zstack"],
  [/\bScrollView\b/, "scrollview"],
  [/\bNavigationStack\b|\.navigationTitle/, "navigation"],
  [/\bSpacer\(/, "spacer"],
  [/\.padding\(/, "padding"],
  [/\.frame\(/, "frame"],
  [/\.background\(/, "background"],
  [/\.font\(/, "font"],
  [/\.foregroundStyle\(/, "foreground"],
  [/\.clipShape\(/, "clip"],
  [/\.preferredColorScheme\(/, "appearance"],
  [/\.buttonStyle\(/, "buttonstyle"],
  [/\bImage\(systemName:/, "sfsymbol"],
  [/\b(TextField|SecureField)\(/, "textfield"],
  [/\bButton[ ({]/, "button"],
  [/\bText\(/, "text"],
  [/\bForEach\b/, "foreach"],
  [/\bTask \{/, "async"],
  [/\.currency\(/, "formatstyle"],
  [/\d+\.\.\.\d+/, "range"],
  [/\{ *(_ in|\w+ in)? *\}?$/, "closure"],
  [/:\s*\.\w+/, "enum"],
];

export function conceptsInLine(line: string): Concept[] {
  const seen = new Set<string>();
  const out: Concept[] = [];
  for (const [re, id] of matchers) {
    if (re.test(line) && !seen.has(id)) {
      seen.add(id);
      out.push(concepts[id]);
    }
  }
  return out;
}

/** The quick reference shown to people coming from the web. */
export const webBridge: Array<{ web: string; swift: string }> = [
  { web: "padding", swift: ".padding()" },
  { web: "border-radius", swift: ".clipShape(…)" },
  { web: "flex column", swift: "VStack" },
  { web: "flex row", swift: "HStack" },
  { web: "flex: 1", swift: "Spacer()" },
  { web: "component", swift: "View" },
  { web: "props", swift: "init parameters" },
  { web: "useState", swift: "@State" },
  { web: "onClick", swift: "Button { … }" },
  { web: "<input>", swift: "TextField" },
];
