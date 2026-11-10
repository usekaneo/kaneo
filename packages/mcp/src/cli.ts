import { brandText } from "@kaneo/branding";
import { stdin as input } from "node:process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runInstall } from "./install/index.js";
import { createMcpServer } from "./server.js";

const SERVE_ALIASES = new Set(["serve", "server", "stdio", "run"]);

export async function runCli(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] === "-h" || argv[0] === "--help" || argv[0] === "help") {
    printMainHelp();
    return;
  }
  if (argv[0] === "install" || argv[0] === "setup") {
    await runInstall(argv.slice(1));
    return;
  }
  if (argv[0] !== undefined) {
    if (SERVE_ALIASES.has(argv[0])) {
      await startMcpServer();
      return;
    }
    console.error(`Unknown command: ${argv[0]}`);
    printMainHelp();
    process.exitCode = 1;
    return;
  }
  if (input.isTTY) {
    await runInstall([]);
    return;
  }
  await startMcpServer();
}

async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function printMainHelp(): void {
  console.log(
    `${brandText("kaneo-mcp: Kaneo MCP server (stdio transport)\n\nUsage:\n  npx @kaneo/mcp         Interactive installer (terminal only; no global install)\n  kaneo-mcp              Same: installer in a TTY; MCP server when stdin is piped\n  kaneo-mcp install      Register in Cursor / Claude / a custom path (explicit)\n  kaneo-mcp serve        Run the MCP server (use from a terminal to test stdio)\n  kaneo-mcp help\n\nOptions:\n  -h, --help             Show this help\n\nMCP clients (Cursor, etc.) run this process with a pipe, so they get the server.\nIn a normal terminal, the default is the interactive installer.\n\nSee also: kaneo-mcp install --help\n")}`,
  );
}
