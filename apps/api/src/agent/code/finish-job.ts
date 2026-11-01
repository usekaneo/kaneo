import { eq } from "drizzle-orm";
import { schema } from "../../database";
import type { AgentDatabase } from "../access";
import type { CodeJobError } from "./lifecycle";

export type CodeJob = typeof schema.agentJobTable.$inferSelect;
export async function finishJob(
  database: AgentDatabase,
  job: CodeJob,
  result: {
    status: "completed" | "failed" | "cancelled";
    outcome?: "pr_opened" | "no_changes";
    error?: CodeJobError;
    summary?: string;
    prNumber?: number;
    prUrl?: string;
  },
) {
  await database
    .update(schema.agentJobTable)
    .set({
      ...result,
      credentialHash: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      finishedAt: new Date(),
    })
    .where(eq(schema.agentJobTable.id, job.id));
  await database
    .delete(schema.agentJobChangesetTable)
    .where(eq(schema.agentJobChangesetTable.jobId, job.id));
  await database
    .insert(schema.agentJobEventTable)
    .values({ jobId: job.id, phase: result.status });
}
