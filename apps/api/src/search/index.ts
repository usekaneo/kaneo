import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import globalSearch from "./controllers/global-search";
import { searchResponseSchema } from "./response";
import { searchQuery } from "./schema";

const globalSearchRoute = createRoute({
  method: "get",
  operationId: "globalSearch",
  path: "/",
  tags: ["Search"],
  summary: "Global search",
  description:
    "Search across tasks, projects, workspaces, comments, and activities in one workspace. Results are ranked by relevance and returned as a single flat list, each entry tagged with its `type`.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: searchQuery },
  responses: {
    200: jsonResponse("Ranked search results", searchResponseSchema),
    400: errorResponse(
      "Invalid query, or workspace ID could not be determined",
    ),
    403: errorResponse("No access to the workspace"),
  },
});

const search = apiRouter().openapi(globalSearchRoute, async (c) => {
  const { q, type, workspaceId, projectId, limit, userEmail } =
    c.req.valid("query");

  return c.json(
    await globalSearch({
      query: q,
      userId: c.get("userId"),
      userEmail,
      type,
      workspaceId,
      projectId,
      limit,
    }),
    200,
  );
});

export default search;
