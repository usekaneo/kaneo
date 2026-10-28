import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getVisibleConversation } from "../access";
import { ownerColumns } from "../owner-columns";
import type { AgentSubject } from "../types";

export async function getConversation(
  subject: AgentSubject,
  conversationId: string,
) {
  const conversation = await getVisibleConversation(subject, conversationId);
  const [owner] = await db
    .select(ownerColumns)
    .from(schema.userTable)
    .where(eq(schema.userTable.id, conversation.userId))
    .limit(1);
  if (!owner)
    throw new HTTPException(404, { message: "Conversation not found" });
  return { ...conversation, owner };
}
