export type McpServerEntry = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

const RESERVED_MCP_SERVER_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Merges or replaces `mcpServers[serverName]` and returns formatted JSON.
 * Preserves other top-level keys and other MCP server entries.
 */
export function mergeMcpServerEntry(
  existingJson: string | null,
  serverName: string,
  serverConfig: McpServerEntry,
): string {
  if (RESERVED_MCP_SERVER_KEYS.has(serverName)) {
    throw new Error(
      `Refusing MCP server name "${serverName}" (reserved key; use a different --name).`,
    );
  }

  let root: Record<string, unknown> = {};
  if (existingJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existingJson);
    } catch {
      throw new Error("Existing MCP config is not valid JSON.");
    }
    if (!isPlainObject(parsed)) {
      throw new Error(
        "Existing MCP config must be a JSON object (not an array or primitive).",
      );
    }
    root = { ...parsed };
  }

  const mcpServers = (() => {
    const map = Object.create(null) as Record<string, unknown>;
    const raw = root.mcpServers;
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      for (const key of Object.keys(raw as object)) {
        if (RESERVED_MCP_SERVER_KEYS.has(key)) {
          continue;
        }
        map[key] = (raw as Record<string, unknown>)[key];
      }
    }
    return map;
  })();

  mcpServers[serverName] = serverConfig;
  root.mcpServers = mcpServers;

  return `${JSON.stringify(root, null, 2)}\n`;
}
