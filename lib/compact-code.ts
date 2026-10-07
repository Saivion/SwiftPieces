// Shrinks the highlighted code blocks in the docs. source.config.ts runs it after fumadocs' shiki step.
//
// Shiki (github-light and github-dark) writes every token as
// <span style="--shiki-light:#D73A49;--shiki-dark:#F97583">, and MDX compiles each span into a React
// element of its own. A piece's full source is about 570 lines and 3,400 elements: 210 KB of HTML and
// 320 KB of RSC payload on one page, which Next stores again inline in the HTML and in its segment
// prefetch files. For each code block this:
// 1. swaps the themes' colour pairs for one-letter classes that set the same variables (app/globals.css),
// 2. drops the span around tokens in the default colour, which every line already inherits from <pre>,
// 3. hands the code to React as one HTML string, so the RSC payload holds a string per block instead of
//    an element per token.
// Anything it doesn't recognise (a font style, another theme's colours, an unexpected node) stays as
// shiki wrote it, so the worst case is a block that isn't compacted, never one that looks different.

type Properties = Record<string, unknown>;
type Element = { type: "element"; tagName: string; properties?: Properties; children: Node[] };
type Text = { type: "text"; value: string };
type Node = Element | Text | { type: string; children?: Node[] };

/**
 * The github-light / github-dark colour pairs (`light|dark`) and the class that stands in for each.
 * The two themes share one rule list, so these are every plain colour either can give a token.
 * app/globals.css sets each pair back as --shiki-light and --shiki-dark on its class.
 */
export const TOKEN_CLASSES: Record<string, string> = {
  "#d73a49|#f97583": "k", // keywords, storage, operators
  "#005cc5|#79b8ff": "c", // constants, support, properties
  "#6f42c1|#b392f0": "f", // functions, types
  "#032f62|#9ecbff": "s", // strings
  "#6a737d|#6a737d": "m", // comments
  "#e36209|#ffab70": "v", // variables, changed lines
  "#22863a|#85e89d": "t", // tags, quotes, inserted lines
  "#b31d28|#fdaeb7": "i", // errors, deleted lines
  "#032f62|#dbedff": "r", // regular expressions
  "#586069|#d1d5da": "b", // bracket highlights
  "#f6f8fa|#2f363d": "u", // ignored and untracked lines
};

/** The themes' default text colour. A token in it needs no span: its line inherits the same colour. */
export const DEFAULT_TOKEN = "#24292e|#e1e4e8";

/** rehype plugin: compacts every shiki code block (`<pre class="shiki">`) on the page. */
export function rehypeCompactCode() {
  return (tree: Node) => visit(tree);
}

function visit(node: Node): void {
  if (!("children" in node) || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (isElement(child) && child.tagName === "pre" && classList(child).includes("shiki")) compactBlock(child);
    else visit(child);
  }
}

function compactBlock(pre: Element): void {
  const index = pre.children.findIndex((child) => isElement(child) && child.tagName === "code");
  const code = pre.children[index];
  // Shiki's <code> carries no attributes; one with any is not the shape this was written for.
  if (!isElement(code) || Object.keys(code.properties ?? {}).length > 0) return;
  const html = toHtml(compactTokens(code.children));
  if (html === null) return;
  pre.children[index] = { type: "mdxJsxFlowElement", name: "code", attributes: [innerHtml(html)], children: [] } as Node;
}

/** The token spans under `nodes` with colour classes, default-colour spans unwrapped and neighbours merged. */
export function compactTokens(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    if (!isElement(node)) {
      append(out, node);
      continue;
    }
    const children = compactTokens(node.children);
    const key = tokenKey(node.properties?.style);
    const tokenClass = key && key !== DEFAULT_TOKEN ? TOKEN_CLASSES[key] : undefined;
    const classes = classList(node);
    const rest = Object.fromEntries(Object.entries(node.properties ?? {}).filter(([name]) => !["style", "class", "className"].includes(name)));
    if (key === DEFAULT_TOKEN && classes.length === 0 && Object.keys(rest).length === 0) {
      for (const child of children) append(out, child);
    } else if (key === DEFAULT_TOKEN || tokenClass) {
      const all = tokenClass ? [...classes, tokenClass] : classes;
      append(out, { ...node, properties: all.length > 0 ? { ...rest, class: all.join(" ") } : rest, children });
    } else {
      append(out, { ...node, children });
    }
  }
  return out;
}

/** `light|dark` for a style that sets the two token colours and nothing else, otherwise null. */
function tokenKey(style: unknown): string | null {
  if (typeof style !== "string") return null;
  let light = "";
  let dark = "";
  for (const declaration of style.split(";")) {
    if (!declaration.trim()) continue;
    const colon = declaration.indexOf(":");
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim().toLowerCase();
    if (name === "--shiki-light") light = value;
    else if (name === "--shiki-dark") dark = value;
    else return null;
  }
  return light && dark ? `${light}|${dark}` : null;
}

/** Adds a node, joining it to the previous one when both are text, or both are spans of the same token class. */
function append(out: Node[], node: Node): void {
  const previous = out[out.length - 1];
  if (previous && isText(previous) && isText(node)) {
    out[out.length - 1] = { type: "text", value: previous.value + node.value };
  } else if (previous && isTokenSpan(previous) && isTokenSpan(node) && previous.properties?.class === node.properties?.class) {
    const children = [...previous.children];
    for (const child of node.children) append(children, child);
    out[out.length - 1] = { ...previous, children };
  } else {
    out.push(node);
  }
}

/** A span whose only attribute is one token colour class, so a neighbour of the same class can absorb it. */
function isTokenSpan(node: Node): node is Element {
  if (!isElement(node) || node.tagName !== "span") return false;
  const keys = Object.keys(node.properties ?? {});
  return keys.length === 1 && keys[0] === "class" && Object.values(TOKEN_CLASSES).includes(String(node.properties?.class));
}

/** Shiki's output (spans and text) as HTML, or null when it holds anything this doesn't serialise. */
export function toHtml(nodes: Node[]): string | null {
  let html = "";
  for (const node of nodes) {
    if (isText(node)) {
      html += node.value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    } else if (isElement(node) && /^[a-z][a-z0-9]*$/.test(node.tagName)) {
      const attributes = toAttributes(node.properties ?? {});
      const inner = toHtml(node.children);
      if (attributes === null || inner === null) return null;
      html += `<${node.tagName}${attributes}>${inner}</${node.tagName}>`;
    } else {
      return null;
    }
  }
  return html;
}

/** Attributes as HTML. Plain values go unquoted (`class=line`), which saves bytes in every copy of the page. */
function toAttributes(properties: Properties): string | null {
  let html = "";
  for (const [key, raw] of Object.entries(properties)) {
    if (raw === undefined || raw === null || raw === false) continue;
    const name = key === "className" ? "class" : key;
    // Shiki writes attribute names as HTML has them (class, style, data-*). A React-style name would
    // need mapping this doesn't do, so it leaves the block as it was.
    if (!/^[a-z][a-z0-9-]*$/.test(name)) return null;
    if (raw === true) {
      html += ` ${name}`;
      continue;
    }
    if (typeof raw !== "string" && typeof raw !== "number" && !Array.isArray(raw)) return null;
    const value = Array.isArray(raw) ? raw.join(" ") : String(raw);
    html += /^[\w-]+$/.test(value) ? ` ${name}=${value}` : ` ${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
  }
  return html;
}

/** `dangerouslySetInnerHTML={{ __html: html }}` as an MDX JSX attribute, with the estree MDX compiles from. */
function innerHtml(html: string) {
  const expression = {
    type: "ObjectExpression",
    properties: [
      {
        type: "Property",
        kind: "init",
        method: false,
        shorthand: false,
        computed: false,
        key: { type: "Identifier", name: "__html" },
        value: { type: "Literal", value: html },
      },
    ],
  };
  return {
    type: "mdxJsxAttribute",
    name: "dangerouslySetInnerHTML",
    value: {
      type: "mdxJsxAttributeValueExpression",
      value: `{ __html: ${JSON.stringify(html)} }`,
      data: { estree: { type: "Program", sourceType: "module", comments: [], body: [{ type: "ExpressionStatement", expression }] } },
    },
  };
}

function isElement(node: Node | undefined): node is Element {
  return node?.type === "element";
}

function isText(node: Node): node is Text {
  return node.type === "text";
}

function classList(node: Element): string[] {
  const value = node.properties?.class ?? node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [];
}
