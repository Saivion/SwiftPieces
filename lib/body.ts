
/**
 * A request body read up to `max` bytes, then refused. `req.text()` and `req.json()` read the whole
 * body first, and a body sent in chunks has no Content-Length for the middleware to check, so this
 * is the only cap that holds for every request. Null when the body is too large or unreadable.
 */
export async function readCapped(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    await req.body?.cancel().catch(() => {});
    return null;
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** A capped body parsed as a JSON object, or null. */
export async function readJsonCapped(req: Request, max: number): Promise<Record<string, unknown> | null> {
  const text = await readCapped(req, max);
  if (text === null) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
