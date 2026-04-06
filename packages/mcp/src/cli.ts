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
  console.log(`kaneo-mcp — Kaneo MCP server (stdio transport)

Usage:
  npx @kaneo/mcp         Interactive installer (terminal only; no global install)
  kaneo-mcp              Same: installer in a TTY; MCP server when stdin is piped
  kaneo-mcp install      Register in Cursor / Claude / a custom path (explicit)
  kaneo-mcp serve        Run the MCP server (use from a terminal to test stdio)
  kaneo-mcp help

Options:
  -h, --help             Show this help

MCP clients (Cursor, etc.) run this process with a pipe, so they get the server.
In a normal terminal, the default is the interactive installer.

See also: kaneo-mcp install --help
`);
}
