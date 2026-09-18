import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { assertSelfOrPermission } from "../utils/assert-self-or-permission";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getPeopleOverview from "./controllers/get-people-overview";
import getPerson from "./controllers/get-person";
import getPersonTasks from "./controllers/get-person-tasks";
import listPeople from "./controllers/list-people";
import setTaskOrder from "./controllers/set-task-order";
import updatePerson from "./controllers/update-person";
import {
  peopleOverviewSchema,
  personDetailSchema,
  personListSchema,
  personTaskListSchema,
} from "./response";
import {
  personParam,
  setTaskOrderBody,
  updatePersonBody,
  workspaceQuery,
} from "./schema";

const listPeopleRoute = createRoute({
  method: "get",
  operationId: "listPeople",
  path: "/",
  tags: ["People"],
  summary: "List people",
  description:
    "The workspace directory: members with their title, department, status and whether they are clocked in or online right now.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("People in the workspace", personListSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const getPersonRoute = createRoute({
  method: "get",
  operationId: "getPerson",
  path: "/{userId}",
  tags: ["People"],
  summary: "Get person",
  description:
    "A person's profile and working schedule. Your own is always visible; others need people:read_all.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: personParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("The person", personDetailSchema),
    403: errorResponse("Not you, and missing people:read_all"),
    404: errorResponse("Not a member of this workspace"),
  },
});

const updatePersonRoute = createRoute({
  method: "put",
  operationId: "updatePerson",
  path: "/{userId}",
  tags: ["People"],
  summary: "Update person",
  description:
    "Change a person's title, department, join date, status or schedule overrides. Audit logged.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ people: ["manage"] }),
  ] as const,
  request: {
    params: personParam,
    body: {
      required: true,
      content: { "application/json": { schema: updatePersonBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated person", personDetailSchema),
    400: errorResponse("Invalid profile, or unknown department"),
    403: errorResponse("Missing people:manage permission"),
    404: errorResponse("Not a member of this workspace"),
  },
});

const getPersonTasksRoute = createRoute({
  method: "get",
  operationId: "getPersonTasks",
  path: "/{userId}/tasks",
  tags: ["People"],
  summary: "Get a person's tasks",
  description:
    "Tasks assigned to the person across all projects: open ones and those finished in the last 30 days, with estimate and tracked time.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: personParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("Assigned tasks", personTaskListSchema),
    403: errorResponse("Not you, and missing people:read_all"),
  },
});

const setTaskOrderRoute = createRoute({
  method: "put",
  operationId: "setPersonTaskOrder",
  path: "/{userId}/tasks/order",
  tags: ["People"],
  summary: "Set my task order",
  description:
    "Save your own ordering of your tasks on My work, most important first. Replaces the previous order in this workspace; tasks left out fall back to the top, newest first. Does not change board order.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    params: personParam,
    body: {
      required: true,
      content: { "application/json": { schema: setTaskOrderBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The saved order",
      z.object({ taskIds: z.array(z.string()) }),
    ),
    403: errorResponse("Only your own order can be set"),
  },
});

// Registered before "/{userId}" so "overview" is not taken for a user id.
const peopleOverviewRoute = createRoute({
  method: "get",
  operationId: "getPeopleOverview",
  path: "/overview",
  tags: ["People"],
  summary: "People overview",
  description:
    "Per-person workload, time at work this month and leave this year, for the admin People view. Pay is not included; see the Pay API.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ people: ["read_all"] }),
  ] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Overview", peopleOverviewSchema),
    403: errorResponse("Missing people:read_all"),
  },
});

const people = apiRouter()
  .openapi(listPeopleRoute, async (c) =>
    c.json(await listPeople(c.req.valid("query").workspaceId), 200),
  )
  .openapi(peopleOverviewRoute, async (c) =>
    c.json(await getPeopleOverview(c.req.valid("query").workspaceId), 200),
  )
  .openapi(getPersonRoute, async (c) => {
    const { userId } = c.req.valid("param");
    await assertSelfOrPermission(c, userId, { people: ["read_all"] });
    return c.json(
      await getPerson(c.req.valid("query").workspaceId, userId),
      200,
    );
  })
  .openapi(updatePersonRoute, async (c) => {
    const { userId } = c.req.valid("param");
    const { workspaceId, ...input } = c.req.valid("json");
    return c.json(
      await updatePerson(workspaceId, userId, c.get("userId"), input),
      200,
    );
  })
  .openapi(getPersonTasksRoute, async (c) => {
    const { userId } = c.req.valid("param");
    await assertSelfOrPermission(c, userId, { people: ["read_all"] });
    return c.json(
      await getPersonTasks(c.req.valid("query").workspaceId, userId),
      200,
    );
  })
  .openapi(setTaskOrderRoute, async (c) => {
    const { userId } = c.req.valid("param");
    if (userId !== c.get("userId")) {
      throw new HTTPException(403, {
        message: "Only your own order can be set",
      });
    }
    const { workspaceId, taskIds } = c.req.valid("json");
    return c.json(await setTaskOrder(workspaceId, userId, taskIds), 200);
  });

export default people;
