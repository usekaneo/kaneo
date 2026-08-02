import { HTTPException } from "hono/http-exception";

/**
 * Validates and parses a date string. Throws an HTTPException if the string
 * cannot be parsed into a valid Date.
 */
export function validateAndParseDate(
  dateStr: string,
  fieldName: string,
): Date {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    throw new HTTPException(400, {
      message: `Invalid ${fieldName} "${dateStr}". Please provide a valid ISO 8601 date string.`,
    });
  }
  return parsed;
}

/**
 * Validates that startDate is not after dueDate when both are provided.
 * Throws an HTTPException if the date range is logically invalid.
 */
export function validateDateRange(
  startDate: Date | undefined | null,
  dueDate: Date | undefined | null,
): void {
  if (startDate && dueDate && startDate.getTime() > dueDate.getTime()) {
    throw new HTTPException(400, {
      message:
        "Start date cannot be after due date. Please adjust the date range.",
    });
  }
}
