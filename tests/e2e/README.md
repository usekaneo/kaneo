# Browser smoke tests

These Playwright tests run against a disposable, bundled Kaneo instance built
from the current checkout. They exercise real authentication, workspace creation,
persistence after a reload, and authentication after clearing the session cookie.
They also create projects and tasks, persist task edits, and verify that another
workspace member receives edits through a real WebSocket without reloading.
PostgreSQL uses temporary storage; no existing database or root `.env` is used.

## Local run

Requires Node 24, pnpm 10.32.1, and Docker Compose v2.

```sh
pnpm --dir tests/e2e install --frozen-lockfile --ignore-scripts
pnpm --dir tests/e2e exec playwright install chromium
docker compose -f tests/e2e/compose.yml up --build --wait --wait-timeout 180
pnpm test:e2e
docker compose -f tests/e2e/compose.yml down --volumes
```

The test instance binds to `http://localhost:18173`. Tests create unique synthetic
users and workspaces. Stop the Compose stack after testing, including failed runs;
its temporary database is discarded. The stack's project name is
`kaneo-browserstack-e2e`; do not run two copies simultaneously on the same machine.
Reports, failure screenshots, and local Playwright traces are stored in `.cache/e2e/`.
BrowserStack disables native Playwright tracing; use its session recordings for cloud runs.

## BrowserStack Automate

Set `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` in your shell's environment
using the credentials from your BrowserStack account. Keep them out of source
control and command-line arguments. Start the Compose stack with BrowserStack's
local hostname so the app, API, and session cookies share the same origin:

```sh
export KANEO_E2E_HOST=bs-local.com
docker compose -f tests/e2e/compose.yml up --build --wait --wait-timeout 180
pnpm test:browserstack
docker compose -f tests/e2e/compose.yml down --volumes
unset KANEO_E2E_HOST
```

BrowserStack rewrites `localhost` to `bs-local.com` for WebKit. Configuring that
hostname explicitly avoids mixing the page's origin with a localhost API URL.

The SDK starts and stops BrowserStack Local to connect remote browsers to the
disposable instance. `tests/e2e/browserstack.yml` runs Chrome on Windows 11 and Playwright
WebKit on macOS Sequoia, with one session per platform (two concurrent sessions).
WebKit is an engine compatibility check; this configuration does not test Safari
on a real iPhone. Remove a platform if your plan allows only one parallel session.
Playwright is pinned to 1.62.1, from BrowserStack's supported 1.62 version family;
check their supported versions before upgrading it.

This integration uses Automate only. Test Reporting & Analytics is disabled;
Percy and other BrowserStack products are not configured. Session results and
videos appear in the Automate dashboard under **Kaneo**.

## GitHub Actions

1. Add repository Actions secrets `BROWSERSTACK_USERNAME` and
   `BROWSERSTACK_ACCESS_KEY`.
2. Merge this integration into `main`.
3. Every push to `main` now runs **BrowserStack** automatically. To rerun it,
   open **Actions → BrowserStack → Run workflow**, selecting `main`.

**Browser tests** runs the same suite in Chromium for every pull request, including
forks, without cloud credentials. **BrowserStack** runs Chrome on Windows and
WebKit on macOS after a push to `main`, or a manual dispatch on `main`. Cloud runs
are serialized to stay within the two-session limit; obsolete PR runs are cancelled.

Both workflows build the checked-out revision, use a disposable database, upload
reports for seven days, and tear down the stack even after failure. BrowserStack
credentials are passed only to its credential check and cloud test step. No
production instance is contacted. Tests use synthetic accounts; invitation setup
uses the normal API without sending email because SMTP is not configured.

Add the **Browser tests / smoke** check to branch protection when it has proven
stable. The cloud check runs after merge and does not currently gate releases.

References:

- [BrowserStack Playwright SDK setup](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs/integrate-your-tests)
- [BrowserStack Local](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs/local-testing)
- [Supported Playwright versions and platforms](https://www.browserstack.com/docs/automate/playwright/browsers-and-os)
