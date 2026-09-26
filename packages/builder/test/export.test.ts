import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { freeTemplates } from "../src/index.js";
import { crc32, exportSwiftFiles, exportXcodeProject, registryResolver, zip } from "../src/export/index.js";
import { projectFrom, registry } from "./helpers.js";

const fakeSource = async (p: { name: string }) => [{ target: `SwiftPieces/Things/${p.name}.swift`, content: `// ${p.name}\n` }];

function listZip(bytes: Uint8Array): string[] {
  const dir = mkdtempSync(join(tmpdir(), "spb-"));
  const file = join(dir, "out.zip");
  writeFileSync(file, bytes);
  // `unzip -t` verifies every entry's CRC.
  execFileSync("unzip", ["-tq", file]);
  execFileSync("unzip", ["-q", file, "-d", join(dir, "x")]);
  return execFileSync("find", [".", "-type", "f"], { cwd: join(dir, "x") }).toString().trim().split("\n").map((l) => l.slice(2)).sort();
}

test("crc32 matches the reference value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("zip archives open with the system unzip", () => {
  const files = listZip(zip([{ path: "a.txt", content: "hello" }, { path: "dir/é.swift", content: "let x = 1\n" }]));
  assert.deepEqual(files, ["a.txt", "dir/é.swift"]);
});

test("Xcode project export contains a complete, openable project", async () => {
  const project = projectFrom(freeTemplates.find((t) => t.id === "sign-up")!);
  const result = await exportXcodeProject(project, registry, fakeSource);
  assert.deepEqual(result.missing, []);
  const files = listZip(result.archive);
  for (const f of [
    "SignUp/SignUp.xcodeproj/project.pbxproj",
    "SignUp/SignUp.xcodeproj/project.xcworkspace/contents.xcworkspacedata",
    "SignUp/SignUp/SignUpApp.swift",
    "SignUp/SignUp/SignUpView.swift",
    "SignUp/SignUp/SwiftPieces/Things/FormField.swift",
    "SignUp/SignUp/SwiftPieces/Things/SecureEntry.swift",
    "SignUp/SignUp/SwiftPieces/Things/CommitButton.swift",
    "SignUp/SignUp/Assets.xcassets/Contents.json",
    "SignUp/SignUp/Assets.xcassets/AppIcon.appiconset/Contents.json",
    "SignUp/swiftpieces.json",
    "SignUp/README.md",
  ]) assert.ok(files.includes(f), `missing ${f}`);
  const pbx = result.files.find((f) => f.path.endsWith("project.pbxproj"))!.content;
  assert.match(pbx, /objectVersion = 77;/);
  assert.match(pbx, /isa = PBXFileSystemSynchronizedRootGroup;\n\t+path = SignUp;/);
  assert.match(pbx, /PRODUCT_BUNDLE_IDENTIFIER = com\.example\.SignUp;/);
  assert.match(pbx, /IPHONEOS_DEPLOYMENT_TARGET = 17\.0;/);
  const opens = (pbx.match(/\{/g) ?? []).length;
  assert.equal(opens, (pbx.match(/\}/g) ?? []).length, "pbxproj braces balance");
  const ids = pbx.match(/\b[0-9A-F]{24}\b/g)!;
  assert.ok(new Set(ids).size >= 14, "distinct object ids");
  const config = JSON.parse(result.files.find((f) => f.path.endsWith("swiftpieces.json"))!.content);
  assert.equal(config.directory, "SignUp/SwiftPieces");
});

test("a failed source fetch never breaks the export; the README says what to run", async () => {
  const project = projectFrom(freeTemplates.find((t) => t.id === "sign-up")!);
  const result = await exportXcodeProject(project, registry, async (p) => {
    if (p.name === "SecureEntry") throw new Error("offline");
    return fakeSource(p);
  });
  assert.deepEqual(result.missing.map((m) => m.name), ["SecureEntry"]);
  const readme = result.files.find((f) => f.path.endsWith("README.md"))!.content;
  assert.match(readme, /npx swiftpieces add SecureEntry/);
});

test("Sign in with Apple adds the capability note", async () => {
  const project = projectFrom(freeTemplates.find((t) => t.id === "login")!);
  const result = await exportXcodeProject(project, registry, fakeSource);
  assert.match(result.files.find((f) => f.path.endsWith("README.md"))!.content, /Sign in with Apple/);
});

test("Swift files export is flat and complete", async () => {
  const project = projectFrom(freeTemplates.find((t) => t.id === "onboarding")!);
  const { archive } = await exportSwiftFiles(project, registry, fakeSource);
  const files = listZip(archive);
  assert.deepEqual(files, ["Welcome/SwiftPieces/Things/ElasticButton.swift", "Welcome/SwiftPieces/Things/TextReveal.swift", "Welcome/WelcomeApp.swift", "Welcome/WelcomeView.swift"]);
});

test("the registry resolver reads files and shaders, follows dependencies and caches", async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    const name = url.split("/").pop()!.replace(".json", "");
    const body = name === "screen-a"
      ? { entitled: true, files: [{ target: "SwiftPieces/Screens/A.swift", content: "a" }], dependencies: ["design-system"] }
      : name === "design-system"
        ? { entitled: true, files: [{ target: "SwiftPieces/DesignSystem/DS.swift", content: "ds" }] }
        : name === "Silk"
          ? { files: [{ target: "SwiftPieces/Backgrounds/Silk.swift", content: "s" }], shaders: [{ target: "SwiftPieces/Backgrounds/Silk.metal", content: "m" }] }
          : { entitled: false };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    const resolve = registryResolver({ free: "https://free/r", pro: "https://pro/r" });
    assert.deepEqual((await resolve({ registry: "pro", name: "screen-a" })).map((f) => f.target), ["SwiftPieces/Screens/A.swift", "SwiftPieces/DesignSystem/DS.swift"]);
    assert.deepEqual((await resolve({ registry: "free", name: "Silk" })).map((f) => f.target), ["SwiftPieces/Backgrounds/Silk.swift", "SwiftPieces/Backgrounds/Silk.metal"]);
    await resolve({ registry: "pro", name: "screen-a" });
    assert.equal(calls.filter((c) => c.endsWith("screen-a.json")).length, 1, "cached");
    await assert.rejects(resolve({ registry: "pro", name: "locked" }), /not entitled/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

void readFileSync;
