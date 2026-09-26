import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const projectIdParam = z.object({ projectId: z.string() });

export const taskRelationParam = z.object({ id: z.string() });

// The four standard project-management dependency types: Finish-to-Start,
// Start-to-Start, Finish-to-Finish, Start-to-Finish. Only meaningful for a
// "blocks" relation; a "related"/"subtask" relation is stored with the fs/0
// defaults and its type/lag are ignored on write (see create-task-relation).
export const dependencyTypeSchema = z.enum(["fs", "ss", "ff", "sf"]);

// Lag (positive) or lead (negative) applied to the dependency, in days.
// Bounded to a generous but finite range so a typo can't produce an
// unbounded offset that breaks the Gantt's date math.
export const lagDaysSchema = z.number().int().min(-3650).max(3650);

export const createTaskRelationBody = z.object({
  sourceTaskId: z.string(),
  targetTaskId: z.string(),
  relationType: z.enum(["subtask", "blocks", "related"]),
  dependencyType: dependencyTypeSchema.optional(),
  lagDays: lagDaysSchema.optional(),
});

export const updateTaskRelationBody = z.object({
  dependencyType: dependencyTypeSchema.optional(),
  lagDays: lagDaysSchema.optional(),
});
