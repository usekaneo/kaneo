import db from "../database";
import { auditLogTable } from "../database/schema";

export type AuditEntry = {
  workspaceId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  // Facts about the change (old/new values). Never secrets or tokens.
  data?: Record<string, unknown>;
};

export async function recordAudit(entry: AuditEntry) {
  await db.insert(auditLogTable).values({
    workspaceId: entry.workspaceId,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    data: entry.data ?? null,
  });
}
