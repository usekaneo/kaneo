# Telegram Assignee Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Kaneo user declare one Telegram handle and have Kaneo render a real Telegram mention for the task assignee on task creation and reassignment.

**Architecture:** A nullable `telegram_handle` column on `user`, edited through better-auth's `updateUser` and normalized in server hooks. The Telegram plugin resolves the actor and the event-time assignee in one user lookup, then formats either `@username` or an inline `tg://user?id=` link. Telegram-only event keys and UI items extend the shared chat schemas without changing them.

**Tech Stack:** Hono, Drizzle, PostgreSQL, Valibot/Zod/OpenAPI, React, TanStack Query, react-hook-form, Telegram Bot API `sendMessage` with HTML parse mode, Vitest through Vite+.

**Spec:** `docs/superpowers/specs/2026-11-08-telegram-assignee-mentions-design.md`

## Global Constraints

- Node `^24.15.0 || >=26.0.0`, pnpm `12.15.0`.
- Use the Vite+ task runner (`vp`), not raw `tsc` or `vitest`.
- **Do not commit, push, or open a PR unless the user explicitly asks.** The commit steps are review boundaries; run them only when the user wants commits.
- Keep `parse_mode: "HTML"` for every Telegram send.
- `tg://user?id=<id>` is only valid inside an inline `<a href="...">`; never emit it as bare text.
- Do not modify `apps/api/src/integrations/schema.ts`, `apps/api/src/integrations/response.ts`, or `CHAT_EVENT_ITEMS`. Telegram-only additions go in Telegram files.
- `taskAssigneeChanged` is **off by default**; existing installations must not gain new messages on upgrade.
- `i18n/en-US.json` is the source for user-facing copy.
- Never log, return to other workspace members, or include in a member list the Telegram handle.
- A mention only notifies a Telegram user who is a member of the target group (or has contacted the bot privately). Docs and helper text must say so.

## Review Focus

These are the failure modes most likely to bite a user; each is pinned by a test in the owning task.

1. **Invalid handle returns 400, not 500.** A typo like `alex name` or `alex-name` must surface a validation error from `POST /api/auth/update-user`.
2. **Clearing the handle really clears it.** Empty, whitespace-only, `null`, and `undefined` all become no handle; the message must never render a lone `@`.
3. **Numeric detection is strict.** Only a positive safe integer becomes `tg://user?id=`. A username that starts with a digit or contains `-` must be rejected, not turned into a link.
4. **HTML escaping.** A display name or task title containing `&`, `<`, or `>` must not break the message or inject markup.
5. **Unassigned task creation.** `task.created` with `userId === ""` must not render an `Assignee:` line and must not query an empty user id.
6. **Reassignment race.** `taskAssigneeChanged` must mention `event.newAssigneeId`, not whatever `taskTable.userId` holds when the fire-and-forget handler runs.

---

### Task 1: Store a normalized Telegram handle on the user

**Files:**
- Create: `apps/api/src/user/telegram-handle.ts`
- Create: `tests/api/user/telegram-handle.test.ts`
- Modify: `apps/api/src/database/schema.ts:33-60`
- Modify: `apps/api/src/auth.ts:325-346` and `apps/api/src/auth.ts:787-858`
- Generate: `apps/api/drizzle/00XX_*.sql`

**Interfaces:**
- Produces: `normalizeTelegramHandle(input: unknown): string | null`
- Produces: `TelegramHandleError`
- Produces: `userTable.telegramHandle: string | null`
- Produces: better-auth `telegramHandle` additional field

- [ ] **Step 1: Write the failing normalization test**

Create `tests/api/user/telegram-handle.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import {
  normalizeTelegramHandle,
  TelegramHandleError,
} from "../../../apps/api/src/user/telegram-handle";

describe("normalizeTelegramHandle", () => {
  it.each([
    ["@Alex_Name", "alex_name"],
    ["alex_name", "alex_name"],
    ["t.me/alex_name", "alex_name"],
    ["telegram.me/alex_name", "alex_name"],
    ["https://t.me/alex_name", "alex_name"],
    ["123456789", "123456789"],
    ["  123456789  ", "123456789"],
    ["", null],
    ["   ", null],
    [null, null],
    [undefined, null],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeTelegramHandle(input)).toBe(expected);
  });

  it.each([
    "ab",
    "1alex",
    "alex-name",
    "alex name",
    "a".repeat(33),
    "0",
    "99999999999999999999",
    123,
    {},
  ])("rejects %p", (input) => {
    expect(() => normalizeTelegramHandle(input)).toThrow(TelegramHandleError);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm exec vp test run tests/api/user/telegram-handle.test.ts`
Expected: FAIL because `apps/api/src/user/telegram-handle.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/api/src/user/telegram-handle.ts`:

```ts
export class TelegramHandleError extends Error {
  constructor() {
    super("Enter a valid Telegram username or user ID");
    this.name = "TelegramHandleError";
  }
}

const PREFIX = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i;
const USERNAME = /^[a-z][a-z0-9_]{4,31}$/i;
const NUMERIC = /^[1-9]\d{0,19}$/;

export function normalizeTelegramHandle(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") throw new TelegramHandleError();

  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(PREFIX, "");
  const withoutAt = withoutPrefix.replace(/^@/, "");

  if (NUMERIC.test(withoutAt) && Number.isSafeInteger(Number(withoutAt))) {
    return withoutAt;
  }
  if (USERNAME.test(withoutAt)) return withoutAt.toLowerCase();

  throw new TelegramHandleError();
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm exec vp test run tests/api/user/telegram-handle.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the database column**

In `apps/api/src/database/schema.ts`, add after `locale`:

```ts
telegramHandle: text("telegram_handle"),
```

Run: `pnpm --filter @kaneo/api db:generate`
Expected: a new `apps/api/drizzle/00XX_*.sql` containing
`ALTER TABLE "user" ADD COLUMN "telegram_handle" text;`. Inspect it and keep it.

- [ ] **Step 6: Add the better-auth field**

In `apps/api/src/auth.ts`, inside `user.additionalFields` after `locale`:

```ts
telegramHandle: {
  type: "string",
  input: true,
  required: false,
},
```

- [ ] **Step 7: Normalize on create and update**

In `apps/api/src/auth.ts`, add a local wrapper near the hooks:

```ts
function normalizedTelegramHandleFromUser(user: object) {
  if (!Object.hasOwn(user, "telegramHandle")) return undefined;
  try {
    return normalizeTelegramHandle(
      (user as Record<string, unknown>).telegramHandle,
    );
  } catch (error) {
    if (error instanceof TelegramHandleError) {
      throw new APIError("BAD_REQUEST", { message: error.message });
    }
    throw error;
  }
}
```

Import `normalizeTelegramHandle` and `TelegramHandleError` from
`./user/telegram-handle`.

In `databaseHooks.user.update.before`, normalize **before**
`assertManagedProfileUnchanged`, matching the spec:

```ts
const telegramHandle = normalizedTelegramHandleFromUser(user);
await assertManagedProfileUnchanged(user, ctx);
const cleared = await clearEmailVerificationOnAdminChange(user, ctx);
if (telegramHandle === undefined) return cleared;
return { data: { ...(cleared?.data ?? {}), telegramHandle } };
```

In `databaseHooks.user.create.before`, read the value first:

```ts
const telegramHandle = normalizedTelegramHandleFromUser(user);
```

Return it on every branch. For the anonymous and `/admin/create-user` early
returns:

```ts
return telegramHandle === undefined ? undefined : { data: { telegramHandle } };
```

For the normal branch, add it to the returned data:

```ts
...(telegramHandle === undefined ? {} : { telegramHandle }),
```

- [ ] **Step 8: Verify**

Run:

```bash
pnpm exec vp test run tests/api/user/telegram-handle.test.ts
pnpm --filter @kaneo/api typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 9: Commit (only when the user asked for commits)**

```bash
git add apps/api/src/user/telegram-handle.ts tests/api/user/telegram-handle.test.ts \
  apps/api/src/database/schema.ts apps/api/src/auth.ts apps/api/drizzle
git commit -m "feat(api): store a normalized telegram handle on users"
```

---

### Task 2: Expose the handle on the current user and the web mutation

**Files:**
- Modify: `apps/api/src/user/controllers/get-current-user.ts`
- Modify: `apps/api/src/user/response.ts:23-35`
- Modify: `apps/web/src/lib/auth-client.ts:69-77`
- Modify: `apps/web/src/types/user.ts`
- Modify: `apps/web/src/hooks/mutations/use-update-user-profile.ts`
- Test: `tests/api-integration/current-user.test.ts`

**Interfaces:**
- Consumes: `userTable.telegramHandle`
- Produces: `currentUserSchema.telegramHandle: z.string().nullable()`
- Produces: exported `UpdateUserProfileRequest = { name?: string; locale?: string; telegramHandle?: string | null }`

- [ ] **Step 1: Update the failing integration expectations**

In `tests/api-integration/current-user.test.ts`, add `telegramHandle: null`
to the exact object in the API-key test. Add:

```ts
it("normalizes and clears the owner's Telegram handle", async () => {
  const { app } = createApp();
  const session = await signUpWithSession(app, {
    email: "telegram@example.com",
    name: "Telegram User",
  });

  const update = await app.request("/api/auth/update-user", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: session.cookies },
    body: JSON.stringify({ telegramHandle: "@Alex_Name" }),
  });
  expect(update.status).toBe(200);

  const me = await app.request("/api/user/me", {
    headers: { cookie: session.cookies },
  });
  expect(await me.json()).toMatchObject({ telegramHandle: "alex_name" });

  const clear = await app.request("/api/auth/update-user", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: session.cookies },
    body: JSON.stringify({ telegramHandle: "" }),
  });
  expect(clear.status).toBe(200);

  const cleared = await app.request("/api/user/me", {
    headers: { cookie: session.cookies },
  });
  expect(await cleared.json()).toMatchObject({ telegramHandle: null });
});

it("rejects an invalid Telegram handle with 400", async () => {
  const { app } = createApp();
  const session = await signUpWithSession(app, {
    email: "telegram-invalid@example.com",
    name: "Telegram Invalid",
  });

  const response = await app.request("/api/auth/update-user", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: session.cookies },
    body: JSON.stringify({ telegramHandle: "alex name" }),
  });

  expect(response.status).toBe(400);
});
```

Import `signUpWithSession` from `./helpers/auth-session`.

- [ ] **Step 2: Run the integration test and watch it fail**

Run: `pnpm --dir apps/api exec vp test run --config vitest.integration.config.ts ../../tests/api-integration/current-user.test.ts`
Expected: FAIL because `/api/user/me` does not return `telegramHandle` (and the
invalid value is silently stored). This needs a disposable PostgreSQL and
`DATABASE_URL`; if none is available, run the API typecheck after Step 3
instead.

Do not skip this step when a database is available: it is the only proof that
better-auth `1.7.14` accepts `null` for this optional field. If the clear
request returns 500, fall back to storing `""` from the update hook and treat
an empty string as unset everywhere; keep the single write path.

- [ ] **Step 3: Implement the API response**

In `apps/api/src/user/controllers/get-current-user.ts`, add
`telegramHandle: userTable.telegramHandle` to the select.

In `apps/api/src/user/response.ts`, add to `currentUserSchema`:

```ts
telegramHandle: z.string().nullable().openapi({
  description:
    "The user's normalized Telegram username (without @) or numeric user ID, used for assignee mentions. Null when unset.",
}),
```

- [ ] **Step 4: Wire the web session and mutation**

In `apps/web/src/lib/auth-client.ts`, add to `inferAdditionalFields`:

```ts
telegramHandle: {
  type: "string",
  required: false,
  input: true,
},
```

In `apps/web/src/types/user.ts`, add:

```ts
telegramHandle?: string | null;
```

In `apps/web/src/hooks/mutations/use-update-user-profile.ts`, export the type,
change it to `telegramHandle?: string | null`, and pass `telegramHandle`
through to `authClient.updateUser`.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --dir apps/api exec vp test run --config vitest.integration.config.ts ../../tests/api-integration/current-user.test.ts
pnpm --filter @kaneo/api typecheck
pnpm --filter @kaneo/web typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 6: Commit (only when the user asked for commits)**

```bash
git add apps/api/src/user/controllers/get-current-user.ts \
  apps/api/src/user/response.ts apps/web/src/lib/auth-client.ts \
  apps/web/src/types/user.ts apps/web/src/hooks/mutations/use-update-user-profile.ts \
  tests/api-integration/current-user.test.ts
git commit -m "feat(api): expose the telegram handle on the current user"
```

---

### Task 3: Edit the Telegram handle in Settings → Profile

**Files:**
- Create: `apps/web/src/components/settings/profile/telegram-handle.ts`
- Create: `apps/web/src/components/settings/profile/telegram-handle.test.ts`
- Move: `apps/web/src/components/settings/profile/use-profile-name-autosave.ts` to `apps/web/src/components/settings/profile/use-profile-details-autosave.ts`
- Modify: `apps/web/src/components/settings/profile/profile-page.tsx`
- Modify: `apps/web/src/components/settings/profile/profile-details-section.tsx`
- Modify: `i18n/en-US.json` under `settings.informationPage`
- Test: `apps/web/src/components/settings/profile/profile-page.test.tsx`

**Interfaces:**
- Consumes: `User.telegramHandle`, `UpdateUserProfileRequest.telegramHandle`
- Produces: `normalizeTelegramHandleInput(value: string): string | null`
- Produces: `useProfileDetailsAutosave({ name, telegramHandle, refetchUser })`
- Produces: form values `{ name: string; telegramHandle: string }`

- [ ] **Step 1: Write the failing web normalization test**

Create `apps/web/src/components/settings/profile/telegram-handle.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { normalizeTelegramHandleInput } from "./telegram-handle";

describe("normalizeTelegramHandleInput", () => {
  it.each([
    ["@Alex_Name", "alex_name"],
    ["t.me/alex_name", "alex_name"],
    ["123456789", "123456789"],
    ["", null],
    ["   ", null],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeTelegramHandleInput(input)).toBe(expected);
  });

  it.each(["ab", "1alex", "alex-name", "alex name", "0"])(
    "rejects %p",
    (input) => {
      expect(() => normalizeTelegramHandleInput(input)).toThrow();
    },
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vp test run apps/web/src/components/settings/profile/telegram-handle.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the web helper**

Create `apps/web/src/components/settings/profile/telegram-handle.ts` with the
same rules as the API helper. Add a comment pointing to
`apps/api/src/user/telegram-handle.ts` so the two stay in sync.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm exec vp test run apps/web/src/components/settings/profile/telegram-handle.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing profile test**

In `apps/web/src/components/settings/profile/profile-page.test.tsx`:

- Add `telegramHandle: null as string | null` to `m.user`.
- Add `updateProfile: vi.fn()` to the hoisted `m`.
- Change the `use-update-user-profile` mock to
  `default: () => ({ mutateAsync: m.updateProfile })`.
- In `beforeEach`, call `m.updateProfile.mockReset()` and reset
  `m.user.telegramHandle = null` so tests do not leak state.
- Add:

```tsx
it("renders and saves the Telegram handle", async () => {
  m.updateProfile.mockResolvedValue(undefined);
  render(<ProfilePage />);

  const input = screen.getByRole("textbox", {
    name: "settings:informationPage.telegramLabel",
  });
  fireEvent.change(input, { target: { value: "@Alex_Name" } });

  await waitFor(
    () =>
      expect(m.updateProfile).toHaveBeenCalledWith({
        telegramHandle: "alex_name",
      }),
    { timeout: 2500 },
  );
});

it("clears the Telegram handle", async () => {
  m.user.telegramHandle = "alex_name";
  m.updateProfile.mockResolvedValue(undefined);
  render(<ProfilePage />);

  const input = screen.getByRole("textbox", {
    name: "settings:informationPage.telegramLabel",
  });
  fireEvent.change(input, { target: { value: "" } });

  await waitFor(
    () =>
      expect(m.updateProfile).toHaveBeenCalledWith({ telegramHandle: null }),
    { timeout: 2500 },
  );
});
```

Import `fireEvent` and `waitFor` from `@testing-library/react`.

- [ ] **Step 6: Run it and watch it fail**

Run: `pnpm exec vp test run apps/web/src/components/settings/profile/profile-page.test.tsx`
Expected: FAIL because the Telegram field does not render.

- [ ] **Step 7: Extend the autosave hook**

Move the file with `git mv`, then change:

- `ProfileFormValues` to `{ name: string; telegramHandle: string }`.
- `lastSavedRef` to `useRef<ProfileFormValues | null>(null)`.
- The reset effect to depend on both `name` and `telegramHandle`, storing
  `{ name: name.trim(), telegramHandle: telegramHandle ?? "" }`.
- The Zod schema to add:

```ts
telegramHandle: z.string().refine((value) => {
  try {
    normalizeTelegramHandleInput(value);
    return true;
  } catch {
    return false;
  }
}, t("settings:informationPage.validation.telegramInvalid")),
```

- The save function to build a diff. Import
  `type UpdateUserProfileRequest` from
  `@/hooks/mutations/use-update-user-profile`:

```ts
const nextName = data.name.trim();
let nextHandle: string | null;
try {
  nextHandle = normalizeTelegramHandleInput(data.telegramHandle);
} catch {
  return;
}
const last = lastSavedRef.current;
const payload: UpdateUserProfileRequest = {};
if (last?.name !== nextName) payload.name = nextName;
if ((last?.telegramHandle ?? "") !== (nextHandle ?? "")) {
  payload.telegramHandle = nextHandle;
}
if (Object.keys(payload).length === 0) return;
```

After `updateProfile(payload)`, reset and store
`{ name: nextName, telegramHandle: nextHandle ?? "" }`, then `refetchUser()`.
Keep the existing queue, toast, and cleanup behavior.

Export `ProfileFormValues` and `useProfileDetailsAutosave`; the details
component imports both.

- [ ] **Step 8: Extend the form and UI**

In `profile-page.tsx`, call:

```ts
const form = useProfileDetailsAutosave({
  name: user?.name,
  telegramHandle: user?.telegramHandle,
  refetchUser,
});
```

In `profile-details-section.tsx`, widen the `form` prop to the hook's
`ProfileFormValues`, add `telegramHandle?: string | null` to the `user` prop,
and add a `FormField` after the name field:

```tsx
<FormField
  control={form.control}
  name="telegramHandle"
  render={({ field }) => (
    <SettingsFormRow
      label={t("settings:informationPage.telegramLabel")}
      description={t("settings:informationPage.telegramHint")}
    >
      <Input
        size="sm"
        className="sm:w-64"
        autoComplete="off"
        maxLength={64}
        placeholder={t("settings:informationPage.telegramPlaceholder")}
        {...field}
      />
    </SettingsFormRow>
  )}
/>
```

- [ ] **Step 9: Add the i18n keys**

In `i18n/en-US.json` under `settings.informationPage`:

```json
"telegramLabel": "Telegram",
"telegramHint": "Your @username or numeric Telegram user ID. Kaneo mentions you when you are the assignee. You must be a member of the Telegram group that receives the notifications.",
"telegramPlaceholder": "@username or 123456789",
```

Add to `settings.informationPage.validation`:

```json
"telegramInvalid": "Enter a valid Telegram username or user ID"
```

Run: `pnpm i18n:check:fix`
Expected: other locale files receive the new keys.

- [ ] **Step 10: Verify**

Run:

```bash
pnpm exec vp test run apps/web/src/components/settings/profile/telegram-handle.test.ts
pnpm exec vp test run apps/web/src/components/settings/profile/profile-page.test.tsx
pnpm --filter @kaneo/web typecheck
pnpm i18n:check
```

Expected: PASS and no type errors.

- [ ] **Step 11: Commit (only when the user asked for commits)**

```bash
git add apps/web/src/components/settings/profile i18n
git commit -m "feat(web): edit the telegram handle in profile settings"
```

---

### Task 4: Format Telegram mentions

**Files:**
- Create: `apps/api/src/plugins/telegram/html.ts`
- Create: `apps/api/src/plugins/telegram/mention.ts`
- Modify: `apps/api/src/plugins/telegram/events.ts` (remove the local `escapeHtml`)
- Test: `tests/api/plugins/telegram-mention.test.ts`

**Interfaces:**
- Produces: `escapeHtml(value: string): string`
- Produces: `TelegramIdentity = { name: string; telegramHandle: string | null }`
- Produces: `formatTelegramMention(identity: TelegramIdentity): string`

- [ ] **Step 1: Write the failing mention test**

Create `tests/api/plugins/telegram-mention.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { formatTelegramMention } from "../../../apps/api/src/plugins/telegram/mention";

describe("formatTelegramMention", () => {
  it.each([
    [{ name: "Alex", telegramHandle: "alex" }, "@alex"],
    [
      { name: "Alex", telegramHandle: "123456789" },
      '<a href="tg://user?id=123456789">Alex</a>',
    ],
    [{ name: "A & B", telegramHandle: null }, "A &amp; B"],
    [
      { name: "A <B>", telegramHandle: "123" },
      '<a href="tg://user?id=123">A &lt;B&gt;</a>',
    ],
  ])("formats %p as %p", (identity, expected) => {
    expect(formatTelegramMention(identity)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vp test run tests/api/plugins/telegram-mention.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `html.ts` and `mention.ts`**

Move the existing `escapeHtml` body into `apps/api/src/plugins/telegram/html.ts`
and export it. In `mention.ts`:

```ts
import { escapeHtml } from "./html";

export type TelegramIdentity = {
  name: string;
  telegramHandle: string | null;
};

export function formatTelegramMention({
  name,
  telegramHandle,
}: TelegramIdentity): string {
  if (!telegramHandle) return escapeHtml(name);
  if (/^\d+$/.test(telegramHandle)) {
    return `<a href="tg://user?id=${telegramHandle}">${escapeHtml(name)}</a>`;
  }
  return `@${escapeHtml(telegramHandle)}`;
}
```

Update `events.ts` to import `escapeHtml` from `./html` and delete the local
copy.

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm exec vp test run tests/api/plugins/telegram-mention.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (only when the user asked for commits)**

```bash
git add apps/api/src/plugins/telegram/html.ts \
  apps/api/src/plugins/telegram/mention.ts \
  apps/api/src/plugins/telegram/events.ts \
  tests/api/plugins/telegram-mention.test.ts
git commit -m "feat(api): format telegram assignee mentions"
```

---

### Task 5: Build the Telegram message body

**Files:**
- Create: `apps/api/src/plugins/telegram/format.ts`
- Create: `apps/api/src/plugins/telegram/message.ts`
- Modify: `apps/api/src/plugins/telegram/events.ts`
- Test: `tests/api/plugins/telegram-message.test.ts`

**Interfaces:**
- Consumes: `escapeHtml`, `formatTelegramMention`, `TelegramIdentity`
- Produces: `TelegramEventData` (see below)
- Produces: `buildTelegramMessage(title: string, body: string, data: TelegramEventData): string`

- [ ] **Step 1: Write the failing message test**

Create `tests/api/plugins/telegram-message.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { buildTelegramMessage } from "../../../apps/api/src/plugins/telegram/message";

const base = {
  taskTitle: "Fix login",
  taskNumber: 12,
  projectName: "Web",
  taskUrl: "https://kaneo.test/task/1",
  actorName: "Creator",
  status: "to-do",
  priority: null,
};

describe("buildTelegramMessage", () => {
  it("mentions a username assignee", () => {
    expect(
      buildTelegramMessage("New task created", "Body", {
        ...base,
        assignee: { name: "Alex", telegramHandle: "alex" },
      }),
    ).toContain("<b>Assignee:</b> @alex");
  });

  it("mentions a numeric assignee with an inline link", () => {
    expect(
      buildTelegramMessage("New task created", "Body", {
        ...base,
        assignee: { name: "Alex", telegramHandle: "123" },
      }),
    ).toContain('<b>Assignee:</b> <a href="tg://user?id=123">Alex</a>');
  });

  it("omits the assignee line when there is no assignee", () => {
    expect(
      buildTelegramMessage("New task created", "Body", {
        ...base,
        assignee: null,
      }),
    ).not.toContain("<b>Assignee:</b>");
  });

  it("escapes task titles and names", () => {
    const text = buildTelegramMessage("New task created", "Body", {
      ...base,
      taskTitle: "A & B",
      assignee: { name: "<Alex>", telegramHandle: "123" },
    });
    expect(text).toContain("A &amp; B");
    expect(text).toContain("&lt;Alex&gt;");
  });

  it("renders exactly one Triggered by line", () => {
    const text = buildTelegramMessage("New task created", "Body", {
      ...base,
      assignee: { name: "Alex", telegramHandle: "alex" },
    });
    expect(text.match(/<b>Triggered by:<\/b>/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vp test run tests/api/plugins/telegram-message.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Move the shared formatters**

Create `apps/api/src/plugins/telegram/format.ts` and move `toSentenceCase` and
`truncate` from `events.ts` into it as exports. Update `events.ts` to import
them.

- [ ] **Step 4: Implement `message.ts`**

Create `apps/api/src/plugins/telegram/message.ts` with this signature; the body
is described next:

```ts
import type { TelegramConfig } from "./config";
import { postToTelegram } from "./client";
import { toSentenceCase } from "./format";
import { escapeHtml } from "./html";
import { formatTelegramMention, type TelegramIdentity } from "./mention";

export type TelegramEventData = {
  taskTitle: string;
  taskNumber: number | null;
  projectName: string;
  taskUrl: string | null;
  actorName: string | null;
  assignee: TelegramIdentity | null;
  status: string | null;
  priority: string | null;
};

export function buildTelegramMessage(
  title: string,
  body: string,
  data: TelegramEventData,
): string;
```

Copy the current `sendTelegramMessage` `lines` construction **up to and
including the `Priority` line only**. Do not copy its final `Triggered by`
line. Then append the assignee line (when present) and exactly one
`Triggered by` line at the end:

```ts
if (data.assignee) {
  lines.push(`<b>Assignee:</b> ${formatTelegramMention(data.assignee)}`);
}
lines.push(`<b>Triggered by:</b> ${escapeHtml(data.actorName ?? "Kaneo")}`);
```

The result must contain exactly one `Triggered by:` line; the Step 1 test pins
this.

Move the existing `getSafeTelegramTargetIdentifier` and
`sendTelegramMessage` into `message.ts` as well. `sendTelegramMessage` keeps its
current signature and calls `buildTelegramMessage`.

In `events.ts`, remove the imports that only the moved helpers used
(`createHash`, `safeOutboundError`, `postToTelegram`). Leave the database and
table imports for Task 6, which moves the remaining query.

- [ ] **Step 5: Run the test and watch it pass**

Run: `pnpm exec vp test run tests/api/plugins/telegram-message.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify existing Telegram logging still passes**

Run: `pnpm exec vp test run tests/api/plugins/telegram-logging.test.ts`
Expected: PASS. If the test imported `handleTaskCreated` from `events.ts`, it
still can; only the helpers moved.

- [ ] **Step 7: Commit (only when the user asked for commits)**

```bash
git add apps/api/src/plugins/telegram/format.ts \
  apps/api/src/plugins/telegram/message.ts \
  apps/api/src/plugins/telegram/events.ts \
  tests/api/plugins/telegram-message.test.ts
git commit -m "feat(api): build telegram messages with assignee lines"
```

---

### Task 6: Resolve the event-time actor and assignee

**Files:**
- Create: `apps/api/src/plugins/telegram/event-data.ts`
- Modify: `apps/api/src/plugins/telegram/events.ts`
- Modify: `apps/api/src/plugins/types.ts:7-16`
- Modify: `apps/api/src/plugins/registry.ts:39-59`
- Test: `tests/api/plugins/telegram-events.test.ts`
- Test: `tests/api/plugins/telegram-logging.test.ts` (unchanged; its mock only
  resolves rows through `.limit()`, so run it to prove the new query still
  works)

**Interfaces:**
- Consumes: `TelegramEventData` from Task 5
- Produces: `getTelegramEventData(taskId, projectId, actorId, assigneeId): Promise<TelegramEventData | null>`
- Produces: `TaskCreatedEvent.actorId?: string`
- Produces: `runTelegramHandler(context, event, featureKey, { actorId, assigneeId }, buildMessage)`

- [ ] **Step 1: Write the failing handler test**

Create `tests/api/plugins/telegram-events.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDescriptionChanged,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
} from "../../../apps/api/src/plugins/telegram/events";

const m = vi.hoisted(() => ({
  getEventData: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../../apps/api/src/plugins/telegram/event-data", () => ({
  getTelegramEventData: m.getEventData,
}));
vi.mock("../../../apps/api/src/plugins/telegram/client", () => ({
  postToTelegram: m.send,
}));

const token = `12345678:${"x".repeat(35)}`;
const context = {
  integrationId: "integration",
  projectId: "project",
  config: {
    botToken: token,
    chatId: "-100123",
    events: {
      taskCreated: true,
      taskStatusChanged: true,
      taskPriorityChanged: true,
      taskTitleChanged: true,
      taskDescriptionChanged: true,
      taskCommentCreated: true,
    },
  },
};
const data = {
  taskTitle: "Task",
  taskNumber: 1,
  projectName: "Project",
  taskUrl: null,
  actorName: "Creator",
  status: "to-do",
  priority: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("Telegram handler targets", () => {
  it("uses the creator as actor and the assignee as the mention target", async () => {
    m.getEventData.mockResolvedValue({
      ...data,
      assignee: { name: "Alex", telegramHandle: "alex" },
    });

    await handleTaskCreated(
      {
        taskId: "task",
        projectId: "project",
        userId: "assignee",
        actorId: "creator",
        title: "Task",
        description: null,
        priority: null,
        status: "to-do",
        number: 1,
      },
      context,
    );

    expect(m.getEventData).toHaveBeenCalledWith(
      "task",
      "project",
      "creator",
      "assignee",
    );
    expect(m.send.mock.calls[0][1].text).toContain("<b>Assignee:</b> @alex");
  });

  it("renders a numeric assignee as an inline link", async () => {
    m.getEventData.mockResolvedValue({
      ...data,
      assignee: { name: "Alex", telegramHandle: "123456789" },
    });

    await handleTaskCreated(
      {
        taskId: "task",
        projectId: "project",
        userId: "assignee",
        actorId: "creator",
        title: "Task",
        description: null,
        priority: null,
        status: "to-do",
        number: 1,
      },
      context,
    );

    expect(m.send.mock.calls[0][1].text).toContain(
      '<b>Assignee:</b> <a href="tg://user?id=123456789">Alex</a>',
    );
  });

  it.each([
    [
      "status",
      () =>
        handleTaskStatusChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldStatus: "to-do",
            newStatus: "done",
            title: "Task",
          },
          context,
        ),
    ],
    [
      "priority",
      () =>
        handleTaskPriorityChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldPriority: "low",
            newPriority: "high",
            title: "Task",
          },
          context,
        ),
    ],
    [
      "title",
      () =>
        handleTaskTitleChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldTitle: "Old",
            newTitle: "New",
          },
          context,
        ),
    ],
    [
      "description",
      () =>
        handleTaskDescriptionChanged(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            oldDescription: null,
            newDescription: "New",
          },
          context,
        ),
    ],
    [
      "comment",
      () =>
        handleTaskCommentCreated(
          {
            taskId: "task",
            projectId: "project",
            userId: "actor",
            comment: "Hello",
          },
          context,
        ),
    ],
  ])("keeps the current format for %s events", async (_name, run) => {
    m.getEventData.mockResolvedValue({ ...data, assignee: null });

    await run();

    expect(m.getEventData).toHaveBeenCalledWith("task", "project", "actor", null);
    expect(m.send.mock.calls[0][1].text).not.toContain("<b>Assignee:</b>");
  });

  it("treats an unassigned create as no assignee", async () => {
    m.getEventData.mockResolvedValue({ ...data, assignee: null });

    await handleTaskCreated(
      {
        taskId: "task",
        projectId: "project",
        userId: "",
        actorId: "creator",
        title: "Task",
        description: null,
        priority: null,
        status: "to-do",
        number: 1,
      },
      context,
    );

    expect(m.getEventData).toHaveBeenCalledWith("task", "project", "creator", null);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vp test run tests/api/plugins/telegram-events.test.ts`
Expected: FAIL because `getTelegramEventData` lives in `events.ts` (the mock has
no effect) and the handlers do not accept the new targets.

- [ ] **Step 3: Implement `event-data.ts`**

Move `getTelegramEventData` and its `getTaskUrl` helper into
`apps/api/src/plugins/telegram/event-data.ts`, importing `TelegramEventData`
from `./message`. Keep the task query, but remove `userId` from its inputs and
do not select `taskTable.userId`. Load users in parallel:

```ts
const ids = [...new Set([actorId, assigneeId].filter((id): id is string => Boolean(id)))];
const usersPromise = ids.length
  ? db
      .select({
        id: userTable.id,
        name: userTable.name,
        telegramHandle: userTable.telegramHandle,
      })
      .from(userTable)
      .where(inArray(userTable.id, ids))
      .limit(ids.length)
  : Promise.resolve([]);
const [[taskRow], users] = await Promise.all([taskPromise, usersPromise]);
```

The `.limit(ids.length)` is required, not optional: `tests/api/plugins/telegram-logging.test.ts`
mocks the query chain so that only `.limit()` returns rows, and `ids` is
non-empty on this branch. Without it, `users.map(...)` throws.

Build a `Map` by id, then return `actorName` from `actorId` and `assignee` from
`assigneeId`.

After the move, remove the now-unused `db`, table, `and`, and `eq` imports
from `events.ts`, and run the API typecheck.

- [ ] **Step 4: Rewire the handlers**

In `events.ts`, change `runTelegramHandler` to accept
`{ actorId, assigneeId }` and call:

```ts
getTelegramEventData(
  event.taskId,
  event.projectId,
  targets.actorId,
  targets.assigneeId,
);
```

Then pass the targets from each handler:

- `handleTaskCreated`:
  `{ actorId: event.actorId ?? null, assigneeId: event.userId || null }`
- `handleTaskStatusChanged`, `handleTaskPriorityChanged`,
  `handleTaskTitleChanged`, `handleTaskDescriptionChanged`,
  `handleTaskCommentCreated`: `{ actorId: event.userId, assigneeId: null }`

- [ ] **Step 5: Forward the creator id**

In `apps/api/src/plugins/types.ts`, add `actorId?: string` to
`TaskCreatedEvent`.

In `apps/api/src/plugins/registry.ts`, add `currentUserId?: string` to the
`task.created` subscription generic and pass `actorId: data.currentUserId` to
`broadcastTaskCreated`.

- [ ] **Step 6: Run the tests and watch them pass**

Run:

```bash
pnpm exec vp test run tests/api/plugins/telegram-events.test.ts
pnpm exec vp test run tests/api/plugins/telegram-message.test.ts
pnpm exec vp test run tests/api/plugins/telegram-logging.test.ts
```

Expected: PASS.

- [ ] **Step 7: Verify types**

Run: `pnpm --filter @kaneo/api typecheck`
Expected: no errors.

- [ ] **Step 8: Commit (only when the user asked for commits)**

```bash
git add apps/api/src/plugins/telegram/event-data.ts \
  apps/api/src/plugins/telegram/events.ts apps/api/src/plugins/types.ts \
  apps/api/src/plugins/registry.ts tests/api/plugins/telegram-events.test.ts
git commit -m "feat(api): resolve telegram actor and assignee from the event"
```

---

### Task 7: Add the Telegram `taskAssigneeChanged` event

**Files:**
- Modify: `apps/api/src/plugins/telegram/config.ts:3-10,44-51`
- Modify: `apps/api/src/plugins/telegram/events.ts`
- Modify: `apps/api/src/plugins/telegram/index.ts`
- Test: `tests/api/plugins/telegram-events.test.ts`

**Interfaces:**
- Consumes: `runTelegramHandler`, `TaskAssigneeChangedEvent`
- Produces: `telegramEventKeys` includes `"taskAssigneeChanged"`
- Produces: `defaultTelegramEvents.taskAssigneeChanged === false`
- Produces: `handleTaskAssigneeChanged`

- [ ] **Step 1: Write the failing test**

In `tests/api/plugins/telegram-events.test.ts`, add
`handleTaskAssigneeChanged` to the import from
`../../../apps/api/src/plugins/telegram/events`, add
`taskAssigneeChanged: true` to the `context.config.events` object, and add:

```ts
it("mentions the event-time new assignee", async () => {
  m.getEventData.mockResolvedValue({
    ...data,
    assignee: { name: "New", telegramHandle: "new" },
  });

  await handleTaskAssigneeChanged(
    {
      taskId: "task",
      projectId: "project",
      userId: "actor",
      title: "Task",
      oldAssignee: "Old",
      newAssignee: "New",
      newAssigneeId: "new",
    },
    context,
  );

  expect(m.getEventData).toHaveBeenCalledWith("task", "project", "actor", "new");
  expect(m.send.mock.calls[0][1].text).toContain("Task was assigned to New.");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vp test run tests/api/plugins/telegram-events.test.ts`
Expected: FAIL because `handleTaskAssigneeChanged` does not exist or is not
registered.

- [ ] **Step 3: Add the event key and default**

In `config.ts`, append `"taskAssigneeChanged"` to `telegramEventKeys` and
`taskAssigneeChanged: false` to `defaultTelegramEvents`.

- [ ] **Step 4: Add the handler and register it**

In `events.ts`, add:

```ts
export async function handleTaskAssigneeChanged(
  event: TaskAssigneeChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(
    context,
    event,
    "taskAssigneeChanged",
    { actorId: event.userId, assigneeId: event.newAssigneeId },
    () => ({
      title: "Task assignee changed",
      body: `${event.title} was assigned to ${event.newAssignee || "someone"}.`,
    }),
  );
}
```

This is the only handler that passes a non-null `assigneeId` besides
`handleTaskCreated`.

In `index.ts`, import it and add
`onTaskAssigneeChanged: handleTaskAssigneeChanged`.

- [ ] **Step 5: Run the tests and watch them pass**

Run:

```bash
pnpm exec vp test run tests/api/plugins/telegram-events.test.ts
pnpm --filter @kaneo/api typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 6: Commit (only when the user asked for commits)**

```bash
git add apps/api/src/plugins/telegram/config.ts \
  apps/api/src/plugins/telegram/events.ts \
  apps/api/src/plugins/telegram/index.ts \
  tests/api/plugins/telegram-events.test.ts
git commit -m "feat(api): notify telegram when a task assignee changes"
```

---

### Task 8: Extend the Telegram API contract and settings UI

**Files:**
- Create: `apps/api/src/telegram-integration/events.ts`
- Modify: `apps/api/src/telegram-integration/schema.ts`
- Modify: `apps/api/src/telegram-integration/response.ts`
- Modify: `apps/web/src/fetchers/telegram-integration/get-telegram-integration.ts`
- Modify: `apps/web/src/fetchers/telegram-integration/create-telegram-integration.ts`
- Modify: `apps/web/src/fetchers/telegram-integration/update-telegram-integration.ts`
- Create: `apps/web/src/components/project/integrations/telegram/telegram-events.ts`
- Create: `apps/web/src/components/project/integrations/telegram/telegram-events.test.ts`
- Modify: `apps/web/src/components/project/integrations/telegram/telegram-form-values.ts`
- Modify: `apps/web/src/components/project/integrations/telegram/telegram-integration-settings.tsx`
- Modify: `apps/web/src/components/project/integrations/telegram/build-telegram-request.test.ts`
- Modify: `apps/web/src/components/project/integrations/telegram/telegram-integration-settings.test.tsx`
- Modify: `i18n/en-US.json`
- Generated: `apps/docs/openapi.json`

**Interfaces:**
- Consumes: `telegramEventKeys`, `defaultTelegramEvents`
- Produces: `telegramIntegrationEventToggles`
- Produces: `telegramIntegrationEventsSchema`
- Produces: `TelegramEvents = ChatEvents & { taskAssigneeChanged: boolean }`
- Produces: `TELEGRAM_EVENT_ITEMS`
- Produces: `toTelegramEvents(events?): TelegramEvents`

- [ ] **Step 1: Write the failing web event test**

Create `apps/web/src/components/project/integrations/telegram/telegram-events.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { CHAT_EVENT_ITEMS } from "@/components/project/integrations/chat-webhook/chat-events";
import { TELEGRAM_EVENT_ITEMS, toTelegramEvents } from "./telegram-events";

describe("telegram events", () => {
  it("adds the Telegram-only event without touching the shared list", () => {
    expect(TELEGRAM_EVENT_ITEMS.map((item) => item.id)).toContain(
      "taskAssigneeChanged",
    );
    expect(CHAT_EVENT_ITEMS.map((item) => item.id)).not.toContain(
      "taskAssigneeChanged",
    );
  });

  it("defaults the new event to off", () => {
    expect(toTelegramEvents()).toMatchObject({ taskAssigneeChanged: false });
    expect(toTelegramEvents({ taskAssigneeChanged: true })).toMatchObject({
      taskAssigneeChanged: true,
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vp test run apps/web/src/components/project/integrations/telegram/telegram-events.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the Telegram event helpers**

Create `telegram-events.ts`:

```ts
import {
  CHAT_EVENT_ITEMS,
  type ChatEvents,
  toChatEvents,
} from "@/components/project/integrations/chat-webhook/chat-events";
import type { EventChecklistItem } from "@/components/project/integrations/event-checklist/event-checklist-item";

export type TelegramEvents = ChatEvents & {
  taskAssigneeChanged: boolean;
};

export const TELEGRAM_EVENT_ITEMS: EventChecklistItem<keyof TelegramEvents>[] = [
  ...CHAT_EVENT_ITEMS,
  {
    id: "taskAssigneeChanged",
    labelKey: "settings:telegramIntegration.events.taskAssigneeChanged",
  },
];

export function toTelegramEvents(
  events?: Partial<TelegramEvents> | null,
): TelegramEvents {
  return {
    ...toChatEvents(events),
    taskAssigneeChanged: events?.taskAssigneeChanged ?? false,
  };
}
```

- [ ] **Step 4: Wire the web form and settings**

- `telegram-form-values.ts`: import `TelegramEvents` and `toTelegramEvents`;
  change `events` to `TelegramEvents`; add `taskAssigneeChanged: z.boolean()`
  to the schema object; use `toTelegramEvents(integration?.events)`.
- `telegram-integration-settings.tsx`: import `TELEGRAM_EVENT_ITEMS` from
  `./telegram-events` and use it in `EventChecklist`.
- `get-telegram-integration.ts`: add `taskAssigneeChanged: boolean` to the
  `events` type.
- `create-telegram-integration.ts` and `update-telegram-integration.ts`: add
  `taskAssigneeChanged?: boolean`.
- Update `build-telegram-request.test.ts` and
  `telegram-integration-settings.test.tsx` to use `toTelegramEvents()` instead
  of `toChatEvents()`.

- [ ] **Step 5: Add the API contract**

Create `apps/api/src/telegram-integration/events.ts`:

```ts
import { integrationEventToggles } from "../integrations/schema";
import { integrationEventsSchema } from "../integrations/response";
import { z } from "../openapi";

export const telegramIntegrationEventToggles = integrationEventToggles.extend({
  taskAssigneeChanged: z.boolean().optional(),
});

export const telegramIntegrationEventsSchema = integrationEventsSchema
  .extend({
    taskAssigneeChanged: z.boolean(),
  })
  .openapi("TelegramIntegrationEvents");
```

Use `telegramIntegrationEventToggles` in `telegram-integration/schema.ts` for
both `createTelegramBody.events` and `updateTelegramBody.events`. Use
`telegramIntegrationEventsSchema` in `telegram-integration/response.ts`.
Do not change `telegram-controller.ts`; it already spreads
`defaultTelegramEvents`.

- [ ] **Step 6: Add the i18n key**

In `i18n/en-US.json` under `settings.telegramIntegration`:

```json
"events": {
  "taskAssigneeChanged": "Assignee changed"
}
```

Run: `pnpm i18n:check:fix`

- [ ] **Step 7: Regenerate OpenAPI**

Run: `pnpm openapi:check:fix`
Expected: `apps/docs/openapi.json` gains `taskAssigneeChanged` in the Telegram
request/response schemas, and `pnpm openapi:check` passes.

- [ ] **Step 8: Run the web and API tests**

Run:

```bash
pnpm exec vp test run apps/web/src/components/project/integrations/telegram/telegram-events.test.ts
pnpm exec vp test run apps/web/src/components/project/integrations/telegram/build-telegram-request.test.ts
pnpm exec vp test run apps/web/src/components/project/integrations/telegram/telegram-integration-settings.test.tsx
pnpm --filter @kaneo/api typecheck
pnpm --filter @kaneo/web typecheck
pnpm openapi:check
pnpm i18n:check
```

Expected: PASS and no errors.

- [ ] **Step 9: Commit (only when the user asked for commits)**

```bash
git add apps/api/src/telegram-integration \
  apps/web/src/fetchers/telegram-integration \
  apps/web/src/components/project/integrations/telegram \
  i18n apps/docs/openapi.json
git commit -m "feat(web): configure the telegram assignee-changed event"
```

---

### Task 9: Document the feature and run the full gate

**Files:**
- Modify: `apps/docs/core/integrations/telegram.mdx`
- Modify: `apps/docs/core/integrations/outgoing-webhooks.mdx` (only if needed)

**Interfaces:**
- Consumes: the behavior implemented in Tasks 1–8.

- [ ] **Step 1: Update the Telegram guide**

Add a "Mention the assignee" section covering:

- Settings → Profile → Telegram: `@username`, `t.me/...`, or numeric ID;
- username vs numeric ID, and how to get a numeric ID (forward a message to
  `@userinfobot`, or use a similar helper);
- the assignee must be a member of the Telegram group;
- `taskAssigneeChanged` is a separate toggle and is off by default;
- a typo produces a plain name, not a notification.

- [ ] **Step 2: Validate the docs**

Run from `apps/docs`:

```bash
pnpm dlx mint validate
pnpm dlx mint broken-links
```

Expected: both pass.

- [ ] **Step 3: Run the broad gate**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all pass. Report the exact commands and results.

- [ ] **Step 4: Final manual check (real instance)**

With a disposable instance:

1. Set a Telegram handle on a user in Settings → Profile.
2. Configure a Telegram project integration pointing at a group the user is in.
3. Create a task assigned to that user.
4. Confirm the message has an `Assignee:` line and Telegram highlights/notifies
   the user.
5. Reassign the task and confirm the opt-in `taskAssigneeChanged` message
   mentions the new assignee.

- [ ] **Step 5: Commit (only when the user asked for commits)**

```bash
git add apps/docs
git commit -m "docs: document telegram assignee mentions"
```

---

## Self-Review

- **Spec coverage:** data model (Task 1), validation (Tasks 1/3), auth/API
  (Task 2), profile UI (Task 3), mention rendering (Tasks 4/5), event-time
  assignee and actor (Task 6), `taskAssigneeChanged` (Task 7), Telegram-only
  API/UI (Task 8), docs (Task 9).
- **Type consistency:** `TelegramEventData` lives in `message.ts` and is
  consumed by `event-data.ts`; `TelegramIdentity` lives in `mention.ts`;
  `TelegramEvents`/`TELEGRAM_EVENT_ITEMS` live in the Telegram web folder;
  `runTelegramHandler` consistently takes `{ actorId, assigneeId }`;
  `ProfileFormValues` is exported from the autosave hook for the details
  component.
- **Review Focus coverage:** invalid input (Task 2 integration), clearing
  (Tasks 1/2/3), numeric detection (Tasks 1/3/4/6), HTML escaping (Tasks 4/5),
  unassigned create (Task 6), reassignment race (Tasks 6/7).
- **Closed blocking issues:**
  - Task 6 keeps `.limit(ids.length)` on the user lookup so
    `telegram-logging.test.ts` still resolves rows through its `.limit()` mock;
    the test is run, not rewritten.
  - Task 5 copies the existing lines only through `Priority`, inserts the
    assignee line, then emits exactly one `Triggered by`; a test asserts one
    occurrence.
- **Closed test gaps:** Task 1 covers `telegram.me/` and a 33-character
  username; Task 3 covers clearing to `null`; Task 6 covers a numeric
  `tg://user?id=` anchor at the handler level and all five non-assignee events;
  `handleTaskAssigneeChanged` belongs to Task 7, so Task 6 has no forward
  reference.
- **Consistency fixes:** normalization runs before
  `assertManagedProfileUnchanged`; moved helpers list their unused imports; the
  extended events schema registers as `TelegramIntegrationEvents`;
  `newAssignee || "someone"` handles an empty string.
- **Remaining risks:** delivery still requires the assignee to be a member of
  the target Telegram group; the clear-path integration test needs a disposable
  PostgreSQL; `tg://user?id=` only works with `parse_mode: "HTML"`.
- **Proportion:** the plan pins interfaces and tests; it does not paste the
  whole implementation.
