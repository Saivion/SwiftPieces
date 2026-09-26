import assert from "node:assert/strict";
import { test } from "node:test";
import { freeTemplates, generateProject, generateScreen, loginFromTemplates, str } from "./codegen-fixtures.js";
import { assertWellFormedSwift, projectFrom, registry } from "./helpers.js";

test("Swift string literals escape quotes, backslashes and newlines", () => {
  assert.equal(str('Say "hi"'), '"Say \\"hi\\""');
  assert.equal(str("a\\b"), '"a\\\\b"');
  assert.equal(str("two\nlines"), '"two\\nlines"');
  // Interpolation stays literal text: the backslash is escaped.
  assert.equal(str("\\(secret)"), '"\\\\(secret)"');
});

test("every free template generates well-formed, idiomatic SwiftUI", () => {
  for (const t of freeTemplates) {
    const project = projectFrom(t);
    const gen = generateProject(project, registry);
    for (const f of gen.files) assertWellFormedSwift(f.content, `${t.id}/${f.path}`);
    const screen = gen.screens[0];
    assert.match(screen.code, new RegExp(`^import SwiftUI\\n`), t.id);
    assert.match(screen.code, new RegExp(`struct ${screen.name}: View \\{`), t.id);
    assert.match(screen.code, /#Preview \{\n {4}\w+\(\)\n\}/, t.id);
    assert.doesNotMatch(screen.code, /\n\n\n/, `${t.id}: double blank lines`);
  }
});

test("the login screen reads like hand-written SwiftUI", () => {
  const code = loginFromTemplates().code;
  assert.match(code, /^import SwiftUI\nimport AuthenticationServices\n/);
  assert.match(code, / {4}@State private var email = ""\n {4}@State private var password = ""\n/);
  assert.match(code, /SecureField\("Password", text: \$password\)/);
  assert.match(code, /TextField\("you@example\.com", text: \$email\)\n\s+\.textContentType\(\.emailAddress\)/);
  assert.match(code, /Button\("Forgot password\?"\) \{\}\n\s+\.buttonStyle\(\.borderless\)\n\s+\.controlSize\(\.small\)/);
  assert.match(code, /SignInWithAppleButton\(\.signIn\) \{ request in\n/);
  assert.match(code, /\.preferredColorScheme\(\.dark\)/);
  // Modifiers on a one-line view are indented under it; after a closing brace they align with it.
  assert.match(code, /\n(\s+)Text\("Welcome back"\)\n\1 {4}\.font\(\.largeTitle\)\n\1 {4}\.fontWeight\(\.bold\)/);
  assert.match(code, /\n(\s+)\}\n\1\.frame\(maxWidth: \.infinity, alignment: \.leading\)\n\1\.padding\(24\)/);
  assert.doesNotMatch(code, /\.font\(\.body\)/, "body is the default text style");
});

test("imports and state are only emitted when used", () => {
  const project = projectFrom(freeTemplates.find((t) => t.id === "empty-state")!);
  const code = generateProject(project, registry).screens[0].code;
  assert.doesNotMatch(code, /AuthenticationServices/);
  assert.doesNotMatch(code, /@State/);
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
  const project = projectFrom(freeTemplates.find((t) => t.id === "login")!);
  const screen = project.screens[0];
  const gen = generateScreen(screen, registry);
  const lines = gen.code.split("\n");
  const secure = screen.root.children!.find((c) => c.props.secure === true)!;
  const [start, end] = gen.ranges[secure.id];
  const span = lines.slice(start - 1, end).join("\n");
  assert.match(span, /SecureField/);
  assert.doesNotMatch(span, /TextField\("you@example/);
});

test("pieces are listed once per project, with their registry", () => {
  const project = projectFrom(freeTemplates.find((t) => t.id === "sign-up")!);
  const gen = generateProject(project, registry);
  const names = gen.pieces.map((p) => p.name).sort();
  assert.deepEqual(names, ["CommitButton", "FormField", "SecureEntry"]);
  assert.ok(gen.pieces.every((p) => p.registry === "free"));
  assert.match(gen.files[0].content, /@main\nstruct SignUpApp: App/);
});

test("multi-screen tab projects get a TabView root", () => {
  const login = projectFrom(freeTemplates.find((t) => t.id === "login")!).screens[0];
  const settings = projectFrom(freeTemplates.find((t) => t.id === "settings")!).screens[0];
  const gen = generateProject({ v: 1, id: "p", name: "Demo", shell: "tabs", updatedAt: 0, screens: [login, settings] }, registry);
  const content = gen.files.find((f) => f.path === "ContentView.swift")!.content;
  assertWellFormedSwift(content, "ContentView");
  assert.match(content, /TabView \{\n\s+LoginView\(\)\n\s+\.tabItem/);
  assert.match(gen.files[0].content, /ContentView\(\)/);
});

test("generation is fast enough to run on every edit", () => {
  const project = projectFrom(freeTemplates.find((t) => t.id === "profile")!);
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) generateProject(project, registry);
  const per = (performance.now() - t0) / 200;
  assert.ok(per < 5, `generation took ${per.toFixed(2)}ms per project`);
});

import { validateProject } from "../src/index.js";
function projectFromRoot(root: unknown) {
  return validateProject({ screens: [{ name: "Test", root }] }, registry).value;
}
