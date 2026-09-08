import { responseTimestamp, z } from "../openapi";

export const columnSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    slug: z.string().openapi({
      description:
        "Stable identifier derived from the name; tasks store this as their status.",
    }),
    position: z.number().openapi({
      description:
        "Board order, ascending. Columns are always returned sorted by it.",
    }),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    isFinal: z.boolean().openapi({
      description:
        "Marks the column as a done state, which stops overdue reminders for tasks in it.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Column");

export const columnListSchema = z.array(columnSchema);
