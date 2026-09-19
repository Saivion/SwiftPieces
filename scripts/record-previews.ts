/**
 * Records a looping preview per piece from the iOS Simulator and (optionally)
 * uploads to R2. Spec: pre-rendered MP4/WebM loops are the default preview path.
 *
 *   npm run previews:record -- [--pieces GlassCard,Silk] [--duration 6] [--device "iPhone 17 Pro"]
 *                              [--skip-build] [--local] [--upload]
 *
 *   --local   copy outputs into public/previews/ and write a site-relative manifest
 *   --upload  push outputs to the MEDIA R2 bucket with `wrangler r2 object put`
 *
 * Without ffmpeg on PATH only H.264 MP4 + PNG poster are produced; with ffmpeg
 * a VP9 WebM and a downscaled MP4 are written as well.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PREVIEWS = join(ROOT, "previews");
const OUT = join(PREVIEWS, "out");
const BUNDLE_ID = "com.swiftpieces.previews";

type Args = { pieces?: string[]; duration: number; device: string; skipBuild: boolean; local: boolean; upload: boolean };
function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    pieces: get("--pieces")?.split(",").map((s) => s.trim()).filter(Boolean),
    duration: Number(get("--duration") ?? 6),
    device: get("--device") ?? "iPhone 17 Pro",
    skipBuild: a.includes("--skip-build"),
    local: a.includes("--local"),
    upload: a.includes("--upload"),
  };
}

const sh = (cmd: string, args: string[], opts: { quiet?: boolean } = {}) => {
  const r = spawnSync(cmd, args, { stdio: opts.quiet ? "pipe" : "inherit", encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr ?? ""}`);
  return r.stdout ?? "";
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

function findDevice(name: string): string {
  const json = JSON.parse(sh("xcrun", ["simctl", "list", "devices", "available", "-j"], { quiet: true }));
  const all = Object.values(json.devices as Record<string, { name: string; udid: string }[]>).flat();
  const dev = all.find((d) => d.name === name);
  if (!dev) throw new Error(`Simulator "${name}" not found`);
  return dev.udid;
}

function toSlug(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").toLowerCase();
}

async function record(udid: string, name: string, seconds: number) {
  const slug = toSlug(name);
  const raw = join(OUT, `${slug}.raw.mp4`);
  const poster = join(OUT, `${slug}.png`);

  sh("xcrun", ["simctl", "launch", "--terminate-running-process", udid, BUNDLE_ID, "-piece", name], { quiet: true });
  await sleep(1500);
  sh("xcrun", ["simctl", "io", udid, "screenshot", "--type", "png", poster], { quiet: true });

  const rec = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--codec", "h264", "--force", raw], { stdio: "ignore" });
  await sleep(seconds * 1000);
  rec.kill("SIGINT");
  await new Promise<void>((resolve) => rec.on("exit", () => resolve()));
  await sleep(500);

  const outputs: { mp4: string; webm?: string; poster: string } = { mp4: `${slug}.mp4`, poster: `${slug}.png` };
  if (hasFfmpeg) {
    // 720px-wide, faststart MP4 for Safari; VP9 WebM for everyone else. Loop-friendly, no audio.
    sh("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-movflags", "+faststart", "-an", join(OUT, `${slug}.mp4`)]);
    sh("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-vf", "scale=720:-2", "-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "0", "-an", join(OUT, `${slug}.webm`)]);
    outputs.webm = `${slug}.webm`;
  } else {
    copyFileSync(raw, join(OUT, `${slug}.mp4`));
  }
  return { slug, outputs };
}

async function main() {
  const args = parseArgs();
  mkdirSync(OUT, { recursive: true });

  const index = JSON.parse(readFileSync(join(ROOT, "registry/__registry__/index.json"), "utf8")) as { name: string }[];
  const names = args.pieces ?? index.map((i) => i.name);

  if (!args.skipBuild) {
    console.log("Building preview app…");
    sh("xcodebuild", ["-project", join(PREVIEWS, "SwiftPiecesPreviews.xcodeproj"), "-scheme", "SwiftPiecesPreviews", "-destination", `platform=iOS Simulator,name=${args.device}`, "-derivedDataPath", join(PREVIEWS, "build"), "-quiet", "build"]);
  }
  const app = join(PREVIEWS, "build/Build/Products/Debug-iphonesimulator/SwiftPiecesPreviews.app");
  if (!existsSync(app)) throw new Error("Preview app not built");

  const udid = findDevice(args.device);
  spawnSync("xcrun", ["simctl", "boot", udid], { stdio: "ignore" }); // no-op if booted
  sh("xcrun", ["simctl", "bootstatus", udid, "-b"], { quiet: true });
  spawnSync("open", ["-a", "Simulator", "--background"], { stdio: "ignore" });
  sh("xcrun", ["simctl", "install", udid, app], { quiet: true });
  if (!hasFfmpeg) console.warn("ffmpeg not found: writing H.264 MP4 + PNG only (no WebM, no downscale)");

  const manifestPath = join(PREVIEWS, "manifest.json");
  const manifest: Record<string, { mp4?: string; webm?: string; poster?: string }> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

  for (const name of names) {
    process.stdout.write(`Recording ${name}… `);
    const { slug, outputs } = await record(udid, name, args.duration);
    if (args.upload) {
      for (const f of Object.values(outputs)) {
        sh("npx", ["wrangler", "r2", "object", "put", `swiftpieces-media/previews/${f}`, "--file", join(OUT, f), "--remote"], { quiet: true });
      }
      manifest[slug] = Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, `previews/${v}`]));
    } else if (args.local) {
      const dest = join(ROOT, "public/previews");
      mkdirSync(dest, { recursive: true });
      for (const f of Object.values(outputs)) copyFileSync(join(OUT, f), join(dest, f));
      manifest[slug] = Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, `/previews/${v}`]));
    }
    console.log("done");
  }

  if (args.upload || args.local) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest written: ${manifestPath}. Run \`npm run registry:build\` to pick it up.`);
  } else {
    console.log(`Outputs in ${OUT}. Re-run with --upload (R2) or --local (public/previews) to publish.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
