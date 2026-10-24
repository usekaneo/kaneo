import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { habitTable } from "../../database/schema";

// Habits are private: another user's habit is reported as missing.
export async function habitOrThrow(id: string, userId: string) {
  const [habit] = await db
    .select()
    .from(habitTable)
    .where(and(eq(habitTable.id, id), eq(habitTable.userId, userId)))
    .limit(1);
  if (!habit) throw new HTTPException(404, { message: "Habit not found" });
  return habit;
}
