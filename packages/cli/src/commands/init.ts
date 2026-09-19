import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { CONFIG_REGISTRIES, findConfig, writeConfig } from "../config.js";
import { detectXcodeProject } from "../xcode.js";

export async function init(opts: { registry?: string; proRegistry?: string; dir?: string; minIOS?: string; force?: boolean }) {
  const cwd = process.cwd();
  const existing = findConfig(cwd);
  if (existing && !opts.force) {
    console.log(`Already initialized: ${existing.path} (use --force to rewrite)`);
    return;
  }

  const project = detectXcodeProject(cwd);
  let directory = opts.dir;
  if (!directory) directory = project?.sourceDir ? relative(cwd, join(project.sourceDir, "SwiftPieces")) : "SwiftPieces";

  mkdirSync(join(cwd, directory), { recursive: true });
  const path = writeConfig(cwd, {
    directory,
    minIOSVersion: opts.minIOS ?? "17.0",
    registries: { free: opts.registry ?? CONFIG_REGISTRIES.free, pro: opts.proRegistry ?? CONFIG_REGISTRIES.pro },
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
