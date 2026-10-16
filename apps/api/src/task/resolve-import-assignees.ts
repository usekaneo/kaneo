import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import db, { schema } from "../database";
import { instanceAdminRoleSql } from "../utils/instance-admin-role";

export async function resolveImportAssignees(
  references: string[],
  workspaceId: string,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (references.length === 0) return resolved;

  const users = await db
    .select({ id: schema.userTable.id, email: schema.userTable.email })
    .from(schema.userTable)
    .leftJoin(
      schema.workspaceUserTable,
      and(
        eq(schema.workspaceUserTable.userId, schema.userTable.id),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        or(
          inArray(schema.userTable.id, references),
          inArray(
            sql`lower(${schema.userTable.email})`,
            references.map((reference) => reference.toLowerCase()),
          ),
        ),
        or(
          isNotNull(schema.workspaceUserTable.userId),
          instanceAdminRoleSql(schema.userTable.role),
        ),
      ),
    );

  const ids = new Set(users.map((user) => user.id));
  const byEmail = new Map<string, string[]>();
  for (const user of users) {
    const email = user.email.toLowerCase();
    byEmail.set(email, [...(byEmail.get(email) ?? []), user.id]);
  }
  for (const reference of references) {
    // Existing exports use IDs; retain their meaning even if an ID resembles an email.
    if (ids.has(reference)) {
      resolved.set(reference, reference);
      continue;
    }
    const matches = byEmail.get(reference.toLowerCase());
    const match = matches?.[0];
    if (matches?.length === 1 && match) resolved.set(reference, match);
  }
  return resolved;
}
