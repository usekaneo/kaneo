# @kaneo/planka-import

Migrate your [PLANKA](https://planka.app) boards into [Kaneo](https://kaneo.app).

PLANKA has no export feature, so this tool reads your boards through PLANKA's
REST API and recreates them in Kaneo through Kaneo's public API. Nothing is
written to PLANKA, and your PLANKA credentials never leave your machine.

## Usage

```bash
npx @kaneo/planka-import --planka-url https://planka.example.com --dry-run
```

A dry run reads PLANKA only and prints exactly what would be created. When the
plan looks right, add your Kaneo credentials and drop `--dry-run`:

```bash
npx @kaneo/planka-import \
  --planka-url https://planka.example.com \
  --kaneo-url https://cloud.kaneo.app \
  --kaneo-api-key kaneo_xxx \
  --workspace ws_123
```

You'll be prompted for your PLANKA login and for which boards to migrate.

Create a Kaneo API key under **Settings → API keys**. Self-hosting? Point
`--kaneo-url` at your own instance.

## What carries over

| PLANKA | Kaneo |
| --- | --- |
| Board | Project |
| List | Column (`Closed` lists become the final column) |
| Card | Task |
| Card description | Task description |
| Checklists (task lists) | Markdown checkboxes appended to the description |
| Checklist items linked to another card | Task relations (subtask) |
| Labels | Labels, with their original colors |
| Card members | Assignee, matched by email address |
| Due date | Due date |
| Comments | Comments, prefixed with the original author and date |

One Kaneo project is created per PLANKA **board**, since the board is what holds
lists and cards. If a PLANKA project has several boards, each Kaneo project is
named `Project - Board`.

## What doesn't

- **Attachments.** Counted and reported, but not transferred.
- **Archive and trash lists.** Skipped by design; only active and closed lists
  are migrated.
- **Comment authorship.** The comment is created by the API key's owner, but the
  original PLANKA author is recorded and displayed alongside it. Requires Kaneo
  2.17.6 or newer.
- **Priorities.** PLANKA has no priority field, so every task starts at
  `no-priority`.
- **Custom fields, stopwatches, and card subscriptions.** No Kaneo equivalent.

**Run the import as a PLANKA admin.** PLANKA hides other users' email addresses
from non-admin accounts, and assignees are matched by email, so a non-admin
import leaves every task unassigned.

Assignees also only match when the person already exists in the target Kaneo
workspace with the same email address. Invite your team first, then import, and
assignments come across on the first run.

## Options

| Flag | Description |
| --- | --- |
| `--planka-url <url>` | PLANKA instance URL (required) |
| `--planka-user <user>` | Email or username (prompted if omitted) |
| `--planka-password <pass>` | Password (or set `PLANKA_PASSWORD`) |
| `--planka-token <token>` | Use an existing access token instead of logging in |
| `--planka-api-key <key>` | Use a PLANKA API key (or `PLANKA_API_KEY`). Works for SSO-only accounts |
| `--kaneo-url <url>` | Kaneo instance URL (default `https://cloud.kaneo.app`) |
| `--kaneo-api-key <key>` | Kaneo API key (or set `KANEO_API_KEY`) |
| `--workspace <id>` | Target workspace (prompted if omitted) |
| `--project <name\|id>` | Migrate only this PLANKA project (repeatable) |
| `--all` | Migrate every board without prompting |
| `--dry-run` | Report what would happen, write nothing |
| `--skip-comments` | Don't migrate comments |
| `--icon <name>` | Lucide icon for created projects (default `Layout`) |
| `--report <path>` | Write a JSON report |
| `-y, --yes` | Skip the confirmation prompt |

If your PLANKA account uses SSO or has two-factor authentication enabled, there
is no password to log in with. Create a PLANKA API key for the account and pass
`--planka-api-key` instead.

## Re-running

The importer always creates new projects; it does not update ones it created
earlier. If an import goes wrong, delete the created Kaneo project and run it
again. Board-level failures are isolated, so one broken board won't stop the
rest, and the summary tells you which ones failed.

## License

MIT
