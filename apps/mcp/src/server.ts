import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuthService } from "./auth/auth-service.js";
import { KaneoClient } from "./kaneo/client.js";
import { registerTools } from "./tools/register.js";
import { normalizeBaseUrl } from "./utils/normalize-base-url.js";

export function createMcpServer(): McpServer {
  const baseUrl = normalizeBaseUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );
  const clientId = process.env.KANEO_MCP_CLIENT_ID || "kaneo-mcp";
  const auth = new AuthService({ baseUrl, clientId });
  const client = new KaneoClient({ baseUrl, auth });
  const server = new McpServer({
    name: "kaneo-mcp",
    version: "0.1.0",
  });
  registerTools(server, { client });
  return server;
}
