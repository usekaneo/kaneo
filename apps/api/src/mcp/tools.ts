import { registerTools, type ToolRegistrar } from "@kaneo/mcp/tools";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

export type McpToolRegistrar = ToolRegistrar;

type ShapeToolServer = {
  registerTool(
    name: string,
    config: { description: string; inputSchema: z.ZodRawShape },
    callback: (args: unknown) => Promise<CallToolResult>,
  ): unknown;
};

export function toMcpToolRegistrar(server: ShapeToolServer): McpToolRegistrar {
  return {
    registerTool: (name, config, callback) =>
      server.registerTool(
        name,
        {
          description: config.description,
          inputSchema: config.inputSchema.shape,
        },
        (args) => callback(args),
      ),
  };
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Binary downloads can be up to the asset size cap, so allow more time. */
const ASSET_TIMEOUT_MS = 30_000;

class ApiClient {
  readonly usingApiKey = false;
  constructor(
    readonly baseUrl: string,
    private token: string,
  ) {}

  private async request(
    path: string,
    init?: RequestInit,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    return fetch(url, {
      ...init,
      headers,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
    });
  }

  /** Returns the raw response for binary endpoints such as asset downloads. */
  async raw(path: string, init?: RequestInit): Promise<Response> {
    return this.request(path, init, ASSET_TIMEOUT_MS);
  }

  async json<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.request(path, init);

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      const detail =
        typeof body === "object" && body !== null && "message" in body
          ? (body as { message: string }).message
          : typeof body === "string" && body.length > 0
            ? body.slice(0, 500)
            : `HTTP ${res.status}`;
      throw new Error(`${path}: ${detail}`);
    }
    return body as T;
  }
}

export function registerMcpTools(
  server: McpToolRegistrar,
  baseUrl: string,
  token: string,
  // The origin shown to users in asset results. Defaults to the fetch origin
  // but callers pass the public API URL so internal addresses never leak.
  assetUrlBase: string = baseUrl,
): void {
  registerTools(server, {
    client: new ApiClient(baseUrl, token),
    assetUrlBase,
  });
}
