// The shorthand catalog builds are written in. A build is plain data: screens of registry
// components with only the props that differ from their defaults. It runs through validation like
// any other input, so an entry can never contain something the Playground can't render or export.
import type { CatalogBuilder } from "../../core/catalog.js";
import { themeFromLook } from "../../core/looks.js";
import type { Props, ScreenNode, Theme } from "../../core/schema.js";

/** A node. Ids are assigned when the entry is built. */
export function nd(component: string, props: Props = {}, children?: ScreenNode[]): ScreenNode {
  return { id: "", component, props, ...(children ? { children } : {}) };
}

function withIds(node: ScreenNode, newId: () => string): ScreenNode {
  return { ...node, id: newId(), ...(node.children ? { children: node.children.map((c) => withIds(c, newId)) } : {}) };
}

/** Link values by screen key: push, present as a sheet, or finish into a new root. */
export type Links = { to(key: string): string; sheet(key: string): string; root(key: string): string };

export type ScreenSpec = { key: string; name: string; props?: Record<string, Props[string] | undefined>; children: ScreenNode[]; tab?: { title: string; icon: string } };

const defined = (p: ScreenSpec["props"] = {}): Props => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Props;

/**
 * A small app: named screens, linked by key. The first screen is where it opens. `look` is a house
 * look id (core/looks.ts) or a full theme; absent, it is plain iOS.
 */
/**
 * A look as an app's theme. The SwiftPieces look (the app library remixes) follows the device's
 * appearance instead of pinning its dark signature, so every remix works in light and dark: the
 * Playground's light/dark toggle shows both, and "Open in Xcode" follows the phone's setting.
 */
function lookTheme(look: string): Theme {
  const theme = themeFromLook(look);
  return look === "pieces" ? { ...theme, appearance: "system" } : theme;
}

export function app(opts: { name: string; shell?: "single" | "tabs"; tabBar?: "dock"; look?: string | Theme; screens: (l: Links) => ScreenSpec[] }): CatalogBuilder {
  return (newId) => {
    const ids = new Map<string, string>();
    const id = (key: string) => {
      if (!ids.has(key)) ids.set(key, newId());
      return ids.get(key)!;
    };
    const specs = opts.screens({ to: id, sheet: (k) => `sheet:${id(k)}`, root: (k) => `root:${id(k)}` });
    return {
      name: opts.name,
      shell: opts.shell ?? "single",
      ...(opts.tabBar ? { tabBar: opts.tabBar } : {}),
      ...(opts.look ? { theme: typeof opts.look === "string" ? lookTheme(opts.look) : opts.look } : {}),
      screens: specs.map((s) => ({
        id: id(s.key),
        name: s.name,
        root: withIds(nd("screen", { alignment: "leading", spacing: 16, ...defined(s.props) }, s.children), newId),
        ...(s.tab ? { tab: s.tab } : {}),
      })),
    };
  };
}

// ---------------------------------------------------------------- Common pieces of screens

export const title = (text: string, extra: Props = {}) => nd("text", { text, style: "largeTitle", weight: "bold", ...extra });
export const heading = (text: string, extra: Props = {}) => nd("text", { text, style: "title2", weight: "bold", ...extra });
export const headline = (text: string, extra: Props = {}) => nd("text", { text, style: "headline", ...extra });
export const body = (text: string, extra: Props = {}) => nd("text", { text, style: "body", color: "secondary", ...extra });
export const footnote = (text: string, extra: Props = {}) => nd("text", { text, style: "footnote", color: "secondary", ...extra });
export const caption = (text: string, extra: Props = {}) => nd("text", { text, style: "caption", color: "secondary", ...extra });
export const section = (text: string) => nd("text", { text: text.toUpperCase(), style: "footnote", weight: "semibold", color: "secondary" });
export const space = (height = 8) => nd("spacer", { mode: "fixed", height });
export const flex = () => nd("spacer");
export const row = (props: Props, children?: ScreenNode[]) => nd("hstack", { spacing: 12, ...props }, children);
export const col = (props: Props, children: ScreenNode[]) => nd("vstack", { spacing: 8, ...props }, children);

/** An inset grouped list section: rows in a card, with hairlines between them. */
export const group = (rows: ScreenNode[], extra: Props = {}) =>
  nd("vstack", { spacing: 0, style: "card", padding: 16, radius: 16, ...extra }, rows.flatMap((r, i) => (i ? [nd("divider"), r] : [r])));

/** A small labelled statistic. */
export const stat = (value: string, label: string) =>
  nd("vstack", { alignment: "center", spacing: 2, style: "card", padding: 14, radius: 14 }, [
    nd("text", { text: value, style: "title3", weight: "bold" }),
    nd("text", { text: label, style: "caption", color: "secondary" }),
  ]);

/** A single-screen entry. */
export const single = (name: string, view: string, props: Props, children: ScreenNode[], look?: string) =>
  app({ name, look, screens: () => [{ key: "main", name: view, props, children }] });
