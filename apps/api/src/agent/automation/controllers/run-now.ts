import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../../database";
import type { AgentSubject } from "../../types";
import { getOwnedAutomation } from "../access";
import { checkOwnerAccess } from "../owner-access";
import { pauseAutomation, recordSkip } from "../pause";
import { queueAutomationRun } from "../queue-run";

export async function runAutomationNow(subject: AgentSubject, id: string) {
  await getOwnedAutomation(subject, id);
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.agentAutomationTable)
      .where(eq(schema.agentAutomationTable.id, id))
      .for("update");
    if (!row || row.ownerId !== subject.userId)
      throw new HTTPException(409, { message: "Automation owner changed" });
    const access = await checkOwnerAccess(row);
    if (access !== "ok") {
      if (access === "lost") await pauseAutomation(tx, id, "owner_access");
      return { queued: false as const, reason: "unavailable" as const };
    }
    if (!row.enabled)
      throw new HTTPException(409, {
        message: "Enable the automation before running it",
      });
    const queued = await queueAutomationRun(
      tx,
      row,
      { source: "manual", scheduledFor: null, events: [], moreEvents: 0 },
      randomUUID(),
    );
    if (!queued.queued) await recordSkip(tx, id, queued.reason);
    return queued;
  });
  if (!result.queued)
    throw new HTTPException(429, {
      message: `Automation run skipped: ${result.reason}`,
    });
  return { id: result.runId, status: "queued" as const };
}
