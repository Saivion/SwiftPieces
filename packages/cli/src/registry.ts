export interface RegistryFile {
  path: string;
  type: string;
  target: string;
  content?: string;
}

export interface RegistryItem {
  name: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  version: string;
  minIOSVersion: string;
  registryDependencies: string[];
  spmDependencies: { url: string; from: string; product?: string }[];
  requiredCapabilities: string[];
  infoPlist: Record<string, string>;
  files: RegistryFile[];
  shaders: RegistryFile[];
  assets: RegistryFile[];
  docs: string;
  /** Pro items only: "screen" | "template". */
  type?: string;
}

export class RegistryError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

const UA = { "user-agent": "swiftpieces-cli", accept: "application/json" };

/** fetch, but an unreachable host is a RegistryError with a plain-English message, never a stack trace. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    const host = new URL(url).origin;
    throw new RegistryError(`Couldn't reach ${host}. Check your internet connection and try again. If it keeps failing, see https://github.com/saivion/swiftpieces/issues`);
  }
}

async function get(url: string, licenseKey?: string) {
  const headers: Record<string, string> = { ...UA };
  if (licenseKey) headers["x-license-key"] = licenseKey;
  return request(url, { headers });
}

/**
 * Resolution order (Rev 3 §9): Free first; on 404 try Pro with the license key.
 * Pro 401/403 produce a helpful message, never a stack trace.
 */
export async function fetchItem(registries: { free: string; pro: string }, name: string, licenseKey?: string): Promise<{ item: RegistryItem; source: "free" | "pro" }> {
  const enc = encodeURIComponent(name);
  const free = await get(`${registries.free.replace(/\/$/, "")}/${enc}.json`);
  if (free.ok) return { item: (await free.json()) as RegistryItem, source: "free" };
  if (free.status !== 404) throw new RegistryError(`Free registry returned ${free.status} for "${name}"`, free.status);

  const pro = await get(`${registries.pro.replace(/\/$/, "")}/${enc}.json`, licenseKey);
  if (pro.status === 404) throw new RegistryError(`No piece named "${name}" in the free or Pro registry. Run \`npx swiftpieces list\`.`, 404);
  if (pro.status === 401) throw new RegistryError(`"${name}" is a Pro piece. Run \`npx swiftpieces login\` with your license key, or get one at https://pro.swiftpieces.com/pro`, 401);
  if (pro.status === 403) throw new RegistryError(`"${name}" is part of Swift Pieces Pro, and this license's account doesn't own Swift Pieces Pro. Get it at https://pro.swiftpieces.com/pro`, 403);
  if (!pro.ok) throw new RegistryError(`Pro registry returned ${pro.status} for "${name}"`, pro.status);
  const item = (await pro.json()) as RegistryItem;
  if (!item.files?.some((f) => f.content !== undefined)) {
    throw new RegistryError(
      licenseKey
        ? `"${name}" is part of Swift Pieces Pro, and this license does not include Pro access. Get it at https://pro.swiftpieces.com/pro`
        : `"${name}" is a Pro piece. Run \`npx swiftpieces login <key>\` with your license key, or get one at https://pro.swiftpieces.com/pro`,
      licenseKey ? 403 : 401,
    );
  }
  return { item, source: "pro" };
}

export async function fetchIndex(registry: string): Promise<Omit<RegistryItem, "files">[]> {
  const res = await get(`${registry.replace(/\/$/, "")}/index.json`);
  if (!res.ok) throw new RegistryError(`Registry index returned ${res.status}`, res.status);
  return (await res.json()) as Omit<RegistryItem, "files">[];
}

export interface LicenseStatus {
  access: "pro" | "none";
  licenseId: string;
  hint?: string;
}

export async function whoami(proRegistry: string, licenseKey: string): Promise<LicenseStatus | null> {
  const base = proRegistry.replace(/\/r\/?$/, "");
  const res = await request(`${base}/api/license/verify`, { headers: { ...UA, "x-license-key": licenseKey } });
  if (!res.ok) return null;
  return (await res.json()) as LicenseStatus;
}
