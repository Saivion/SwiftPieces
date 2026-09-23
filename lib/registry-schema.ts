import { z } from "zod";
import { categoryIds } from "@/lib/categories";

// The free registry schema (Rev 2 §5, Rev 3 §3). Free has no tiers and no
// gating: everything in this registry is MIT + Commons Clause.

export const categorySchema = z.enum(categoryIds);
export type { Category } from "@/lib/categories";

export const registryFileTypeSchema = z.enum(["registry:component", "registry:shader", "registry:asset"]);

export const registryFileSchema = z.object({
  path: z.string(),
  type: registryFileTypeSchema,
  target: z.string(),
  content: z.string().optional(),
});

export const spmDependencySchema = z.object({
  url: z.string().url(),
  from: z.string(),
  product: z.string().optional(),
});

export const previewSchema = z.object({
  video: z.string().url().optional(),
  videoMp4: z.string().url().optional(),
  poster: z.string().url().optional(),
});

export const registryItemSchema = z.object({
  $schema: z.string().default("https://swiftpieces.com/schema/registry-item.json"),
  name: z.string().regex(/^[A-Z][A-Za-z0-9]+$/, "PascalCase Swift type name"),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  type: z.literal("registry:component"),
  title: z.string(),
  description: z.string(),
  category: categorySchema,
  license: z.literal("MIT+Commons-Clause").default("MIT+Commons-Clause"),
  version: z.string().default("1.0.0"),
  minIOSVersion: z.string().regex(/^\d+(\.\d+)?$/),
  swiftToolsVersion: z.string().default("6.1"),
  tags: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  spmDependencies: z.array(spmDependencySchema).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  infoPlist: z.record(z.string(), z.string()).default({}),
  assets: z.array(registryFileSchema).default([]),
  shaders: z.array(registryFileSchema).default([]),
  files: z.array(registryFileSchema),
  preview: previewSchema.default({}),
  docs: z.string().url(),
  /** Pro screen id this piece grows into, e.g. "toast-stack". */
  pro: z.string().optional(),
  /** Day the piece shipped ("YYYY-MM-DD"). */
  added: z.string().optional(),
  /** Shipped within the last 30 days, as of the last registry build. Computed once, so server and client agree. */
  isNew: z.boolean().default(false),
  liquidGlass: z.boolean().default(false),
  metal: z.boolean().default(false),
});
export type RegistryItem = z.infer<typeof registryItemSchema>;

export const registryIndexEntrySchema = registryItemSchema.omit({ files: true, shaders: true, assets: true }).extend({
  files: z.array(registryFileSchema.omit({ content: true })),
  shaders: z.array(registryFileSchema.omit({ content: true })).default([]),
});
export type RegistryIndexEntry = z.infer<typeof registryIndexEntrySchema>;

export const pieceFrontmatterSchema = z.object({
  piece: z.string().regex(/^[A-Z][A-Za-z0-9]+$/).optional(),
  category: categorySchema.optional(),
  minIOSVersion: z.string().optional(),
  version: z.string().default("1.0.0"),
  tags: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
});
export type PieceFrontmatter = z.infer<typeof pieceFrontmatterSchema>;
