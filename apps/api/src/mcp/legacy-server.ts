import { brand } from "@kaneo/branding";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMcpTools, toMcpToolRegistrar } from "./tools";
import { MCP_MAX_TOOL_INPUT_ELEMENTS } from "./request-bounds";

export function createMcpServerForUser(
  token: string,
  internalApiUrl: string,
): McpServer {
  const server = new McpServer(
    { name: brand.name, version: "1.0.0" },
    { maxToolInputElements: MCP_MAX_TOOL_INPUT_ELEMENTS },
  );
  registerMcpTools(toMcpToolRegistrar(server), internalApiUrl, token);
  return server;
}
