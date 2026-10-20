import { formatZodError, registryItemSchema, type RegistryItem } from "./schema.js";

export type { RegistryItem };

export interface RegistryFile {
  path?: string;
  type?: string;
  target: string;
  content: string;
}

export class RegistryError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "RegistryError";
  }
}

/** The only origin that receives `x-license-key` unless `--trust-registry` is passed. */
export const OFFICIAL_PRO_ORIGIN = "https://pro.swiftpieces.com";

export type FetchPolicy = {
  /** Allow `http://` only for localhost, 127.0.0.1, and ::1. */
  allowHttpLocalhost?: boolean;
  /** Send the license key to a registry other than https://pro.swiftpieces.com. */
  trustRegistry?: boolean;
};

const UA = { "user-agent": "swiftpieces-cli", accept: "application/json" };

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Registries are https. Plain http is refused except for a loopback host behind the dev flag. */
export function assertRegistryUrl(raw: string, policy: FetchPolicy = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RegistryError(`Registry URL is not valid: ${raw}`);
  }
  if (url.username || url.password) throw new RegistryError(`Refusing a registry URL with credentials: ${url.origin}`);
  if (url.protocol === "https:") return url;
  if (url.protocol === "http:" && policy.allowHttpLocalhost && isLocalHost(url.hostname)) return url;
  if (url.protocol === "http:" && isLocalHost(url.hostname)) {
    throw new RegistryError(`Refusing ${url.origin}. Registries must be https. Pass --allow-http-localhost to use a local http registry.`);
  }
  throw new RegistryError(`Refusing ${raw}. Registries must be https.`);
}

/** The license key leaves the machine only for the official Pro origin, unless the trust flag is set. */
export function sendsLicenseKey(target: URL, policy: FetchPolicy = {}): boolean {
  if (policy.trustRegistry) return true;
  return target.origin === OFFICIAL_PRO_ORIGIN;
}

function registryUrl(base: string, suffix: string, policy: FetchPolicy): URL {
  const root = assertRegistryUrl(base, policy);
  const url = new URL(suffix.replace(/^\//, ""), `${root.toString().replace(/\/$/, "")}/`);
  return assertRegistryUrl(url.toString(), policy);
}

function authHeaders(target: URL, licenseKey: string | undefined, policy: FetchPolicy): Record<string, string> {
  const headers: Record<string, string> = { ...UA };
  if (licenseKey && sendsLicenseKey(target, policy)) headers["x-license-key"] = licenseKey;
  return headers;
}

function withheld(target: URL, licenseKey: string | undefined, policy: FetchPolicy): boolean {
  return Boolean(licenseKey) && !sendsLicenseKey(target, policy);
}

/** fetch, but an unreachable host is a RegistryError with a plain-English message, never a stack trace. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    let host = url;
    try {
      host = new URL(url).origin;
    } catch {
      host = url;
    }
    throw new RegistryError(`Couldn't reach ${host}. Check your internet connection and try again. If it keeps failing, see https://github.com/saivion/swiftpieces/issues`);
  }
}

function parseItem(data: unknown, name: string): RegistryItem {
  const parsed = registryItemSchema.safeParse(data);
  if (!parsed.success) {
    throw new RegistryError(`"${name}" failed validation and was not written. ${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * Resolution order (Rev 3 §9): Free first; on 404 try Pro with the license key.
 * Pro 401/403 produce a helpful message, never a stack trace.
 */
export async function fetchItem(registries: { free: string; pro: string }, name: string, licenseKey?: string, policy: FetchPolicy = {}): Promise<{ item: RegistryItem; source: "free" | "pro" }> {
  const enc = `${encodeURIComponent(name)}.json`;
  const freeUrl = registryUrl(registries.free, enc, policy);
  const free = await request(freeUrl.toString(), { headers: authHeaders(freeUrl, licenseKey, policy) });
  if (free.ok) return { item: parseItem(await free.json(), name), source: "free" };
  if (free.status !== 404) throw new RegistryError(`Free registry returned ${free.status} for "${name}"`, free.status);

  const proUrl = registryUrl(registries.pro, enc, policy);
  const pro = await request(proUrl.toString(), { headers: authHeaders(proUrl, licenseKey, policy) });
  if (pro.status === 404) throw new RegistryError(`No piece named "${name}" in the free or Pro registry. Run \`npx swiftpieces list\`.`, 404);
  if (pro.status === 401) {
    throw new RegistryError(
      withheld(proUrl, licenseKey, policy)
        ? `"${name}" is a Pro piece, and the license key was not sent to ${proUrl.origin}. The key is only sent to ${OFFICIAL_PRO_ORIGIN}. Pass --trust-registry if you trust this registry.`
        : `"${name}" is a Pro piece. Run \`npx swiftpieces login\` with your license key, or get one at https://pro.swiftpieces.com/pro`,
      401,
    );
  }
  if (pro.status === 403) throw new RegistryError(`"${name}" is part of SwiftPieces Pro, and this license's account doesn't own SwiftPieces Pro. Get it at https://pro.swiftpieces.com/pro`, 403);
  if (!pro.ok) throw new RegistryError(`Pro registry returned ${pro.status} for "${name}"`, pro.status);
  const needsPro = () =>
    new RegistryError(
      licenseKey
        ? `"${name}" is part of SwiftPieces Pro, and this license does not include Pro access. Get it at https://pro.swiftpieces.com/pro`
        : `"${name}" is a Pro piece. Run \`npx swiftpieces login <key>\` with your license key, or get one at https://pro.swiftpieces.com/pro`,
      licenseKey ? 403 : 401,
    );
  const body: unknown = await pro.json();
  // Without Pro the registry answers 200 with the item's public metadata and no files (screens, templates and blocks
  // alike). Say so before validating the item, which needs files.
  const files = body && typeof body === "object" ? (body as { files?: unknown }).files : undefined;
  if (!Array.isArray(files) || files.length === 0) throw needsPro();
  const item = parseItem(body, name);
  if (!item.files.some((file) => file.content !== undefined)) throw needsPro();
  return { item, source: "pro" };
}

export interface RegistryIndexEntry {
  name: string;
  category: string;
  minIOSVersion: string;
  type?: string;
  description: string;
}

export async function fetchIndex(registry: string, policy: FetchPolicy = {}): Promise<RegistryIndexEntry[]> {
  const url = registryUrl(registry, "index.json", policy);
  const res = await request(url.toString(), { headers: { ...UA } });
  if (!res.ok) throw new RegistryError(`Registry index returned ${res.status}`, res.status);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new RegistryError("Registry index was not a list of pieces.");
  return data as RegistryIndexEntry[];
}

export interface LicenseStatus {
  access: "pro" | "none";
  licenseId: string;
  hint?: string;
}

export async function whoami(proRegistry: string, licenseKey: string, policy: FetchPolicy = {}): Promise<LicenseStatus | null> {
  const root = assertRegistryUrl(proRegistry, policy);
  const base = root.toString().replace(/\/$/, "").replace(/\/r$/, "");
  const url = assertRegistryUrl(`${base}/api/license/verify`, policy);
  if (withheld(url, licenseKey, policy)) {
    throw new RegistryError(`Not sending the license key to ${url.origin}. It is only sent to ${OFFICIAL_PRO_ORIGIN}. Pass --trust-registry to send it to this registry.`);
  }
  const res = await request(url.toString(), { headers: authHeaders(url, licenseKey, policy) });
  if (!res.ok) return null;
  return (await res.json()) as LicenseStatus;
}
