import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../../database";
import { getOwnedRun } from "../access";
import type { AgentSubject } from "../types";

export async function cancelRun(subject: AgentSubject, runId: string) {
  await getOwnedRun(subject, runId);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.agentRunTable)
      .set({
        status: "cancelled",
        finishedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      })
      .where(
        and(
          eq(schema.agentRunTable.id, runId),
          inArray(schema.agentRunTable.status, ["queued", "running"]),
        ),
      );
    const [run] = await tx
      .select({ status: schema.agentRunTable.status })
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, runId));
    if (run?.status === "cancelled")
      await tx
        .update(schema.agentProposalTable)
        .set({ status: "discarded" })
        .where(
          and(
            eq(schema.agentProposalTable.runId, runId),
            eq(schema.agentProposalTable.status, "pending"),
          ),
        );
    if (run?.status === "cancelled")
      await tx
        .update(schema.agentStepTable)
        .set({
          status: "failed",
          summary: "Run cancelled",
          finishedAt: new Date(),
        })
        .where(
          and(
            eq(schema.agentStepTable.runId, runId),
            eq(schema.agentStepTable.status, "running"),
          ),
        );
  });
  return { id: runId, status: (await getOwnedRun(subject, runId)).run.status };
}
