import { and, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { hasUserWorkspacePermission } from "../../utils/require-workspace-permission";
import { conversationReadable } from "../run-visibility";
import type { AgentSubject } from "../types";

const automation = schema.agentAutomationTable;
const conversation = schema.agentConversationTable;

// Workspace admins may see every automation's settings, but not its prompt
// or runs, so they can take over one whose owner lost access.
export function isAutomationAdmin(subject: AgentSubject) {
  return hasUserWorkspacePermission(subject.userId, subject.workspaceId, {
    agent: ["manage_automations"],
  });
}

// The owner's current automation conversation; join it to read sharing.
export const ownerConversationJoin = and(
  eq(conversation.automationId, automation.id),
  eq(conversation.userId, automation.ownerId),
  sql`${conversation.projectId} IS NOT DISTINCT FROM ${automation.projectId}`,
);

export function readableAutomationScope(subject: AgentSubject) {
  return or(
    isNull(automation.projectId),
    projectAccessCondition(subject.userId, automation.projectId),
  );
}

// Match conversation headers: a nonempty thread needs at least one visible run.
export function sharedWith(subject: AgentSubject): SQL {
  return and(
    isNotNull(conversation.sharedAt),
    readableAutomationScope(subject),
    conversationReadable(subject),
  ) as SQL;
}

export function visibleAutomations(subject: AgentSubject, admin: boolean) {
  return and(
    eq(automation.workspaceId, subject.workspaceId),
    admin
      ? undefined
      : or(eq(automation.ownerId, subject.userId), sharedWith(subject)),
  );
}

export async function getVisibleAutomation(
  subject: AgentSubject,
  automationId: string,
) {
  const admin = await isAutomationAdmin(subject);
  const [row] = await db
    .select({
      automation,
      conversation,
      canRead: sql<boolean>`((${eq(automation.ownerId, subject.userId)} AND ${readableAutomationScope(subject)}) OR coalesce(${sharedWith(subject)}, false))`,
    })
    .from(automation)
    .leftJoin(conversation, ownerConversationJoin)
    .where(
      and(eq(automation.id, automationId), visibleAutomations(subject, admin)),
    )
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Automation not found" });
  const isOwner = row.automation.ownerId === subject.userId;
  return {
    automation: row.automation,
    conversation: row.conversation,
    isOwner,
    admin,
    // Admins see settings only; the prompt and runs follow sharing rules.
    canRead: row.canRead,
  };
}

export async function getOwnedAutomation(
  subject: AgentSubject,
  automationId: string,
) {
  const visible = await getVisibleAutomation(subject, automationId);
  if (!visible.isOwner)
    throw new HTTPException(403, {
      message: "Only the automation owner can do this",
    });
  return visible;
}
