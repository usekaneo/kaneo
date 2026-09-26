# Browser smoke tests

These Playwright tests run against a disposable, bundled Kaneo instance built
from the current checkout. They exercise real authentication, workspace creation,
persistence after a reload, and authentication after clearing the session cookie.
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
Reports, failure screenshots, and traces are stored in `.cache/e2e/`.

## BrowserStack Automate

Set `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` in your shell's environment
using the credentials from your BrowserStack account. Keep them out of source
control and command-line arguments. Start the same Compose stack, then run:

```sh
pnpm test:browserstack
```

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
3. Open **Actions → BrowserStack → Run workflow**, selecting `main`.

The workflow is manual and accepts only `main`. It builds the checked-out revision,
runs the tests through BrowserStack Local, uploads the Playwright report, and tears
down the temporary stack even after failure. Credentials are passed only to the
credential check and BrowserStack test step. It does not run on pull requests.

References:

- [BrowserStack Playwright SDK setup](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs/integrate-your-tests)
- [BrowserStack Local](https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs/local-testing)
- [Supported Playwright versions and platforms](https://www.browserstack.com/docs/automate/playwright/browsers-and-os)
