import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Showcase } from "@/components/docs/showcase";
import { PieceFacts } from "@/components/docs/piece-facts";
import { BlockFacts, ProBlockFacts } from "@/components/blocks/block-facts";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    Callout,
    Step,
    Steps,
    // A piece's or block's page: Preview and Code, then its facts (scripts/build-registry.ts writes them in).
    Showcase,
    PieceFacts,
    BlockFacts,
    ProBlockFacts,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
