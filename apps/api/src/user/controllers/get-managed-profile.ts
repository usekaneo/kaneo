import { and, eq } from "drizzle-orm";
import db from "../../database";
import { accountTable, userTable } from "../../database/schema";
import { parseManagedProfileFields } from "../../utils/custom-oauth-env";

export async function getManagedProfile(userId: string) {
  const fields = parseManagedProfileFields();
  if (fields.length === 0) return null;

  const [stored] = await db
    .select({
      name: userTable.name,
      image: userTable.image,
      locale: userTable.locale,
    })
    .from(userTable)
    .innerJoin(
      accountTable,
      and(
        eq(accountTable.userId, userTable.id),
        eq(accountTable.providerId, "custom"),
      ),
    )
    .where(eq(userTable.id, userId))
    .limit(1);

  return stored ? { fields, stored } : null;
}

export default getManagedProfile;
