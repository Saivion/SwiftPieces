import assert from "node:assert/strict";
import { test } from "node:test";
import { createCatalog, generateProject, generateScreen, projectLinks, str, validateProject } from "../src/index.js";
import { freeCatalogSource } from "../src/definitions/catalog/index.js";
import { assertWellFormedSwift, entryProject, registry } from "./helpers.js";

test("Swift string literals escape quotes, backslashes and newlines", () => {
  assert.equal(str('Say "hi"'), '"Say \\"hi\\""');
  assert.equal(str("a\\b"), '"a\\\\b"');
  assert.equal(str("two\nlines"), '"two\\nlines"');
  // Interpolation stays literal text: the backslash is escaped.
  assert.equal(str("\\(secret)"), '"\\\\(secret)"');
});

test("every catalog entry generates well-formed, idiomatic SwiftUI", async () => {
  const catalog = createCatalog(freeCatalogSource);
  for (const e of catalog.entries) {
    const project = entryProject(e.kind, e.slug);
    const gen = generateProject(project, registry);
    for (const f of gen.files) assertWellFormedSwift(f.content, `${e.kind}/${e.slug}/${f.path}`);
    for (const screen of gen.screens) {
      assert.match(screen.code, /^import SwiftUI\n/, e.slug);
      assert.match(screen.code, new RegExp(`struct ${screen.name}: View \\{`), e.slug);
      assert.match(screen.code, /#Preview \{\n {4}NavigationStack \{\n {8}\w+\(\)\n {4}\}\n\}/, e.slug);
      assert.doesNotMatch(screen.code, /\n\n\n/, `${e.slug}: double blank lines`);
    }
  }
});

test("the login screen reads like hand-written SwiftUI", () => {
  const project = entryProject("screens", "login");
  const code = generateScreen(project.screens[0], registry, project.screens).code;
  assert.match(code, /^import SwiftUI\nimport AuthenticationServices\n/);
  assert.match(code, / {4}@State private var email = ""\n {4}@State private var password = ""\n/);
  assert.match(code, /SecureField\("Password", text: \$password\)/);
  assert.match(code, /TextField\("you@example\.com", text: \$email\)\n\s+\.textContentType\(\.emailAddress\)/);
  // A sheet is presented from the button after its own modifiers, indented under the one-line view.
  assert.match(code, /Button\("Forgot password\?"\) \{ showResetPassword = true \}\n(\s+)\.buttonStyle\(\.borderless\)\n\1\.controlSize\(\.small\)\n\1\.sheet\(isPresented: \$showResetPassword\) \{\n\1 {4}NavigationStack \{ ResetPasswordView\(\) \}\n\1 {8}\.presentationDetents\(\[\.medium\]\)\n\1\}/);
  assert.match(code, /SignInWithAppleButton\(\.signIn\) \{ request in\n/);
  assert.match(code, /NavigationLink \{\n\s+WelcomeHomeView\(\)/);
  assert.match(code, /\n(\s+)Text\("Welcome back"\)\n\1 {4}\.font\(\.largeTitle\)\n\1 {4}\.fontWeight\(\.bold\)/);
  assert.doesNotMatch(code, /\.font\(\.body\)/, "body is the default text style");
});

test("imports and state are only emitted when used", () => {
  const project = entryProject("screens", "empty-state");
  const code = generateProject(project, registry).screens[0].code;
  assert.doesNotMatch(code, /AuthenticationServices/);
  assert.match(code, /OutcomeScreen\(/);
});

test("state names are unique and derived from labels", () => {
  const root = {
    id: "r", component: "screen", props: {},
    children: [
      { id: "a", component: "input", props: { label: "Email" } },
      { id: "b", component: "input", props: { label: "Email" } },
      { id: "c", component: "toggle", props: { label: "Push alerts" } },
    ],
  };
  const project = projectFromRoot(root);
  const code = generateScreen(project.screens[0], registry).code;
  assert.match(code, /@State private var email = ""/);
  assert.match(code, /@State private var email2 = ""/);
  assert.match(code, /@State private var pushAlerts = true/);
});

test("node line ranges point at the node's own code", () => {
  const project = entryProject("screens", "login");
  const screen = project.screens[0];
  const gen = generateScreen(screen, registry, project.screens);
  const lines = gen.code.split("\n");
  const secure = screen.root.children!.find((c) => c.props.secure === true)!;
  const [start, end] = gen.ranges[secure.id];
  const span = lines.slice(start - 1, end).join("\n");
  assert.match(span, /SecureField/);
  assert.doesNotMatch(span, /TextField\("you@example/);
  for (const [id, [a, b]] of Object.entries(gen.ranges)) assert.ok(a >= 1 && b >= a && b <= lines.length, `${id}: range in bounds`);
});

test("pieces are listed once per project, with their registry", () => {
  const project = entryProject("screens", "sign-up");
  const gen = generateProject(project, registry);
  const names = gen.pieces.map((p) => p.name).sort();
  assert.deepEqual(names, ["CommitButton", "FormField", "SecureEntry"]);
  assert.ok(gen.pieces.every((p) => p.registry === "free"));
  assert.match(gen.files[0].content, /@main\nstruct NorthwindApp: App/);
});

test("a tab app gets a TabView of its tab roots; pushed screens stay out of it", () => {
  const project = entryProject("flows", "tab-app");
  const gen = generateProject(project, registry);
  const content = gen.files.find((f) => f.path === "ContentView.swift")!.content;
  assertWellFormedSwift(content, "ContentView");
  assert.match(content, /TabView\(selection: \$tab\) \{\n\s+NavigationStack \{ HomeView\(\) \}\n\s+\.tabItem \{ Label\("Home", systemImage: "house"\) \}\n\s+\.tag\(0\)/);
  assert.match(content, /\.environment\(\\\.appTab, \$tab\)/, "screens can switch tabs through the environment");
  assert.match(content, /@Entry var appTab: Binding<Int>/);
  assert.doesNotMatch(content, /BookView/, "a pushed detail is not a tab");
  assert.match(gen.files[0].content, /ContentView\(\)/);
});

test("a tab app with the dock tab bar hides the system bar and drives tabs with the Floating Dock", () => {
  const project = { ...entryProject("flows", "tab-app"), tabBar: "dock" as const };
  const gen = generateProject(project, registry);
  const content = gen.files.find((f) => f.path === "ContentView.swift")!.content;
  assertWellFormedSwift(content, "ContentView");
  assert.match(content, /TabView\(selection: \$tab\) \{\n\s+NavigationStack \{ HomeView\(\) \}\n\s+\.tag\(0\)\n\s+\.toolbar\(\.hidden, for: \.tabBar\)/);
  assert.match(content, /FloatingDock\(items: \[\n\s+\.init\("Home", systemImage: "house"\)/);
  assert.ok(gen.pieces.some((p) => p.registry === "free" && p.name === "FloatingDock"), "the dock's source is exported");
  assert.equal(validateProject(project, registry).value.tabBar, "dock", "validation keeps the dock");
});

test("a link to another tab selects that tab instead of pushing a copy of it", () => {
  const base = entryProject("flows", "tab-app");
  const [first, second] = base.screens.filter((sc) => sc.tab);
  assert.ok(first && second, "the tab app has two tab roots");
  const project = structuredClone(base);
  const root = project.screens.find((sc) => sc.id === first.id)!.root;
  root.children = [...(root.children ?? []), { id: "go", component: "button", props: { title: "Go", link: second.id } }];
  const gen = generateProject(validateProject(project, registry).value, registry);
  const code = gen.files.find((f) => f.path === `${first.name}.swift`)!.content;
  assert.match(code, /@Environment\(\\\.appTab\) private var appTab/);
  assert.match(code, /appTab\.wrappedValue = 1/);
  assert.doesNotMatch(code, new RegExp(`NavigationLink[\\s\\S]*${second.name}\\(\\)`), "not pushed");
});

test("finishing onboarding switches the app's root on an @AppStorage flag", () => {
  const project = entryProject("flows", "onboarding");
  const gen = generateProject(project, registry);
  const app = gen.files[0].content;
  assert.match(app, /@AppStorage\("didFinishOnboarding"\) private var didFinishOnboarding = false/);
  assert.match(app, /Group \{\n\s+if didFinishOnboarding \{\n\s+NavigationStack \{\n\s+HomeView\(\)/);
  assert.match(app, /\}\n {12}\.tint\(Theme\.accent\)/, "the look applies to whichever root shows");
  const paywall = gen.screens.find((s) => s.name === "PaywallView")!.code;
  assert.match(paywall, /@AppStorage\("didFinishOnboarding"\) private var didFinishOnboarding = false/);
  assert.match(paywall, /didFinishOnboarding = true/);
  const signIn = generateProject(entryProject("flows", "sign-in"), registry).files[0].content;
  assert.match(signIn, /if isSignedIn \{/);
});

test("generation is fast enough to run on every edit", () => {
  const project = entryProject("screens", "profile");
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) generateProject(project, registry);
  const per = (performance.now() - t0) / 200;
  assert.ok(per < 5, `generation took ${per.toFixed(2)}ms per project`);
});

import { validateProject } from "../src/index.js";
function projectFromRoot(root: unknown) {
  return validateProject({ screens: [{ name: "Test", root }] }, registry).value;
}

test("links push the linked screen, go back with dismiss, and root the app in one NavigationStack", () => {
  const project = projectFromScreens([
    { id: "s1", name: "WelcomeView", root: { id: "r1", component: "screen", props: { title: "Welcome" }, children: [
      { id: "b1", component: "button", props: { title: "Get started", link: "s2" } },
      { id: "row1", component: "row", props: { title: "Settings", link: "s2" } },
      { id: "e1", component: "elastic-button", props: { title: "Next", link: "s2" } },
    ] } },
    { id: "s2", name: "SignUpView", root: { id: "r2", component: "screen", props: { title: "Sign up" }, children: [
      { id: "b2", component: "button", props: { title: "Back", link: "back", fullWidth: false } },
      { id: "b3", component: "button", props: { title: "Self", link: "s2" } },
    ] } },
  ]);
  const gen = generateProject(project, registry);
  for (const f of gen.files) assertWellFormedSwift(f.content, f.path);
  const [welcome, signUp] = gen.screens;
  assert.match(welcome.code, /NavigationLink \{\n\s+SignUpView\(\)\n\s+\} label: \{\n\s+Text\("Get started"\)/);
  assert.match(welcome.code, /\}\n\s+\.buttonStyle\(\.borderedProminent\)/);
  assert.match(welcome.code, /\.buttonStyle\(\.plain\)/, "a linked row keeps its own colors");
  assert.match(welcome.code, /\.buttonStyle\(\.elastic\(\.signal\)\)/);
  assert.doesNotMatch(welcome.code, /NavigationStack \{\n\s+ScrollView/, "screens never open their own NavigationStack");
  assert.match(welcome.code, /\.navigationTitle\("Welcome"\)/);
  assert.match(signUp.code, /@Environment\(\\\.dismiss\) private var dismiss/);
  assert.match(signUp.code, /Button\("Back"\) \{ dismiss\(\) \}/);
  assert.doesNotMatch(signUp.code, /NavigationLink/, "a link to its own screen is dropped");
  const app = gen.files.find((f) => f.path.endsWith("App.swift"))!.content;
  assert.match(app, /WindowGroup \{\n\s+NavigationStack \{\n\s+WelcomeView\(\)\n\s+\}\n\s+\}/);
});

test("projectLinks lists every live link, and validation prunes links to missing screens", () => {
  const project = projectFromScreens([
    { id: "s1", name: "AView", root: { id: "r1", component: "screen", props: {}, children: [
      { id: "b1", component: "button", props: { link: "s2" } },
      { id: "b2", component: "button", props: { link: "gone" } },
      { id: "t1", component: "row", props: { accessory: "toggle", link: "s2" } },
    ] } },
    { id: "s2", name: "BView", root: { id: "r2", component: "screen", props: {}, children: [{ id: "b3", component: "button", props: { link: "back" } }] } },
  ]);
  assert.equal(project.screens[0].root.children![1].props.link, "", "dangling link cleared on validation");
  const links = projectLinks(project, registry);
  assert.deepEqual(links.map((l) => `${l.nodeId}>${l.to}`), ["b1>s2", "b3>back"], "hidden (toggle row) links are ignored");
});

function projectFromScreens(screens: unknown[]) {
  return validateProject({ id: "p1", name: "Flow", shell: "single", screens }, registry).value;
}

test("a look becomes Theme.swift, the app root's tint and font, the screen background and the accent asset", async () => {
  const { themeFromLook } = await import("../src/index.js");
  const { exportXcodeProject } = await import("../src/export/index.js");
  const base = projectFromScreens([
    { id: "s1", name: "HomeView", root: { id: "r1", component: "screen", props: {}, children: [
      { id: "b1", component: "button", props: { title: "Go" } },
      { id: "e1", component: "elastic-button", props: { title: "Next" } },
      { id: "c1", component: "card", props: { radius: 20 } },
    ] } },
  ]);
  const project = { ...base, theme: { ...themeFromLook("neon"), appearance: "dark" as const } };
  const gen = generateProject(project, registry);
  for (const f of gen.files) assertWellFormedSwift(f.content, f.path);
  const theme = gen.files.find((f) => f.path === "Theme.swift")!.content;
  assert.match(theme, /static let accent = Color\(light: 0x0E0E10, dark: 0xD4FF3F\)/);
  const app = gen.files.find((f) => f.path.endsWith("App.swift"))!.content;
  assert.match(app, /\.tint\(Theme\.accent\)\n\s+\.fontDesign\(\.monospaced\)\n\s+\.preferredColorScheme\(\.dark\)/);
  const home = gen.screens[0].code;
  assert.match(home, /\.background\(Theme\.background\)/);
  assert.match(home, /\.foregroundStyle\(Theme\.accentInk\)/, "filled accent buttons use the look's ink");
  assert.match(home, /\.buttonStyle\(\.elastic\(\.init\(fill: Theme\.accent, ink: Theme\.accentInk\)\)\)/);
  assert.match(home, /cornerRadius: 20\)/, "standard corners keep the radius");
  const plain = generateProject(base, registry);
  assert.ok(!plain.files.some((f) => f.path === "Theme.swift"), "no look, no Theme.swift");
  const out = await exportXcodeProject(project, registry, async (p) => [{ target: `SwiftPieces/Controls/${p.name}.swift`, content: "// stub\n" }]);
  const accent = JSON.parse(out.files.find((f) => f.path.endsWith("AccentColor.colorset/Contents.json"))!.content);
  assert.equal(accent.colors.length, 2);
  assert.equal(accent.colors[1].appearances[0].value, "dark");
  const agents = out.files.find((f) => f.path.endsWith("/AGENTS.md"))!.content;
  assert.match(agents, /Look: Neon/);
  assert.match(agents, /ElasticButton/);
  assert.ok(out.files.some((f) => f.path.endsWith("/CLAUDE.md")));
});


test("a screen that draws its own top bar hides the system's, and can step out of the tab bar", () => {
  const root = {
    id: "r", component: "screen", props: { title: "", navigationBar: "hidden", tabBar: "hidden" },
    children: [{ id: "g", component: "glass-bar", props: { title: "Move Bookmark", leading: "close", leadingLink: "back", trailing: "done", trailingText: "Move" } }],
  };
  const code = generateScreen(projectFromRoot(root).screens[0], registry).code;
  assertWellFormedSwift(code, "own bars");
  assert.match(code, /\.toolbar\(\.hidden, for: \.navigationBar\)/);
  assert.match(code, /\.toolbar\(\.hidden, for: \.tabBar\)/);
  // The glass controls are the screen's own, and the bar's title sits in a ZStack on the centre line.
  assert.match(code, /ZStack \{\n\s+Text\("Move Bookmark"\)/);
  assert.equal(code.match(/private struct GlassButtonStyle/g)?.length, 1);
  // Left automatic, a screen keeps the system bars.
  const plain = generateScreen(projectFromRoot({ id: "r", component: "screen", props: { title: "Home" }, children: [] }).screens[0], registry).code;
  assert.doesNotMatch(plain, /toolbar\(\.hidden/);
});
