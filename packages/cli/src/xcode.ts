import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export interface XcodeProject {
  projectPath: string;   // …/MyApp.xcodeproj
  appName: string;       // MyApp
  sourceDir: string | null; // …/MyApp (the app's synchronized root folder), if present
  usesSynchronizedGroups: boolean;
}

/** Finds the first .xcodeproj in `dir` and inspects its pbxproj for Xcode 16 synchronized groups. */
export function detectXcodeProject(dir: string): XcodeProject | null {
  const entries = readdirSync(dir).filter((e) => e.endsWith(".xcodeproj"));
  if (!entries.length) return null;
  const projectPath = join(dir, entries[0]);
  const appName = basename(entries[0], ".xcodeproj");
  const pbx = join(projectPath, "project.pbxproj");
  const text = existsSync(pbx) ? readFileSync(pbx, "utf8") : "";
  const usesSynchronizedGroups = text.includes("PBXFileSystemSynchronizedRootGroup");

  // The app's main synchronized folder is conventionally named after the target.
  const candidate = join(dir, appName);
  const sourceDir = existsSync(candidate) && statSync(candidate).isDirectory() ? candidate : null;
  return { projectPath, appName, sourceDir, usesSynchronizedGroups };
}
