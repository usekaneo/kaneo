import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { getOwnedRun } from "../access";
import { summarizeAttachments } from "../attachment-summary";
import type { AgentSubject } from "../types";

export async function getRun(subject: AgentSubject, runId: string) {
  const { run } = await getOwnedRun(subject, runId);
  const {
    leaseOwner: _owner,
    leaseExpiresAt: _lease,
    attachments,
    ...publicRun
  } = run;
  const [steps, proposals] = await Promise.all([
    db
      .select()
      .from(schema.agentStepTable)
      .where(eq(schema.agentStepTable.runId, runId))
      .orderBy(schema.agentStepTable.createdAt, schema.agentStepTable.id)
      .limit(40),
    db
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
}
