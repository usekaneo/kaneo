import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";
import db, { schema } from "../database";
import {
  hasUserWorkspacePermission,
  type PermissionMap,
} from "../utils/require-workspace-permission";
import { isBanActive } from "../utils/user-ban";
import type { AgentSubject } from "./types";

export type AgentDatabase =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function assertAgentAccess(
  subject: AgentSubject,
  permissions: PermissionMap = { project: ["read"], task: ["read"] },
  database: AgentDatabase = db,
) {
  const [workspace] = await database
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, subject.workspaceId))
    .limit(1);
  if (!workspace)
    throw new HTTPException(404, { message: "Workspace not found" });
  const [user] = await database
    .select({
      banned: schema.userTable.banned,
      banExpires: schema.userTable.banExpires,
      isAnonymous: schema.userTable.isAnonymous,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, subject.userId))
    .limit(1);
  if (
    !user ||
    user.isAnonymous ||
    isBanActive(user) ||
    !(await hasUserWorkspacePermission(
      subject.userId,
      subject.workspaceId,
      permissions,
      database,
    ))
  ) {
    throw new HTTPException(403, { message: "Insufficient agent permissions" });
  }
  if (subject.projectId)
    await assertAgentProject(subject, subject.projectId, database);
}

export async function assertAgentProject(
  subject: AgentSubject,
  projectId: string,
  database: AgentDatabase = db,
) {
  const [project] = await database
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.id, projectId),
        eq(schema.projectTable.workspaceId, subject.workspaceId),
      ),
    )
    .limit(1);
  if (!project || (subject.projectId && subject.projectId !== projectId)) {
    throw new HTTPException(404, {
      message: "Project not found in agent scope",
    });
  }
}

export async function requireAgentSession(c: Context, next: Next) {
  if (!c.get("session") || c.get("apiKey"))
    throw new HTTPException(403, { message: "Agent requires a user session" });
  await assertAgentAccess({
    userId: c.get("userId"),
    workspaceId: c.req.param("workspaceId") ?? "",
    projectId: null,
  });
  return next();
}

export async function getOwnedConversation(
  subject: AgentSubject,
  conversationId: string,
  database: AgentDatabase = db,
) {
  const [conversation] = await database
    .select()
    .from(schema.agentConversationTable)
    .where(
      and(
        eq(schema.agentConversationTable.id, conversationId),
        eq(schema.agentConversationTable.userId, subject.userId),
        eq(schema.agentConversationTable.workspaceId, subject.workspaceId),
      ),
    )
    .limit(1);
  if (!conversation)
    throw new HTTPException(404, { message: "Conversation not found" });
  await assertAgentAccess(
    { ...subject, projectId: conversation.projectId },
    undefined,
    database,
  );
  return conversation;
}

export async function getOwnedRun(
  subject: AgentSubject,
  runId: string,
  database: AgentDatabase = db,
) {
  const [run] = await database
    .select()
    .from(schema.agentRunTable)
    .innerJoin(
      schema.agentConversationTable,
      eq(schema.agentRunTable.conversationId, schema.agentConversationTable.id),
    )
    .where(
      and(
        eq(schema.agentRunTable.id, runId),
        eq(schema.agentConversationTable.userId, subject.userId),
        eq(schema.agentConversationTable.workspaceId, subject.workspaceId),
      ),
    )
    .limit(1);
  if (!run) throw new HTTPException(404, { message: "Run not found" });
  const scoped = { ...subject, projectId: run.agent_conversation.projectId };
  await assertAgentAccess(scoped, undefined, database);
  return { run: run.agent_run, subject: scoped };
}
