import { eq } from "drizzle-orm";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";
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
