import { sql } from "drizzle-orm";
import { z } from "zod";
import db from "../../database";
import {
  withQuillsSystemWorkspace,
  type Database,
} from "../../database/quills/client";
const days = z.coerce.number().int().min(1).max(3650);
export const retentionSchema = z.object({
  events: days.default(90),
  jobs: days.default(7),
  logs: days.default(90),
});
export async function pruneQuillsWorkspace(
  tx: Database,
  input: z.input<typeof retentionSchema> = {},
) {
  const policy = retentionSchema.parse(input);
  // Keep this month's billing inputs even when an operator selects a shorter log retention.
  const statements = [
    sql`DELETE FROM quills.events WHERE (workspace_id,id) IN (SELECT workspace_id,id FROM quills.events WHERE published_at IS NOT NULL AND published_at<now()-${policy.events}*interval '1 day' ORDER BY id LIMIT 1000)`,
    sql`DELETE FROM quills.job_queue WHERE (workspace_id,id) IN (SELECT workspace_id,id FROM quills.job_queue WHERE (status='succeeded' OR (status='failed' AND NOT EXISTS (SELECT 1 FROM quills.events e WHERE e.event_id=job_queue.dedupe_key AND e.published_at IS NULL))) AND finished_at<now()-${policy.jobs}*interval '1 day' ORDER BY id LIMIT 1000)`,
    sql`DELETE FROM quills.email_log WHERE (workspace_id,id) IN (SELECT workspace_id,id FROM quills.email_log WHERE created_at<least(now()-${policy.logs}*interval '1 day',date_trunc('month',now())) ORDER BY created_at LIMIT 1000)`,
    sql`DELETE FROM quills.ai_usage_log WHERE (workspace_id,id) IN (SELECT workspace_id,id FROM quills.ai_usage_log WHERE created_at<least(now()-${policy.logs}*interval '1 day',date_trunc('month',now())) ORDER BY created_at LIMIT 1000)`,
    sql`UPDATE quills.export_runs SET s3_key=NULL WHERE expires_at<=now() AND s3_key IS NOT NULL`,
  ];
  let removed = 0;
  for (const statement of statements)
    removed += (await tx.execute(statement)).rowCount ?? 0;
  return removed;
}
export async function runQuillsRetention() {
  const policy = retentionSchema.parse({
    events: process.env.QUILLS_EVENT_RETENTION_DAYS,
    jobs: process.env.QUILLS_JOB_RETENTION_DAYS,
    logs: process.env.QUILLS_LOG_RETENTION_DAYS,
  });
  let cursor = "";
  let degraded = false;
  for (;;) {
    const page = await db.execute<{ id: string }>(
      sql`SELECT id FROM public.workspace WHERE id>${cursor} ORDER BY id LIMIT 100`,
    );
    if (!page.rows.length) break;
    for (const row of page.rows) {
      try {
        await withQuillsSystemWorkspace(
          row.id,
          (tx) => pruneQuillsWorkspace(tx, policy),
          { allowArchived: true },
        );
      } catch {
        degraded = true;
      }
      cursor = row.id;
    }
  }
  return { degraded };
}
