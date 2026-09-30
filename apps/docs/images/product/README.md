# Documentation screenshots

These are captures of the real Kaneo frontend using fictional Studio North data. No live account or database is used.

Board, List, task, and Gantt images use the same fixture capture as `apps/site/public/images/product/`, in both light and dark themes. Their original viewport is 1728 × 1000 at 2× density. These eight images are checked-in captures; the settings capture script below does not regenerate them.

Backlog, members, labels, workflow, integrations, notifications, and security settings are captured at 1440 × 1000 with 2× density. From the repository root, run:

```bash
node scripts/ui-review-bot/docs-screenshots.mjs
```

The script requires the UI review bot's Playwright dependencies and Chromium. It starts its own Vite server on port 5188, intercepts API calls with fixtures, blocks external requests, checks for browser errors and missing fixtures, and stops its server when finished.

Place screenshots in a Mintlify `Frame`, with `block dark:hidden` on the light image and `hidden dark:block` on the dark image. Include alt text and a caption. Review each changed capture before publishing.

The current documentation captures were refreshed against the local frontend on 2026-09-26. The fixture date controls sample task deadlines, not the capture date.

To capture only one view, set `DOCS_SCREENSHOT_VIEW`, for example `DOCS_SCREENSHOT_VIEW=integrations node scripts/ui-review-bot/docs-screenshots.mjs`.
