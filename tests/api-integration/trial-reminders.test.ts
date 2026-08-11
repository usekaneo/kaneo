import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const sendTrialReminderEmail = vi.fn();

vi.mock("@kaneo/email", () => ({
  isSmtpConfigured: () => true,
  sendTrialReminderEmail: (...args: unknown[]) =>
    sendTrialReminderEmail(...args),
}));

const { default: db, schema } = await import("../../apps/api/src/database");
const { checkTrialReminders } = await import(
  "../../apps/api/src/scheduler/trial-reminders"
);
const { resetTestDatabase } = await import("./helpers/database");
const { createWorkspaceMember } = await import("./helpers/fixtures");

const DAY = 24 * 60 * 60 * 1000;

const CLOUD_ENV = {
  KANEO_CLOUD: "true",
  CREEM_API_KEY: "creem_test_dummy",
  CREEM_WEBHOOK_SECRET: "whsec_dummy",
  SMTP_HOST: "smtp.example.com",
  SMTP_FROM: "kaneo@example.com",
  BILLING_REMINDER_MAX_PER_RUN: "2",
};
const saved: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const [key, value] of Object.entries(CLOUD_ENV)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
});

afterAll(() => {
  for (const key of Object.keys(CLOUD_ENV)) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

async function addWorkspaceOwnedBy(userId: string, trialEndsAt: Date | null) {
  const workspaceId = `workspace-${randomUUID()}`;
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: workspaceId,
      createdAt: new Date(),
      name: `Extra-${randomUUID().slice(0, 6)}`,
      slug: `workspace-${randomUUID()}`,
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId,
    role: "owner",
    joinedAt: new Date(),
  });

  await db.insert(schema.workspaceBillingTable).values({
    workspaceId: workspace.id,
    trialEndsAt,
  });

  return workspace;
}

async function seedTrial(
  trialEndsAt: Date | null,
  overrides: Partial<typeof schema.workspaceBillingTable.$inferInsert> = {},
) {
  const { user, workspace } = await createWorkspaceMember({
    role: "owner",
    workspaceName: `WS-${randomUUID().slice(0, 6)}`,
  });

  await db.insert(schema.workspaceBillingTable).values({
    workspaceId: workspace.id,
    trialEndsAt,
    ...overrides,
  });

  return { user, workspace };
}

function recipients() {
  return sendTrialReminderEmail.mock.calls.map((call) => call[0] as string);
}

describe("trial reminder emails", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sendTrialReminderEmail.mockClear();
  });

  it("warns the owner before the trial ends", async () => {
    const { user } = await seedTrial(new Date(Date.now() + 2.5 * DAY));

    await checkTrialReminders();

    expect(recipients()).toEqual([user.email]);
    const [, subject, data] = sendTrialReminderEmail.mock.calls[0] as [
      string,
      string,
      { daysLeft: number },
    ];
    expect(subject).toContain("ends in 3 days");
    expect(data.daysLeft).toBe(3);
  });

  it("emails once the trial has lapsed", async () => {
    const { user } = await seedTrial(new Date(Date.now() - DAY));

    await checkTrialReminders();

    expect(recipients()).toEqual([user.email]);
    const [, subject, data] = sendTrialReminderEmail.mock.calls[0] as [
      string,
      string,
      { daysLeft: number },
    ];
    expect(subject).toContain("has ended");
    expect(data.daysLeft).toBe(0);
  });

  it("never sends the same reminder twice", async () => {
    await seedTrial(new Date(Date.now() - DAY));

    await checkTrialReminders();
    await checkTrialReminders();

    expect(sendTrialReminderEmail).toHaveBeenCalledTimes(1);
  });

  it("ignores trials that are neither ending soon nor lapsed", async () => {
    await seedTrial(new Date(Date.now() + 9 * DAY));

    await checkTrialReminders();

    expect(sendTrialReminderEmail).not.toHaveBeenCalled();
  });

  it("skips founding-free workspaces and paying subscribers", async () => {
    await seedTrial(null, { foundingFree: true });
    await seedTrial(new Date(Date.now() - DAY), {
      creemSubscriptionId: `sub_${randomUUID()}`,
      status: "active",
    });

    await checkTrialReminders();

    expect(sendTrialReminderEmail).not.toHaveBeenCalled();
  });

  it("records what it sent so a later run can be audited", async () => {
    const { workspace } = await seedTrial(new Date(Date.now() - DAY));

    await checkTrialReminders();

    const rows = await db
      .select()
      .from(schema.billingReminderSentTable)
      .where(eq(schema.billingReminderSentTable.workspaceId, workspace.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.reminderType).toBe("trial_expired");
  });

  it("caps how many it sends per run so the provider is not flooded", async () => {
    for (let i = 0; i < 5; i++) {
      await seedTrial(new Date(Date.now() - (i + 1) * DAY));
    }

    await checkTrialReminders();

    expect(sendTrialReminderEmail).toHaveBeenCalledTimes(2);
  });

  it("sends the most urgent trials first", async () => {
    const soonest = await seedTrial(new Date(Date.now() - 9 * DAY));
    await seedTrial(new Date(Date.now() - 2 * DAY));
    await seedTrial(new Date(Date.now() - 1 * DAY));

    await checkTrialReminders();

    expect(recipients()[0]).toBe(soonest.user.email);
  });

  it("emails an owner once no matter how many workspaces they have", async () => {
    const lapsed = new Date(Date.now() - DAY);
    const { user } = await seedTrial(lapsed);
    for (let i = 0; i < 19; i++) {
      await addWorkspaceOwnedBy(user.id, lapsed);
    }

    await checkTrialReminders();

    expect(sendTrialReminderEmail).toHaveBeenCalledTimes(1);
    expect(recipients()).toEqual([user.email]);
  });

  it("still emails every distinct owner", async () => {
    const lapsed = new Date(Date.now() - DAY);
    const a = await seedTrial(lapsed);
    const b = await seedTrial(lapsed);

    await checkTrialReminders();

    expect(recipients().sort()).toEqual([a.user.email, b.user.email].sort());
  });
});
