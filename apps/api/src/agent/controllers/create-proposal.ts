import { eq, count } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getOwnedRun } from "../access";
import { createProposalSchema } from "../schema";
import { validateAction } from "../validate-action";
import type { AgentSubject } from "../types";

export async function createProposal(
  subject: AgentSubject,
  runId: string,
  input: unknown,
  leaseOwner: string,
) {
  const { action, reason } = createProposalSchema.parse(input);
  return db.transaction(async (tx) => {
    const { run, subject: scoped } = await getOwnedRun(subject, runId, tx);
    const [locked] = await tx
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, run.id))
      .for("update");
    if (
      !locked ||
      locked.status !== "running" ||
      locked.leaseOwner !== leaseOwner ||
      !locked.leaseExpiresAt ||
      locked.leaseExpiresAt.getTime() <= Date.now()
    )
      throw new HTTPException(409, { message: "Run is no longer active" });
    const [total] = await tx
      .select({ value: count() })
      .from(schema.agentProposalTable)
      .where(eq(schema.agentProposalTable.runId, runId));
    if ((total?.value ?? 0) >= 20)
      throw new HTTPException(400, { message: "Run proposal limit reached" });
    const before = await validateAction(scoped, action, tx);
    const [proposal] = await tx
      .insert(schema.agentProposalTable)
      .values({ runId, action, reason, before })
      .returning();
    if (!proposal)
      throw new HTTPException(500, { message: "Could not save proposal" });
    return {
      id: proposal.id,
      action: proposal.action,
      before: proposal.before,
      reason: proposal.reason,
      status: proposal.status,
    };
  });
}
