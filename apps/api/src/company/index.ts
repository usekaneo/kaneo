import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  readCompanySettings,
  updateCompanySettings,
} from "./controllers/company-settings";
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
} from "./controllers/departments";
import {
  companySettingsSchema,
  departmentListSchema,
  departmentSchema,
} from "./response";
import {
  createDepartmentBody,
  departmentParam,
  updateCompanySettingsBody,
  workspaceQuery,
} from "./schema";

const getSettingsRoute = createRoute({
  method: "get",
  operationId: "getCompanySettings",
  path: "/settings",
  tags: ["Company"],
  summary: "Get company settings",
  description:
    "Timezone, currency, working hours, leave allowance and activity retention for a workspace. Defaults apply until an admin saves them.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Company settings", companySettingsSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const updateSettingsRoute = createRoute({
  method: "put",
  operationId: "updateCompanySettings",
  path: "/settings",
  tags: ["Company"],
  summary: "Update company settings",
  description: "Replace the company settings. Changes are audit logged.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updateCompanySettingsBody } },
    },
  },
  responses: {
    200: jsonResponse("The saved settings", companySettingsSchema),
    400: errorResponse("Invalid settings"),
    403: errorResponse("Missing workspace:manage_settings permission"),
  },
});

const listDepartmentsRoute = createRoute({
  method: "get",
  operationId: "listDepartments",
  path: "/departments",
  tags: ["Company"],
  summary: "List departments",
  description: "Departments in a workspace with how many people are in each.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Departments", departmentListSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const createDepartmentRoute = createRoute({
  method: "post",
  operationId: "createDepartment",
  path: "/departments",
  tags: ["Company"],
  summary: "Create department",
  description: "Add a department.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ people: ["manage"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createDepartmentBody } },
    },
  },
  responses: {
    200: jsonResponse("The new department", departmentSchema),
    403: errorResponse("Missing people:manage permission"),
    409: errorResponse("A department with this name already exists"),
  },
});

const deleteDepartmentRoute = createRoute({
  method: "delete",
  operationId: "deleteDepartment",
  path: "/departments/{id}",
  tags: ["Company"],
  summary: "Delete department",
  description:
    "Delete a department. People in it keep their profile without a department.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ people: ["manage"] }),
  ] as const,
  request: { params: departmentParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("The deleted department", departmentSchema),
    403: errorResponse("Missing people:manage permission"),
    404: errorResponse("Department not found"),
  },
});

const company = apiRouter()
  .openapi(getSettingsRoute, async (c) =>
    c.json(await readCompanySettings(c.req.valid("query").workspaceId), 200),
  )
  .openapi(updateSettingsRoute, async (c) => {
    const { workspaceId, ...input } = c.req.valid("json");
    return c.json(
      await updateCompanySettings(workspaceId, c.get("userId"), input),
      200,
    );
  })
  .openapi(listDepartmentsRoute, async (c) =>
    c.json(await listDepartments(c.req.valid("query").workspaceId), 200),
  )
  .openapi(createDepartmentRoute, async (c) => {
    const { workspaceId, name } = c.req.valid("json");
    return c.json(
      await createDepartment(workspaceId, c.get("userId"), name),
      200,
    );
  })
  .openapi(deleteDepartmentRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { workspaceId } = c.req.valid("query");
    return c.json(
      await deleteDepartment(workspaceId, c.get("userId"), id),
      200,
    );
  });

export default company;
