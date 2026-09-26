import { z } from "../openapi";
import { MAX_TASK_POSITION } from "./controllers/next-task-position";
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

const progress = z.number().int().min(0).max(100).openapi({
  description: "Percent complete, 0-100.",
});

// The only four constraint types the Gantt chart understands — see the
// matching comment on taskTable.constraintType in database/schema.ts.
export const VALID_TASK_CONSTRAINT_TYPES = [
  "none",
  "start_no_earlier_than",
  "finish_no_later_than",
  "must_start_on",
] as const;

const constraintTypeDescription =
  "One of: none, start_no_earlier_than (SNET), finish_no_later_than " +
  "(FNLT), must_start_on (MSO).";

const constraintType = z.enum(VALID_TASK_CONSTRAINT_TYPES);

// Required object of optional filters: a RouteParameter cannot itself be optional.
export const listTasksQuery = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional(),
  // Number("abc") is NaN, which used to reach the limit/offset clause unchecked.
  page: pagingNumber(1, 1_000_000).optional(),
  relatedPage: pagingNumber(1, 1_000_000).optional(),
  limit: pagingNumber(1, 100).optional(),
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
    "updateSchedule",
  ]),
  value: z.string().nullable().optional().openapi({
    description:
      "The new value for the chosen operation. Unused by `delete` and `updateSchedule`; null clears an assignee or due date.",
  }),
  scheduleUpdates: z
    .array(
      z.object({
        taskId: z.string(),
        startDate: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .optional()
    .openapi({
      description:
        "Per-task start/due dates for the `updateSchedule` operation — e.g. " +
        "a Gantt drag that cascades forward through `blocks` dependencies. " +
        "Required by that operation; ignored by every other one. Every " +
        "taskId here must also be in `taskIds`.",
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
  progress: progress.optional().openapi({
    description: "Defaults to 0.",
  }),
  isMilestone: z.boolean().optional().openapi({
    description: "Defaults to false.",
  }),
  customFields: z
    .array(z.object({ fieldId: z.string(), value: z.string() }))
    .optional(),
});

export const updateTaskBody = z
  .object({
    title: z.string(),
    description: z.string().optional().openapi({
      description:
        "Omit to preserve the existing description when updating a list summary.",
    }),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    priority,
    status: z.string(),
    projectId: z.string(),
    position: z.number().int().min(0).max(MAX_TASK_POSITION),
    userId: z.string().optional(),
    // Optional and left untouched when omitted (unlike the other fields on
    // this full-replace route): an older client that has never heard of
    // progress/milestones must not silently reset them on every edit.
    progress: progress.optional(),
    isMilestone: z.boolean().optional(),
    // Same "optional and left untouched when omitted" rule as
    // progress/isMilestone above. Providing constraintType is what opts a
    // request into touching either field at all: passing constraintDate
    // alone, with constraintType omitted, leaves both columns untouched.
    constraintType: constraintType.optional().openapi({
      description: `${constraintTypeDescription} Defaults to "none" for a new task; omit here to leave the existing constraint untouched.`,
    }),
    constraintDate: z
      .string()
      .nullable()
      .optional()
      .openapi({
        description:
          "Required when constraintType is set to anything other than " +
          '"none"; forced to null when constraintType is "none". ' +
          "Date-only, normalized server-side to UTC midnight.",
      }),
  })
  .refine(
    (data) =>
      data.constraintType === undefined ||
      data.constraintType === "none" ||
      !!data.constraintDate,
    {
      message: 'constraintDate is required when constraintType is not "none"',
      path: ["constraintDate"],
    },
  );

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

export const descriptionPageQuery = z.object({
  offset: pagingNumber(0, 2_000_000_000).default(0),
  version: z
    .string()
    .regex(/^[0-9]{1,10}$/)
    .optional(),
});
export const descriptionMatchesQuery = z.object({
  query: z.string().trim().min(1).max(256),
  after: z.string().min(1).max(128).optional(),
});
