# Kaneo CLI

The official command-line client for [Kaneo](https://kaneo.app), the open source project manager. It is maintained in the [usekaneo/kaneo](https://github.com/usekaneo/kaneo) monorepo and ships as a single `kaneo` binary for macOS, Linux and Windows.

```bash
curl -fsSL https://kaneo.app/cli/install.sh | sh
kaneo login
kaneo task list
```

It works with Kaneo Cloud and with self-hosted instances, and prints styled output in a terminal and plain JSON everywhere else.

## Install

macOS and Linux:

```bash
curl -fsSL https://kaneo.app/cli/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://kaneo.app/cli/install.ps1 | iex
```

With Homebrew, or with npm and Node.js 20 or newer:

```bash
brew install usekaneo/tap/kaneo
npm install -g @kaneo/cli
```

The script picks the build for your system from the `cli-v<version>` GitHub release, verifies it against the release's `SHA256SUMS`, and installs it to `~/.local/bin/kaneo` (Windows: `%LOCALAPPDATA%\Programs\kaneo\kaneo.exe`, added to your user `PATH`). Both scripts are plain text, so you can read [install.sh](https://github.com/usekaneo/kaneo/blob/main/apps/site/public/cli/install.sh) and [install.ps1](https://github.com/usekaneo/kaneo/blob/main/apps/site/public/cli/install.ps1) before running them.

| Variable | What it does |
| --- | --- |
| `KANEO_VERSION` | Install this version, such as `0.1.0` or `cli-v0.1.0`, instead of the latest |
| `KANEO_INSTALL_DIR` | Install into this directory |
| `KANEO_DOWNLOAD_URL` | Download from a mirror that has the GitHub release layout (`<url>/cli-v<version>/<file>`) instead of GitHub. Requires `KANEO_VERSION` |

```bash
curl -fsSL https://kaneo.app/cli/install.sh | KANEO_VERSION=0.1.0 sh
curl -fsSL https://kaneo.app/cli/install.sh | KANEO_INSTALL_DIR="$HOME/bin" sh
curl -fsSL https://kaneo.app/cli/install.sh | KANEO_DOWNLOAD_URL=https://mirror.example.com/kaneo KANEO_VERSION=0.1.0 sh
```

```powershell
$env:KANEO_VERSION = "0.1.0"; irm https://kaneo.app/cli/install.ps1 | iex
```

To update, run the install command again, `brew upgrade kaneo` for Homebrew, or `npm install -g @kaneo/cli@latest` for npm. To uninstall, delete the binary, and `~/.config/kaneo` too if you want to remove your logins.

Prefer the script to downloading a binary from the release page with a browser: the macOS builds are signed ad hoc but not notarized, so Gatekeeper can block browser downloads. On Alpine and other musl distributions, install the C++ runtime first with `apk add libstdc++`. See the [install guide](https://kaneo.app/docs/cli/install) for mirrors, offline installs and supported systems.

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

The [command reference](https://kaneo.app/docs/cli/reference) lists every argument and flag. Run any command with `--help` for the same information, and `kaneo --completions zsh` (or `bash`, `fish`, `sh`) to print a shell completion script.

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

## Agent skill

The [`kaneo-cli` skill](https://github.com/usekaneo/kaneo/tree/main/skills/kaneo-cli) teaches coding agents such as Claude Code, Codex and Cursor to use the CLI: check the login and workspace, read JSON output, address tasks by ticket ID, and confirm before deleting anything.

```bash
npx skills add usekaneo/kaneo --skill kaneo-cli
```

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

Bump `version` in `package.json` and merge to `main`. The `Release CLI` workflow (`.github/workflows/publish-cli.yml`) tests and bundles the CLI, compiles standalone binaries with Bun for macOS, Linux (glibc and musl) and Windows, and creates the `cli-v<version>` GitHub release with the binaries and a `SHA256SUMS` file. It skips versions that already have a release, and you can also run it by hand from the Actions tab.

After a stable release, the workflow also points the `kaneo` formula in [usekaneo/homebrew-tap](https://github.com/usekaneo/homebrew-tap) at the new binaries. It writes the formula with `scripts/homebrew-formula.sh` and pushes with the `HOMEBREW_TAP_TOKEN` secret, a fine-grained token that can write to that repository only.

While the `CLI_NPM_PUBLISH` repository variable is `true`, the same workflow also publishes `@kaneo/cli` to npm with provenance through trusted publishing, skipping versions that are already published.
