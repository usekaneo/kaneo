import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** The user an admin action is about, or a 404. */
export async function findAdminTargetUser(
  userId: string,
  database: DbOrTx = db,
) {
  const [user] = await database
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      emailVerified: userTable.emailVerified,
      image: userTable.image,
      locale: userTable.locale,
      isAnonymous: userTable.isAnonymous,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!user) throw new HTTPException(404, { message: "User not found" });
  return user;
}

export type AdminTargetUser = Awaited<ReturnType<typeof findAdminTargetUser>>;
