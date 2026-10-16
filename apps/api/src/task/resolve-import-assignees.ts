import { and, eq, exists, inArray, or, sql } from "drizzle-orm";
import db, { schema } from "../database";
import { instanceAdminRoleSql } from "../utils/instance-admin-role";

export async function resolveImportAssignees(
  references: string[],
  workspaceId: string,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (references.length === 0) return resolved;

  // Membership is a predicate: duplicate membership rows still mean one user.
  const eligible = or(
    exists(
      db
        .select({ id: schema.workspaceUserTable.id })
        .from(schema.workspaceUserTable)
        .where(
          and(
            eq(schema.workspaceUserTable.userId, schema.userTable.id),
            eq(schema.workspaceUserTable.workspaceId, workspaceId),
          ),
        ),
    ),
    instanceAdminRoleSql(schema.userTable.role),
  );
  const idUsers = await db
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(and(inArray(schema.userTable.id, references), eligible));
  for (const user of idUsers) resolved.set(user.id, user.id);

  // Keep existing ID imports on the indexed path, including missing IDs.
  const emails = [
    ...new Set(
      references
        .filter(
          (reference) => !resolved.has(reference) && reference.includes("@"),
        )
        .map((reference) => reference.toLowerCase()),
    ),
  ];
  if (emails.length === 0) return resolved;

  const emailUsers = await db
    .select({ id: schema.userTable.id, email: schema.userTable.email })
    .from(schema.userTable)
    .where(
      and(inArray(sql`lower(${schema.userTable.email})`, emails), eligible),
    );
  const byEmail = new Map<string, Set<string>>();
  for (const user of emailUsers) {
    const email = user.email.toLowerCase();
    const matches = byEmail.get(email) ?? new Set<string>();
    matches.add(user.id);
    byEmail.set(email, matches);
  }
  for (const reference of references) {
    // IDs keep precedence even when they resemble another user's email.
    if (resolved.has(reference)) continue;
    const matches = byEmail.get(reference.toLowerCase());
    if (matches?.size !== 1) continue;
    const [id] = matches;
    if (id) resolved.set(reference, id);
  }
  return resolved;
}
