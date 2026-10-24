import { and, eq } from "drizzle-orm";
import db from "../../database";
import { habitCheckTable } from "../../database/schema";
import { habitOrThrow } from "./habit-or-throw";

async function setHabitCheck(
  id: string,
  userId: string,
  date: string,
  done: boolean,
) {
  await habitOrThrow(id, userId);
  if (done)
    await db
      .insert(habitCheckTable)
      .values({ habitId: id, date })
      .onConflictDoNothing();
  else
    await db
      .delete(habitCheckTable)
      .where(
        and(eq(habitCheckTable.habitId, id), eq(habitCheckTable.date, date)),
      );
  return { id, date, done };
}

export default setHabitCheck;
