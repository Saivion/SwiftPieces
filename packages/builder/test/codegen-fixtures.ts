import { freeTemplates, generateProject, generateScreen, str } from "../src/index.js";
import { projectFrom, registry } from "./helpers.js";

export { freeTemplates, generateProject, generateScreen, str };

export function loginFromTemplates() {
  const project = projectFrom(freeTemplates.find((t) => t.id === "login")!);
  return generateScreen(project.screens[0], registry);
}
