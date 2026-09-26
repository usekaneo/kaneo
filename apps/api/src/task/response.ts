import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

const priorityDescription = "One of: no-priority, low, medium, high, urgent.";

const constraintTypeResponseDescription =
  "The Gantt scheduling constraint: none, start_no_earlier_than (SNET), " +
  "finish_no_later_than (FNLT), or must_start_on (MSO).";

export const taskSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    position: z.number().nullable().openapi({
      description: "Order within its column, ascending.",
    }),
    number: z.number().nullable().openapi({
      description: "Per-project counter shown as {projectSlug}-{number}.",
    }),
    userId: z
      .string()
      .nullable()
      .openapi({ description: "The assignee, if any." }),
    title: z.string(),
    description: z.string().nullable(),
    descriptionDeferred: z.boolean().optional().openapi({
      description:
        "True when the list omits a large description; load the task detail or description pages to read it. Do not replace stored text with this null summary.",
    }),
    status: z.string().openapi({
      description: "The slug of the column the task sits in.",
    }),
    priority: z.string().openapi({ description: priorityDescription }),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
    progress: z.number().int().min(0).max(100).openapi({
      description: "Percent complete, 0-100.",
    }),
    isMilestone: z.boolean().openapi({
      description:
        "Renders as a diamond marker on the Gantt chart at its date instead of a spanning bar.",
    }),
    baselineStartDate: nullableResponseTimestamp.openapi({
      description:
        "Snapshotted startDate from when the baseline was last set; null if no baseline.",
    }),
    baselineDueDate: nullableResponseTimestamp.openapi({
      description:
        "Snapshotted dueDate from when the baseline was last set; null if no baseline.",
    }),
    constraintType: z.string().openapi({
      description: constraintTypeResponseDescription,
    }),
    constraintDate: nullableResponseTimestamp.openapi({
      description: "Null unless constraintType is not none.",
    }),
    createdAt: responseTimestamp,
    customFields: z
      .array(z.object({ fieldId: z.string(), value: z.string() }))
      .optional(),
  })
  .openapi("Task");

export const taskWithAssigneeSchema = taskSchema
  .extend({
    assigneeName: z.string().nullable(),
    assigneeId: z.string().nullable(),
  })
  .openapi("TaskWithAssignee");

const taskLabelSchema = z
  .object({ id: z.string(), name: z.string(), color: z.string() })
  .openapi("TaskLabel");

const taskExternalLinkSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    integrationId: z.string(),
    resourceType: z.string(),
    externalId: z.string(),
    url: z.string(),
    title: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable().openapi({
      description:
        "Provider-specific payload, already parsed from the stored JSON string.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TaskExternalLink");

export const boardTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    number: z.number().nullable(),
    description: z.string().nullable(),
    descriptionDeferred: z.boolean().optional().openapi({
      description:
        "True when the list omits a large description; load the task detail or description pages to read it. Do not replace stored text with this null summary.",
    }),
    status: z.string(),
    priority: z.string().openapi({ description: priorityDescription }),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
    progress: z.number().int().min(0).max(100).openapi({
      description: "Percent complete, 0-100.",
    }),
    isMilestone: z.boolean().openapi({
      description:
        "Renders as a diamond marker on the Gantt chart at its date instead of a spanning bar.",
    }),
    baselineStartDate: nullableResponseTimestamp,
    baselineDueDate: nullableResponseTimestamp,
    constraintType: z.string().openapi({
      description: constraintTypeResponseDescription,
    }),
    constraintDate: nullableResponseTimestamp.openapi({
      description: "Null unless constraintType is not none.",
    }),
    position: z.number().nullable(),
    createdAt: responseTimestamp,
    userId: z.string().nullable(),
    assigneeName: z.string().nullable(),
    assigneeId: z.string().nullable(),
    assigneeImage: z.string().nullable(),
    projectId: z.string(),
    labels: z.array(taskLabelSchema),
    externalLinks: z.array(taskExternalLinkSchema),
  })
  .openapi("BoardTask");

export const boardColumnSchema = z
  .object({
    id: z.string().openapi({ description: "The column slug, same as `slug`." }),
    slug: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    isFinal: z.boolean(),
    position: z.number().optional(),
    tasks: z.array(boardTaskSchema),
  })
  .openapi("BoardColumn");

export const boardSchema = z
  .object({
    data: z
      .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        icon: z.string().nullable(),
        description: z.string().nullable(),
        descriptionDeferred: z.boolean().optional().openapi({
          description:
            "True when a project description above 64 KiB is omitted; use project detail or public project description pages for full text.",
        }),
        isPublic: z.boolean().nullable(),
        workspaceId: z.string(),
        columns: z.array(boardColumnSchema),
        archivedTasks: z.array(boardTaskSchema),
        plannedTasks: z.array(boardTaskSchema),
      })
      .openapi("Board"),
    pagination: z
      .object({
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
        relatedPage: z.number(),
        relatedPageSize: z.number(),
        relatedTotalPages: z.number(),
      })
      .openapi({
        description:
          "Always paginated: 50 tasks by default, at most 100 per page. Continue through totalPages to retrieve all tasks. For each task page, follow relatedPage through relatedTotalPages to retrieve all labels, external links and columns (100 related rows per kind per request, plus up to 100 columns needed to represent the tasks).",
      })
      .openapi("BoardPagination"),
  })
  .openapi("BoardResponse");

export const bulkResultSchema = z
  .object({ success: z.boolean(), updatedCount: z.number() })
  .openapi("BulkTaskResult");

export const moveTaskResultSchema = z
  .object({
    task: taskSchema,
    sourceProjectId: z.string(),
    destinationProjectId: z.string(),
  })
  .openapi("MoveTaskResult");

export const taskExportSchema = z
  .object({
    project: z
      .object({
        name: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        exportedAt: z.string().openapi({ format: "date-time" }),
      })
      .openapi("TaskExportProject"),
    tasks: z.array(
      z
        .object({
          title: z.string(),
          description: z.string(),
          status: z.string(),
          priority: z.string(),
          dueDate: z.string().nullable().openapi({ format: "date-time" }),
          startDate: z.string().nullable().openapi({ format: "date-time" }),
          userId: z.string().nullable(),
          labels: z
            .array(
              z
                .object({ name: z.string(), color: z.string() })
                .openapi("ExportedTaskLabel"),
            )
            .openapi({
              description: "Label names and colors, without their ids.",
            }),
        })
        .openapi("ExportedTask"),
    ),
  })
  .openapi("TaskExport");

export const taskImportResultSchema = z
  .object({
    results: z
      .object({
        total: z.number(),
        successful: z.number(),
        failed: z.number(),
        tasks: z.array(z.unknown()).openapi({
          description: "Per-task outcome, each carrying a success flag.",
        }),
      })
      .openapi("TaskImportSummary"),
  })
  .openapi("TaskImportResult");

export const imageUploadSchema = z
  .object({
    key: z.string().openapi({
      description: "Object key to send back to the finalize route.",
    }),
    uploadUrl: z.string().openapi({
      description: "Presigned URL to PUT the image bytes to.",
    }),
    headers: z.record(z.string(), z.string()).openapi({
      description:
        "Headers that must accompany the upload request, including Content-Type.",
    }),
  })
  .openapi("TaskImageUpload");

export const finalizedAssetSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description: "Where the stored image can be read back from.",
    }),
  })
  .openapi("TaskImageAsset");

export const descriptionPageSchema = z
  .object({
    content: z.string(),
    version: z.string(),
    nextOffset: z.number().nullable(),
  })
  .openapi("TaskDescriptionPage");
export const descriptionMatchesSchema = z
  .object({ ids: z.array(z.string()), nextCursor: z.string().nullable() })
  .openapi("TaskDescriptionMatches");
