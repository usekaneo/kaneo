import { z } from "../openapi";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "Invalid date",
  });

export const habitIdParam = z.object({ id: z.string() });

export const habitCheckParam = z.object({
  id: z.string(),
  date: isoDate.openapi({
    description: "The day, as YYYY-MM-DD in the user's own calendar.",
  }),
});

export const habitRangeQuery = z
  .object({
    from: isoDate.openapi({ description: "First day to return checks for." }),
    to: isoDate.openapi({ description: "Last day to return checks for." }),
  })
  .refine(({ from, to }) => from <= to, {
    message: "from must not be after to",
  })
  .refine(
    ({ from, to }) =>
      Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) <=
      366 * 86_400_000,
    { message: "The range may span at most a year" },
  );

export const habitBody = z.object({
  name: z.string().trim().min(1).max(100),
});
