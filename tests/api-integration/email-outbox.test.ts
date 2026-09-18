import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A controllable provider: every test decides whether sending works.
const deliverEmail = vi.fn();

vi.mock("@kaneo/email", async () => {
  const mock = await import("./mocks/email");
  return {
    ...mock,
    isEmailConfigured: () => true,
    emailProvider: () => "resend",
    deliverEmail: (...args: unknown[]) => deliverEmail(...args),
  };
});

const { default: db, schema } = await import("../../apps/api/src/database");
const { enqueueEmail, processEmailOutbox } = await import(
  "../../apps/api/src/email/outbox"
);
const { addWorkspaceMember, requestAs } = await import("./helpers/company");
const { resetTestDatabase } = await import("./helpers/database");
const { createWorkspaceMember } = await import("./helpers/fixtures");

beforeEach(async () => {
  await resetTestDatabase();
  deliverEmail.mockReset();
});

async function outboxRow(id: string) {
  // The first attempt runs in the background right after the insert.
  for (let attempt = 0; attempt < 40; attempt++) {
    const [row] = await db
      .select()
      .from(schema.emailOutboxTable)
      .where(eq(schema.emailOutboxTable.id, id));
    if (row && row.status !== "sending" && row.attempts > 0) return row;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("The email was never attempted");
}

const makeDue = (id: string) =>
  db
    .update(schema.emailOutboxTable)
    .set({ nextAttemptAt: new Date(Date.now() - 1000) })
    .where(eq(schema.emailOutboxTable.id, id));

describe("email outbox", () => {
  it("sends right away and records the provider's id", async () => {
    deliverEmail.mockResolvedValue({ provider: "resend", id: "re_1" });
    const id = await enqueueEmail({
      to: "a@example.com",
      subject: "Hello",
      html: "<p>hi</p>",
      category: "task_assigned",
    });
    const row = await outboxRow(id as string);
    expect(row).toMatchObject({
      status: "sent",
      provider: "resend",
      providerId: "re_1",
      attempts: 1,
    });
    expect(deliverEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@example.com",
        tags: [{ name: "category", value: "task_assigned" }],
      }),
    );
  });

  it("backs off after a failure, retries when due, gives up after five tries", async () => {
    deliverEmail.mockRejectedValue(new Error("Resend rejected the email: 500"));
    const id = (await enqueueEmail({
      to: "b@example.com",
      subject: "Hello",
      html: "<p>hi</p>",
      category: "other",
    })) as string;

    const first = await outboxRow(id);
    expect(first.status).toBe("queued");
    expect(first.lastError).toMatch(/500/);
    expect(first.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    // Not due yet: the tick leaves it alone.
    await processEmailOutbox();
    expect((await outboxRow(id)).attempts).toBe(1);

    for (let attempt = 2; attempt <= 5; attempt++) {
      await makeDue(id);
      await processEmailOutbox();
    }
    const last = await outboxRow(id);
    expect(last).toMatchObject({ status: "failed", attempts: 5 });

    // Failed stays failed: only an admin's "Send again" requeues it.
    deliverEmail.mockResolvedValue({ provider: "resend", id: "re_2" });
    await makeDue(id);
    await processEmailOutbox();
    expect((await outboxRow(id)).status).toBe("failed");
  });
});

describe("email log and default delivery", () => {
  it("emails approvers who never set preferences, and shows it in the log", async () => {
    deliverEmail.mockResolvedValue({ provider: "resend", id: "re_x" });
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member", "Alice");

    const submitted = await requestAs(alice)("/requests/expenses", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        amount: 150_000,
        category: "Travel",
        spentOn: "2026-09-16",
      },
    });
    expect(submitted.status).toBe(200);

    let rows: (typeof schema.emailOutboxTable.$inferSelect)[] = [];
    for (let attempt = 0; attempt < 40 && rows.length === 0; attempt++) {
      rows = await db
        .select()
        .from(schema.emailOutboxTable)
        .where(
          and(
            eq(schema.emailOutboxTable.workspaceId, workspace.id),
            eq(schema.emailOutboxTable.category, "expense_submitted"),
          ),
        );
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      toEmail: owner.email,
      userId: owner.id,
    });
    expect(rows[0]?.subject).toMatch(/^Alice submitted an expense of/);
    expect(rows[0]?.html).toBeTruthy();

    const log = await requestAs(owner)(
      `/email-log?workspaceId=${workspace.id}`,
    );
    expect(log.status).toBe(200);
    expect(log.json.provider).toBe("resend");
    expect(log.json.entries[0]).toMatchObject({
      toEmail: owner.email,
      category: "expense_submitted",
    });
    // Bodies stay out of the log.
    expect(log.json.entries[0].html).toBeUndefined();

    expect(
      (await requestAs(alice)(`/email-log?workspaceId=${workspace.id}`)).status,
    ).toBe(403);
  });

  it("respects someone who turned the workspace off", async () => {
    deliverEmail.mockResolvedValue({ provider: "resend", id: "re_y" });
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: owner.id,
      emailEnabled: true,
    });
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId: owner.id,
      workspaceId: workspace.id,
      isActive: false,
      emailEnabled: true,
    });

    await requestAs(alice)("/requests/expenses", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        amount: 1_000,
        category: "Meals",
        spentOn: "2026-09-16",
      },
    });
    // Give the notification pipeline time to (not) queue anything.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const rows = await db
      .select()
      .from(schema.emailOutboxTable)
      .where(eq(schema.emailOutboxTable.workspaceId, workspace.id));
    expect(rows).toHaveLength(0);
    const [notification] = await db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.userId, owner.id));
    // Still shown inside Kaneo.
    expect(notification?.type).toBe("expense_submitted");
  });
});
