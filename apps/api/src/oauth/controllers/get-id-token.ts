import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function getIdToken(userId: string) {
  const [account] = await db
    .select({ idToken: schema.accountTable.idToken })
    .from(schema.accountTable)
    .where(
      and(
        eq(schema.accountTable.userId, userId),
        eq(schema.accountTable.providerId, "custom"),
      ),
    )
    .limit(1);

  return { idToken: account?.idToken ?? null };
}

export default getIdToken;
