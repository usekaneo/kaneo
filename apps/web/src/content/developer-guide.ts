// Long-form developer documentation rendered in-app by the Developer Guide
// route via MarkdownRenderer. This is a content document (like a README), not
// UI chrome; the page's chrome strings live in i18n. Update the copy here when
// the Git/MCP workflow changes.
export const developerGuideMarkdown = `## Working tasks from code to done

How we connect this Kaneo instance to our repositories, drive task status from Git, and pick up and finish assigned work directly inside Claude Code. Read once, then keep the daily loop at the end handy.

## 1. Connect your repository

Done once per project by a maintainer. The instance-level credentials (the GitHub App, or the GitLab token) are configured by whoever runs Kaneo; you then link a repository from **Project Settings**.

### GitHub

1. An admin configures the GitHub App and installs it on the organization (see the Kaneo GitHub setup guide).
2. Open your project → **Project Settings → GitHub Integration**.
3. **Browse Repositories** and pick one, or enter the owner and repo name.
4. Click **Verify Installation**, then **Connect Repository**.

### GitLab (repo.iotech.mn)

1. Create a Personal Access Token on [repo.iotech.mn](https://repo.iotech.mn/-/user_settings/personal_access_tokens): avatar → **Edit profile → Access tokens**, tick the \`api\` scope, set an expiry, **Create**, and copy it (shown once).
2. Open your project → **Project Settings → GitLab Integration**.
3. Enter instance URL \`https://repo.iotech.mn\`, the **project path** (\`group/project\`), and paste the **PAT**.
4. **Verify**, then **Connect** — Kaneo registers the webhook.
5. Press **Import Issues** once to pull existing issues in as tasks. New issues sync automatically afterward, so you only do this a single time.

> **Assignees match by email.** An issue's assignee links to a Kaneo user by email address. Each developer's email on repo.iotech.mn (or GitHub) must be the **same** as their kaneo.iotech.mn account email, or assignments won't map and tasks won't appear as theirs. Confirm emails match before importing.

Once connected: new Kaneo tasks create a matching issue in the repo, labels stay in sync both ways, and pushes, PRs/MRs, and issue closes drive task status.

## 2. Connect the MCP server

The MCP server lets your AI coding tool read and update Kaneo — list your tasks, read details, move status, comment — without leaving the editor. This instance exposes a built-in HTTP endpoint:

\`\`\`
https://kaneo.iotech.mn/api/mcp
\`\`\`

### Claude Code

Claude Code speaks Streamable HTTP, so point it straight at the endpoint:

\`\`\`bash
claude mcp add --transport http kaneo https://kaneo.iotech.mn/api/mcp
\`\`\`

On the first Kaneo tool call you're sent to sign in and approve the client (OAuth 2.1 + PKCE). After that, every tool runs as **you**. Check it with \`/mcp\`.

### Codex

Use an API key (Settings → Account → Developer) kept in your environment, not the file:

\`\`\`toml
[mcp_servers.kaneo]
url = "https://kaneo.iotech.mn/api/mcp"
bearer_token_env_var = "KANEO_MCP_TOKEN"
startup_timeout_sec = 20
tool_timeout_sec = 60
\`\`\`

Modern HTTP MCP is experimental in Codex — enable \`features.mcp_2026_07_28 = true\`. If your build lags, use the stdio package instead: \`npx @kaneo/mcp\` with \`KANEO_API_KEY\` set.

## 3. How issues and tasks map

A Kaneo task and its repo issue are two views of one thing, kept in sync both ways.

- Creating a task in Kaneo creates a linked repo issue. Each task is an **independent unit** with its own number.
- The **Kaneo task number** and the **repo issue number** are separate counters and often differ. Branch names use the *task* number; commit closing keywords use the *issue* number.
- Status flows both directions — moving the task in Kaneo relabels or closes the issue, and Git activity moves the task.

Default status transitions:

| Git action | Task moves to |
| --- | --- |
| Push a task branch (\`proj-123\`) | in-progress |
| Open a pull/merge request | in-review |
| Merge the pull/merge request | done |
| Commit \`fixes #45\` (any branch) | done |
| Close the linked issue | done |

Reopening the issue reverses the last transition. A task already in a final column is never moved backward by a later push. These transitions are configurable per project in integration settings.

## 4. Branches and commit messages

Two independent handles drive the automation: the **branch name** and the **commit message**.

### Branch name links the task

Name the branch with the project slug and the **Kaneo task number**. Default pattern is \`{slug}-{number}\`; a description after it is fine.

\`\`\`bash
# task #123 in project "proj"
git checkout -b proj-123-fix-login-redirect
\`\`\`

- One task, one branch. Pushing it moves that task to in-progress.
- \`main\`, \`master\`, \`develop\`, \`staging\`, \`production\` are protected and never move a task.

### Commit message closes the issue and task

Reference the **repo issue number** with a closing keyword. This closes the issue and moves the task to done — and it works from a feature branch, with no PR required.

\`\`\`bash
# issue #45 is the repo issue linked to your task
git commit -m "fix: stop double-submit on login (fixes #45)"
\`\`\`

- Keywords: \`close\`/\`closes\`/\`closed\`, \`fix\`/\`fixes\`/\`fixed\`, \`resolve\`/\`resolves\`/\`resolved\`, each followed by \`#<issue>\`.
- A bare \`#45\` with no keyword only cross-references; it does not close.

### Let Claude Code name the branch

To name a branch you need three things: the project **slug**, the **task number**, and the **pattern**. With the Kaneo MCP connected, Claude Code reads the slug and number and runs Git itself. The one thing it can't infer is your naming convention, so commit a small \`CLAUDE.md\` to each repository root — no database setting is involved:

\`\`\`markdown
## Branch & commit convention
- Branch from the Kaneo task: <project-slug>-<task-number>-<short-title>
  e.g. task #123 in "proj" -> proj-123-fix-login
- Never commit straight to main/master/develop/staging/production.
- Close work in the commit body with fixes #<issue-number>
  (the Git host issue number, from the task's linked issue).
- Use Conventional Commits: feat / fix / refactor / docs.
\`\`\`

Keep the convention identical to the project's branch pattern in Kaneo, so what Claude Code generates is what the webhook matches.

## 5. Find and implement tasks in Claude Code

With the MCP server connected, you never leave the editor to see what's assigned or to update it. Ask in plain language; the tool calls the Kaneo tools underneath.

**See your work.** Ask, for example: *"List my open Kaneo tasks in the proj project and show the top one's details."* Underneath it uses \`whoami\`, \`list_projects\`, \`list_tasks\` (filtered to you), and \`get_task\` (full description, comments, and the linked issue number).

**Implement it end to end:**

1. Pick the task; note its Kaneo number and linked issue number from \`get_task\`.
2. Branch on the task number (\`git checkout -b proj-123-short-title\`) and push — the task moves to in-progress.
3. Implement the change and run the project's checks (lint, typecheck, tests).
4. Commit referencing the issue number: \`git commit -m "feat: … (fixes #45)"\`.
5. Open a pull/merge request for review (in-review); merge (done). For small no-review work, the \`fixes #45\` commit alone takes it to done.
6. Post progress with \`create_task_comment\`, or move status explicitly with \`update_task_status\` (call \`list_project_columns\` first for valid slugs).

Let Git drive status wherever possible — a correctly named branch and a \`fixes #\` commit keep Kaneo accurate with no manual dragging. Reach for \`update_task_status\` only for states Git can't express, such as blocked or needs-design.
`;
