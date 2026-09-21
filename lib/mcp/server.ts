/**
 * Minimal MCP server over streamable HTTP (JSON-RPC 2.0, stateless).
 * Supports initialize, ping, tools/list, tools/call. No SDK: keeps the Worker small.
 */
export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

const MAX_BATCH = 20;

/** The largest JSON-RPC body this server reads, counted while streaming so it holds without a Content-Length. */
const MAX_BODY_BYTES = 64 * 1024;

class BodyTooLarge extends Error {}

async function readJsonCapped(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) return JSON.parse("");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

export function createMcpHandler(opts: { name: string; version: string; tools: ToolDef[]; instructions?: string }) {
  const byName = new Map(opts.tools.map((t) => [t.name, t]));

  async function handle(msg: Rpc) {
    const ok = (result: unknown) => ({ jsonrpc: "2.0" as const, id: msg.id ?? null, result });
    const err = (code: number, message: string) => ({ jsonrpc: "2.0" as const, id: msg.id ?? null, error: { code, message } });
    switch (msg.method) {
      case "initialize":
        return ok({ protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: opts.name, version: opts.version }, instructions: opts.instructions });
      case "notifications/initialized":
        return null;
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: opts.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const tool = byName.get(name);
        if (!tool) return err(-32602, `Unknown tool: ${name}`);
        try {
          const result = await tool.handler((msg.params?.arguments as Record<string, unknown>) ?? {});
          const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return ok({ content: [{ type: "text", text }], isError: false });
        } catch (e) {
          return ok({ content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true });
        }
      }
      default:
        return err(-32601, `Method not found: ${msg.method}`);
    }
  }

  return async function POST(req: Request) {
    let body: Rpc | Rpc[];
    try {
      body = (await readJsonCapped(req)) as Rpc | Rpc[];
    } catch (error) {
      if (error instanceof BodyTooLarge) {
        return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: `Request body over ${MAX_BODY_BYTES / 1024}KB.` } }, { status: 413 });
      }
      return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
    }
    const msgs = Array.isArray(body) ? body : [body];
    // One HTTP request may carry a JSON-RPC batch. Cap it so a single request can't fan out into
    // hundreds of tool calls (each a registry read, and on Pro a license lookup).
    if (msgs.length > MAX_BATCH) {
      return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: `Batch too large: at most ${MAX_BATCH} messages per request.` } }, { status: 413 });
    }
    const results = (await Promise.all(msgs.map(handle))).filter(Boolean);
    if (!results.length) return new Response(null, { status: 202 });
    return Response.json(Array.isArray(body) ? results : results[0], { headers: { "Access-Control-Allow-Origin": "*" } });
  };
}
