import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";

/** The user an admin action is about, or a 404. */
export async function findAdminTargetUser(database: DbOrTx, userId: string) {
  const [user] = await database
    .select({ id: schema.userTable.id, email: schema.userTable.email })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (!user) throw new HTTPException(404, { message: "User not found" });
  return user;
}
