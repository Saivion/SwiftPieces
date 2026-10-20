import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { add, requirementLines } from "../src/commands/add.js";
import { init } from "../src/commands/init.js";
import { PathEscapeError, resolveInside, writeInside } from "../src/safe-path.js";
import { assertRegistryUrl, fetchItem, OFFICIAL_PRO_ORIGIN, RegistryError, sendsLicenseKey, whoami } from "../src/registry.js";
import { writeKit } from "../src/kit.js";

const envKeys = ["SWIFTPIECES_REGISTRY", "SWIFTPIECES_PRO_REGISTRY", "SWIFTPIECES_LICENSE_KEY"] as const;
const savedEnv = new Map<string, string | undefined>();
let cwd = "";

before(() => {
  cwd = process.cwd();
  for (const key of envKeys) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

after(() => {
  process.chdir(cwd);
  for (const key of envKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

let cwdChain: Promise<void> = Promise.resolve();

/** `add` and `init` read process.cwd(), so tests that change it take turns. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = cwdChain.then(fn, fn);
  cwdChain = run.then(() => undefined, () => undefined);
  return run;
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "swiftpieces-cli-"));
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    name: "Widget",
    minIOSVersion: "17.0",
    files: [{ target: "SwiftPieces/Widget.swift", content: "import SwiftUI\nstruct Widget: View { var body: some View { EmptyView() } }\n" }],
    ...overrides,
  };
}

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const seen: { url: string; license: string | undefined }[] = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url ?? "", license: typeof req.headers["x-license-key"] === "string" ? req.headers["x-license-key"] : undefined });
    handler(req, res);
  });
  return new Promise<{ origin: string; seen: typeof seen; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        seen,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

describe("path containment", () => {
  it("writes a normal file inside the destination", () => {
    const root = tempDir();
    const written = writeInside(root, "Cards/Widget.swift", "hello");
    assert.equal(written, join(root, "Cards/Widget.swift"));
    assert.equal(readFileSync(written, "utf8"), "hello");
    rmSync(root, { recursive: true, force: true });
  });

  it("rejects .. and writes nothing outside", () => {
    const root = tempDir();
    const outside = join(root, "outside.txt");
    assert.throws(() => writeInside(join(root, "SwiftPieces"), "../../outside.txt", "nope"), PathEscapeError);
    assert.equal(lstatOrNull(outside), null);
    rmSync(root, { recursive: true, force: true });
  });

  it("rejects an absolute path", () => {
    const root = tempDir();
    assert.throws(() => resolveInside(root, "/etc/passwd"), PathEscapeError);
    assert.throws(() => writeInside(root, "/tmp/swiftpieces-absolute-escape.txt", "nope"), PathEscapeError);
    rmSync(root, { recursive: true, force: true });
  });

  it("rejects a symlink that points outside the destination", () => {
    const root = tempDir();
    const dest = join(root, "SwiftPieces");
    const outside = tempDir();
    mkdirSync(dest);
    symlinkSync(outside, join(dest, "link"));
    assert.throws(() => writeInside(dest, "link/pwned.txt", "nope"), PathEscapeError);
    assert.equal(lstatOrNull(join(outside, "pwned.txt")), null);
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("rejects a symlink file and does not follow it", () => {
    const root = tempDir();
    const outside = tempDir();
    const target = join(outside, "secret.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, "Widget.swift"));
    assert.throws(() => writeInside(root, "Widget.swift", "replaced"), PathEscapeError);
    assert.equal(readFileSync(target, "utf8"), "keep");
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("keeps a Build Kit file inside the skills directory", () => {
    const root = tempDir();
    const skills = join(root, "skills");
    mkdirSync(skills);
    assert.throws(() => writeKit(kit("x"), [skills], root, {}), PathEscapeError);
    const ok = writeKit({ ...kit("swift-pieces"), files: [{ path: "swift-pieces/SKILL.md", content: "# skill\n" }] }, [skills], root, {});
    assert.equal(readFileSync(join(skills, "swift-pieces/SKILL.md"), "utf8"), "# skill\n");
    assert.equal(ok.written.length, 1);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("registry policy", () => {
  it("requires https and allows loopback http only behind the dev flag", () => {
    assert.equal(assertRegistryUrl("https://swiftpieces.com/r").origin, "https://swiftpieces.com");
    assert.throws(() => assertRegistryUrl("http://evil.example/r"), /https/);
    assert.throws(() => assertRegistryUrl("http://127.0.0.1:9/r"), /allow-http-localhost/);
    assert.equal(assertRegistryUrl("http://127.0.0.1:9/r", { allowHttpLocalhost: true }).hostname, "127.0.0.1");
    assert.equal(assertRegistryUrl("http://localhost:9/r", { allowHttpLocalhost: true }).hostname, "localhost");
    assert.equal(assertRegistryUrl("http://[::1]:9/r", { allowHttpLocalhost: true }).hostname, "[::1]");
    assert.throws(() => assertRegistryUrl("http://localhost.evil.example/r", { allowHttpLocalhost: true }), /https/);
    assert.throws(() => assertRegistryUrl("file:///tmp/registry"), /https/);
  });

  it("sends the license key only to the official Pro origin unless trusted", () => {
    const official = new URL(`${OFFICIAL_PRO_ORIGIN}/r/Widget.json`);
    assert.equal(sendsLicenseKey(official, {}), true);
    assert.equal(sendsLicenseKey(new URL("https://swiftpieces.com/r/Widget.json"), {}), false);
    assert.equal(sendsLicenseKey(new URL("https://pro.swiftpieces.com.evil.example/r/Widget.json"), {}), false);
    assert.equal(sendsLicenseKey(new URL("http://pro.swiftpieces.com/r/Widget.json"), {}), false);
    assert.equal(sendsLicenseKey(new URL("https://evil.example/r/Widget.json"), {}), false);
    assert.equal(sendsLicenseKey(new URL("https://evil.example/r/Widget.json"), { trustRegistry: true }), true);
  });

  it("says a Pro item needs a license when the Pro registry withholds its files", async () => {
    // Free has no such item; Pro answers 200 with public metadata, `entitled: false` and no files, as it does for
    // any screen, template or block without Pro.
    const server = await listen((req, res) => {
      if (req.url?.startsWith("/r/")) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      res.end(JSON.stringify({ name: "InviteFriendsBlock", type: "block", availability: "pro", entitled: false }));
    });
    try {
      const registries = { free: `${server.origin}/r`, pro: `${server.origin}/pro` };
      await assert.rejects(fetchItem(registries, "InviteFriendsBlock", undefined, { allowHttpLocalhost: true }), (err: RegistryError) => {
        assert.equal(err.status, 401);
        assert.match(err.message, /is a Pro piece\. Run `npx swiftpieces login/);
        return true;
      });
      await assert.rejects(fetchItem(registries, "InviteFriendsBlock", "sp_live_test", { allowHttpLocalhost: true, trustRegistry: true }), (err: RegistryError) => {
        assert.equal(err.status, 403);
        assert.match(err.message, /does not include Pro access/);
        return true;
      });
    } finally {
      await server.close();
    }
  });

  it("never follows a redirect with the license key on it", async () => {
    const server = await listen((req, res) => {
      if (req.url?.startsWith("/elsewhere")) {
        res.end(JSON.stringify({ name: "InviteFriendsBlock", type: "block", availability: "pro", entitled: true, files: [] }));
        return;
      }
      res.statusCode = 302;
      res.setHeader("location", "/elsewhere");
      res.end();
    });
    try {
      const registries = { free: `${server.origin}/r`, pro: `${server.origin}/pro` };
      await assert.rejects(fetchItem(registries, "InviteFriendsBlock", "sp_live_test", { allowHttpLocalhost: true, trustRegistry: true }), (err: RegistryError) => {
        assert.match(err.message, /answered with a redirect/);
        return true;
      });
      assert.ok(!server.seen.some((r) => r.url.startsWith("/elsewhere")), "the key followed the redirect");
    } finally {
      await server.close();
    }
  });
});

describe("add", () => {
  it("writes a valid piece and refuses one that fails the schema", async () => exclusive(async () => {
    const project = tempDir();
    const server = await listen((req, res) => {
      const name = req.url?.includes("Bad") ? "Bad" : "Widget";
      const body = name === "Bad"
        ? { name: "Bad", files: [{ target: "SwiftPieces/Bad.swift", content: 12 }] }
        : item();
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    });
    try {
      process.chdir(project);
      writeFileSync(join(project, "swiftpieces.json"), JSON.stringify({
        directory: "SwiftPieces",
        minIOSVersion: "17.0",
        registries: { free: `${server.origin}/r`, pro: `${server.origin}/pro` },
      }));
      await add(["Widget"], { allowHttpLocalhost: true });
      assert.match(readFileSync(join(project, "SwiftPieces/Widget.swift"), "utf8"), /import SwiftUI/);
      process.exitCode = 0;
      await add(["Bad"], { allowHttpLocalhost: true });
      assert.equal(process.exitCode, 1);
      assert.equal(lstatOrNull(join(project, "SwiftPieces/Bad.swift")), null);
    } finally {
      process.exitCode = 0;
      process.chdir(cwd);
      await server.close();
      rmSync(project, { recursive: true, force: true });
    }
  }));

  it("does not write a piece whose target escapes the directory", async () => exclusive(async () => {
    const project = tempDir();
    const server = await listen((_req, res) => {
      res.end(JSON.stringify(item({ files: [{ target: "SwiftPieces/../../escaped.swift", content: "nope" }] })));
    });
    try {
      process.chdir(project);
      writeFileSync(join(project, "swiftpieces.json"), JSON.stringify({
        directory: "SwiftPieces",
        minIOSVersion: "17.0",
        registries: { free: `${server.origin}/r`, pro: `${server.origin}/pro` },
      }));
      process.exitCode = 0;
      await add(["Widget"], { allowHttpLocalhost: true });
      assert.equal(process.exitCode, 1);
      assert.equal(lstatOrNull(join(project, "escaped.swift")), null);
      assert.equal(lstatOrNull(join(project, "..", "escaped.swift")), null);
    } finally {
      process.exitCode = 0;
      process.chdir(cwd);
      await server.close();
      rmSync(project, { recursive: true, force: true });
    }
  }));

  it("does not send the license key to a local registry unless --trust-registry is set", async () => exclusive(async () => {
    const project = tempDir();
    process.env.SWIFTPIECES_LICENSE_KEY = "sp_live_test";
    const server = await listen((_req, res) => {
      res.end(JSON.stringify(item()));
    });
    try {
      process.chdir(project);
      writeFileSync(join(project, "swiftpieces.json"), JSON.stringify({
        directory: "SwiftPieces",
        minIOSVersion: "17.0",
        registries: { free: `${server.origin}/r`, pro: `${server.origin}/pro` },
      }));
      await add(["Widget"], { allowHttpLocalhost: true, overwrite: true });
      assert.equal(server.seen.at(-1)?.license, undefined);
      await add(["Widget"], { allowHttpLocalhost: true, trustRegistry: true, overwrite: true });
      assert.equal(server.seen.at(-1)?.license, "sp_live_test");
    } finally {
      delete process.env.SWIFTPIECES_LICENSE_KEY;
      process.chdir(cwd);
      await server.close();
      rmSync(project, { recursive: true, force: true });
    }
  }));

  it("refuses a non-https registry configured in swiftpieces.json", async () => exclusive(async () => {
    const project = tempDir();
    process.chdir(project);
    try {
      writeFileSync(join(project, "swiftpieces.json"), JSON.stringify({
        directory: "SwiftPieces",
        minIOSVersion: "17.0",
        registries: { free: "http://evil.example/r", pro: "https://pro.swiftpieces.com/r" },
      }));
      process.exitCode = 0;
      await add(["Widget"], {});
      assert.equal(process.exitCode, 1);
      assert.equal(lstatOrNull(join(project, "SwiftPieces/Widget.swift")), null);
    } finally {
      process.exitCode = 0;
      process.chdir(cwd);
      rmSync(project, { recursive: true, force: true });
    }
  }));

  it("installs a Pro item's Pro dependencies with it, once each", async () => exclusive(async () => {
    const project = tempDir();
    const pro = (name: string, dependencies: string[] = []) => ({ ...item({ name, files: [{ target: `SwiftPieces/${name}.swift`, content: `import SwiftUI\n// ${name}\n` }] }), dependencies });
    const server = await listen((req, res) => {
      const url = req.url ?? "";
      // The free registry has none of these; the Pro registry answers by id or name, as getPublicItem does.
      if (url.startsWith("/r/")) { res.statusCode = 404; res.end("Not found"); return; }
      const body = url.includes("SignInBlock") || url.includes("sign-in") ? pro("SignInBlock", ["design-system", "design-system"])
        : url.includes("design-system") || url.includes("DesignSystem") ? pro("DesignSystem")
        : url.includes("CheckoutBlock") ? pro("CheckoutBlock", ["design-system"])
        : null;
      if (!body) { res.statusCode = 404; res.end("Not found"); return; }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    });
    try {
      process.chdir(project);
      writeFileSync(join(project, "swiftpieces.json"), JSON.stringify({
        directory: "SwiftPieces",
        minIOSVersion: "17.0",
        registries: { free: `${server.origin}/r`, pro: `${server.origin}/pro` },
      }));
      process.exitCode = 0;
      await add(["SignInBlock", "CheckoutBlock"], { allowHttpLocalhost: true });
      assert.equal(process.exitCode, 0);
      for (const name of ["SignInBlock", "CheckoutBlock", "DesignSystem"]) {
        assert.match(readFileSync(join(project, `SwiftPieces/${name}.swift`), "utf8"), new RegExp(`// ${name}`));
      }
      assert.equal(server.seen.filter((s) => s.url.startsWith("/pro/design-system")).length, 1);
    } finally {
      process.exitCode = 0;
      process.chdir(cwd);
      await server.close();
      rmSync(project, { recursive: true, force: true });
    }
  }));

  it("prints Info.plist requirements", () => {
    assert.deepEqual(requirementLines([{
      name: "MotionCard",
      requiredCapabilities: [],
      infoPlist: { NSMotionUsageDescription: "Tilts the card with the device." },
      spmDependencies: [],
    }]), ['MotionCard: add Info.plist NSMotionUsageDescription = "Tilts the card with the device."']);
  });
});

describe("init", () => {
  it("refuses a directory that leaves the project", async () => exclusive(async () => {
    const project = tempDir();
    process.chdir(project);
    try {
      await assert.rejects(() => init({ dir: "../outside", force: true }), PathEscapeError);
      assert.equal(lstatOrNull(join(project, "swiftpieces.json")), null);
    } finally {
      process.chdir(cwd);
      rmSync(project, { recursive: true, force: true });
    }
  }));
});

describe("whoami", () => {
  it("does not send the key to a non-official registry", async () => {
    const server = await listen((_req, res) => {
      res.end(JSON.stringify({ access: "pro", licenseId: "lic" }));
    });
    try {
      await assert.rejects(() => whoami(`${server.origin}/r`, "sp_live_test", { allowHttpLocalhost: true }), /trust-registry/);
      assert.equal(server.seen.length, 0);
      const who = await whoami(`${server.origin}/r`, "sp_live_test", { allowHttpLocalhost: true, trustRegistry: true });
      assert.equal(who?.access, "pro");
      assert.equal(server.seen[0]?.license, "sp_live_test");
    } finally {
      await server.close();
    }
  });

  it("would send the key to the official Pro origin", () => {
    assert.equal(sendsLicenseKey(new URL(`${OFFICIAL_PRO_ORIGIN}/api/license/verify`), {}), true);
  });
});

function lstatOrNull(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function kit(id: string) {
  return {
    id,
    kind: "tool",
    title: "Tool",
    skillName: id,
    uses: [],
    availability: "free" as const,
    files: [{ path: "../../escaped.md", content: "nope" }],
  };
}
