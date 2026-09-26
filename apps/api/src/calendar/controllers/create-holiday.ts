import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceHolidayTable } from "../../database/schema";

// Holidays are date-only: whatever time-of-day (or bare date) the caller
// sends, only the calendar date survives, normalized to UTC midnight so it
// compares equal regardless of the server or caller's local time zone.
function normalizeToUtcMidnight(input: string): Date {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new HTTPException(400, { message: "Invalid holiday date" });
  }
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function createHoliday(workspaceId: string, date: string, name: string) {
  const normalizedDate = normalizeToUtcMidnight(date);

  const [existing] = await db
    .select({ id: workspaceHolidayTable.id })
    .from(workspaceHolidayTable)
    .where(
      and(
        eq(workspaceHolidayTable.workspaceId, workspaceId),
        eq(workspaceHolidayTable.date, normalizedDate),
      ),
    )
    .limit(1);

  if (existing) {
    throw new HTTPException(409, {
      message: "A holiday already exists on this date",
    });
  }

  try {
    const [created] = await db
      .insert(workspaceHolidayTable)
      .values({ workspaceId, date: normalizedDate, name })
      .returning();

    if (!created) {
      throw new HTTPException(500, { message: "Failed to create holiday" });
    }

    return created;
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    // The select above only narrows the race window; the unique constraint
    // on (workspaceId, date) is the actual guard against a concurrent create.
    if (isUniqueViolation(error)) {
      throw new HTTPException(409, {
        message: "A holiday already exists on this date",
      });
    }
    throw error;
  }
}

export default createHoliday;
