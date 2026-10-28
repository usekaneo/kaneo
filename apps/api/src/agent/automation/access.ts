import { and, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { hasUserWorkspacePermission } from "../../utils/require-workspace-permission";
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

// Mirrors conversation sharing: shared and, when project-scoped, readable.
export function sharedWith(subject: AgentSubject): SQL {
  return and(
    isNotNull(conversation.sharedAt),
    readableAutomationScope(subject),
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
    .select({ automation, conversation })
    .from(automation)
    .leftJoin(conversation, ownerConversationJoin)
    .where(
      and(eq(automation.id, automationId), visibleAutomations(subject, admin)),
    )
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Automation not found" });
  const isOwner = row.automation.ownerId === subject.userId;
  const shared = Boolean(row.conversation?.sharedAt);
  return {
    automation: row.automation,
    conversation: row.conversation,
    isOwner,
    admin,
    // Admins see settings only; the prompt and runs follow sharing rules.
    canRead: (isOwner || shared) && (await sharedReadable(subject, row)),
  };
}

async function sharedReadable(
  subject: AgentSubject,
  row: { automation: typeof automation.$inferSelect },
) {
  if (!row.automation.projectId) return true;
  const [project] = await db
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.id, row.automation.projectId),
        projectAccessCondition(subject.userId, schema.projectTable.id),
      ),
    )
    .limit(1);
  return Boolean(project);
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
