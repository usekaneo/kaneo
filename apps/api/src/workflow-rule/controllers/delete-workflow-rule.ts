import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workflowRuleTable } from "../../database/schema";

async function deleteWorkflowRule(id: string) {
  const existing = await db.query.workflowRuleTable.findFirst({
    where: eq(workflowRuleTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Workflow rule not found" });
  }

  await db.delete(workflowRuleTable).where(eq(workflowRuleTable.id, id));

  return existing;
}

export default deleteWorkflowRule;
