import { join, relative } from "node:path";
import { CONFIG_REGISTRIES, findConfig, writeConfig } from "../config.js";
import { assertRegistryUrl, type FetchPolicy } from "../registry.js";
import { detectXcodeProject } from "../xcode.js";
import { mkdirInside, resolveInside } from "../safe-path.js";

export async function init(opts: { registry?: string; proRegistry?: string; dir?: string; minIOS?: string; force?: boolean; allowHttpLocalhost?: boolean }) {
  const cwd = process.cwd();
  const existing = findConfig(cwd);
  if (existing && !opts.force) {
    console.log(`Already initialized: ${existing.path} (use --force to rewrite)`);
    return;
  }

  const project = detectXcodeProject(cwd);
  const requested = opts.dir ?? (project?.sourceDir ? relative(cwd, join(project.sourceDir, "SwiftPieces")) : "SwiftPieces");
  const policy: FetchPolicy = { allowHttpLocalhost: opts.allowHttpLocalhost };
  const free = (opts.registry ?? CONFIG_REGISTRIES.free).toString();
  const pro = (opts.proRegistry ?? CONFIG_REGISTRIES.pro).toString();
  assertRegistryUrl(free, policy);
  assertRegistryUrl(pro, policy);
  const directory = relative(cwd, resolveInside(cwd, requested));
  mkdirInside(cwd, resolveInside(cwd, directory));
  const path = writeConfig(cwd, {
    directory,
    minIOSVersion: opts.minIOS ?? "17.0",
    registries: { free, pro },
  });

  console.log(`Created ${relative(cwd, path)}`);
  console.log(`Pieces will be written to ./${directory}/`);

  if (!project) {
    console.log("\nNo Xcode project in this folder, so pieces go to ./" + directory + "/ right here.");
    console.log("To have them appear in your app automatically, run the command from the folder that contains your .xcodeproj,");
    console.log("or drag this " + directory + " folder into your app in Xcode once.");
  } else if (!project.usesSynchronizedGroups) {
    console.log(`\n${project.appName}.xcodeproj does not use Xcode 16 synchronized folders.`);
    console.log("Add the SwiftPieces folder to your target once in Xcode (File → Add Files…), or convert the group with File → Convert to Folder.");
  } else if (!project.sourceDir) {
    console.log(`\nCould not find the ${project.appName}/ source folder. Add ./${directory} to your target once in Xcode; new files then sync automatically.`);
  } else {
    console.log(`\n${project.appName}.xcodeproj uses synchronized folders: files added to ./${directory} appear in the target with no project edits.`);
  }
}
