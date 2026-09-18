import { eq } from "drizzle-orm";
import db from "../database";
import {
  payrollRunTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { subscribeToEvent } from "../events";
import createNotification from "../notification/controllers/create-notification";
import { getRoleStatements } from "../utils/require-workspace-permission";

/** Members whose role lets them approve requests, never `except`. */
async function approvers(workspaceId: string, except: string) {
  const members = await db
    .select({
      userId: workspaceUserTable.userId,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.workspaceId, workspaceId));
  const canApprove = new Map<string, boolean>();
  for (const role of new Set(members.map((m) => m.role))) {
    const statements = await getRoleStatements(workspaceId, role);
    canApprove.set(role, Boolean(statements?.request?.includes("approve")));
  }
  return members
    .filter((m) => m.userId !== except && canApprove.get(m.role))
    .map((m) => m.userId);
}

async function nameOf(userId: string) {
  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));
  return user?.name ?? "";
}

type LeaveRequested = {
  workspaceId: string;
  requestId: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
};

type LeaveDecided = {
  workspaceId: string;
  requestId: string;
  userId: string;
  actorId: string;
  decision: "approved" | "rejected" | "cancelled";
  type: string;
  startDate: string;
  endDate: string;
  note: string | null;
};

subscribeToEvent<LeaveRequested>("leave.requested", async (data) => {
  const [recipients, userName] = await Promise.all([
    approvers(data.workspaceId, data.userId),
    nameOf(data.userId),
  ]);
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "leave_requested",
        eventData: { ...data, userName },
        resourceId: data.requestId,
        resourceType: "leave_request",
      }),
    ),
  );
});

subscribeToEvent<LeaveDecided>("leave.decided", async (data) => {
  await createNotification({
    userId: data.userId,
    type: `leave_${data.decision}`,
    eventData: { ...data, actorName: await nameOf(data.actorId) },
    resourceId: data.requestId,
    resourceType: "leave_request",
  });
});

type ExpenseSubmitted = {
  workspaceId: string;
  expenseId: string;
  userId: string;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  spentOn: string;
};

type ExpenseDecided = {
  workspaceId: string;
  expenseId: string;
  userId: string;
  actorId: string;
  decision: "approved" | "rejected" | "paid";
  amount: number;
  currency: string;
  category: string;
  spentOn: string;
};

subscribeToEvent<ExpenseSubmitted>("expense.submitted", async (data) => {
  const [recipients, userName] = await Promise.all([
    approvers(data.workspaceId, data.userId),
    nameOf(data.userId),
  ]);
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "expense_submitted",
        eventData: { ...data, userName },
        resourceId: data.expenseId,
        resourceType: "expense",
      }),
    ),
  );
});

subscribeToEvent<ExpenseDecided>("expense.decided", async (data) => {
  // Paying yourself back needs no email to yourself.
  if (data.actorId === data.userId) return;
  await createNotification({
    userId: data.userId,
    type: `expense_${data.decision}`,
    eventData: { ...data, actorName: await nameOf(data.actorId) },
    resourceId: data.expenseId,
    resourceType: "expense",
  });
});

type PayslipReady = { workspaceId: string; runId: string; userIds: string[] };

// Published by pay/ when a run is approved, which is when payslips show.
subscribeToEvent<PayslipReady>("payslip.ready", async (data) => {
  const [run] = await db
    .select({ year: payrollRunTable.year, month: payrollRunTable.month })
    .from(payrollRunTable)
    .where(eq(payrollRunTable.id, data.runId));
  if (!run) return;
  await Promise.all(
    data.userIds.map((userId) =>
      createNotification({
        userId,
        type: "payslip_ready",
        eventData: {
          workspaceId: data.workspaceId,
          runId: data.runId,
          year: run.year,
          month: run.month,
        },
        resourceId: data.runId,
        resourceType: "payslip",
      }),
    ),
  );
});
