import { z } from "../openapi";
import { VALID_PRIORITIES } from "./validate-task-fields";

const pagingNumber = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, "Expected a positive integer")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

export const taskParam = z.object({ id: z.string() });

export const projectIdParam = z.object({ projectId: z.string() });

const priority = z.enum(VALID_PRIORITIES);

// Required object of optional filters: a RouteParameter cannot itself be optional.
export const listTasksQuery = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  // Number("abc") is NaN, which used to reach the limit/offset clause unchecked.
  page: pagingNumber(1, 1_000_000).optional(),
  limit: pagingNumber(1, 200).optional(),
  sortBy: z
    .enum(["createdAt", "priority", "dueDate", "position", "title", "number"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
});

export const bulkUpdateBody = z.object({
  taskIds: z.array(z.string()).min(1),
  operation: z.enum([
    "updateStatus",
    "updatePriority",
    "updateAssignee",
    "delete",
    "addLabel",
    "removeLabel",
    "updateDueDate",
  ]),
  value: z.string().nullable().optional().openapi({
    description:
      "The new value for the chosen operation. Unused by `delete`; null clears an assignee or due date.",
  }),
});

export const createTaskBody = z.object({
  title: z.string(),
  description: z.string(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority,
  status: z.string().openapi({ description: "The target column's slug." }),
  userId: z.string().optional().openapi({ description: "Assignee, if any." }),
});

export const updateTaskBody = z.object({
  title: z.string(),
  description: z.string(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority,
  status: z.string(),
  projectId: z.string(),
  position: z.number(),
  userId: z.string().optional(),
});

export const moveTaskBody = z.object({
  destinationProjectId: z.string(),
  destinationStatus: z.string().optional().openapi({
    description: "Defaults to the destination project's first column.",
  }),
});

export const importTasksBody = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      status: z.string(),
      priority: z.string().optional(),
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      userId: z.string().nullable().optional(),
    }),
  ),
});

export const updateStatusBody = z.object({ status: z.string() });
export const updatePriorityBody = z.object({ priority });
export const updateAssigneeBody = z.object({
  userId: z.string().nullable().openapi({ description: "Null unassigns." }),
});
export const updateDueDateBody = z.object({ dueDate: z.string().optional() });
export const updateTitleBody = z.object({ title: z.string() });
export const updateDescriptionBody = z.object({ description: z.string() });

const surface = z.enum(["description", "comment"]).openapi({
  description: "Where the image is used, which decides how it is scoped.",
});

export const imageUploadBody = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  surface,
});

export const finalizeImageUploadBody = z.object({
  key: z
    .string()
    .openapi({ description: "The key returned when the URL was issued." }),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  surface,
});
