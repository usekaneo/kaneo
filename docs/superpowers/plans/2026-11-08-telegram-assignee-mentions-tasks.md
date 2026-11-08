# Telegram Assignee Mentions — Task Checklist

Tracking list for `2026-11-08-telegram-assignee-mentions.md`.
Task numbering, file scopes, and gates mirror that plan; the plan is the spec for each step.

## Constraints (apply to every task)

- No commits, pushes, or PRs until the user explicitly asks.
- Use `vp` for tests (`pnpm exec vp test run <file>`), not raw `vitest`/`tsc`.
- Keep `parse_mode: "HTML"` on every Telegram send.
- Telegram-only additions stay in Telegram files; do not touch
  `apps/api/src/integrations/schema.ts`, `apps/api/src/integrations/response.ts`, or `CHAT_EVENT_ITEMS`.
- Never expose a user's `telegramHandle` to anyone but that user.

## Dependency map

```
Task 1 → Task 2 → Task 3 ─┐
Task 4 → Task 5 → Task 6 → Task 7 → Task 8 ─┴→ Task 9
```

Tasks 1 and 4 are independent and can start in parallel.
Task 8 needs both chains (Tasks 3 and 7) complete. Task 9 needs all.

## Tasks

- [x] **Task 1 — Store a normalized Telegram handle on the user**
  - Files: create `apps/api/src/user/telegram-handle.ts`, `tests/api/user/telegram-handle.test.ts`; modify `apps/api/src/database/schema.ts` (add `telegram_handle` after `locale`), `apps/api/src/auth.ts` (additional field + create/update hooks); generate a Drizzle migration in `apps/api/drizzle/`.
  - Produces: `normalizeTelegramHandle(input): string | null`, `TelegramHandleError`, `userTable.telegramHandle`.
  - Gate: `pnpm exec vp test run tests/api/user/telegram-handle.test.ts` then `pnpm --filter @kaneo/api typecheck`.
  - Pins: invalid handle rejected; empty/`null`/`undefined` clear to `null`; numeric only when a positive safe integer; username must start with a letter.

- [x] **Task 2 — Expose the handle on the current user and the web mutation** *(needs Task 1)*
  - Files: `apps/api/src/user/controllers/get-current-user.ts`, `apps/api/src/user/response.ts`, `apps/web/src/lib/auth-client.ts`, `apps/web/src/types/user.ts`, `apps/web/src/hooks/mutations/use-update-user-profile.ts`, `tests/api-integration/current-user.test.ts`.
  - Produces: `currentUserSchema.telegramHandle`, exported `UpdateUserProfileRequest` with `telegramHandle?: string | null`.
  - Gate: `tests/api-integration/current-user.test.ts` (needs disposable PostgreSQL + `DATABASE_URL`; if unavailable, API typecheck after implementation), plus API and web typecheck.
  - Pins: invalid handle returns 400, not 500; clearing really clears.

- [x] **Task 3 — Edit the handle in Settings → Profile** *(needs Task 2)*
  - Files: new `apps/web/src/components/settings/profile/telegram-handle.ts` + test; rename `use-profile-name-autosave.ts` → `use-profile-details-autosave.ts`; `profile-page.tsx`, `profile-details-section.tsx`, `profile-page.test.tsx`, `i18n/en-US.json`.
  - Produces: `normalizeTelegramHandleInput`, `useProfileDetailsAutosave({ name, telegramHandle, refetchUser })`, form values `{ name, telegramHandle }`.
  - Gate: both profile tests, `pnpm --filter @kaneo/web typecheck`, `pnpm i18n:check`.
  - Pins: field renders and saves normalized value; empty input clears to `null`.

- [x] **Task 4 — Format Telegram mentions**
  - Files: create `apps/api/src/plugins/telegram/html.ts`, `mention.ts`; modify `events.ts` to drop its local `escapeHtml`; test `tests/api/plugins/telegram-mention.test.ts`.
  - Produces: `escapeHtml`, `TelegramIdentity`, `formatTelegramMention`.
  - Gate: `tests/api/plugins/telegram-mention.test.ts`.
  - Pins: `@username` vs `<a href="tg://user?id=...">`; strict numeric detection; HTML escaping of names.

- [x] **Task 5 — Build the Telegram message body** *(needs Task 4)*
  - Files: create `apps/api/src/plugins/telegram/format.ts`, `message.ts`; modify `events.ts`; test `tests/api/plugins/telegram-message.test.ts`.
  - Produces: `TelegramEventData`, `buildTelegramMessage(title, body, data)`.
  - Gate: message test plus `tests/api/plugins/telegram-logging.test.ts`.
  - Pins: assignee line only when assigned; exactly one `Triggered by:` line; titles/names escaped.

- [x] **Task 6 — Resolve the event-time actor and assignee** *(needs Task 5)*
  - Files: create `apps/api/src/plugins/telegram/event-data.ts` (move `getTelegramEventData` / `getTaskUrl`, keep `.limit(ids.length)` on the user lookup); modify `events.ts`, `apps/api/src/plugins/types.ts`, `apps/api/src/plugins/registry.ts`; test `tests/api/plugins/telegram-events.test.ts`.
  - Produces: `getTelegramEventData(taskId, projectId, actorId, assigneeId)`, `TaskCreatedEvent.actorId`, `runTelegramHandler(context, event, featureKey, { actorId, assigneeId }, buildMessage)`.
  - Gate: `telegram-events.test.ts`, `telegram-message.test.ts`, `telegram-logging.test.ts`, API typecheck.
  - Pins: unassigned create (`userId === ""`) sends no assignee and queries no empty id; non-assignee events keep current format.

- [x] **Task 7 — Add the Telegram `taskAssigneeChanged` event** *(needs Task 6)*
  - Files: `apps/api/src/plugins/telegram/config.ts`, `events.ts`, `index.ts`; test `tests/api/plugins/telegram-events.test.ts`.
  - Produces: `telegramEventKeys` includes `taskAssigneeChanged`, `defaultTelegramEvents.taskAssigneeChanged === false`, `handleTaskAssigneeChanged`.
  - Gate: `telegram-events.test.ts` plus API typecheck.
  - Pins: reassignment race — mentions `event.newAssigneeId`, not `taskTable.userId`; off by default on upgrade.

- [x] **Task 8 — Extend the Telegram API contract and settings UI** *(needs Tasks 3 and 7)*
  - Files: create `apps/api/src/telegram-integration/events.ts`; modify Telegram integration `schema.ts`/`response.ts`; three web fetchers; new `telegram-events.ts` + test; `telegram-form-values.ts`, `telegram-integration-settings.tsx`, related tests; `i18n/en-US.json`.
  - Produces: `telegramIntegrationEventToggles`, `telegramIntegrationEventsSchema`, `TelegramEvents`, `TELEGRAM_EVENT_ITEMS`, `toTelegramEvents`.
  - Gate: web event/request/settings tests, API + web typecheck, `pnpm openapi:check:fix` then `pnpm openapi:check`, `pnpm i18n:check`.
  - Pins: shared `CHAT_EVENT_ITEMS` unchanged; new toggle defaults off; OpenAPI regenerated, not hand-edited.

- [x] **Task 9 — Document the feature and run the full gate** *(needs Tasks 1–8)*
  - Files: `apps/docs/core/integrations/telegram.mdx` (and `outgoing-webhooks.mdx` only if needed).
  - Gate: from `apps/docs`, `pnpm dlx mint validate` and `pnpm dlx mint broken-links`; then `pnpm lint`, `pnpm typecheck`, `pnpm test`.
  - Docs must state: `@username` / `t.me/...` / numeric ID supported; the assignee must be a member of the Telegram group; `taskAssigneeChanged` is a separate, off-by-default toggle.
  - Final: manual check on a disposable instance (set handle → configure integration → create assigned task → confirm mention → reassign → confirm opt-in message).
