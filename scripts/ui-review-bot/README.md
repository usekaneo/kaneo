# Peekareq

A maintainer comments `/peekareq` on an open Kaneo PR. The bot selects up to three UI scenarios, captures the PR in Chromium, frames the changed component, uploads three distinct previews, and posts this line followed by a description/image table:

> This UI-screenshot was auto-made by a beta tool made by @tinsever

Below the screenshot table, **Findings (Beta)** and **Run info** are collapsed by default. Findings contain axe-core accessibility results and clearly labeled AI suggestions with practical fixes. Run info lists the models that returned responses, provider-reported AI cost, and elapsed time from planning through review (including job waits). Re-runs update the bot's existing comment.

## GitHub setup

- Install the GitHub App on `usekaneo/kaneo` with **Contents: Read and write** and **Pull requests: Read and write**, and **Issues: Read-only**. The installation owner must approve permission updates.
- Set Actions variable `APP_CLIENT_ID` and secrets `APP_PRIVATE_KEY` (the complete PEM file) and `OPENROUTER_API_KEY`.
- Put this directory and both `ui-review.yml` and `ui-review-run.yml` workflows on the default branch.
- Deploy `worker/` to Cloudflare (see below). Enable the App webhook at its `/webhook` URL, set the same signing secret, and subscribe only to **Issue comment**.

Comment exactly `/peekareq` in a PR's conversation, or use **Actions → Peekareq → Run workflow**. Current write, maintain, or admin access is required. Bots, comment edits, quoted commands, arguments, ordinary issues, and closed PRs do not start a run. Failed permission checks stop the request before model calls. Only authorized requests can cancel an earlier run for the same PR.

The final job authenticates as `<app-slug>[bot]`. PNGs are stored on a dedicated `code/ui-screenshots` branch and embedded using immutable URLs. Concurrent uploads preserve earlier images. Failed captures and reports for a changed or closed PR are not posted.

## Local use

Requires Node 24, pnpm, git, and authenticated `gh` with contents and PR-comment write access. Workflows use Node 24.

```sh
npm --prefix scripts/ui-review-bot ci --ignore-scripts
npm --prefix scripts/ui-review-bot run setup
npm --prefix scripts/ui-review-bot start -- 1719
```

A PR number or URL is required. Runs upload and comment automatically; add `--no-post` to keep results local. The default key file is `~/.env.openroutercopythis`, containing `API_KEY=…` or `OPENROUTER_API_KEY=…`. It is parsed as data, never executed.

```sh
npm --prefix scripts/ui-review-bot start -- 1719 --no-post
npm --prefix scripts/ui-review-bot start -- 1719 --capture-only --no-post
npm --prefix scripts/ui-review-bot test
node scripts/ui-review-bot/publish.mjs /absolute/path/to/report.json
```

Use `--model provider/model` or `--key-file /path/to/key.env` to override defaults. Local App authentication uses `GH_TOKEN` and `UI_REVIEW_BOT_LOGIN=<app-slug>[bot]`; otherwise `gh` supplies your user identity.

Default model: `qwen/qwen3.8-flash`, verified against OpenRouter's live vision-model catalog. If its provider is rate-limited or temporarily unavailable, the run switches to `google/gemini-2.5-flash-lite`; explicitly selected other models keep their selection. Temporary failures retry at most twice and all attempts count toward the five-request budget. The model receives the PR diff, relevant source, synthetic page text, and screenshots. Each run allows at most five calls, three scenarios, and six interactions per scenario. Reports record provider-reported usage and cost; there is no fixed dollar cap.

Local reports, before/after PNGs, and pixel differences are saved in `.cache/ui-review-bot/runs/<id>/`. Ctrl+C cancels capture and closes previews.

## Coverage and isolation

The current fixture adapter supports account settings, a synthetic workspace/project/task, stateful time-entry Start/Stop controls, and custom-field values. Multiselect changes use fixture-backed scenarios for project configuration, the option picker, and multiple selected values. Each scenario identifies the component to frame and controls that must be visible; portalled menus are included in the frame. Missing or clipped controls and identical previews prevent publication. Defined fixture scenarios use their short, specific names as captions. Marketing-site and docs-only changes stop during planning because the preview currently runs `apps/web` only. Each scenario gets its own fixture state. The capture-only preset is specific to PR #1719. Other features may require fixtures; unknown API reads produce incomplete captures. Full before/after captures use a 1440×1000 desktop viewport; GitHub receives bounded close-up previews captured directly in Chromium. Captions are limited to 70 characters. Captures use light theme, English, UTC, and disabled animations. The captured PR areas are audited with axe-core 4.13.0 using WCAG 2 A/AA, 2.1 A/AA, 2.2 AA, and best-practice rules. Confirmed violations and checks needing manual review remain distinct. AI also reviews visible clipping, overlap, readability, and interaction feedback. These checks do not establish full accessibility compliance or test real backend behavior.

Before images use the PR's merge base. Different routes or interaction states are labeled in the local report rather than treated as regression scores. Each revision uses its own frozen lockfile with install scripts disabled. Browser traffic is restricted to the local preview and synthetic API responses.

The Worker verifies GitHub signatures and current maintainer access before sending `repository_dispatch`. Ordinary comments never create Actions entries. Actions rechecks the original comment and author before planning. Authorization, planning, capture, and review/posting use separate GitHub-hosted runners. Only capture executes PR code, without provider secrets or a write token. Trusted jobs check out the workflow revision. Review accepts bounded capture JSON and PNGs, preserves the trusted plan's PR identity, rejects malformed images, and recalculates differences. App credentials are provided only after review. The default Actions token is read-only.

Local capture executes PR code as your OS user; it is not an OS sandbox. Use GitHub-hosted capture for untrusted PRs. Credentials are not passed into preview environments or written to reports. PR previews, short captions, bounded findings, and run statistics are published; intermediate workflow artifacts expire after one day.

## Cloudflare webhook

The Worker is `peekareq-webhook`; endpoint: `https://peekareq-webhook.marmeladenjunge.workers.dev/webhook`. It uses the Workers Free-compatible request path and a small D1 table to deduplicate command comment IDs. The optional code-review relay also uses this Worker; browser captures continue to run in Actions. Its installation token is restricted to `kaneo` with Contents write and Pull requests read; repository dispatch uses the existing Contents permission.

```sh
npx wrangler@4.133.0 d1 execute peekareq-commands --remote --file scripts/ui-review-bot/worker/schema.sql --config scripts/ui-review-bot/worker/wrangler.jsonc
npx wrangler@4.133.0 secret put APP_PRIVATE_KEY --config scripts/ui-review-bot/worker/wrangler.jsonc
npx wrangler@4.133.0 secret put WEBHOOK_SECRET --config scripts/ui-review-bot/worker/wrangler.jsonc
npx wrangler@4.133.0 deploy --config scripts/ui-review-bot/worker/wrangler.jsonc
```

Store the App key as PKCS#8 PEM (convert a downloaded PKCS#1 key with `openssl pkcs8 -topk8 -nocrypt`). Keep secrets out of source control. For a new account, create a D1 database and update its ID in `wrangler.jsonc`. The Worker checks the configured installation ID and repository before using App credentials. If dispatch times out after claiming a command, it deliberately does not replay it: check Actions first, then post a fresh command if needed.

## Code review (Beta)

`/peekareview` requests a source-based review of an open PR. It uses the same live maintainer authorization and webhook filtering as `/peekareq`. Ordinary comments do not start either workflow. Re-runs update one Peekareq comment containing collapsed **Findings (Beta)** and **Run info**, including model, new AI cost, duration, and reviewed revision.

The code reviewer uses `deepseek/deepseek-v4-flash` through OpenRouter. It reads immutable base/head source without checking out or executing PR code. It retrieves callers, guards, constraints, and related tests; a second pass challenges each candidate, then a base-only pass checks that the behavior is newly introduced. Findings need validated source citations. Missing evidence, malformed responses, timeouts, and omitted files produce explicitly incomplete results. An empty review is not an approval.

Deployment requires `code-review.yml`, the updated Worker/schema, Worker secrets `OPENROUTER_API_KEY` and `REVIEW_PROXY_TOKEN`, Actions secret `PEEKAREVIEW_PROXY_TOKEN` with the same 64-character hexadecimal token, and Actions variable `PEEKAREVIEW_MODEL_URL` pointing to the Worker's `/review-model` endpoint. The provider key stays in the Worker for code reviews. The existing screenshot workflow keeps its separate provider-key configuration.

The relay requires an initialized `review_budget` row with `id = 1`, `ceiling = 850000`, and `initial_spend` equal to the already committed trial spending in integer microdollars. It refuses inference without initialization. The $0.85 trial ceiling includes prior development spend and a 15% allowance; it never resets automatically. Requests reserve maximum cost atomically before inference, and unknown charges remain reserved. Successful identical requests are cached; unresolved requests are not automatically retried within a run. An explicitly requested new run can try again while retaining the earlier reservation. A local review also has a $0.10 limit and a 12-minute deadline.

For a private local review:

```sh
node scripts/ui-review-bot/code-review/cli.mjs 1735
node scripts/ui-review-bot/code-review/cli.mjs --base BASE_SHA --head HEAD_SHA
node scripts/ui-review-bot/code-review/cli.mjs --budget
```

Reports are saved under `.cache/code-review/`; the local CLI does not post to GitHub. The Actions publisher rechecks the original command, current maintainer access, PR head, and base immediately before posting.
