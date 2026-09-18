import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";

export async function getCurrentUser(userId: string) {
  const [user] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: userTable.role,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export default getCurrentUser;
