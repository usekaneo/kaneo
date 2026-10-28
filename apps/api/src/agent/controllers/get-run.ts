import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { getVisibleRun } from "../access";
import { summarizeAttachments } from "../attachment-summary";
import type { AgentSubject } from "../types";

export async function getRun(subject: AgentSubject, runId: string) {
  // Keep the access check and returned steps/proposals in one snapshot. A tool
  // can add a newly restricted project while this request is reading the run.
  return db.transaction(
    async (tx) => {
      const { run } = await getVisibleRun(subject, runId, tx);
      const {
        leaseOwner: _owner,
        leaseExpiresAt: _lease,
        attachments,
        touchedProjectIds: _touched,
        ...publicRun
      } = run;
      const [steps, proposals] = await Promise.all([
        tx
          .select()
          .from(schema.agentStepTable)
          .where(eq(schema.agentStepTable.runId, runId))
          .orderBy(schema.agentStepTable.createdAt, schema.agentStepTable.id)
          .limit(40),
        tx
          .select()
          .from(schema.agentProposalTable)
          .where(eq(schema.agentProposalTable.runId, runId))
          .orderBy(
            schema.agentProposalTable.createdAt,
            schema.agentProposalTable.id,
          )
          .limit(20),
      ]);
      return {
        ...publicRun,
        attachments: summarizeAttachments(attachments),
        steps,
        proposals,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
