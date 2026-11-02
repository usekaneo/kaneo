# Kaneo CI coding job

`@kaneo/agent-job` claims a dispatched Kaneo coding job using GitHub Actions OIDC, runs OpenCode 1.19.5 headlessly, collects additions/edits/deletions using private Git metadata, and uploads the changeset. The API creates the branch, commit, and draft PR. The wrapper never receives the Agent App installation token.

## Workflow setup

Copy [templates/kaneo-agent.yml](templates/kaneo-agent.yml) into the target repository as `.github/workflows/kaneo-agent.yml` on its default branch. Keep its `run-name`, `job` input, concurrency group, and read-only checkout permissions. Kaneo uses the run name to recover dispatches after a lost HTTP response.

Set these repository Actions variables:

- `KANEO_API_URL`: the same public origin/URL as the Kaneo API's `KANEO_API_URL`, for example `https://kaneo.example.com`. Separate web/API deployments use the API's origin. This is also the default OIDC audience.
- `KANEO_AGENT_SOURCE_REF`: a full 40-character commit SHA in `usekaneo/kaneo` containing this package. Pin a reviewed released commit after this implementation lands. A local, unpushed commit is not available to Actions.

Add `OPENROUTER_API_KEY` as a repository CI secret. It belongs to the customer and is used only in their Actions runner. When the server uses a custom `KANEO_CODE_OIDC_AUDIENCE`, set the same environment variable on the workflow's **Run approved job** step.

The template pins the three actions by immutable SHA. The wrapper's dependency and all platform binaries are pinned to OpenCode 1.19.5 with registry integrity hashes in `pnpm-lock.yaml`; pnpm installs with a frozen lockfile. There is no dependency on an unpublished action or npm release. Install/build runs before the customer model secret is placed in the wrapper step.

The repository checkout has full history, so the wrapper can detach at the API-approved base SHA without a persistent Git credential. No repository dependencies or install scripts are run by the template. OpenCode can read and edit files; shell, network-fetch/search tools, external directories, project configuration, and external plugins are disabled. Tests/toolchains can be run as separately reviewed workflow steps, without handing the coding process a repository write token. This is intentionally a restrictive first adapter.

## Protocol and limits

The claimed spec includes a bounded current task context, marked as untrusted data separately from the approved instructions.

The wrapper exchanges Actions' OIDC JWT at `POST /api/agent-jobs/claim`. It retries a 409 for up to a minute while Kaneo records the dispatch, and masks the returned credential. It sends a coarse heartbeat every 30 seconds, then a single changeset or fixed failure code. HTTP calls time out, reject redirects, and never print response bodies, model output, or credentials. A rejected heartbeat kills the coding process group. The deadline also kills the process group.

The coding process receives an isolated home and an explicit environment containing its model key, PATH, temporary-directory configuration, and restrictive OpenCode settings. It receives no callback credential, OIDC request credential, or GitHub token. Raw occurrences of known job/model credentials in collected file bytes abort the upload. This is not an OS sandbox or an egress firewall: use a disposable GitHub-hosted runner, and apply your own CI/network policy. Do not run jobs on a persistent runner carrying unrelated credentials.

Changesets support at most 300 paths and 10 MiB of decoded file content, including binary and executable files. New symlinks and submodules are rejected. API policy also refuses CI definitions/local actions, Git metadata, traversal, and protected branches. CI logs contain only wrapper outcomes; the Actions run URL is the log link. No model output is sent to Kaneo as progress.

Before starting the coding process and again before collection, the wrapper rejects unresolved symlinks and symlinks that resolve outside the checkout, including existing tracked directory links. Resolved links within the checkout remain supported. This prevents allowed file tools from reaching runner files or collector metadata through a checkout link.

Before the coding process starts, the wrapper copies the approved base tree into a separate temporary Git repository outside the checkout. Collection uses that repository's config, index, and independent object store, with the worktree fixed to the checkout. It never reads the checkout's mutable Git config after the agent runs, so agent-written filters, fsmonitor commands, includes, or worktree redirects cannot control collection. Temporary metadata is removed when the job finishes or fails.

## Development

```sh
pnpm --dir packages/agent-job run build
pnpm --dir packages/agent-job run typecheck
pnpm --dir packages/agent-job test
```

Tests use local temporary repositories, a mocked coding CLI, and mocked HTTP. They never call GitHub or a model provider.
