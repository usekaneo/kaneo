import { hasWorkspaceAccess, syncWorkspaceAccess } from "./workspace-access";
import { createRevocationDelivery } from "./revocation-delivery";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import db from "../database";
import {
  projectTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { subscribeToEvent } from "../events";
import {
  hasInstanceAdminRole,
  instanceAdminRoleSql,
} from "../utils/instance-admin-role";
import { isRedisConfigured } from "../redis";
import {
  getRelationSourceProject,
  getSubtaskParentProjects,
} from "../task/get-subtask-parent-projects";
import type {
  BroadcastAdapter,
  BroadcastMessage,
  ProjectBroadcastMessage,
  UserBroadcast,
  UserBroadcastMessage,
} from "./broadcast-adapter";
import { InMemoryBroadcastAdapter } from "./in-memory-broadcast-adapter";
import { RedisBroadcastAdapter } from "./redis-broadcast-adapter";

const INSTANCE_ID = randomUUID();
let revocationDelivery: ReturnType<typeof createRevocationDelivery> | undefined;
let receivedRevocations:
  | ReturnType<typeof createRevocationDelivery>
  | undefined;

type ProjectConnection = {
  ws: WSContext;
  userId: string;
  initiatorId: string;
  workspaceId: string;
};

type UserConnection = {
  ws: WSContext;
};

/**
 * User-scoped connections: tracks WebSocket connections keyed by userId.
 * Used for delivering user-targeted events like NOTIFICATION_CREATED.
 */
const userConnections = new Map<string, Set<UserConnection>>();

export function addUserConnection(userId: string, ws: WSContext) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  const conn: UserConnection = { ws };
  userConnections.get(userId)?.add(conn);
  return conn;
}

export function removeUserConnection(userId: string, conn: UserConnection) {
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(conn);
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }
}

export function broadcastToUser(userId: string, message: UserBroadcastMessage) {
  deliverToLocalUserConnections(userId, message);

  if (!adapter) {
    return;
  }

  void adapter
    .publishToUser({ userId, message, origin: INSTANCE_ID })
    .catch((err) => {
      console.error("Failed to publish a user broadcast:", err);
    });
}

function deliverToLocalUserConnections(
  userId: string,
  message: UserBroadcastMessage,
) {
  if (
    message.type === "WORKSPACE_ACCESS_REVOKED" &&
    typeof message.workspaceId === "string"
  ) {
    revokeLocalWorkspaceConnections(userId, message.workspaceId);
  }
  const allAccessRevoked = message.type === "USER_ACCESS_REVOKED";
  if (allAccessRevoked) {
    for (const [projectId, connections] of projectConnections)
      for (const conn of [...connections]) {
        if (conn.userId !== userId) continue;
        removeConnection(projectId, conn);
        try {
          conn.ws.close(1008, "User access revoked");
        } catch {
          /* Already closed. */
        }
      }
  }
  const connections = userConnections.get(userId);
  if (!connections) return;

  const payload = JSON.stringify(message);
  for (const conn of connections) {
    try {
      conn.ws.send(payload);
    } catch {
      connections.delete(conn);
    }
    if (allAccessRevoked) {
      connections.delete(conn);
      try {
        conn.ws.close(1008, "User access revoked");
      } catch {
        /* Already closed. */
      }
    }
  }
  if (connections.size === 0) {
    userConnections.delete(userId);
  }
}

/**
 * Local connections: each instance tracks only its own WebSocket connections.
 */
const projectConnections = new Map<string, Set<ProjectConnection>>();

/**
 * Batching queues and timers local per-instance.
 * They accumulate messages before flushing to the broadcast adapter.
 */
const projectBroadcastQueues = new Map<
  string,
  Map<string, { message: ProjectBroadcastMessage; excludeInitiatorId?: string }>
>();
const projectBroadcastTimeouts = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

let adapter: BroadcastAdapter | null = null;

// --- Subscribe to incoming broadcasts and deliver to local connections ---
export async function initializeWebSocketAdapter() {
  if (adapter) return;

  const nextAdapter = isRedisConfigured()
    ? new RedisBroadcastAdapter()
    : new InMemoryBroadcastAdapter();

  const retryReceived = createRevocationDelivery({
    async publishToUser(msg) {
      if (
        await hasWorkspaceAccess(msg.userId, msg.message.workspaceId as string)
      )
        return;
      if (receivedRevocations !== retryReceived) return;
      deliverToLocalUserConnections(msg.userId, msg.message);
    },
  });
  receivedRevocations = retryReceived;
  try {
    await nextAdapter.subscribe((msg: BroadcastMessage) => {
      return deliverToLocalConnections(
        msg.projectId,
        msg.message,
        msg.excludeInitiatorId,
        msg.authorizationBatch,
      );
    });
    await nextAdapter.subscribeToUser(
      async (msg: UserBroadcast) => {
        if (msg.origin === INSTANCE_ID) {
          return;
        }
        if (
          msg.message.type === "WORKSPACE_ACCESS_REVOKED" &&
          typeof msg.message.workspaceId === "string" &&
          !msg.message.force
        ) {
          try {
            // Redis can deliver an offline-queued initial publish after this
            // member has been re-added. Check the recipient's current access.
            if (await hasWorkspaceAccess(msg.userId, msg.message.workspaceId))
              return;
          } catch (error) {
            console.error(
              "Failed to verify received workspace revocation:",
              error,
            );
            await retryReceived.send(msg);
            return;
          }
        }
        deliverToLocalUserConnections(msg.userId, msg.message);
      },
      async () => {
        await Promise.all(
          [...userConnections].flatMap(([userId, connections]) =>
            [...connections].map(({ ws }) => syncWorkspaceAccess(userId, ws)),
          ),
        );
      },
    );
  } catch (err) {
    retryReceived.stop();
    receivedRevocations = undefined;
    await nextAdapter.shutdown().catch(() => {});
    throw err;
  }

  adapter = nextAdapter;
  revocationDelivery = createRevocationDelivery(nextAdapter);
  console.log(`📡 WebSockets Initialized using: "${adapter.constructor.name}"`);
}

export async function shutdownWebSocketAdapter() {
  revocationDelivery?.stop();
  revocationDelivery = undefined;
  receivedRevocations?.stop();
  receivedRevocations = undefined;
  const pendingQueues = [...projectBroadcastQueues.entries()];

  for (const timeout of projectBroadcastTimeouts.values()) {
    clearTimeout(timeout);
  }
  projectBroadcastTimeouts.clear();
  projectBroadcastQueues.clear();

  const currentAdapter = adapter;
  if (currentAdapter) {
    await Promise.allSettled(
      pendingQueues.flatMap(([projectId, queue]) =>
        [...queue.values()].map(({ message, excludeInitiatorId }) =>
          currentAdapter.publish({ projectId, message, excludeInitiatorId }),
        ),
      ),
    );
  }

  await currentAdapter?.shutdown();
  adapter = null;
}

function closeLocalProjectConnections(projectId: string) {
  const timeout = projectBroadcastTimeouts.get(projectId);
  if (timeout) clearTimeout(timeout);
  projectBroadcastTimeouts.delete(projectId);
  projectBroadcastQueues.delete(projectId);
  const connections = projectConnections.get(projectId);
  projectConnections.delete(projectId);
  for (const conn of connections ?? []) {
    try {
      conn.ws.send(JSON.stringify({ type: "PROJECT_MOVED", projectId }));
    } catch {
      /* The socket may already be closed. */
    }
    try {
      conn.ws.close(1008, "Project workspace changed");
    } catch {
      /* Already closed. */
    }
  }
}

export async function closeProjectConnections(projectId: string) {
  closeLocalProjectConnections(projectId);
  try {
    await adapter?.publish({
      projectId,
      message: { type: "PROJECT_MOVED", projectId },
    });
  } catch (error) {
    // Delivery also checks the workspace, so missed Redis notifications cannot
    // leave old connections receiving future project updates.
    console.error("Failed to publish project move:", error);
  }
}

function revokeLocalWorkspaceConnections(userId: string, workspaceId: string) {
  for (const [projectId, connections] of projectConnections) {
    for (const conn of [...connections]) {
      if (conn.userId !== userId || conn.workspaceId !== workspaceId) continue;
      removeConnection(projectId, conn);
      try {
        conn.ws.close(1008, "Workspace access revoked");
      } catch {
        /* Already closed. */
      }
    }
  }
}

export async function revokeUserConnections(userId: string) {
  const message = { type: "USER_ACCESS_REVOKED" };
  deliverToLocalUserConnections(userId, message);
  await revocationDelivery?.send({ userId, message, origin: INSTANCE_ID });
}

export async function revokeWorkspaceConnections(
  userId: string,
  workspaceId: string,
  options: { force?: boolean; role?: string | null } = {},
) {
  if (!options.force) {
    try {
      const [user] =
        "role" in options
          ? [{ role: options.role }]
          : await db
              .select({ userId: userTable.id, role: userTable.role })
              .from(userTable)
              .where(eq(userTable.id, userId));
      if (hasInstanceAdminRole(user?.role)) return;
    } catch (error) {
      console.error("Failed to read role after membership removal:", error);
    }
  }
  deliverToLocalUserConnections(userId, {
    type: "WORKSPACE_ACCESS_REVOKED",
    workspaceId,
  });
  await revocationDelivery?.send(
    {
      userId,
      message: {
        type: "WORKSPACE_ACCESS_REVOKED",
        workspaceId,
        ...(options.force ? { force: true } : {}),
      },
      origin: INSTANCE_ID,
    },
    options.force
      ? undefined
      : async () => {
          const [[user], members] = await Promise.all([
            db
              .select({ role: userTable.role })
              .from(userTable)
              .where(eq(userTable.id, userId)),
            db
              .select({ userId: workspaceUserTable.userId })
              .from(workspaceUserTable)
              .where(
                and(
                  eq(workspaceUserTable.userId, userId),
                  eq(workspaceUserTable.workspaceId, workspaceId),
                ),
              ),
          ]);
          return !hasInstanceAdminRole(user?.role) && members.length === 0;
        },
  );
}

const workspaceLookups = new Map<string, Promise<string | null>>();
function currentProjectWorkspace(projectId: string) {
  let pending = workspaceLookups.get(projectId);
  if (!pending) {
    pending = db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .limit(1)
      .then(([project]) => project?.workspaceId ?? null)
      .finally(() => workspaceLookups.delete(projectId));
    workspaceLookups.set(projectId, pending);
  }
  return pending;
}

const authorizationLookups = new Map<
  string,
  Promise<{ workspaceId: string | null; members: Set<string> } | null>
>();
function currentBroadcastAccess(
  projectId: string,
  recipients: Array<{ userId: string }>,
  authorizationBatch: string,
) {
  const key = JSON.stringify([
    projectId,
    authorizationBatch,
    [...new Set(recipients.map((conn) => conn.userId))].sort(),
  ]);
  let pending = authorizationLookups.get(key);
  if (!pending) {
    pending = (async () => {
      let workspaceId: string | null;
      try {
        workspaceId = await currentProjectWorkspace(projectId);
      } catch (error) {
        console.error("Failed to validate project broadcast access:", error);
        return null;
      }
      let members = new Set<string>();
      if (workspaceId) {
        try {
          const rows = await db
            .select({ userId: workspaceUserTable.userId })
            .from(workspaceUserTable)
            .where(
              and(
                eq(workspaceUserTable.workspaceId, workspaceId),
                inArray(workspaceUserTable.userId, [
                  ...new Set(recipients.map((conn) => conn.userId)),
                ]),
              ),
            );
          members = new Set(rows.map((row) => row.userId));
          const nonmembers = [
            ...new Set(recipients.map((conn) => conn.userId)),
          ].filter((userId) => !members.has(userId));
          if (nonmembers.length > 0) {
            const admins = await db
              .select({ userId: userTable.id, role: userTable.role })
              .from(userTable)
              .where(
                and(
                  inArray(userTable.id, nonmembers),
                  instanceAdminRoleSql(userTable.role),
                ),
              );
            for (const admin of admins) members.add(admin.userId);
          }
        } catch (error) {
          console.error("Failed to validate broadcast membership:", error);
          return null;
        }
      }
      return { workspaceId, members };
    })().finally(() => authorizationLookups.delete(key));
    authorizationLookups.set(key, pending);
  }
  return pending;
}

async function deliverToLocalConnections(
  projectId: string,
  message: ProjectBroadcastMessage,
  excludeInitiatorId?: string,
  authorizationBatch: string = randomUUID(),
) {
  if (message.type === "PROJECT_MOVED") {
    closeLocalProjectConnections(projectId);
    return;
  }
  const connections = projectConnections.get(projectId);
  if (!connections) return;
  const recipients = [...connections];
  const access = await currentBroadcastAccess(
    projectId,
    recipients,
    authorizationBatch,
  );
  if (!access) return;
  const { workspaceId, members } = access;
  const payload = JSON.stringify(message);
  for (const conn of recipients) {
    // A move may have closed these connections while the lookup was in flight.
    if (!projectConnections.get(projectId)?.has(conn)) continue;
    if (conn.workspaceId !== workspaceId || !members.has(conn.userId)) {
      removeConnection(projectId, conn);
      try {
        conn.ws.close(
          1008,
          conn.workspaceId !== workspaceId
            ? "Project workspace changed"
            : "Workspace access revoked",
        );
      } catch {
        /* Already closed. */
      }
      continue;
    }
    if (excludeInitiatorId && conn.initiatorId === excludeInitiatorId) continue;
    try {
      conn.ws.send(payload);
    } catch {
      removeConnection(projectId, conn);
    }
  }
}

export function addConnection(
  projectId: string,
  ws: WSContext,
  userId: string,
  initiatorId: string,
  workspaceId: string,
) {
  if (!projectConnections.has(projectId)) {
    projectConnections.set(projectId, new Set());
  }
  const conn: ProjectConnection = { ws, userId, initiatorId, workspaceId };
  projectConnections.get(projectId)?.add(conn);
  return conn;
}

export function removeConnection(projectId: string, conn: ProjectConnection) {
  const connections = projectConnections.get(projectId);
  if (connections) {
    connections.delete(conn);
    if (connections.size === 0) {
      projectConnections.delete(projectId);
    }
  }
}

export function broadcastToProject(
  projectId: string,
  message: ProjectBroadcastMessage,
  excludeInitiatorId?: string,
) {
  if (!adapter) {
    console.warn("broadcastToProject called before adapter initialization");
    return;
  }

  if (!projectBroadcastQueues.has(projectId)) {
    projectBroadcastQueues.set(projectId, new Map());
  }

  const messageKey = `${message.type === "TASKS_REORDERED" ? `${message.type}:${crypto.randomUUID()}` : message.type}:${message.taskId ?? ""}:${message.sourceTaskId ?? ""}:${message.targetTaskId ?? ""}`;
  const previous = projectBroadcastQueues.get(projectId)?.get(messageKey);
  projectBroadcastQueues.get(projectId)?.set(messageKey, {
    message: {
      ...message,
      ...(previous?.message.linksChanged ? { linksChanged: true } : {}),
      ...(previous?.message.taskTitleChanged ? { taskTitleChanged: true } : {}),
    },
    excludeInitiatorId,
  });

  if (projectBroadcastTimeouts.has(projectId)) {
    return;
  }

  const timeout = setTimeout(() => {
    projectBroadcastTimeouts.delete(projectId);
    const queue = projectBroadcastQueues.get(projectId);
    projectBroadcastQueues.delete(projectId);

    if (!queue || !adapter) return;

    // Only this captured flush may share its authorization snapshot.
    const authorizationBatch = randomUUID();
    // Publish each queued message through the adapter
    for (const { message: msg, excludeInitiatorId: exId } of queue.values()) {
      void adapter
        .publish({
          projectId,
          message: msg,
          excludeInitiatorId: exId,
          authorizationBatch,
        })
        .catch((err) => {
          console.error(
            `Failed to publish broadcast for project ${projectId}:`,
            err,
          );
        });
    }
  }, 100);

  projectBroadcastTimeouts.set(projectId, timeout);
}

type TaskEvent = {
  titleChanged?: boolean;
  skipSubtaskParentRefresh?: boolean;
  id: string | undefined;
  projectId: string;
  userId: string;
  initiatorId?: string;
  taskId: string;
  sourceTaskId: string | undefined;
  targetTaskId: string | undefined;
};

// Include the initiating window: its local mutation refreshes the child project,
// while it may be displaying a different parent board. Never send child data.
function refreshParentBoards(
  projects: { projectId: string }[],
  currentProjectId = "",
) {
  for (const { projectId } of projects) {
    if (projectId === currentProjectId) continue;
    broadcastToProject(projectId, {
      type: "TASK_RELATION_UPDATED",
      projectId,
      taskId: "",
    });
  }
}

subscribeToEvent<{ projects: { projectId: string }[] }>(
  "subtask-parents.refresh",
  async ({ projects }) => {
    refreshParentBoards(projects);
  },
);

const taskUpdateEvents = [
  "task.created",
  "task.updated",
  "task.deleted",
  "task.status_changed",
  "task.priority_changed",
  "task.unassigned",
  "task.assignee_changed",
  "task.due_date_changed",
  "task.title_changed",
  "task.description_changed",
  "task.label_assigned",
  "task.label_unassigned",
  "task.label_created",
  "task.labels_updated",
  "task.label_deleted",
  "task-relation.created",
  "task-relation.deleted",
  "comment.created",
  "comment.deleted",
  "comment.updated",
];

subscribeToEvent<{
  taskId: string;
  userId: string;
  initiatorId?: string;
  type: string;
  content: string;
  fromProjectId: string;
  fromProjectName: string;
  toProjectId: string;
  toProjectName: string;
  oldStatus: string;
  newStatus: string;
}>("task.moved", async (data) => {
  const { fromProjectId, initiatorId, toProjectId, taskId } = data;

  broadcastToProject(
    toProjectId,
    { type: "TASK_MOVED", projectId: toProjectId, taskId },
    initiatorId,
  );
  broadcastToProject(
    fromProjectId,
    { type: "TASK_MOVED", projectId: fromProjectId, taskId },
    initiatorId,
  );
  refreshParentBoards(await getSubtaskParentProjects([taskId]), toProjectId);
});

subscribeToEvent<{
  projectId: string;
  userId: string;
  initiatorId?: string;
}>("task-relation.refresh", async (data) => {
  const { projectId, initiatorId } = data;
  if (!projectId) return;

  broadcastToProject(
    projectId,
    {
      type: "TASK_RELATION_UPDATED",
      projectId,
      taskId: "",
      sourceTaskId: undefined,
      targetTaskId: undefined,
    },
    initiatorId,
  );
});

// Project-scoped rather than per task: a project move can unassign every task
// in the project at once, so clients refetch the board once instead of
// receiving one message per task.
subscribeToEvent<{
  projectId: string;
  userId: string;
  initiatorId?: string;
}>("task.bulk_unassigned", async (data) => {
  const { projectId, initiatorId } = data;
  if (!projectId) return;

  broadcastToProject(
    projectId,
    { type: "TASK_UPDATED", projectId, taskId: "" },
    initiatorId,
  );
});

subscribeToEvent<{ notificationId: string; userId: string }>(
  "notification.created",
  async (data) => {
    if (data.userId) {
      broadcastToUser(data.userId, { type: "NOTIFICATION_CREATED" });
    }
  },
);

subscribeToEvent<{
  projectId: string;
  initiatorId?: string;
  linksChanged?: boolean;
}>("project.updated", async (data) => {
  const { projectId, initiatorId } = data;
  if (!projectId) return;

  broadcastToProject(
    projectId,
    {
      type: "PROJECT_UPDATED",
      projectId,
      ...(data.linksChanged ? { linksChanged: true } : {}),
    },
    initiatorId,
  );
});

for (const eventName of taskUpdateEvents) {
  subscribeToEvent<TaskEvent>(eventName, async (data) => {
    const { projectId, initiatorId } = data;
    const taskId = data.taskId;

    if (!projectId || !taskId) return;
    let type: string;
    switch (eventName) {
      case "task.created":
        type = "TASK_CREATED";
        break;
      case "task.deleted":
        type = "TASK_DELETED";
        break;
      case "task-relation.created":
      case "task-relation.deleted":
        type = "TASK_RELATION_UPDATED";
        break;
      case "task.label_assigned":
      case "task.label_unassigned":
      case "task.label_created":
      case "task.labels_updated":
      case "task.label_deleted":
        type = "TASK_LABEL_UPDATED";
        break;
      case "comment.created":
      case "comment.deleted":
      case "comment.updated":
        type = "COMMENT_UPDATED";
        break;
      default:
        type = "TASK_UPDATED";
    }

    if (eventName === "task.label_deleted") {
      // Cascade deletion waits for this adapter operation rather than growing
      // the ordinary 100ms broadcast queue behind a slow Redis connection.
      await adapter?.publish({
        projectId,
        message: { type, projectId, taskId },
        excludeInitiatorId: initiatorId,
      });
      return;
    }

    broadcastToProject(
      projectId,
      {
        type,
        projectId,
        taskId: taskId,
        sourceTaskId: data.sourceTaskId,
        targetTaskId: data.targetTaskId,
        ...(eventName === "task.title_changed" || data.titleChanged
          ? { taskTitleChanged: true }
          : {}),
      },
      initiatorId,
    );
    if (eventName === "task.status_changed" && !data.skipSubtaskParentRefresh) {
      refreshParentBoards(await getSubtaskParentProjects([taskId]), projectId);
    } else if (eventName === "task-relation.deleted" && data.sourceTaskId) {
      refreshParentBoards(
        await getRelationSourceProject(data.sourceTaskId),
        projectId,
      );
    }
  });
}

subscribeToEvent<{
  projectId: string;
  userId: string;
  tasks: Array<{ id: string; position: number; status?: string }>;
}>("tasks.reordered", async (data) => {
  broadcastToProject(data.projectId, {
    type: "TASKS_REORDERED",
    projectId: data.projectId,
    tasks: data.tasks,
  });
});
