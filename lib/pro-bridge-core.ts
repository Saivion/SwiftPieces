// The checks behind the Pro bridge (lib/pro-bridge.ts), kept pure so they are tested directly
// (lib/pro-bridge-core.test.ts). The Free site never holds a Pro cookie or a Clerk SDK: it borrows a
// short-lived session token from a hidden page on the Pro site and sends it as a Bearer token.

/** The only Pro API paths this site calls. Anything else is refused before a request is made. */
const ALLOWED_PATHS = /^\/api\/(session|builder\/(projects(\/bp_[a-z0-9]{8,32})?|apps|generate))$/;
export const isAllowedProPath = (path: string) => ALLOWED_PATHS.test(path);

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * A reply from the token page, accepted only when it comes from the Pro origin, from our own frame,
 * answers the request we sent, and carries a token shaped like a JWT (or null: signed out).
 * `undefined` means "not ours, keep waiting".
 */
export function acceptTokenReply(
  event: { origin: string; source: unknown; data: unknown },
  expect: { origin: string; source: unknown; id: string },
): string | null | undefined {
  if (event.origin !== expect.origin || event.source !== expect.source) return undefined;
  const d = event.data as { type?: unknown; id?: unknown; token?: unknown } | null;
  if (!d || typeof d !== "object" || d.type !== "sp:token" || d.id !== expect.id) return undefined;
  if (d.token === null) return null;
  return typeof d.token === "string" && d.token.length < 8192 && JWT.test(d.token) ? d.token : null;
}

/** The token page saying it's ready, from the Pro origin and our own frame only. */
export function isReadySignal(event: { origin: string; source: unknown; data: unknown }, expect: { origin: string; source: unknown }): boolean {
  return event.origin === expect.origin && event.source === expect.source && (event.data as { type?: unknown } | null)?.type === "sp:ready";
}

/**
 * When a token stops being worth reusing: its `exp`, less a margin. Read only to avoid asking for a
 * new token on every call; the Pro server verifies the token (signature included) on every request.
 */
export function tokenExpiry(token: string, marginMs = 15_000): number {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const exp = (JSON.parse(atob(part + "===".slice((part.length + 3) % 4))) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 - marginMs : 0;
  } catch {
    return 0;
  }
}

/** A request id: random, so a reply can only answer the request that asked. */
export function requestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
