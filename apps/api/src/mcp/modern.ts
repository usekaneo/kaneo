import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerMcpTools } from "./tools";

export function createModernMcpHandler(token: string, apiUrl: string) {
  return createMcpHandler(
    () => {
      const server = new McpServer({
        name: "kaneo-mcp",
        version: "1.0.0",
      });
      registerMcpTools(server, apiUrl, token);
      return server;
    },
    { legacy: "reject" },
  );
}
