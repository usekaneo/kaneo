import { pagingNumber, z } from "../../openapi";
import { VALID_PRIORITIES } from "../validate-task-fields";
import { GLOBAL_STATUSES } from "./global-status";

export const globalBoardTasksQuery = z.object({
  globalStatus: z.enum([...GLOBAL_STATUSES, "unmapped"]).openapi({
    description:
      "The board column to page through. `unmapped` lists tasks whose project column cannot be placed on to-do, in-progress, or done without guessing.",
  }),
  workspaceId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional().openapi({
    description: "A user ID, `me` for the caller, or `unassigned`.",
  }),
  priority: z.enum(VALID_PRIORITIES).optional(),
  label: z.string().trim().min(1).max(100).optional().openapi({
    description: "Label name, matched case-insensitively.",
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
