# Telegram assignee mentions from a self-declared profile field

Date: 2026-11-08
Status: Proposed (waiting for approval)
Approach chosen: A — self-declared field on the global user profile

## Intent

Kaneo posts project task activity to Telegram. Users want the assignee to be
mentioned in the group message so Telegram notifies that person. Kaneo has no
Telegram identity today, so it cannot render a real mention.

This design adds a self-declared Telegram handle to the global user profile and
uses it to render a mention for the task assignee when the task is created or
reassigned.

## Goals

- A user can set, change, and clear a Telegram handle in Settings → Profile.
- The handle accepts `@username`, a bare username, `t.me/...`, or a numeric
  Telegram user ID. The server normalizes it into one canonical value.
- Telegram messages for `task.created` show the task assignee and mention them
  when the assignee has a handle.
- A new Telegram event toggle, `taskAssigneeChanged`, mentions the new
  assignee when enabled.
- Existing installations keep their current Telegram message volume after the
  upgrade; the new event is off by default.
- The handle is not exposed to other workspace members, not logged, and not
  added to shared chat/provider schemas.
- The change works on a single instance without Redis or S3.

## Non-goals

- Verifying that the declared handle belongs to the Kaneo user.
- Receiving Telegram updates or running a bot webhook/polling loop.
- Admin-managed per-workspace or per-project identity mapping.
- Mentioning users in Slack, Discord, Mattermost, or generic webhooks.
- Tagging comment authors or arbitrary `@mentions` in descriptions.
- A dedicated mobile profile UI. The session field will carry through; the
  mobile screen is a later change.
- Tagging the assignee on every event. Only `task.created` and the opt-in
  `taskAssigneeChanged` event get the mention.

## Anti-goals

- A mention that pings the wrong person because the actor and the assignee were
  conflated.
- Breaking the existing Telegram message format, event defaults, or configs.
- Adding a Telegram-only event to `integrationEventToggles`,
  `integrationEventsSchema`, or `CHAT_EVENT_ITEMS` shared by other providers.
- Making the profile save path depend on a project's bot token.

## Constraints

- better-auth owns user updates. Follow the existing `locale` precedent:
  `additionalFields` on the server, `inferAdditionalFields` on the client.
- Telegram `tg://user?id=<id>` only works inside an inline HTML link. Messages
  must keep `parse_mode: "HTML"`.
- A mention only notifies a user who is a member of the target group (or who has
  contacted the bot privately). The code cannot guarantee delivery; docs and UI
  helper text must say so.
- Public contracts stay accurate: update Zod schemas/descriptions and run
  `pnpm openapi:check:fix`.
- User-facing copy goes through i18n keys with `i18n/en-US.json` as the source.
- The API enforces permission; a hidden UI control is not an authorization
  check.

## Approaches considered

### A. Self-declared global profile field — chosen

One optional `telegram_handle` column on `user`, edited in Settings → Profile.

- Pros: one identity for every workspace and project; no admin burden; small
  UI/API surface; follows the `locale` pattern; ship in one change.
- Cons: cannot verify ownership; a typo silently produces no notification.

### B. Admin-managed workspace/project mapping

A mapping table per workspace or project, filled by admins.

- Pros: admins control the values.
- Cons: duplicated mapping per workspace, a large settings/admin surface, and
  it still cannot verify ownership. Does not fit a self-hosted tool that should
  stay simple.

### C. Bot deep-link linking

The user opens `t.me/<bot>?start=<token>`; the bot captures the numeric ID and
Kaneo stores it.

- Pros: accurate, no username needed, verifies identity.
- Cons: Kaneo currently only sends Telegram messages. This needs an update
  receiver (public webhook or polling), secrets, retries, a linking UI, and
  handling one bot per project. That is a separate project.

A is chosen because it delivers the requested behavior with the smallest model
and leaves the `telegram_handle` column usable by C later.

## Design

### 1. Data model

Add one nullable column to `userTable` in
`apps/api/src/database/schema.ts`:

```ts
telegramHandle: text("telegram_handle"),
```

Generate the migration with
`pnpm --filter @kaneo/api db:generate` and inspect the SQL. No unique index:
two people could legitimately type the same value by mistake, and a uniqueness
error would leak that another account uses the handle.

Canonical storage:

- numeric ID: digits only, as a string (avoids integer precision issues);
- username: lowercased, without the leading `@` (Telegram usernames are
  case-insensitive);
- cleared value: `NULL`.

### 2. Validation and normalization

Create `apps/api/src/user/telegram-handle.ts` with a pure
`normalizeTelegramHandle(input: unknown): string | null`:

1. Treat `null` and `undefined` as `null` (clearing the value); reject other
   non-string input.
2. Trim.
3. Treat an empty or whitespace-only string as `null`.
4. Strip an optional `https://t.me/`, `http://t.me/`, `t.me/`, or `telegram.me/`
   prefix.
5. Strip one leading `@`.
6. If the remainder is all digits and is greater than zero, return it as-is.
7. If it matches `^[a-z][a-z0-9_]{4,31}$` case-insensitively, return it
   lowercased.
8. Otherwise throw a dedicated `TelegramHandleError`.

The hooks catch `TelegramHandleError` and rethrow
`new APIError("BAD_REQUEST", { message: "Enter a valid Telegram username or user ID" })`
so the client gets a 400 instead of a 500. Keep the helper free of Hono imports
so it stays unit-testable.

Wire it into both user hooks in `apps/api/src/auth.ts`:

- `databaseHooks.user.update.before`, before `assertManagedProfileUnchanged`:
  when `Object.hasOwn(user, "telegramHandle")`, return
  `{ data: { telegramHandle: normalizeTelegramHandle(user.telegramHandle) } }`.
- `databaseHooks.user.create.before`: normalize `telegramHandle` the same way
  before returning the role/verification data. A crafted sign-up request may
  include the field; it belongs to the new account, but it must still be
  canonical.

`input: true` also lets better-auth's `/admin/update-user` set the field. That
is acceptable (an admin acting on an account) and the same update hook
normalizes it. Custom OAuth does not manage this field: `MANAGED_PROFILE_FIELDS`
is `name, image, locale`, and `refresh-managed-profile.ts` selects only those
columns, so a provider claim cannot overwrite the handle. Do not add
`telegramHandle` to `MANAGED_PROFILE_FIELDS`.

Keep the helper idempotent: hooks may run for non-HTTP writes too. If
better-auth rejects `null` in a hook return for an optional string field, fall
back to storing `""` and treating an empty string as unset everywhere. Do not
add a second write path.

Add a unit test in `tests/api/user/telegram-handle.test.ts` covering: `@name`,
bare name, `t.me/name`, numeric ID, uppercase username, empty string, invalid
characters, too short, too long, zero, and non-string input.

### 3. Auth, session, and API contract

Server (`apps/api/src/auth.ts`):

```ts
telegramHandle: {
  type: "string",
  input: true,
  required: false,
},
```

Client (`apps/web/src/lib/auth-client.ts`): add the same field to the existing
`inferAdditionalFields({ user: { ... } })` call.

Web type (`apps/web/src/types/user.ts`): add
`telegramHandle?: string | null`.

`apps/api/src/user/controllers/get-current-user.ts`: select
`userTable.telegramHandle`.

`apps/api/src/user/response.ts`: add
`telegramHandle: z.string().nullable().openapi({ description: "..." })` to
`currentUserSchema`. The description must say the value is a normalized
username (no `@`) or numeric Telegram user ID.

Update `tests/api-integration/current-user.test.ts` for the new field.

Do **not** add `telegramHandle` to `get-workspace-members.ts` or any shared
member list. It is only returned to the owner through the session and
`GET /user/me`.

### 4. Profile UI

Extend the existing profile form from `{ name }` to
`{ name, telegramHandle }`:

- `apps/web/src/components/settings/profile/profile-page.tsx`
- `apps/web/src/components/settings/profile/profile-details-section.tsx`
- `apps/web/src/components/settings/profile/use-profile-name-autosave.ts`

Rename the hook to `use-profile-details-autosave.ts` and save only the fields
that changed. Keep the current debounce, queue, toast, and `refetchUser`
behavior for the name. Add the Telegram field to the same form so there is one
save path and one validation summary.

The new row uses `SettingsFormRow` and `Input`:

- label: `settings:informationPage.telegramLabel`
- description: `settings:informationPage.telegramHint`, explaining that the
  value is a username or numeric ID and that the person must be in the Telegram
  group.
- placeholder: `@username or 123456789`
- `autoComplete="off"`, `maxLength={64}`.

Client-side validation mirrors the server for fast feedback, but the server
remains authoritative. Empty input is valid and clears the value.

`apps/web/src/hooks/mutations/use-update-user-profile.ts`: add
`telegramHandle?: string | null` to the request type and pass it to
`authClient.updateUser`.

Update `apps/web/src/components/settings/profile/profile-page.test.tsx`:
the Telegram input renders, is editable, saves via the mutation, and clears.

i18n keys in `i18n/en-US.json` under `settings.informationPage`:

- `telegramLabel`
- `telegramHint`
- `telegramPlaceholder`
- `validation.telegramInvalid`

Run `pnpm i18n:check:fix` so every locale gets the new keys.

### 5. Telegram mention rendering

Create `apps/api/src/plugins/telegram/html.ts` and move the existing
`escapeHtml` there. Keep `events.ts` importing it; do not create a cycle.

Create `apps/api/src/plugins/telegram/mention.ts`:

```ts
export type TelegramIdentity = {
  name: string;
  telegramHandle: string | null;
};

export function formatTelegramMention(identity: TelegramIdentity): string;
```

Rules:

- numeric handle →
  `<a href="tg://user?id=${digits}">${escapeHtml(name)}</a>`
- username handle → `@${escapeHtml(handle)}`
- no handle → `escapeHtml(name)` (plain name, no tag)

Only digits can reach the `href`, and the name/handle are escaped. Add unit
tests in `tests/api/plugins/telegram-mention.test.ts` for both branches, HTML
characters in the name, and a missing handle.

### 6. Resolve the assignee from the event, and only mention it where intended

`getTelegramEventData` in `apps/api/src/plugins/telegram/events.ts` currently
loads only the user identified by the event's `userId`. For `task.created` that
id is the assignee; for other events it is the actor. That conflation must not
drive a mention.

Change the signature to accept both the actor and the event-time assignee:

```ts
getTelegramEventData(
  taskId: string,
  projectId: string,
  actorId: string | null,
  assigneeId: string | null,
): Promise<TelegramEventData | null>
```

Callers supply the event-time assignee, not the task's current row:

- `handleTaskCreated`: `event.userId || null` (create-task stores the assignee
  there; an unassigned task has `""`);
- `handleTaskAssigneeChanged`: `event.newAssigneeId`.

Do not re-read `taskTable.userId` for the assignee. `publishEvent` is
fire-and-forget, so by the time the handler runs the task may already have been
reassigned again; the mention would then name a different person than the event
body. Event-time ids keep the mention and the body aligned.

Change the shape to:

```ts
type TelegramEventData = {
  taskTitle: string;
  taskNumber: number | null;
  projectName: string;
  taskUrl: string | null;
  actorName: string | null;
  assignee: TelegramIdentity | null;
  status: string | null;
  priority: string | null;
};
```

Implementation:

- Keep the existing task query for title, number, status, priority, project and
  workspace. It does not supply the assignee.
- Collect `actorId` and `assigneeId`, dedupe, and load `id, name, telegramHandle`
  for those ids in one `inArray(userTable.id, ids)` query. Guard the empty case.
- `actorName` comes from `actorId`; `assignee` comes from `assigneeId`.

Only two handlers render the assignee line. `runTelegramHandler` takes
`{ actorId, assigneeId }` and passes both straight to
`getTelegramEventData`; `assigneeId: null` means no assignee lookup and no
assignee line.

- `handleTaskCreated`: `{ actorId: event.actorId ?? null, assigneeId: event.userId || null }`
- `handleTaskAssigneeChanged`: `{ actorId: event.userId, assigneeId: event.newAssigneeId }`
- status/priority/title/description/comment: `{ actorId: event.userId, assigneeId: null }`.
  Their message format and query count stay exactly as today: no assignee
  line, no mention, no extra user lookup.

When `mentionAssignee` is true and `data.assignee` exists,
`sendTelegramMessage` adds one line:

```
<b>Assignee:</b> @alex
```

or the numeric-ID inline link. The existing `Triggered by:` line keeps using
`actorName`.

### 7. Actor id for `task.created`

Add `actorId?: string` to `TaskCreatedEvent` in
`apps/api/src/plugins/types.ts`.

In `apps/api/src/plugins/registry.ts`, extend the `task.created` subscription
generic with `currentUserId?: string` and forward it:

```ts
actorId: data.currentUserId,
```

`apps/api/src/task/controllers/create-task.ts` already publishes
`currentUserId`, so the interactive create path gets the real creator.

`runTelegramHandler` gains the `actorId` option described in section 6:

- `handleTaskCreated` passes `event.actorId ?? null`;
- all other handlers pass `event.userId` (the actor for those events).

`duplicate-task.ts` and `import-tasks.ts` already publish `currentUserId`, so
they show the duplicating/importing user. Only the external GitLab/Gitea/GitHub
webhook publishers omit it; they show `Triggered by: Kaneo` instead of
mislabelling the assignee. Do not change those publishers in this scope.

### 8. `taskAssigneeChanged`

Server:

- `apps/api/src/plugins/telegram/config.ts`: add `"taskAssigneeChanged"` to
  `telegramEventKeys`, and `taskAssigneeChanged: false` to
  `defaultTelegramEvents`. Off by default preserves existing behavior on
  upgrade.
- `apps/api/src/plugins/telegram/events.ts`: add
  `handleTaskAssigneeChanged`, body
  `"<title> was assigned to <newAssignee>."`, and register
  `onTaskAssigneeChanged` in `apps/api/src/plugins/telegram/index.ts`.
  The mention comes from the assignee line, so the body stays plain text.

API contract:

- Create `apps/api/src/telegram-integration/events.ts` with a Telegram-only
  extension:
  `telegramIntegrationEventToggles = integrationEventToggles.extend({ taskAssigneeChanged: z.boolean().optional() })`
  and
  `telegramIntegrationEventsSchema = integrationEventsSchema.extend({ taskAssigneeChanged: z.boolean() })`.
- Use those in `apps/api/src/telegram-integration/schema.ts` and
  `response.ts`.
- `telegram-controller.ts` already spreads `defaultTelegramEvents`, so
  `toResponse` and `buildNextTelegramConfigFromPatch` pick up the new key.
- Do not modify `apps/api/src/integrations/schema.ts` or
  `apps/api/src/integrations/response.ts`.

Web:

- `apps/web/src/fetchers/telegram-integration/*`: add
  `taskAssigneeChanged?: boolean` / `boolean` to the create, update, and get
  types for Telegram only.
- Create `apps/web/src/components/project/integrations/telegram/telegram-events.ts`
  with `TelegramEvents = ChatEvents & { taskAssigneeChanged: boolean }`,
  `TELEGRAM_EVENT_ITEMS = [...CHAT_EVENT_ITEMS, { id: "taskAssigneeChanged",
  labelKey: "settings:telegramIntegration.events.taskAssigneeChanged" }]`, and
  `toTelegramEvents`.
- Use `TELEGRAM_EVENT_ITEMS` in `telegram-integration-settings.tsx` and
  `TelegramEvents` in `telegram-form-values.ts`.
- Do not modify `CHAT_EVENT_ITEMS`.

i18n: add
`settings.telegramIntegration.events.taskAssigneeChanged = "Assignee changed"`.

OpenAPI: run `pnpm openapi:check:fix`.

### 9. Docs

Update `apps/docs/core/integrations/telegram.mdx`:

- a "Mention the assignee" section under the existing setup steps;
- how to set the handle in Settings → Profile;
- username vs numeric ID, and how to obtain a numeric ID;
- the group-membership requirement;
- the `taskAssigneeChanged` toggle and its default-off state.

Update `apps/docs/core/integrations/outgoing-webhooks.mdx` only if its Telegram
event list would otherwise be misleading.

Validate from `apps/docs` with `pnpm dlx mint validate` and
`pnpm dlx mint broken-links`.

## Verification

Smallest proof per area, then the broad gate before a requested commit:

- `pnpm exec vp test run tests/api/user/telegram-handle.test.ts`
- `pnpm exec vp test run tests/api/plugins/telegram-mention.test.ts`
- `pnpm exec vp test run tests/api/plugins/telegram-logging.test.ts`
- Telegram handler tests must assert that `task.created` and
  `taskAssigneeChanged` include the `Assignee:` line / `tg://user?id=` anchor,
  that the other five events keep their current format with no `Assignee:`
  line, and that `taskAssigneeChanged` uses `event.newAssigneeId` even when the
  task row already points at someone else.
- `pnpm exec vp test run apps/web/src/components/settings/profile/profile-page.test.tsx`
- `pnpm exec vp test run apps/web/src/components/project/integrations/telegram/build-telegram-request.test.ts`
- `pnpm exec vp test run apps/web/src/components/project/integrations/telegram/telegram-integration-settings.test.tsx`
- `pnpm --filter @kaneo/api typecheck`
- `pnpm --filter @kaneo/web typecheck`
- `pnpm openapi:check`
- `pnpm i18n:check`
- `pnpm lint` and `pnpm test` before a requested commit.

Integration proof for the mutation path: a PostgreSQL test that updates
`telegramHandle` through the auth API and reads it back from `GET /user/me`,
plus an invalid value returning 400. Extend the existing
`tests/api-integration/current-user.test.ts` or add a focused file next to it.

## Rollout

1. Schema + auth field + normalization + `GET /user/me` + tests.
2. Profile UI + i18n + web tests.
3. Mention helper + assignee resolution + actor forwarding + Telegram tests.
4. `taskAssigneeChanged` event, Telegram-only schemas/UI, OpenAPI, docs.
5. Operator step (outside code): add the bot to the target group, send one
   message there, read `chat.id` from `getUpdates`, and make sure every
   assignee who should be notified is a member of that group.

## Decisions left to the builder

- Whether to keep one `use-profile-details-autosave` hook or extract a small
  generic debounced-save helper if the two-field diff becomes noisy.
- Whether clearing should store `NULL` or `""` if better-auth rejects `NULL` in
  the update hook.
- Exact copy for the helper text, within the constraints above.
- Whether to add a Telegram handle row to the mobile profile screen now or
  later.
