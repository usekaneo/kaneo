import { and, asc, between, count, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { habitCheckTable, habitTable } from "../../database/schema";

async function getHabits(userId: string, from: string, to: string) {
  const habits = await db
    .select({
      id: habitTable.id,
      name: habitTable.name,
      createdAt: habitTable.createdAt,
      doneCount: count(habitCheckTable.date),
    })
    .from(habitTable)
    .leftJoin(habitCheckTable, eq(habitCheckTable.habitId, habitTable.id))
    .where(eq(habitTable.userId, userId))
    .groupBy(habitTable.id)
    .orderBy(asc(habitTable.createdAt), asc(habitTable.id));
  if (habits.length === 0) return [];

  const checks = await db
    .select()
    .from(habitCheckTable)
    .where(
      and(
        inArray(
          habitCheckTable.habitId,
          habits.map((habit) => habit.id),
        ),
        between(habitCheckTable.date, from, to),
      ),
    )
    .orderBy(asc(habitCheckTable.date));
  const checksByHabit = new Map<string, string[]>();
  for (const check of checks)
    checksByHabit.set(check.habitId, [
      ...(checksByHabit.get(check.habitId) ?? []),
      check.date,
    ]);

  return habits.map((habit) => ({
    ...habit,
    createdAt: habit.createdAt.toISOString(),
    checks: checksByHabit.get(habit.id) ?? [],
  }));
}

export default getHabits;
