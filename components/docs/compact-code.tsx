"use client";

import { createElement, useMemo, type ReactNode } from "react";
import type { CompactNode } from "@/lib/compact-code";

/**
 * A highlighted code block's <code>, built from the compact tree lib/compact-code.ts writes into the
 * docs at compile time. It's a client component so the page's RSC payload carries the tree as one
 * string per block rather than an element per token; the server still renders the same markup into
 * the HTML. React creates every span and escapes every piece of text, so no raw HTML is injected.
 */
export function CompactCode({ tree }: { tree: string }) {
  const children = useMemo(() => (JSON.parse(tree) as CompactNode[]).map(toNode), [tree]);
  return createElement("code", null, ...children);
}

function toNode(node: CompactNode): ReactNode {
  if (typeof node === "string") return node;
  const [tag, props, ...children] = node;
  return createElement(tag, props || null, ...children.map(toNode));
}
