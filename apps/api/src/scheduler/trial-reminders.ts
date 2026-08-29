import { isSmtpConfigured, sendTrialReminderEmail } from "@kaneo/email";
import { and, asc, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";
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

// Sending is deliberately slow. The provider rate-limits per second and per
// day, and a burst that trips either is silently dropped downstream: SMTP has
// already accepted the message, so nothing surfaces as an error here.
const DEFAULT_MAX_PER_RUN = 25;
const SEND_SPACING_MS = 600;

function maxPerRun() {
  const parsed = Number.parseInt(
    process.env.BILLING_REMINDER_MAX_PER_RUN ?? "",
    10,
  );
  return Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_MAX_PER_RUN : parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // One row per owner, not per workspace: trials are granted per owner, so a
  // person with twenty workspaces must still get one email, not twenty.
  // DISTINCT ON forces ORDER BY to lead with the owner, so urgency ordering
  // has to happen outside it or the cap would drop the soonest expiries.
  const owners = db
    .selectDistinctOn([workspaceUserTable.userId], {
      userId: workspaceUserTable.userId,
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
        eq(billingReminderSentTable.userId, workspaceUserTable.userId),
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
    .orderBy(
      asc(workspaceUserTable.userId),
      asc(workspaceBillingTable.trialEndsAt),
    )
    .as("owners");

  return db
    .select()
    .from(owners)
    .orderBy(asc(owners.trialEndsAt))
    .limit(maxPerRun());
}

export async function checkTrialReminders(): Promise<{ degraded: boolean }> {
  if (!isBillingEnabled() || !isSmtpConfigured()) {
    return { degraded: false };
  }

  const now = new Date();
  let sent = 0;
  let degraded = false;

  for (const reminder of REMINDERS) {
    let rows: Awaited<ReturnType<typeof getWorkspacesNeedingReminder>>;
    try {
      rows = await getWorkspacesNeedingReminder(reminder.type, now);
    } catch (error) {
      console.error(`Failed to query ${reminder.type} reminders`, error);
      degraded = true;
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
          userId: row.userId,
          workspaceId: row.workspaceId,
          reminderType: reminder.type,
          trialEndsAt: row.trialEndsAt,
        })
        .onConflictDoNothing({
          target: [
            billingReminderSentTable.userId,
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

      if (sent > 0) {
        await sleep(SEND_SPACING_MS);
      }

      await sendTrialReminderEmail(
        row.email,
        reminder.subject(row.workspaceName),
        {
          workspaceName: row.workspaceName,
          daysLeft,
          billingUrl: `${clientUrl()}/dashboard/settings/workspace/billing`,
        },
      );
      sent++;
    }
  }

  if (sent > 0) {
    console.log(`Sent ${sent} trial reminder email(s)`);
  }

  return { degraded };
}
