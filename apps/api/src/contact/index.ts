import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createContact from "./controllers/create-contact";
import deleteContact from "./controllers/delete-contact";
import listContacts from "./controllers/list-contacts";
import updateContact from "./controllers/update-contact";
import { contactListSchema, contactSchema } from "./response";
import {
  contactParam,
  createContactBody,
  listContactsQuery,
  updateContactBody,
  workspaceParam,
} from "./schema";

// Contacts reuse the existing vocabulary: reading follows workspace:read, and
// writing follows task permissions because contacts exist to attach to tasks.
const access = (
  permission: Parameters<typeof requireWorkspacePermission>[0],
) => [workspaceAccess.fromParam(), requireWorkspacePermission(permission)];
const idParam = workspaceParam.extend(contactParam.shape);

const contact = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(
    createRoute({
      method: "get",
      operationId: "listContacts",
      path: "/workspace/{workspaceId}",
      tags: ["Contacts"],
      summary: "List contacts",
      description:
        "List the workspace's shared sales contacts by name, optionally filtered by search text, type, or region. Returns at most 500.",
      middleware: access({ workspace: ["read"] }),
      request: { params: workspaceParam, query: listContactsQuery },
      responses: {
        200: jsonResponse("Contacts", contactListSchema),
        403: errorResponse("Missing workspace:read permission"),
        404: errorResponse("Workspace not found"),
      },
    }),
    async (c) =>
      c.json(
        await listContacts({
          workspaceId: c.get("workspaceId"),
          ...c.req.valid("query"),
        }),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "post",
      operationId: "createContact",
      path: "/workspace/{workspaceId}",
      tags: ["Contacts"],
      summary: "Create a contact",
      description:
        "Add a shared contact. Type and region default to `other` and must come from the fixed lists.",
      middleware: access({ task: ["create"] }),
      request: {
        params: workspaceParam,
        body: {
          required: true,
          content: { "application/json": { schema: createContactBody } },
        },
      },
      responses: {
        201: jsonResponse("Contact created", contactSchema),
        400: errorResponse("Invalid contact"),
        403: errorResponse("Missing task:create permission"),
        404: errorResponse("Workspace not found"),
      },
    }),
    async (c) =>
      c.json(
        await createContact({
          workspaceId: c.get("workspaceId"),
          ...c.req.valid("json"),
        }),
        201,
      ),
  )
  .openapi(
    createRoute({
      method: "patch",
      operationId: "updateContact",
      path: "/workspace/{workspaceId}/{id}",
      tags: ["Contacts"],
      summary: "Update a contact",
      description:
        "Change a contact. Send null to clear phone, email, or notes.",
      middleware: access({ task: ["update"] }),
      request: {
        params: idParam,
        body: {
          required: true,
          content: { "application/json": { schema: updateContactBody } },
        },
      },
      responses: {
        200: jsonResponse("Contact updated", contactSchema),
        400: errorResponse("Invalid contact"),
        403: errorResponse("Missing task:update permission"),
        404: errorResponse("Workspace or contact not found"),
      },
    }),
    async (c) =>
      c.json(
        await updateContact(
          c.get("workspaceId"),
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "delete",
      operationId: "deleteContact",
      path: "/workspace/{workspaceId}/{id}",
      tags: ["Contacts"],
      summary: "Delete a contact",
      description:
        "Delete a contact. Tasks linked to it are kept and simply lose the link.",
      middleware: access({ task: ["delete"] }),
      request: { params: idParam },
      responses: {
        200: jsonResponse("Contact deleted", z.object({ id: z.string() })),
        403: errorResponse("Missing task:delete permission"),
        404: errorResponse("Workspace or contact not found"),
      },
    }),
    async (c) =>
      c.json(
        await deleteContact(c.get("workspaceId"), c.req.valid("param").id),
        200,
      ),
  );

export default contact;
