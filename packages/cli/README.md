# Kaneo CLI

[`@kaneo/cli`](https://www.npmjs.com/package/@kaneo/cli) is the official command-line client for [Kaneo](https://kaneo.app), the open source project manager. It is maintained in the [usekaneo/kaneo](https://github.com/usekaneo/kaneo) monorepo and installs the `kaneo` command.

```bash
npm install -g @kaneo/cli
kaneo login
kaneo task list
```

It works with Kaneo Cloud and with self-hosted instances, prints styled output in a terminal and plain JSON everywhere else, and needs Node.js 20 or newer.

## Sign in

`kaneo login` uses device authorization: it shows a one-time code, copies it to your clipboard, and opens the approval page in your browser. Approve it there and the CLI stores a token for that server.

```bash
kaneo login                                   # Kaneo Cloud
kaneo login --api-url https://kaneo.example.com
kaneo whoami
kaneo logout
```

For CI and scripts, use an API key instead (create one in Settings, then Account, then API Keys):

```bash
export KANEO_API_KEY=...
kaneo task list -w <workspace-id> -p KAN
```

Credentials are resolved in this order: `--token`, then `KANEO_API_KEY`, then the stored login. A stored login is only sent to the server it was created for.

## Commands

| Command | What it does |
| --- | --- |
| `kaneo` | Home screen: your account, workspace, open tasks and the main commands |
| `kaneo login`, `logout`, `whoami` | Sign in, sign out, show the current account and server |
| `kaneo profile list`, `use`, `rename`, `remove` | Manage stored logins for several servers or accounts |
| `kaneo task list`, `mine`, `view`, `open` | List a project's tasks or your own, show one, open it in the browser |
| `kaneo task create`, `edit`, `duplicate`, `delete` | Create, change, copy and delete tasks |
| `kaneo task status`, `move`, `assign`, `field` | Change a task's column, project, assignee or custom fields |
| `kaneo task bulk` | Apply one change to many tasks at once |
| `kaneo task attach`, `images` | Upload files to a task, show the images in its description |
| `kaneo task relation`, `link`, `activity` | Subtasks and blockers, links, and the task's history |
| `kaneo task export`, `import` | Export a project's tasks as JSON and create tasks from such a file |
| `kaneo comment list`, `add`, `edit`, `delete` | Read and manage task comments |
| `kaneo label list`, `create`, `edit`, `delete` | Manage workspace labels |
| `kaneo time start`, `stop`, `status`, `log`, `list`, `edit` | Track time with a timer or log it afterwards |
| `kaneo project list`, `view`, `create`, `edit`, `archive`, `unarchive`, `move`, `delete` | Manage projects |
| `kaneo column list`, `create`, `edit`, `move`, `delete` | Manage a project's columns |
| `kaneo field list`, `create`, `delete` | Manage a project's custom fields |
| `kaneo workflow list`, `set`, `delete` | Move tasks when GitHub, GitLab or Gitea events arrive |
| `kaneo workspace list`, `use`, `create`, `edit`, `leave`, `delete` | Choose and manage workspaces |
| `kaneo member list`, `invite`, `role`, `remove` | Manage workspace members |
| `kaneo invitation list`, `pending`, `accept`, `decline`, `cancel` | Manage invitations you sent or received |
| `kaneo notification list`, `read` | Read your notifications (also `kaneo inbox`) |
| `kaneo search` | Search tasks, projects and comments |
| `kaneo link`, `unlink` | Save or remove the workspace and project for a repository |
| `kaneo context` | Show the settings in use and where each came from |
| `kaneo doctor` | Check the server, your login and API compatibility |
| `kaneo api` | Send an authenticated request to any API endpoint, like `gh api` |

The [command reference](https://kaneo.app/docs/core/integrations/cli-commands) lists every argument and flag. Run any command with `--help` for the same information, and `kaneo --completions zsh` (or `bash`, `fish`, `sh`) to print a shell completion script.

Tasks are addressed by their ticket ID, such as `KAN-123`, or by id. When a required workspace, project or column is missing and you are in a terminal, the CLI offers a searchable picker. In scripts it fails with an error that says which flag to pass.

Commands that delete or remove data ask for confirmation in a terminal and need `--yes` in scripts. Comments and descriptions can be read from a file with `-F <file>`, or from stdin with `-`.

## Output

Human mode is the default in a terminal. JSON mode is used with `--json` or `--jq`, with `KANEO_JSON=true`, or whenever stdout is not a terminal:

- A successful command prints exactly one JSON value on stdout.
- A failed command prints `{"error": "message"}` on stdout and exits with code 1.
- JSON mode never prints colors, spinners, images or extra lines.

`--jq` filters the JSON with a built-in jq engine, so `jq` does not need to be installed. Strings print without quotes, one result per line:

```bash
kaneo task list -p KAN --jq '.[] | select(.priority == "urgent") | .ticketId'
```

Use `--human` to force styled output. Styled output respects `NO_COLOR`, `FORCE_COLOR` and `TERM=dumb`, and falls back to ASCII when the terminal cannot show Unicode.

Images in task descriptions (`kaneo task images`), uploads (`kaneo task attach`) and your avatar (`kaneo whoami`) are shown inline in Kitty, Ghostty, iTerm2 and WezTerm. Other terminals with 256 colors and Unicode get a preview drawn with colored blocks, and the rest get links. Set `KANEO_IMAGES=kitty|iterm|blocks|off` to override this. Your token is only sent with requests for files on your Kaneo server.

## Configuration

| Setting | Flag | Environment |
| --- | --- | --- |
| Server | `--api-url` | `KANEO_API_URL` (default `https://cloud.kaneo.app`) |
| Token | `--token` | `KANEO_API_KEY` |
| Workspace | `-w`, `--workspace` | `KANEO_WORKSPACE` |
| Project | `-p`, `--project` | `KANEO_PROJECT` |
| Stored login | `--profile` | `KANEO_PROFILE` |
| JSON output | `--json` | `KANEO_JSON=true` |
| Inline images | | `KANEO_IMAGES` (`kitty`, `iterm`, `blocks` or `off`) |
| Web app address for links | | `KANEO_WEB_URL` (detected at login) |
| Config file | | `KANEO_CONFIG` |

Logins live in `~/.config/kaneo/config.json` (or `$XDG_CONFIG_HOME/kaneo/config.json`), readable only by you. The running timer is tracked in `timer.json` next to it. If that file was written by a different kaneo CLI, this one leaves it untouched and asks you to move it or set `KANEO_CONFIG`.

`kaneo link` saves the workspace and project for a repository in a `.kaneo.json` at its root, and `kaneo unlink` removes them:

```json
{ "workspace": "your-workspace-id", "project": "KAN" }
```

The workspace comes from `-w`, then `KANEO_WORKSPACE`, then `.kaneo.json`, then the default from `kaneo workspace use`. The project comes from `-p`, then `KANEO_PROJECT`, then `.kaneo.json`. Run `kaneo context` to see which values are in use and where each came from.

## Develop

```bash
pnpm install
pnpm --filter @kaneo/cli build     # bundles to dist/kaneo.mjs
node packages/cli/dist/kaneo.mjs --help
pnpm --filter @kaneo/cli test
pnpm --filter @kaneo/cli typecheck
```

The CLI is written with [Effect](https://effect.website) 4 (`effect/cli`, `effect/http`, `effect/schema`) and bundled into one file with no runtime dependencies, so `kaneo --version` starts in about 50 ms. Commands are `Effect.fn` functions, failures are tagged errors mapped in one place (`src/errors/describe.ts`), and the API client, config store and terminal are services that tests replace with layers.

## Releasing

Bump `version` in `package.json` and merge to `main`. The `Publish CLI Package` workflow publishes to npm with provenance and creates a `cli-v<version>` release.
