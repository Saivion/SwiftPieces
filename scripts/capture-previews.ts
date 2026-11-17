/**
 * Still images of every free component's live preview, so each component page has its own image in the
 * HTML (search engines and shares see it before any JavaScript runs).
 *
 *   npm run previews:capture                                  # from production
 *   npm run previews:capture -- --base http://localhost:3000  # from a local `next start`
 *   npm run previews:capture -- FlipCard SwipeDeck            # only these pieces
 *
 * For each piece it opens the component page in a headless browser, waits for the live preview to play,
 * and screenshots the preview frame in light and in dark. It writes, under public/previews/<category>/<slug>/:
 *
 *   <slug>-light.webp   1200x900, the page's primary image (og, JSON-LD, image sitemap)
 *   <slug>-dark.webp    1200x900, shown instead in dark mode
 *   <slug>-thumb.webp   480x360, for lists (/components), so the full still keeps one home
 *   <slug>-og.jpg       1200x630 share card: the still beside the piece's name
 *
 * and lib/piece-media.json, which the site reads (lib/piece-media.ts). Pieces whose page is missing are skipped.
 * Needs Playwright with Chromium (set CHROME to a browser binary if Playwright's is not installed) and sharp.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { piecePhrase } from "../lib/piece-seo";
import type { RegistryIndexEntry } from "../lib/registry-schema";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = opt("base", "https://swiftpieces.com").replace(/\/$/, "");
const WAIT = Number(opt("wait", "2500"));
const only = new Set(args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))));
const MANIFEST = join(ROOT, "lib/piece-media.json");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Playwright is not a dependency, so its types are not here
type Browser = any;

export type PieceMedia = { light: string; dark: string; thumb: string; og: string; width: number; height: number };

const index: RegistryIndexEntry[] = JSON.parse(readFileSync(join(ROOT, "registry/__registry__/index.json"), "utf8"));
const manifest: Record<string, PieceMedia> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

const FONT = readFileSync(join(ROOT, "public/fonts", (await import("node:fs")).readdirSync(join(ROOT, "public/fonts")).find((f) => f.startsWith("allo-core"))!)).toString("base64");
const MARK = readFileSync(join(ROOT, "public/logo-mark.png")).toString("base64");

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The share card: the light still on the right, the piece's name and what it is on the left. */
function ogHtml(e: RegistryIndexEntry, still: string): string {
  const phrase = piecePhrase(e);
  const sub = phrase.toLowerCase() === e.title.toLowerCase() ? "SwiftUI component" : `SwiftUI ${phrase}`;
  return `<!doctype html><html><head><style>
  @font-face { font-family: Allo; src: url(data:font/woff2;base64,${FONT}) format("woff2"); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #f3f2ee; font-family: Allo, system-ui, sans-serif; color: #141414; display: flex; align-items: center; gap: 40px; padding: 0 44px 0 60px; }
  .text { flex: 1; display: flex; flex-direction: column; height: 520px; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 650; }
  .brand img { width: 40px; height: 40px; border-radius: 12px; }
  h1 { font-size: 64px; line-height: 1.02; font-weight: 700; letter-spacing: -0.02em; }
  p { margin-top: 18px; font-size: 28px; line-height: 1.25; color: #5d5b56; font-weight: 550; }
  .foot { font-size: 22px; color: #5d5b56; font-weight: 550; }
  .still { width: 640px; height: 480px; border-radius: 34px; overflow: hidden; background: #e9e7e1; flex: none; }
  .still img { width: 100%; height: 100%; object-fit: cover; display: block; }
  </style></head><body>
  <div class="text">
    <div class="brand"><img src="data:image/png;base64,${MARK}">SwiftPieces</div>
    <div><h1>${escapeHtml(e.title)}</h1><p>${escapeHtml(sub)}<br>for iOS ${e.minIOSVersion.replace(/\.0$/, "")}+</p></div>
    <div class="foot">Free · swiftpieces.com</div>
  </div>
  <div class="still"><img src="data:image/webp;base64,${still}"></div>
  </body></html>`;
}

async function capture(browser: Browser, e: RegistryIndexEntry) {
  const docsPath = new URL(e.docs).pathname;
  const [, , , category, slug] = docsPath.split("/");
  const dir = join(ROOT, "public/previews", category, slug);
  const rel = `/previews/${category}/${slug}/${slug}`;
  mkdirSync(dir, { recursive: true });
  const shots: Record<string, Buffer> = {};
  for (const theme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, colorScheme: theme });
    await ctx.addInitScript((t: string) => {
      try {
        localStorage.setItem("theme", t);
      } catch {}
    }, theme);
    const page = await ctx.newPage();
    const res = await page.goto(`${BASE}${docsPath}`, { waitUntil: "networkidle" });
    if (!res || res.status() !== 200) {
      await ctx.close();
      throw new Error(`${docsPath}: ${res?.status()}`);
    }
    const frame = page.locator('#preview [role=tabpanel] [class*="container-type"]').first();
    await frame.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(WAIT);
    shots[theme] = await frame.screenshot({ animations: "allow" });
    await ctx.close();
  }
  const still = (buf: Buffer, w: number, h: number, quality = 80) => sharp(buf).resize(w, h, { fit: "cover" }).webp({ quality, effort: 5 }).toBuffer();
  const light = await still(shots.light, 1200, 900);
  writeFileSync(join(dir, `${slug}-light.webp`), light);
  writeFileSync(join(dir, `${slug}-dark.webp`), await still(shots.dark, 1200, 900));
  writeFileSync(join(dir, `${slug}-thumb.webp`), await still(shots.light, 480, 360, 78));

  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(ogHtml(e, light.toString("base64")), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const og = await page.screenshot({ type: "png" });
  await ctx.close();
  writeFileSync(join(dir, `${slug}-og.jpg`), await sharp(og).jpeg({ quality: 82, mozjpeg: true }).toBuffer());

  manifest[e.name] = { light: `${rel}-light.webp`, dark: `${rel}-dark.webp`, thumb: `${rel}-thumb.webp`, og: `${rel}-og.jpg`, width: 1200, height: 900 };
}

// Playwright is not a dependency of the site: it is resolved from wherever it is installed (NODE_PATH works).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped here, for the same reason
const { chromium } = createRequire(import.meta.url)("playwright") as { chromium: { launch(o: object): Promise<Browser> } };
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ["--no-sandbox"] } : {});
const todo = index.filter((e) => !only.size || only.has(e.name));
let n = 0;
const failed: string[] = [];
const queue = [...todo];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      try {
        await capture(browser, e);
        console.log(`${++n}/${todo.length} ${e.name}`);
      } catch (error) {
        failed.push(e.name);
        console.warn(`skip ${e.name}: ${(error as Error).message}`);
      }
    }
  }),
);
await browser.close();
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + "\n");
console.log(`captured ${n}, skipped ${failed.length}${failed.length ? `: ${failed.join(", ")}` : ""}`);
