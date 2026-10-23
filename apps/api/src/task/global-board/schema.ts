import { pagingNumber, z } from "../../openapi";
import { VALID_PRIORITIES } from "../validate-task-fields";
import { GLOBAL_STATUSES } from "./global-status";

export const DUE_DATE_FILTERS = [
  "dueThisWeek",
  "dueNextWeek",
  "noDueDate",
] as const;

export const GLOBAL_BOARD_FILTER_SUBJECTS = [
  "workspaceId",
  "projectId",
  "assigneeId",
  "priority",
  "label",
  "dueDate",
] as const;

// Query strings repeat a key for several values; one value arrives bare.
const listParam = <T extends z.ZodType<string>>(item: T, description: string) =>
  z
    .union([item, z.array(item).max(100)])
    .optional()
    .transform((value) => (value === undefined ? undefined : [value].flat()))
    .openapi({ description });

export const globalBoardTasksQuery = z.object({
  globalStatus: z.enum([...GLOBAL_STATUSES, "unmapped"]).openapi({
    description:
      "The board column to page through. `unmapped` lists tasks whose project column cannot be placed on to-do, in-progress, or done without guessing.",
  }),
  workspaceId: listParam(z.string().min(1), "Workspace IDs."),
  projectId: listParam(z.string().min(1), "Project IDs."),
  assigneeId: listParam(
    z.string().min(1),
    "User IDs, `me` for the caller, or `unassigned`.",
  ),
  priority: listParam(z.enum(VALID_PRIORITIES), "Priorities."),
  label: listParam(
    z.string().trim().min(1).max(100),
    "Label names, matched case-insensitively. A task matches when it has any of them.",
  ),
  dueDate: listParam(
    z.enum(DUE_DATE_FILTERS),
    "`dueThisWeek`, `dueNextWeek`, or `noDueDate`.",
  ),
  negate: listParam(
    z.enum(GLOBAL_BOARD_FILTER_SUBJECTS),
    "Filters to invert: a task matches when it does not match that filter.",
  ),
  dueWeekStart: z.iso.datetime({ offset: true }).optional().openapi({
    description:
      "When the caller's current week starts, for the week due-date filters. Defaults to Monday 00:00 UTC.",
  }),
  q: z.string().max(200).optional().openapi({
    description: "Matches task titles, or a ticket ID such as KAN-12.",
  }),
  page: pagingNumber(1, 1_000_000, 1),
  limit: pagingNumber(1, 100, 50),
});

export const moveGlobalBoardTaskBody = z.object({
  taskId: z.string().min(1),
  status: z.string().min(1).optional().openapi({
    description:
      "The project column slug to move the task into. Omit to only reorder it.",
  }),
  visibleTaskIds: z.array(z.string().min(1)).min(1).max(1000).openapi({
    description:
      "The lane's cards as the caller sees them after the drop, top to bottom, including the moved task. Neighbours decide its place in the caller's order and among same-project tasks on the project board.",
  }),
});
