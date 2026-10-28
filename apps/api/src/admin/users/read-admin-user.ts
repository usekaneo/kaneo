import { eq } from "drizzle-orm";
import { userTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { adminUserColumns, toAdminUser } from "./admin-user-columns";

/** A user as the admin directory lists them. */
export async function readAdminUser(userId: string, database: DbOrTx) {
  const [row] = await database
    .select(adminUserColumns)
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!row) throw new Error("Admin user disappeared");
  return toAdminUser(row);
}
