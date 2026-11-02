import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../../database";
import type { AgentSubject } from "../../types";
import { getOwnedAutomation } from "../access";
import { cancelAutomationRuns } from "../cancel-runs";

export async function deleteAutomation(subject: AgentSubject, id: string) {
  await getOwnedAutomation(subject, id);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.agentAutomationTable)
      .where(
        and(
          eq(schema.agentAutomationTable.id, id),
          eq(schema.agentAutomationTable.ownerId, subject.userId),
        ),
      )
      .for("update");
    if (!row) throw new HTTPException(404, { message: "Automation not found" });
    await cancelAutomationRuns(tx, id);
    await tx
      .delete(schema.agentAutomationTable)
      .where(eq(schema.agentAutomationTable.id, id));
    return { id };
  });
}
