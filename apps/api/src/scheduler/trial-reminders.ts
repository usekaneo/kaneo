import { isSmtpConfigured, sendTrialReminderEmail } from "@kaneo/email";
import { and, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";
import { isBillingEnabled } from "../billing/config";
import db from "../database";
import {
  billingReminderSentTable,
  userTable,
  workspaceBillingTable,
  workspaceTable,
  workspaceUserTable,
} from "../database/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderType = "trial_ending" | "trial_expired";

const REMINDERS: {
  type: ReminderType;
  subject: (workspaceName: string) => string;
}[] = [
  {
    type: "trial_ending",
    subject: (name) => `Your ${name} trial ends in 3 days`,
  },
  {
    type: "trial_expired",
    subject: (name) => `Your ${name} trial has ended`,
  },
];

function clientUrl() {
  return (process.env.KANEO_CLIENT_URL ?? "https://cloud.kaneo.app").replace(
    /\/$/,
    "",
  );
}

async function getWorkspacesNeedingReminder(type: ReminderType, now: Date) {
  const windowStart =
    type === "trial_ending" ? new Date(now.getTime() + 2 * DAY_MS) : null;
  const windowEnd =
    type === "trial_ending" ? new Date(now.getTime() + 3 * DAY_MS) : now;

  const trialWindow =
    type === "trial_ending"
      ? and(
          gt(workspaceBillingTable.trialEndsAt, windowStart as Date),
          lte(workspaceBillingTable.trialEndsAt, windowEnd),
        )
      : lte(workspaceBillingTable.trialEndsAt, windowEnd);

  return db
    .select({
      workspaceId: workspaceTable.id,
      workspaceName: workspaceTable.name,
      trialEndsAt: workspaceBillingTable.trialEndsAt,
      email: userTable.email,
    })
    .from(workspaceBillingTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceTable.id, workspaceBillingTable.workspaceId),
    )
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceBillingTable.workspaceId),
        eq(workspaceUserTable.role, "owner"),
      ),
    )
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .leftJoin(
      billingReminderSentTable,
      and(
        eq(
          billingReminderSentTable.workspaceId,
          workspaceBillingTable.workspaceId,
        ),
        eq(billingReminderSentTable.reminderType, type),
      ),
    )
    .where(
      and(
        isNull(billingReminderSentTable.id),
        eq(workspaceBillingTable.foundingFree, false),
        isNotNull(workspaceBillingTable.trialEndsAt),
        isNull(workspaceBillingTable.creemSubscriptionId),
        trialWindow,
        eq(userTable.banned, false),
      ),
    )
    .limit(500);
}

export async function checkTrialReminders(): Promise<void> {
  if (!isBillingEnabled() || !isSmtpConfigured()) {
    return;
  }

  const now = new Date();

  for (const reminder of REMINDERS) {
    let rows: Awaited<ReturnType<typeof getWorkspacesNeedingReminder>>;
    try {
      rows = await getWorkspacesNeedingReminder(reminder.type, now);
    } catch (error) {
      console.error(`Failed to query ${reminder.type} reminders`, error);
      continue;
    }

    for (const row of rows) {
      if (!row.email || !row.trialEndsAt) {
        continue;
      }

      // Claim the send first: a duplicate email is worse than a missed one,
      // and the unique constraint makes a concurrent run a no-op.
      const [claimed] = await db
        .insert(billingReminderSentTable)
        .values({
          workspaceId: row.workspaceId,
          reminderType: reminder.type,
          trialEndsAt: row.trialEndsAt,
        })
        .onConflictDoNothing({
          target: [
            billingReminderSentTable.workspaceId,
            billingReminderSentTable.reminderType,
          ],
        })
        .returning();

      if (!claimed) {
        continue;
      }

      const daysLeft = Math.max(
        0,
        Math.ceil((row.trialEndsAt.getTime() - now.getTime()) / DAY_MS),
      );

      await sendTrialReminderEmail(
        row.email,
        reminder.subject(row.workspaceName),
        {
          workspaceName: row.workspaceName,
          daysLeft,
          billingUrl: `${clientUrl()}/dashboard/settings/workspace/billing`,
        },
      );
    }
  }
}
