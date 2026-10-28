import { asc } from "drizzle-orm";
import db, { schema } from "../../../../apps/api/src/database";

export function readAuditLog() {
  const log = schema.adminAuditLogTable;
  return db.select().from(log).orderBy(asc(log.action), asc(log.createdAt));
}
