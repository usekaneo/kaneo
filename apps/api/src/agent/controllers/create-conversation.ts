import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { assertAgentAccess, assertAgentProject } from "../access";
import { requireAgentConfig } from "../config";
import type { AgentSubject } from "../types";

export async function createConversation(
  subject: AgentSubject,
  input: { title: string; projectId?: string },
) {
  requireAgentConfig();
  await assertAgentAccess(subject);
  if (input.projectId) await assertAgentProject(subject, input.projectId);
  const [conversation] = await db
    .insert(schema.agentConversationTable)
    .values({
      userId: subject.userId,
      workspaceId: subject.workspaceId,
      projectId: input.projectId ?? null,
      title: input.title,
    })
    .returning();
  if (!conversation)
    throw new HTTPException(500, { message: "Could not create conversation" });
  return conversation;
}
