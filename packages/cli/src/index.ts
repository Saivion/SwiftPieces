#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./commands/init.js";
import { add } from "./commands/add.js";
import { list } from "./commands/list.js";
import { login, logout, whoami } from "./commands/auth.js";

const program = new Command();
program.name("swiftpieces").description("Add Swift Pieces to your Xcode project. https://swiftpieces.com").version("0.3.3");

program
  .command("init")
  .description("Create a SwiftPieces/ folder and swiftpieces.json in this project")
  .option("--registry <url>", "free registry base URL")
  .option("--pro-registry <url>", "Pro registry base URL")
  .option("--dir <path>", "folder to write pieces into (relative to project root)")
  .option("--min-ios <version>", "your project's minimum iOS version", "17.0")
  .option("--force", "rewrite an existing swiftpieces.json")
  .action((o) => init({ registry: o.registry, proRegistry: o.proRegistry, dir: o.dir, minIOS: o.minIos, force: o.force }));

program
  .command("add")
  .description("Fetch pieces into your SwiftPieces folder (free first, then Pro with your license), and Build Kit items (style-, brief-, recipe-, tool-, swift-pieces) into your coding agent's skills folder")
  .argument("<names...>", "piece names or ids, e.g. SwipeDeck wallet-stack style-studio")
  .option("--overwrite", "replace files that already exist")
  .option("--dry-run", "show what would be written")
  .option("--agent <agents>", "Build Kit: claude, codex, cursor or xcode, comma-separated (default: detected, else claude)")
  .option("--global", "Build Kit: install for every project instead of this one")
  .action((names, o) => add(names, { overwrite: o.overwrite, dryRun: o.dryRun, agent: o.agent, global: o.global }));

program
  .command("list")
  .description("List available pieces")
  .option("--category <name>", "filter by category")
  .option("--pro", "list the Pro registry instead of Free")
  .option("--kit", "list the Swift Pieces Pro Build Kit")
  .option("--json", "print JSON")
  .action((o) => list(o));

program.command("login").description("Store your Pro license key in ~/.swiftpieces/auth.json").argument("[key]").action((k) => login(k));
program.command("logout").description("Remove the stored license key").action(() => logout());
program.command("whoami").description("Check whether the stored license key has Swift Pieces Pro").action(() => whoami());

program.parseAsync().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
