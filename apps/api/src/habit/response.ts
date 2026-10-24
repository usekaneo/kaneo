import { z } from "../openapi";

export const habitSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    doneCount: z.number().openapi({
      description: "Days the habit was done since it was created.",
    }),
    checks: z.array(z.string()).openapi({
      description: "Days in the requested range the habit was done.",
    }),
  })
  .openapi("Habit");

export const habitCheckSchema = z
  .object({ id: z.string(), date: z.string(), done: z.boolean() })
  .openapi("HabitCheck");
