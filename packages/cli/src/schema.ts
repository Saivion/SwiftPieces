import { z } from "zod";

const pieceName = z.string().regex(/^[A-Z][A-Za-z0-9]+$/, "expected a PascalCase piece name");

const registryFileSchema = z.object({
  path: z.string().optional(),
  type: z.string().optional(),
  target: z.string().min(1),
  content: z.string(),
});

const spmDependencySchema = z.object({
  url: z.string(),
  from: z.string(),
  product: z.string().optional(),
});

/**
 * The install payload. Matches the free registry item (lib/registry-schema.ts) on every field the
 * CLI writes or follows, and accepts a Pro item whose `type` is not `registry:component`.
 * Unknown keys are dropped. A payload that fails this schema is never written.
 */
export const registryItemSchema = z.object({
  name: pieceName,
  slug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  version: z.string().optional(),
  minIOSVersion: z.string().regex(/^\d+(\.\d+)?$/).default("17.0"),
  registryDependencies: z.array(pieceName).default([]),
  spmDependencies: z.array(spmDependencySchema).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  infoPlist: z.record(z.string(), z.string()).default({}),
  files: z.array(registryFileSchema).min(1),
  shaders: z.array(registryFileSchema).default([]),
  assets: z.array(registryFileSchema).default([]),
  docs: z.string().optional(),
});

export type RegistryItem = z.infer<typeof registryItemSchema>;

export const kitItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.string().min(1),
  title: z.string(),
  skillName: z.string().min(1),
  uses: z.array(z.string()).default([]),
  availability: z.enum(["free", "pro"]),
  files: z.array(z.object({
    path: z.string().min(1),
    content: z.string(),
  })).min(1),
});

export type KitItem = z.infer<typeof kitItemSchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues.slice(0, 6).map((issue) => `${issue.path.join(".") || "(item)"}: ${issue.message}`).join("; ");
}
