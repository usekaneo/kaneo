import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";
import { syncWorkspaceAccess } from "./workspace-access";
import { workspaceRevocationIsCurrent } from "./workspace-revocation-is-current";
import { createRevocationDelivery } from "./revocation-delivery";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import db from "../database";
import {
  apikeyTable,
  projectTable,
  sessionTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { subscribeToEvent } from "../events";
import { findInaccessibleProjectIds } from "../project-access/find-inaccessible-project-ids";
import { filterUsersWithProjectAccess } from "../project-access/filter-users-with-project-access";
import { listWorkspaceProjectIds } from "../project-access/list-workspace-project-ids";
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
import { getProjectReadAccess } from "./project-read-access";

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
  sessionId: string | null;
  apiKeyId?: string;
};

type UserConnection = {
  ws: WSContext;
  sessionId: string | null;
  apiKeyId?: string;
};

// Only sockets of an ended session get this code, so the web rechecks its cookie.
export const SESSION_ENDED_CLOSE_CODE = 4001;

/**
 * User-scoped connections: tracks WebSocket connections keyed by userId.
 * Used for delivering user-targeted events like NOTIFICATION_CREATED.
 */
const userConnections = new Map<string, Set<UserConnection>>();

export function addUserConnection(
  userId: string,
  ws: WSContext,
  sessionId: string | null = null,
  apiKeyId?: string,
) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  const conn: UserConnection = {
    ws,
    sessionId,
    ...(apiKeyId ? { apiKeyId } : {}),
  };
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

type Credential = { sessionId: string | null; apiKeyId?: string };

function closeLocalCredentialConnections(
  userId: string,
  ended: (conn: Credential) => boolean,
  code: number,
  reason: string,
) {
  for (const [projectId, connections] of projectConnections)
    for (const conn of [...connections]) {
      if (conn.userId !== userId || !ended(conn)) continue;
      removeConnection(projectId, conn);
      try {
        conn.ws.close(code, reason);
      } catch {
        /* Already closed. */
      }
    }
  for (const conn of [...(userConnections.get(userId) ?? [])]) {
    if (!ended(conn)) continue;
    removeUserConnection(userId, conn);
    try {
      conn.ws.close(code, reason);
    } catch {
      /* Already closed. */
    }
  }
}

function closeLocalSessionConnections(
  userId: string,
  sessionIds: ReadonlySet<string>,
) {
  closeLocalCredentialConnections(
    userId,
    ({ sessionId }) => sessionId !== null && sessionIds.has(sessionId),
    SESSION_ENDED_CLOSE_CODE,
    "Session ended",
  );
}

function closeLocalApiKeyConnections(
  userId: string,
  apiKeyIds: ReadonlySet<string>,
) {
  closeLocalCredentialConnections(
    userId,
    ({ apiKeyId }) => apiKeyId !== undefined && apiKeyIds.has(apiKeyId),
    1008,
    "API key revoked",
  );
}

const stringIds = (ids: unknown) =>
  Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string")
    : [];

function deliverToLocalUserConnections(
  userId: string,
  message: UserBroadcastMessage,
) {
  if (message.type === "SESSIONS_ENDED") {
    closeLocalSessionConnections(
      userId,
      new Set(stringIds(message.sessionIds)),
    );
    return;
  }
  if (message.type === "API_KEYS_REVOKED") {
    closeLocalApiKeyConnections(userId, new Set(stringIds(message.apiKeyIds)));
    return;
  }
  if (
    message.type === "WORKSPACE_ACCESS_REVOKED" &&
    typeof message.workspaceId === "string"
  ) {
    revokeLocalWorkspaceConnections(
      userId,
      message.workspaceId,
      message.reason === "archived" ? "Workspace archived" : undefined,
    );
  }
  if (
    message.type === "PROJECT_ACCESS_CHANGED" &&
    typeof message.workspaceId === "string"
  ) {
    void revokeLocalProjectConnections(userId, message.workspaceId);
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

/** Open sockets on this API instance, for the admin system page. */
export function getLocalRealtimeStats() {
  const users = new Set<string>();
  let connections = 0;
  for (const [userId, sockets] of userConnections) {
    if (sockets.size === 0) continue;
    users.add(userId);
    connections += sockets.size;
  }
  for (const sockets of projectConnections.values()) {
    for (const socket of sockets) {
      users.add(socket.userId);
      connections += 1;
    }
  }
  return {
    adapter:
      adapter === null
        ? null
        : adapter instanceof RedisBroadcastAdapter
          ? ("redis" as const)
          : ("in-memory" as const),
    connections,
    connectedUsers: users.size,
  };
}

// --- Subscribe to incoming broadcasts and deliver to local connections ---
export async function initializeWebSocketAdapter() {
  if (adapter) return;

  const nextAdapter = isRedisConfigured()
    ? new RedisBroadcastAdapter()
    : new InMemoryBroadcastAdapter();

  const retryReceived = createRevocationDelivery({
    async publishToUser(msg) {
      if (
        !(await workspaceRevocationIsCurrent(
          msg.userId,
          msg.message.workspaceId as string,
          msg.message.reason,
        ))
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
          (!msg.message.force || msg.message.reason === "archived")
        ) {
          try {
            // Queued revocations may arrive after access has been restored.
            if (
              !(await workspaceRevocationIsCurrent(
                msg.userId,
                msg.message.workspaceId,
                msg.message.reason,
              ))
            )
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
        await Promise.all([
          ...[...userConnections].flatMap(([userId, connections]) =>
            [...connections].map(({ ws }) => syncWorkspaceAccess(userId, ws)),
          ),
          recheckLocalProjectAccess(),
          recheckLocalSessions(),
          recheckLocalApiKeys(),
        ]);
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

function revokeLocalWorkspaceConnections(
  userId: string,
  workspaceId: string,
  reason = "Workspace access revoked",
) {
  for (const [projectId, connections] of projectConnections) {
    for (const conn of [...connections]) {
      if (conn.userId !== userId || conn.workspaceId !== workspaceId) continue;
      removeConnection(projectId, conn);
      try {
        conn.ws.close(1008, reason);
      } catch {
        /* Already closed. */
      }
    }
  }
}

async function revokeLocalProjectConnections(
  userId: string,
  workspaceId?: string,
) {
  const revokedWorkspaceIds = new Set<string>();
  const owned = [...projectConnections].flatMap(([projectId, connections]) =>
    [...connections]
      .filter(
        (conn) =>
          conn.userId === userId &&
          (workspaceId === undefined || conn.workspaceId === workspaceId),
      )
      .map((conn) => ({ projectId, conn })),
  );
  if (owned.length === 0) return revokedWorkspaceIds;
  let denied: Set<string>;
  try {
    denied = new Set(
      await findInaccessibleProjectIds(
        userId,
        owned.map(({ projectId }) => projectId),
      ),
    );
  } catch (error) {
    console.error("Failed to verify project access:", error);
    return revokedWorkspaceIds;
  }
  for (const { projectId, conn } of owned) {
    if (!denied.has(projectId)) continue;
    if (!projectConnections.get(projectId)?.has(conn)) continue;
    removeConnection(projectId, conn);
    revokedWorkspaceIds.add(conn.workspaceId);
    try {
      conn.ws.close(1008, "Project access revoked");
    } catch {}
  }
  return revokedWorkspaceIds;
}

async function recheckLocalProjectAccess() {
  const userIds = new Set(
    [...projectConnections.values()].flatMap((connections) =>
      [...connections].map((conn) => conn.userId),
    ),
  );
  await Promise.all(
    [...userIds].map(async (userId) => {
      for (const workspaceId of await revokeLocalProjectConnections(userId)) {
        const payload = JSON.stringify({
          type: "PROJECT_ACCESS_CHANGED",
          workspaceId,
        });
        for (const { ws } of userConnections.get(userId) ?? []) {
          try {
            ws.send(payload);
          } catch {}
        }
      }
    }),
  );
}

async function recheckLocalSessions() {
  const sessionsByUser = new Map<string, Set<string>>();
  const note = (userId: string, sessionId: string | null) => {
    if (sessionId === null) return;
    const sessionIds = sessionsByUser.get(userId) ?? new Set<string>();
    sessionsByUser.set(userId, sessionIds.add(sessionId));
  };
  for (const [userId, connections] of userConnections)
    for (const conn of connections) note(userId, conn.sessionId);
  for (const connections of projectConnections.values())
    for (const conn of connections) note(conn.userId, conn.sessionId);
  const ids = [...sessionsByUser.values()].flatMap((sessionIds) => [
    ...sessionIds,
  ]);
  if (ids.length === 0) return;
  let existing: Set<string>;
  try {
    const rows = await db
      .select({ id: sessionTable.id })
      .from(sessionTable)
      .where(inArray(sessionTable.id, ids));
    existing = new Set(rows.map((row) => row.id));
  } catch (error) {
    console.error("Failed to verify realtime sessions:", error);
    return;
  }
  for (const [userId, sessionIds] of sessionsByUser) {
    const ended = new Set([...sessionIds].filter((id) => !existing.has(id)));
    if (ended.size > 0) closeLocalSessionConnections(userId, ended);
  }
}

// Redis may have dropped a key revocation while this instance was disconnected.
async function recheckLocalApiKeys() {
  const keysByUser = new Map<string, Set<string>>();
  const note = (userId: string, apiKeyId?: string) => {
    if (!apiKeyId) return;
    keysByUser.set(userId, (keysByUser.get(userId) ?? new Set()).add(apiKeyId));
  };
  for (const [userId, connections] of userConnections)
    for (const conn of connections) note(userId, conn.apiKeyId);
  for (const connections of projectConnections.values())
    for (const conn of connections) note(conn.userId, conn.apiKeyId);
  const ids = [...keysByUser.values()].flatMap((keyIds) => [...keyIds]);
  if (ids.length === 0) return;
  let existing: Set<string>;
  try {
    const rows = await db
      .select({ id: apikeyTable.id })
      .from(apikeyTable)
      .where(inArray(apikeyTable.id, ids));
    existing = new Set(rows.map((row) => row.id));
  } catch (error) {
    console.error("Failed to verify realtime API keys:", error);
    return;
  }
  for (const [userId, keyIds] of keysByUser) {
    const revoked = new Set([...keyIds].filter((id) => !existing.has(id)));
    if (revoked.size > 0) closeLocalApiKeyConnections(userId, revoked);
  }
}

export async function revokeUserConnections(userId: string) {
  const message = { type: "USER_ACCESS_REVOKED" };
  deliverToLocalUserConnections(userId, message);
  await revocationDelivery?.send({ userId, message, origin: INSTANCE_ID });
}

export async function revokeSessionConnections(
  userId: string,
  sessionIds: string[],
) {
  if (sessionIds.length === 0) return;
  const message = { type: "SESSIONS_ENDED", sessionIds };
  deliverToLocalUserConnections(userId, message);
  await revocationDelivery?.send({ userId, message, origin: INSTANCE_ID });
}

/** Close sockets opened with deleted API keys, on every API instance. */
export async function revokeApiKeyConnections(
  userId: string,
  apiKeyIds: string[],
) {
  if (apiKeyIds.length === 0) return;
  const message = { type: "API_KEYS_REVOKED", apiKeyIds };
  deliverToLocalUserConnections(userId, message);
  await revocationDelivery?.send({ userId, message, origin: INSTANCE_ID });
}

export async function revokeWorkspaceConnections(
  userId: string,
  workspaceId: string,
  options: {
    force?: boolean;
    role?: string | null;
    /** Tells clients why, so they can explain it instead of redirecting. */
    reason?: "archived";
  } = {},
) {
  if (
    options.reason === "archived" &&
    !(await workspaceRevocationIsCurrent(userId, workspaceId, options.reason))
  )
    return;
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
  const reason = options.reason ? { reason: options.reason } : {};
  deliverToLocalUserConnections(userId, {
    type: "WORKSPACE_ACCESS_REVOKED",
    workspaceId,
    ...reason,
  });
  await revocationDelivery?.send(
    {
      userId,
      message: {
        type: "WORKSPACE_ACCESS_REVOKED",
        workspaceId,
        ...reason,
        ...(options.force ? { force: true } : {}),
      },
      origin: INSTANCE_ID,
    },
    options.reason === "archived"
      ? () => workspaceRevocationIsCurrent(userId, workspaceId, options.reason)
      : options.force
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

const workspaceLookups = new Map<
  string,
  Promise<{ workspaceId: string | null; archived: boolean }>
>();
function currentProjectWorkspace(projectId: string) {
  let pending = workspaceLookups.get(projectId);
  if (!pending) {
    pending = db
      .select({
        workspaceId: projectTable.workspaceId,
        archived: sql<boolean>`not ${workspaceIsActive(projectTable.workspaceId)}`,
      })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .limit(1)
      .then(([project]) => ({
        workspaceId: project?.workspaceId ?? null,
        archived: !!project?.archived,
      }))
      .finally(() => workspaceLookups.delete(projectId));
    workspaceLookups.set(projectId, pending);
  }
  return pending;
}

const authorizationLookups = new Map<
  string,
  Promise<{
    workspaceId: string | null;
    archived: boolean;
    members: Set<string>;
    restricted: Set<string>;
    readers: Set<string>;
    apiKeys: Map<string, string>;
  } | null>
>();
function currentBroadcastAccess(
  projectId: string,
  recipients: Array<{ userId: string; apiKeyId?: string }>,
  authorizationBatch: string,
) {
  const userIds = [...new Set(recipients.map((conn) => conn.userId))].sort();
  const apiKeyIds = [
    ...new Set(
      recipients.flatMap((conn) => (conn.apiKeyId ? [conn.apiKeyId] : [])),
    ),
  ].sort();
  const key = JSON.stringify([
    projectId,
    authorizationBatch,
    userIds,
    apiKeyIds,
  ]);
  let pending = authorizationLookups.get(key);
  if (!pending) {
    pending = (async () => {
      let workspaceId: string | null;
      let archived: boolean;
      try {
        ({ workspaceId, archived } = await currentProjectWorkspace(projectId));
      } catch (error) {
        console.error("Failed to validate project broadcast access:", error);
        return null;
      }
      let members = new Set<string>();
      let restricted = new Set<string>();
      let readers = new Set<string>();
      let apiKeys = new Map<string, string>();
      // An archived workspace has no readers: leaving `members` empty closes
      // any socket a missed revocation left open.
      if (workspaceId && !archived) {
        try {
          const [rows, permitted] = await Promise.all([
            db
              .select({
                userId: workspaceUserTable.userId,
                role: workspaceUserTable.role,
              })
              .from(workspaceUserTable)
              .where(
                and(
                  eq(workspaceUserTable.workspaceId, workspaceId),
                  inArray(workspaceUserTable.userId, userIds),
                ),
              ),
            filterUsersWithProjectAccess(userIds, projectId),
          ]);
          members = new Set(rows.map((row) => row.userId));
          restricted = new Set(
            userIds.filter((userId) => !permitted.has(userId)),
          );
          ({ readers, apiKeys } = await getProjectReadAccess(
            workspaceId,
            recipients,
            rows,
          ));
          const nonmembers = userIds.filter((userId) => !members.has(userId));
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
      return { workspaceId, archived, members, restricted, readers, apiKeys };
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
  const { workspaceId, archived, members, restricted, readers, apiKeys } =
    access;
  const payload = JSON.stringify(message);
  for (const conn of recipients) {
    // A move may have closed these connections while the lookup was in flight.
    if (!projectConnections.get(projectId)?.has(conn)) continue;
    const revoked =
      conn.workspaceId !== workspaceId
        ? "Project workspace changed"
        : archived
          ? "Workspace archived"
          : !members.has(conn.userId)
            ? "Workspace access revoked"
            : restricted.has(conn.userId)
              ? "Project access revoked"
              : !readers.has(conn.userId) ||
                  (conn.apiKeyId && apiKeys.get(conn.apiKeyId) !== conn.userId)
                ? "Read permission revoked"
                : null;
    if (revoked) {
      removeConnection(projectId, conn);
      try {
        conn.ws.close(1008, revoked);
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
  apiKeyId?: string,
  sessionId: string | null = null,
) {
  if (!projectConnections.has(projectId)) {
    projectConnections.set(projectId, new Set());
  }
  const conn: ProjectConnection = {
    ws,
    userId,
    initiatorId,
    workspaceId,
    sessionId,
    ...(apiKeyId ? { apiKeyId } : {}),
  };
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

async function broadcastProjectMembersUpdated(
  workspaceId: string,
  projectIds?: string[],
) {
  for (const projectId of projectIds ??
    (await listWorkspaceProjectIds(workspaceId)))
    broadcastToProject(projectId, {
      type: "PROJECT_MEMBERS_UPDATED",
      projectId,
    });
}

subscribeToEvent<{
  workspaceId: string;
  userId: string;
  projectIds?: string[];
}>("project_access.updated", async ({ workspaceId, userId, projectIds }) => {
  if (!workspaceId || !userId) return;
  const message = { type: "PROJECT_ACCESS_CHANGED", workspaceId };
  deliverToLocalUserConnections(userId, message);
  await revocationDelivery?.send({ userId, message, origin: INSTANCE_ID });
  await broadcastProjectMembersUpdated(workspaceId, projectIds);
});

subscribeToEvent<{ workspaceId: string; projectIds?: string[] }>(
  "project_members.updated",
  async ({ workspaceId, projectIds }) => {
    if (!workspaceId) return;
    await broadcastProjectMembersUpdated(workspaceId, projectIds);
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
