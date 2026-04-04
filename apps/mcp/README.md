# Kaneo MCP server

`@kaneo/mcp` is a local MCP server for Kaneo.

It runs over stdio, signs in with Kaneo's device flow, and then calls the Kaneo API with a bearer token. The package lives in `apps/mcp` in this monorepo and exposes the `kaneo-mcp` CLI.

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

If the package is published to npm or your private registry:

```bash
npm install -g @kaneo/mcp
kaneo-mcp
```

Or:

```bash
npx @kaneo/mcp
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
pnpm -C apps/mcp run build
```

The CLI entry points to `./dist/index.js`.

For Cursor or another MCP client, point the command at the built file:

```text
.../kaneo/apps/mcp/dist/index.js
```

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
