import { defineDocs } from "fumadocs-mdx/macro";
import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";
import { pieceFrontmatterSchema } from "@/lib/registry-schema";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema.extend({ ...pieceFrontmatterSchema.shape, index: z.boolean().optional() }),
  },
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
