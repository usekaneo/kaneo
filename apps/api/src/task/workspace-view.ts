import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  pagingNumber,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getWorkspaceTasks from "./controllers/get-workspace-tasks";
import { assignedTasksSchema } from "./response";
import { VALID_PRIORITIES } from "./validate-task-fields";

export const workspaceTasksQuery = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().max(128).optional(),
  assigneeId: z.string().max(128).optional().openapi({
    description:
      "A member ID, or unassigned. Matches every assignee, including additional assignees.",
  }),
  priority: z.enum(VALID_PRIORITIES).optional(),
  completion: z.enum(["open", "completed", "all"]).optional(),
  search: z.string().max(200).optional().openapi({
    description:
      "Case-insensitive literal search of titles and project task identifiers.",
  }),
  page: pagingNumber(1, 1000000).optional(),
});
const response = assignedTasksSchema.extend({
  tasks: z.array(
    assignedTasksSchema.shape.tasks.element.extend({
      completed: z.boolean(),
      assignees: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          image: z.string().nullable(),
        }),
      ),
    }),
  ),
});
const route = createRoute({
  method: "get",
  path: "/",
  operationId: "listWorkspaceTasks",
  tags: ["Tasks"],
  summary: "List tasks across accessible workspace projects",
  description:
    "A bounded read-only workspace overview. Filters apply before pagination; at most 100 compact task summaries per page. Archived tasks and projects are excluded. Completion follows each project's workflow rather than merging status slugs. Total is the matching accessible task count. Defaults to open tasks, ordered by due date, priority, creation time and ID.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { query: workspaceTasksQuery },
  responses: {
    200: jsonResponse("Workspace task page", response),
    400: errorResponse("Invalid query"),
    403: errorResponse("Missing project or task read permission"),
    404: errorResponse("Workspace not found"),
  },
});
export default apiRouter().openapi(route, async (c) => {
  const { workspaceId, page, ...filters } = c.req.valid("query");
  return c.json(
    await getWorkspaceTasks(workspaceId, c.get("userId"), filters, page),
    200,
  );
});
