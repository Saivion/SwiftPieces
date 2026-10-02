// The Swift statement an app piece runs to follow its `link` (a row tapped, a day opened), with the
// presentation modifier it needs attached to the node: a push becomes a flag and a
// `.navigationDestination(isPresented:)`, a sheet a flag and a `.sheet`, root sets the app's flag,
// back dismisses. Null when the link is empty or dangling.
import type { EmitContext } from "../../core/schema.js";
import { INDENT } from "../../core/swift.js";

export function linkAction(ctx: EmitContext, value: unknown): string | null {
  const target = ctx.link(String(value ?? ""));
  if (!target) return null;
  if (target.kind === "back") return `${ctx.dismiss()}()`;
  if (target.kind === "root") return `${target.flag} = true`;
  if (target.kind === "tab") return target.set;
  const flag = ctx.state(`show${target.view.replace(/View$/, "")}`, "", "false");
  if (target.kind === "push") {
    ctx.attach([`.navigationDestination(isPresented: $${flag}) {`, `${INDENT}${target.view}()`, "}"]);
  } else {
    ctx.attach([`.sheet(isPresented: $${flag}) {`, `${INDENT}NavigationStack { ${target.view}() }`, "}"]);
  }
  return `${flag} = true`;
}
