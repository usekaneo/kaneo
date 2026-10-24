import { eq } from "drizzle-orm";
import db from "../../database";
import { habitTable } from "../../database/schema";
import { habitOrThrow } from "./habit-or-throw";

export async function createHabit(userId: string, name: string) {
  const [habit] = await db
    .insert(habitTable)
    .values({ userId, name })
    .returning();
  if (!habit) throw new Error("Failed to create habit");
  return {
    id: habit.id,
    name: habit.name,
    createdAt: habit.createdAt.toISOString(),
    doneCount: 0,
    checks: [],
  };
}

export async function renameHabit(id: string, userId: string, name: string) {
  await habitOrThrow(id, userId);
  await db.update(habitTable).set({ name }).where(eq(habitTable.id, id));
  return { id, name };
}

export async function deleteHabit(id: string, userId: string) {
  await habitOrThrow(id, userId);
  await db.delete(habitTable).where(eq(habitTable.id, id));
  return { id };
}
