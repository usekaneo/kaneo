export type McpServerEntry = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

/**
 * Merges or replaces `mcpServers[serverName]` and returns formatted JSON.
 * Preserves other top-level keys and other MCP server entries.
 */
export function mergeMcpServerEntry(
  existingJson: string | null,
  serverName: string,
  serverConfig: McpServerEntry,
): string {
  let root: Record<string, unknown> = {};
  if (existingJson) {
    try {
      const parsed: unknown = JSON.parse(existingJson);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        root = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      console.warn(
        "[kaneo-mcp] Existing MCP config is not valid JSON; overwriting with a fresh object.",
      );
    }
  }

  const mcpServers = (() => {
    const raw = root.mcpServers;
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      return { ...(raw as Record<string, unknown>) };
    }
    return {};
  })();

  mcpServers[serverName] = serverConfig;
  root.mcpServers = mcpServers;

  return `${JSON.stringify(root, null, 2)}\n`;
}
