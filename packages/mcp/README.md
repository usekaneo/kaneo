# Kaneo MCP server

`@kaneo/mcp` is a local MCP server for Kaneo.

It runs over stdio, signs in with Kaneo's device flow, and then calls the Kaneo API with a bearer token. The package lives in `packages/mcp` in this monorepo and exposes the `kaneo-mcp` CLI.

## Prerequisites

- Node.js 20+
- A running Kaneo API (for example `http://localhost:1337`) and web app (for device approval UI).

Kaneo allows `kaneo-cli` and `kaneo-mcp` by default, so you usually do not need extra server configuration.

If you want to run this server with a different client ID, allow it on the Kaneo server:

```bash
DEVICE_AUTH_CLIENT_IDS=kaneo-cli,kaneo-mcp,your-client-id
```

## Environment

| Variable | Description |
|----------|-------------|
| `KANEO_API_URL` | Kaneo API origin (default `http://localhost:1337`). Do not include `/api`. |
| `KANEO_MCP_CLIENT_ID` | Device-flow client id (default `kaneo-mcp`). Must match `DEVICE_AUTH_CLIENT_IDS` on the server. |

## Install

**Recommended (no global install):** run the interactive installer with npx:

```bash
npx @kaneo/mcp
```

npm downloads the package, then an **interactive menu** (arrow keys + Enter) asks **where** to register the server (Cursor user-wide, Cursor project, Claude Desktop, or a custom JSON path). It then merges a `mcpServers` entry that points at this package’s `dist/index.js` with your current Node binary.

In a normal terminal, `npx @kaneo/mcp` and `kaneo-mcp` with no subcommand both start the installer. When the process is **not** attached to a TTY (for example when Cursor launches the MCP server with a pipe), the same entry runs the stdio MCP server instead.

To run the server manually from a shell (for example to debug stdio), use:

```bash
npx @kaneo/mcp serve
```

If you prefer a global install:

```bash
npm install -g @kaneo/mcp
kaneo-mcp
```

(`kaneo-mcp install` is the same installer with an explicit subcommand.)

Non-interactive example (Cursor user config, skip overwrite prompts):

```bash
kaneo-mcp install --target cursor-user -y
```

Point at a self-hosted API when generating the config:

```bash
kaneo-mcp install --target cursor-user -y --api-url https://kaneo.example.com
```

See all options:

```bash
kaneo-mcp install --help
```

If you are currently inside the local `packages/mcp` package directory, npm may resolve the local workspace package instead of the published one and fail to expose the bin. In that case, either run `npx` from outside `packages/mcp`, or use a local build:

```bash
node dist/index.js
```

The published package includes `dist/`. `prepublishOnly` runs the build before publish.

## Develop from source

From the repo root:

```bash
pnpm install
pnpm --filter @kaneo/mcp run build
pnpm --filter @kaneo/mcp run start
pnpm --filter @kaneo/mcp run test
```

Or run it from the package directory:

```bash
pnpm -C packages/mcp run build
```

The CLI entry points to `./dist/index.js`. Use `npx @kaneo/mcp` or `kaneo-mcp` after a global install so your IDE config points at the resolved path.

## Authentication

On the first tool call that needs Kaneo, the server:

1. Requests a device code from `POST /api/auth/device/code`
2. Prints the verification URL and user code to `stderr`
3. Tries to open the browser
4. Polls `POST /api/auth/device/token` until approved
5. Stores the access token at `~/.config/kaneo-mcp/credentials.json` with mode `0600`

## Tools

- Session: `whoami`, `list_workspaces`
- Projects: `list_projects`, `get_project`, `create_project`, `update_project`
- Tasks: `list_tasks`, `get_task`, `create_task`, `update_task`, `move_task`, `update_task_status`
- Comments: `list_task_comments`, `create_task_comment`
- Labels: `list_workspace_labels`, `create_label`, `attach_label_to_task`, `detach_label_from_task`
