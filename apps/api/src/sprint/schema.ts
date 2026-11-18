import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const sprintParam = z.object({ id: z.string() });

export const taskIdParam = z.object({ taskId: z.string() });

export const createSprintBody = z.object({
  name: z.string().min(1).optional().openapi({
    description:
      "Sprint name, unique per project. Omitted to generate the next free 'Sprint N' name.",
  }),
  goal: z.string().nullable().optional().openapi({
    description: "What the team wants to achieve in this sprint.",
  }),
  startDate: z.string().optional().openapi({
    description:
      'ISO date string, e.g. "2025-01-15". Optional until the sprint starts.',
  }),
  endDate: z.string().optional().openapi({
    description:
      'ISO date string, e.g. "2025-01-29". Optional until the sprint starts.',
  }),
});

export const updateSprintBody = z.object({
  name: z.string().min(1).optional(),
  goal: z
    .string()
    .nullable()
    .optional()
    .openapi({ description: "Null clears the sprint goal." }),
  startDate: z.string().optional().openapi({
    description:
      "Only accepted for future sprints; the active sprint is already running and closed sprints are immutable.",
  }),
  endDate: z.string().nullable().optional().openapi({
    description: "Accepted for future and active sprints. Null clears it.",
  }),
});

export const reorderSprintsBody = z.object({
  sprints: z
    .array(z.object({ id: z.string(), position: z.number().int().min(0) }))
    .openapi({
      description:
        "Every sprint keeps its new position. Only future sprints may be reordered; active and closed sprints are rejected.",
    }),
});

export const startSprintBody = z.object({
  startDate: z.string().optional().openapi({
    description: "ISO date string. Defaults to now, or the stored start date.",
  }),
  endDate: z.string().optional().openapi({
    description:
      "ISO date string. Defaults to the stored end date, or the start date plus the project's default sprint length.",
  }),
});

export const closeSprintBody = z.object({
  targetSprintId: z.string().nullable().openapi({
    description:
      "Future sprint of the same project that receives every unfinished task. Null moves them to the backlog. Completed tasks stay in the closed sprint as history.",
  }),
});

export const updateTaskSprintBody = z.object({
  sprintId: z.string().nullable().openapi({
    description:
      "Active or future sprint of the task's project. Null moves the task to the backlog. Closed sprints are rejected in both directions.",
  }),
});
