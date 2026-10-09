---
name: kaneo-cli
description: Work with Kaneo tasks, projects, comments and time tracking through the `kaneo` CLI. Use when the user asks to list, create, update, assign or close Kaneo tasks, see what is assigned to them, comment, log time, or script against a Kaneo workspace on Kaneo Cloud or a self-hosted instance.
---

# Kaneo CLI

`kaneo` is the official command line for [Kaneo](https://kaneo.app). Run from an agent, stdout is not a terminal, so every command answers in JSON and never prompts.

## Check the setup first

Run `kaneo context`. It prints the server, user, workspace and project in use, and where each value came from.

- `kaneo: command not found`: ask the user to install it in their own terminal, where they can read the script first: `curl -fsSL https://kaneo.app/cli/install.sh | sh` (Windows: `irm https://kaneo.app/cli/install.ps1 | iex`). The binary lands in `~/.local/bin/kaneo` (Windows: `%LOCALAPPDATA%\Programs\kaneo\kaneo.exe`). Your shell may not have that folder on its `PATH` yet, so call it by that full path until it does.
- No user: `kaneo login` is a browser approval only a person can finish. Ask the user to run it in their own terminal. Headless and CI runs use an API key in `KANEO_API_KEY` instead (created in Kaneo under Settings, Account, API Keys).
- No workspace: list them with `kaneo workspace list --jq '.[] | "\(.id) \(.name)"'` and pass `-w <id>`, or ask the user to pick a default with `kaneo workspace use`.
- Server or compatibility errors: `kaneo doctor` explains what is wrong.

You are ready when `kaneo context` shows a user and the workspace you mean to act in.

## Output contract

- Success prints exactly one JSON value on stdout and exits 0.
- Failure prints `{"error": "message"}` on stdout and exits 1. The message names what went wrong, such as a missing project, so fix that and retry. A message saying something needs confirmation means rerunning with `--yes` once the user has agreed.
- `--jq '<expr>'` filters the JSON with a built-in jq. Strings print raw, one result per line. Reach for it to keep large results small.
- Writes print JSON describing the change: `task create` returns the new task (`--jq .ticketId` gives its ticket id), and `task status` returns the `from` and `to` columns. Run `kaneo task view` to see the full task afterwards.
- `task list` stops at 50 tasks. Pass `--all` when you need every match, for example to count.
- `task mine` returns at most 100 tasks per workspace, soonest due first, and cannot page further. For a complete list, run `kaneo task list -p <KEY> --mine --all` for each project.

## Addressing things

- Tasks by ticket id such as `KAN-12`, projects by key such as `KAN`, workspaces by id. When the user names a project, find its key with `kaneo project list`.
- Statuses are the slugs of a project's columns, such as `to-do`, `in-progress` or `done`. Projects can have custom columns, so list them with `kaneo column list -p KAN` before moving a task somewhere unfamiliar.
- The workspace comes from `-w`, then `KANEO_WORKSPACE`, then a `.kaneo.json` in the current folder or any parent, then the default from `kaneo workspace use`. The project comes from `-p`, then `KANEO_PROJECT`, then `.kaneo.json`. A `.kaneo.json` further up the tree can select a different workspace than expected; `kaneo context` shows which source won.
- Dates take `YYYY-MM-DD`, `today`, `tomorrow` or `+3d`.
- Descriptions and comments are Markdown. Pass long text with `-F <file>`, or `-F -` to read stdin.

## Common commands

```sh
kaneo project list --jq '.[] | "\(.key)  \(.name)"'
kaneo column list -p KAN --jq '.[] | "\(.slug)  \(.name)"'
kaneo task mine --jq '.[] | "\(.ticketId)  \(.statusName)  \(.title)"'
kaneo task list -p KAN --open --jq '.[] | select(.priority == "urgent") | .ticketId'
kaneo task view KAN-12
kaneo task create "Fix flaky login test" -p KAN --priority high --due tomorrow --label Bug --assignee me
kaneo task status KAN-12 in-progress
kaneo task edit KAN-12 --priority urgent --add-label Bug
kaneo task assign KAN-12 me
kaneo comment add KAN-12 "Fixed in #123"
kaneo time log KAN-12 1h30m -m "Pairing on the fix"
kaneo search "login redirect" --type tasks
kaneo task delete KAN-12 --yes
kaneo api GET /workspace --jq '.[].name'
```

Every command documents its arguments and flags in `kaneo <command> --help`. The full reference is at https://kaneo.app/docs/core/integrations/cli-commands.

## Changes other people see

A workspace is shared and updates reach teammates live. Confirm with the user before deleting anything, applying `kaneo task bulk`, or moving tasks between projects, then pass `--yes` where the command asks for confirmation. Keep credentials private: leave `KANEO_API_KEY`, `--token` values and the config file (`~/.config/kaneo/config.json`) out of output and messages.
