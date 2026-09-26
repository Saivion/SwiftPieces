// End-to-end checks for the playground (Free) and the builder (Pro), in a real browser.
//
//   FREE_URL=http://localhost:3000 PRO_URL=http://localhost:3200 node packages/builder/e2e/builder.e2e.mjs
//
// Needs Playwright (`npm i -g playwright` or PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs) and a
// Chromium it can launch (CHROMIUM_PATH). Either URL may be omitted to skip that app. The Pro run
// mocks /api/session and the builder APIs, so it needs no Clerk, D1 or model key.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const FREE = process.env.FREE_URL;
const PRO = process.env.PRO_URL;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
const perf = {};

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push(["ok", name, Date.now() - t]);
  } catch (e) {
    results.push(["FAIL", name, Date.now() - t, e.message.split("\n")[0]]);
  }
}

async function open(url, { viewport = { width: 1440, height: 900 }, reducedMotion = "no-preference", setup } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|favicon/.test(m.text()) && errors.push(m.text()));
  if (setup) await setup(page);
  await page.goto(url, { waitUntil: "networkidle" });
  return { ctx, page, errors };
}

const phoneText = (page) => page.locator(".spb-phone").innerText();
const unzipList = (buf) => {
  const dir = mkdtempSync(join(tmpdir(), "spb-e2e-"));
  const f = join(dir, "x.zip");
  writeFileSync(f, buf);
  execFileSync("unzip", ["-tq", f]);
  return execFileSync("unzip", ["-Z1", f]).toString().trim().split("\n");
};

if (FREE) {
  const url = `${FREE}/playground`;

  await step("free: beginner flow (onboarding → template → customize → code → export)", async () => {
    const { ctx, page, errors } = await open(url);
    await page.getByRole("heading", { name: "What are you building?" }).waitFor();
    await page.getByText("My first iOS app").click();
    await page.getByRole("heading", { name: "Start with a screen" }).waitFor();
    await page.getByRole("button", { name: /^Login/ }).click();
    assert.match(await phoneText(page), /Welcome back/);

    // Customize the heading: select it on the phone, change its text in the property panel.
    await page.locator(".spb-phone").getByText("Welcome back").click();
    const field = page.locator(".spb-right textarea, .spb-right input[type=text]").first();
    const t0 = Date.now();
    await field.fill("Hello again");
    await page.locator(".spb-phone").getByText("Hello again").waitFor();
    perf.propertyRoundTripMs = Date.now() - t0;

    // The code follows, and highlights the selected component.
    await page.getByRole("radio", { name: "Both" }).click();
    const code = page.locator(".spb-code-body");
    await code.getByText('Text("Hello again")').waitFor();
    assert.ok(await page.locator(".spb-code-body li.is-hl").count() > 0, "selected node highlighted in code");

    // What's this? on a line.
    await page.locator('.spb-code-body li[data-line="5"]').click();
    await page.locator(".spb-explain").waitFor();

    // Export a whole Xcode project, with the component sources fetched from /r.
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download Xcode project/ }).click()]);
    const files = unzipList(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c)));
    for (const f of ["Login/Login.xcodeproj/project.pbxproj", "Login/Login/LoginView.swift", "Login/Login/LoginApp.swift", "Login/README.md"]) assert.ok(files.includes(f), `zip has ${f}`);
    await page.getByText("What happens next").waitFor();
    perf.builder = await page.evaluate(() => window.__spBuilderPerf.summary());
    perf.heapMB = await page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576));
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await step("free: export includes SwiftPieces sources", async () => {
    const { ctx, page } = await open(`${url}?template=sign-up`);
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download Xcode project/ }).click()]);
    const files = unzipList(Buffer.concat(await (await download.createReadStream()).toArray()));
    for (const n of ["Inputs/FormField.swift", "Inputs/SecureEntry.swift", "Controls/CommitButton.swift"]) assert.ok(files.includes(`SignUp/SignUp/SwiftPieces/${n}`), `zip has ${n}`);
    await ctx.close();
  });

  await step("free: keyboard only (layers, reorder, delete, undo, add)", async () => {
    const { ctx, page } = await open(`${url}?template=settings`);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Layers" }).click();
    const tree = page.getByRole("tree", { name: "Screen layers" });
    const first = tree.getByRole("treeitem").first();
    await first.focus();
    await page.keyboard.press("ArrowDown");
    const selected = () => tree.locator('[aria-selected="true"] .spb-layer-name').innerText();
    assert.equal(await selected(), "Vertical Stack");
    const before = await tree.getByRole("treeitem").count();
    await page.keyboard.press("Alt+ArrowDown");
    await page.keyboard.press("Delete");
    assert.equal(await tree.getByRole("treeitem").count(), before - 6);
    await page.keyboard.press("Tab"); // leave the tree so the global shortcut applies
    await page.keyboard.press("Control+z");
    assert.equal(await tree.getByRole("treeitem").count(), before);
    await page.getByRole("tab", { name: "Components" }).click();
    await page.getByRole("button", { name: "Add Toggle" }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".spb-props h2").innerText(), "Toggle");
    await ctx.close();
  });

  await step("free: deep link opens with the component selected; draft survives reload", async () => {
    const { ctx, page } = await open(`${url}?component=ElasticButton`);
    assert.equal(await page.locator(".spb-props h2").innerText(), "Elastic Button");
    await page.locator(".spb-strip").waitFor(); // the non-blocking persona strip, not the modal
    await page.waitForTimeout(600); // autosave debounce
    await page.goto(url, { waitUntil: "networkidle" });
    assert.match(await phoneText(page), /Reserve table/);
    await ctx.close();
  });

  await step("free: a corrupt draft opens safely", async () => {
    const { ctx, page, errors } = await open(url, {
      setup: (p) => p.addInitScript(() => localStorage.setItem("sp:playground:draft", JSON.stringify({ screens: [{ root: { component: "screen", children: [{ component: "nope" }, { component: "text", props: { text: 7 } }] } }] }))),
    });
    await page.keyboard.press("Escape");
    assert.match(await phoneText(page), /7/);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await step("free: Pro components are visible but locked", async () => {
    const { ctx, page } = await open(url);
    await page.keyboard.press("Escape");
    const locked = page.locator(".spb-lib-item.is-locked");
    assert.ok((await locked.count()) >= 4);
    assert.match(await locked.first().getAttribute("href"), /\/builder$/);
    await ctx.close();
  });

  await step("free: phone layout, no horizontal scroll, tabs work", async () => {
    const { ctx, page } = await open(`${url}?template=profile`, { viewport: { width: 390, height: 844 } });
    await page.keyboard.press("Escape");
    for (const tab of ["Add", "Layers", "Edit", "SwiftUI", "Screen"]) {
      await page.locator(".spb-tabs").getByRole("button", { name: tab }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${tab}: ${overflow}px horizontal overflow`);
    }
    await ctx.close();
  });

  await step("free: reduced motion stops preview animation", async () => {
    const { ctx, page } = await open(`${url}?component=thinking-state`, { reducedMotion: "reduce" });
    const name = await page.locator(".spb-shimmer").first().evaluate((el) => getComputedStyle(el).animationName);
    assert.equal(name, "none");
    await ctx.close();
  });

  await step("free: marketing pages carry the entry points", async () => {
    const { ctx, page } = await open(`${FREE}/docs/components/controls/elastic-button`);
    assert.equal(await page.getByRole("link", { name: /Customize this component/ }).getAttribute("href"), "/playground?component=elastic-button");
    await page.goto(`${FREE}/components`, { waitUntil: "domcontentloaded" });
    await page.getByText("New to SwiftUI?").first().waitFor();
    await page.goto(`${FREE}/screens`, { waitUntil: "domcontentloaded" });
    assert.ok(await page.locator('a[href="/playground?template=login"]').count());
    await ctx.close();
  });
}

if (PRO) {
  const mock = (plan) => async (page) => {
    await page.route("**/api/session", (r) => r.fulfill({ json: { signedIn: plan !== "anon", pro: plan === "pro", imageUrl: null } }));
    const saved = new Map();
    await page.route("**/api/builder/projects", async (r) => {
      if (r.request().method() === "POST") {
        const id = "bp_e2etest0001";
        saved.set(id, JSON.parse(r.request().postData()).project);
        return r.fulfill({ json: { id } });
      }
      return r.fulfill({ json: { projects: [...saved].map(([id, p]) => ({ id, name: p.name, updatedAt: Date.now() })) } });
    });
    await page.route("**/api/builder/generate", (r) =>
      r.fulfill({ json: { root: { component: "screen", props: { appearance: "dark" }, children: [{ component: "text", props: { text: "Pay Mara" } }, { component: "payment-card" }, { component: "swipe-to-confirm" }] }, issues: [] } }),
    );
  };

  await step("pro: owners get Pro components, AI describe, save and multi-screen", async () => {
    const { ctx, page, errors } = await open(`${PRO}/builder`, { setup: mock("pro") });
    await page.getByText("I already know SwiftUI").click();
    await page.getByRole("button", { name: "Add Payment Card" }).click();
    assert.equal(await page.locator(".spb-props h2").innerText(), "Payment Card");
    await page.locator(".spb-phone").getByText("4242 4242 4242 4242").waitFor();

    await page.getByRole("button", { name: "Describe" }).click();
    await page.getByLabel("Describe what you want to build").fill("A screen to send money to Mara");
    await page.getByRole("button", { name: "Build it" }).click();
    await page.locator(".spb-phone").getByText("Pay Mara").waitFor();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL(/\/project\/bp_e2etest0001$/);

    await page.getByRole("button", { name: "Add a screen" }).click();
    assert.equal(await page.getByLabel("Current screen").locator("option").count(), 2);
    await page.getByLabel("How screens are presented").selectOption("tabs");
    await page.getByRole("radio", { name: "SwiftUI" }).click();
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await step("pro: visitors without Pro see locked Pro components and a sign-in path", async () => {
    const { ctx, page } = await open(`${PRO}/builder`, { setup: mock("anon") });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add Payment Card (Pro)" }).click();
    await page.getByText("Payment Card is part of SwiftPieces Pro.").waitFor();
    assert.match(await page.getByRole("link", { name: "Sign in to save" }).getAttribute("href"), /^\/sign-in\?redirect_url=/);
    await ctx.close();
  });
}

await browser.close();
for (const [status, name, ms, err] of results) console.log(`${status.padEnd(4)} ${name} (${ms}ms)${err ? `\n     ${err}` : ""}`);
console.log(JSON.stringify(perf, null, 2));
process.exitCode = results.some((r) => r[0] === "FAIL") ? 1 : 0;
