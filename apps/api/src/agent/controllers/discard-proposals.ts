import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { getOwnedRun } from "../access";
import type { AgentSubject } from "../types";

export async function discardProposals(
  subject: AgentSubject,
  runId: string,
  proposalIds: string[],
) {
  await getOwnedRun(subject, runId);
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, runId))
      .for("update");
    if (!run || !["awaiting_review", "completed"].includes(run.status))
      throw new HTTPException(409, { message: "Run is not ready for review" });
    const found = await tx
      .select({ id: schema.agentProposalTable.id })
      .from(schema.agentProposalTable)
      .where(
        and(
          eq(schema.agentProposalTable.runId, runId),
          inArray(schema.agentProposalTable.id, proposalIds),
        ),
      );
    if (found.length !== proposalIds.length)
      throw new HTTPException(404, { message: "Proposal not found" });
    const discarded = await tx
      .update(schema.agentProposalTable)
      .set({ status: "discarded" })
      .where(
        and(
          eq(schema.agentProposalTable.runId, runId),
          inArray(schema.agentProposalTable.id, proposalIds),
          eq(schema.agentProposalTable.status, "pending"),
        ),
      )
      .returning({ id: schema.agentProposalTable.id });
    const pending = await tx
      .select({ id: schema.agentProposalTable.id })
      .from(schema.agentProposalTable)
      .where(
        and(
          eq(schema.agentProposalTable.runId, runId),
          eq(schema.agentProposalTable.status, "pending"),
        ),
      )
      .limit(1);
    if (!pending.length)
      await tx
        .update(schema.agentRunTable)
        .set({ status: "completed" })
        .where(eq(schema.agentRunTable.id, runId));
    return { proposalIds: discarded.map((proposal) => proposal.id) };
  });
}
