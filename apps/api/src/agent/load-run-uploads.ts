import { eq } from "drizzle-orm";
import db, { schema } from "../database";
import { isTextAttachment } from "./is-text-attachment";
import type { AgentAttachment } from "./types";

// Bytes are read only here, for the run being executed.
export async function loadRunUploads(
  runId: string,
  attachments: AgentAttachment[],
): Promise<Map<string, Uint8Array>> {
  if (attachments.every(isTextAttachment)) return new Map();
  const rows = await db
    .select({
      id: schema.agentAttachmentTable.id,
      data: schema.agentAttachmentTable.data,
    })
    .from(schema.agentAttachmentTable)
    .where(eq(schema.agentAttachmentTable.runId, runId));
  return new Map(rows.map((row) => [row.id, row.data]));
}
