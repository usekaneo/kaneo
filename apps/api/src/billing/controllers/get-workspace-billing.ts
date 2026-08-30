import { and, eq, isNotNull, min } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  trialGrantTable,
  userTable,
  workspaceBillingTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { foundingCutoff, isBillingEnabled, trialDays } from "../config";
import { hashTrialEmail } from "../trial-identity";

const ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "scheduled_cancel",
]);

export async function resolveTrialEndsAt(
  workspaceId: string,
): Promise<Date | null> {
  const [owner] = await db
    .select({
      userId: workspaceUserTable.userId,
      email: userTable.email,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.role, "owner"),
      ),
    )
    .limit(1);

  if (owner) {
    const [earlier] = await db
      .select({ trialEndsAt: min(workspaceBillingTable.trialEndsAt) })
      .from(workspaceBillingTable)
      .innerJoin(
        workspaceUserTable,
        eq(workspaceUserTable.workspaceId, workspaceBillingTable.workspaceId),
      )
      .where(
        and(
          eq(workspaceUserTable.userId, owner.userId),
          eq(workspaceUserTable.role, "owner"),
          isNotNull(workspaceBillingTable.trialEndsAt),
        ),
      );

    if (earlier?.trialEndsAt) {
      return new Date(earlier.trialEndsAt);
    }

    return claimTrial(owner.email);
  }

  return new Date(Date.now() + trialDays() * 24 * 60 * 60 * 1000);
}

async function claimTrial(email: string): Promise<Date> {
  const emailHash = hashTrialEmail(email);
  const trialEndsAt = new Date(Date.now() + trialDays() * 24 * 60 * 60 * 1000);

  const [claimed] = await db
    .insert(trialGrantTable)
    .values({ emailHash, trialEndsAt })
    .onConflictDoNothing({ target: trialGrantTable.emailHash })
    .returning({ trialEndsAt: trialGrantTable.trialEndsAt });

  if (claimed) {
    return claimed.trialEndsAt;
  }

  const [granted] = await db
    .select({ trialEndsAt: trialGrantTable.trialEndsAt })
    .from(trialGrantTable)
    .where(eq(trialGrantTable.emailHash, emailHash))
    .limit(1);

  return granted?.trialEndsAt ?? trialEndsAt;
}

export async function getOrCreateWorkspaceBilling(workspaceId: string) {
  const [existing] = await db
    .select()
    .from(workspaceBillingTable)
    .where(eq(workspaceBillingTable.workspaceId, workspaceId));

  if (existing) {
    return existing;
  }

  const workspace = await db.query.workspaceTable.findFirst({
    where: eq(workspaceTable.id, workspaceId),
  });

  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  const cutoff = foundingCutoff();
  const isFounding = cutoff !== null && workspace.createdAt <= cutoff;
  const trialEndsAt = isFounding ? null : await resolveTrialEndsAt(workspaceId);

  const [created] = await db
    .insert(workspaceBillingTable)
    .values({
      workspaceId,
      foundingFree: isFounding,
      trialEndsAt,
    })
    .onConflictDoNothing({ target: workspaceBillingTable.workspaceId })
    .returning();

  if (created) {
    return created;
  }

  const [raced] = await db
    .select()
    .from(workspaceBillingTable)
    .where(eq(workspaceBillingTable.workspaceId, workspaceId));

  if (!raced) {
    throw new HTTPException(500, {
      message: "Failed to initialize workspace billing",
    });
  }
  return raced;
}

export function computeEntitlement(
  billing: typeof workspaceBillingTable.$inferSelect,
) {
  if (!isBillingEnabled()) {
    return { active: true, reason: "billing_disabled" as const };
  }
  if (billing.foundingFree) {
    return { active: true, reason: "founding_free" as const };
  }
  if (billing.status && ACTIVE_STATUSES.has(billing.status)) {
    return { active: true, reason: "subscription" as const };
  }
  if (billing.trialEndsAt && billing.trialEndsAt.getTime() > Date.now()) {
    return { active: true, reason: "trial" as const };
  }
  return { active: false, reason: "expired" as const };
}

async function getWorkspaceBilling(workspaceId: string) {
  const billing = await getOrCreateWorkspaceBilling(workspaceId);
  const entitlement = computeEntitlement(billing);

  return {
    billingEnabled: isBillingEnabled(),
    entitlement,
    foundingFree: billing.foundingFree,
    trialEndsAt: billing.trialEndsAt,
    plan: billing.plan,
    billingInterval: billing.billingInterval,
    status: billing.status,
    seats: billing.seats,
    currentPeriodEnd: billing.currentPeriodEnd,
    canceledAt: billing.canceledAt,
    hasCustomer: Boolean(billing.creemCustomerId),
  };
}

export default getWorkspaceBilling;
