import { randomUUID } from "node:crypto";
import db, { schema } from "../../../../apps/api/src/database";

export async function createInstanceAdmin() {
  const userId = `admin-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: "Instance Admin",
      role: "admin",
    })
    .returning();
  return user;
}
