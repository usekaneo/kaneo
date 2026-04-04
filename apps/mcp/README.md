# Kaneo MCP server

Model Context Protocol (stdio) server that talks to a [Kaneo](https://github.com/usekaneo/kaneo) instance using the OAuth 2.0 device authorization flow (RFC 8628), then calls Kaneo’s REST API with `Authorization: Bearer <token>`.

**How MCP fits here:** clients (Cursor, Claude Desktop, etc.) start a **local process** and talk to it over **stdin/stdout** using the MCP protocol. This package ships a **`bin`** (`kaneo-mcp`) for installable CLIs.

This package lives in the Kaneo monorepo at **`apps/mcp`**.

## Prerequisites

- Node.js 20+
- A running Kaneo API (for example `http://localhost:1337`) and web app (for device approval UI).

On the Kaneo server, allow this MCP client’s ID:

```bash
DEVICE_AUTH_CLIENT_IDS=kaneo-cli,kaneo-mcp
```

If you omit `DEVICE_AUTH_CLIENT_IDS`, Kaneo defaults to allowing `kaneo-cli` only—you must include `kaneo-mcp` (or set `KANEO_MCP_CLIENT_ID` to an ID you have allowlisted).

## Environment

| Variable | Description |
|----------|-------------|
| `KANEO_API_URL` | Kaneo API origin (default `http://localhost:1337`). Do not include `/api`. |
| `KANEO_MCP_CLIENT_ID` | Device-flow client id (default `kaneo-mcp`). Must match `DEVICE_AUTH_CLIENT_IDS` on the server. |

## Install (published package)

After publishing `@kaneo/mcp` to npm (or a private registry):

```bash
npm install -g @kaneo/mcp
kaneo-mcp
```

Or:

```bash
npx @kaneo/mcp
```

The published tarball includes **`dist/`** and dependencies; `prepublishOnly` runs the TypeScript build before publish.

## Develop from source (inside this monorepo)

From the **`kaneo/`** directory:

```bash
pnpm install
pnpm --filter @kaneo/mcp run build
pnpm --filter @kaneo/mcp run start
pnpm --filter @kaneo/mcp run test
```

Or with paths:

```bash
pnpm -C apps/mcp run build
```

The CLI entry is `kaneo-mcp` in `package.json` `bin` → `./dist/index.js`.
For **Cursor**, point the MCP command at **`…/kaneo/apps/mcp/dist/index.js`** (absolute path after build).

## Authentication

On the first tool call that needs Kaneo, the server:

1. Requests a device code from `POST /api/auth/device/code`
2. Prints the verification URL and user code to **stderr** (stdout stays clean for MCP)
3. Tries to open the browser
4. Polls `POST /api/auth/device/token` until approved
5. Stores the access token under `~/.config/kaneo-mcp/credentials.json` (mode `0600`)

## Tools

Session: `whoami`, `list_workspaces`

Projects: `list_projects`, `get_project`, `create_project`, `update_project`

Tasks: `list_tasks`, `get_task`, `create_task`, `update_task`, `move_task`, `update_task_status`

Comments: `list_task_comments`, `create_task_comment`

Labels: `list_workspace_labels`, `create_label`, `attach_label_to_task`, `detach_label_from_task`
