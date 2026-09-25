import { eq } from "drizzle-orm";
import db, { schema } from "../../database";

export default async function getCurrentUser(userId: string) {
  const [user] = await db
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      email: schema.userTable.email,
      image: schema.userTable.image,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);

  return user ?? null;
}
