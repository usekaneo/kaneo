import { and, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import db, { schema } from "../../database";
import { escapeLikePattern } from "../../search/like-pattern";

type ListAuditLogInput = {
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  page: number;
  limit: number;
};

const log = schema.adminAuditLogTable;

function actionFilter(action: string) {
  return action.includes(".")
    ? eq(log.action, action)
    : or(
        eq(log.action, action),
        like(log.action, `${escapeLikePattern(action)}.%`),
      );
}

export async function listAuditLog(input: ListAuditLogInput) {
  const filters: (SQL | undefined)[] = [
    input.action ? actionFilter(input.action) : undefined,
    input.actorId ? eq(log.actorUserId, input.actorId) : undefined,
    input.targetType ? eq(log.targetType, input.targetType) : undefined,
    input.targetId ? eq(log.targetId, input.targetId) : undefined,
  ];
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(log)
      .where(where)
      .orderBy(desc(log.createdAt), desc(log.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
    db.select({ value: count() }).from(log).where(where),
  ]);

  return {
    entries: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      actor: {
        id: row.actorUserId,
        name: row.actorName,
        email: row.actorEmail,
      },
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel,
      metadata: row.metadata ?? null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    })),
    total: totalRow?.value ?? 0,
  };
}

export default listAuditLog;
