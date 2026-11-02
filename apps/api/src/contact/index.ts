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
import getContactTimeline from "./controllers/get-contact-timeline";
import listContacts from "./controllers/list-contacts";
import updateContact from "./controllers/update-contact";
import createOptions from "./options/create-options";
import deleteOption from "./options/delete-option";
import listOptions from "./options/list-options";
import renameOption from "./options/rename-option";
import reorderOptions from "./options/reorder-options";
import {
  contactOptionSchema,
  contactOptionsSchema,
  createOptionsResultSchema,
  deleteOptionResultSchema,
} from "./options/response";
import {
  createOptionsBody,
  kindParam,
  optionParam,
  renameOptionBody,
  reorderOptionsBody,
} from "./options/schema";
import {
  contactListSchema,
  contactSchema,
  contactTimelineSchema,
} from "./response";
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
        "List the workspace's shared sales contacts by name, optionally filtered by search text, type, or region (an option key or label). Each contact has the type and region keys plus their current labels (null when not set). Returns at most 500.",
      middleware: access({ workspace: ["read"] }),
      request: { params: workspaceParam, query: listContactsQuery },
      responses: {
        200: jsonResponse("Contacts", contactListSchema),
        400: errorResponse("Unknown type or region"),
        403: errorResponse("Missing workspace:read permission"),
        404: errorResponse("Workspace not found"),
      },
    }),
    async (c) =>
      c.json(
        await listContacts({
          workspaceId: c.get("workspaceId"),
          userId: c.get("userId"),
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
        "Add a shared contact. Type and region are optional; when given they must be an option key or label from this workspace's lists (see the options routes) and are stored as the key. Omitted means not set.",
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
      method: "get",
      operationId: "getContactTimeline",
      path: "/workspace/{workspaceId}/{id}/timeline",
      tags: ["Contacts"],
      summary: "Get a contact's follow-up timeline",
      description:
        "The contact's leads (tasks linked to it, next follow-up first) and the comments on those leads, newest first. Log an interaction by commenting on a lead. Leads in projects the caller cannot open are left out.",
      middleware: access({ workspace: ["read"] }),
      request: { params: idParam },
      responses: {
        200: jsonResponse("Leads and interactions", contactTimelineSchema),
        403: errorResponse("Missing workspace:read permission"),
        404: errorResponse("Workspace or contact not found"),
      },
    }),
    async (c) =>
      c.json(
        await getContactTimeline(
          c.get("workspaceId"),
          c.req.valid("param").id,
          c.get("userId"),
        ),
        200,
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
        "Change a contact. Send null to clear phone, email, notes, type, or region. Type and region take an option key or label.",
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
  )

  .openapi(
    createRoute({
      method: "get",
      operationId: "listContactOptions",
      path: "/workspace/{workspaceId}/options",
      tags: ["Contacts"],
      summary: "List contact types and locations",
      description:
        "The workspace's contact types and locations in display order, each with its key, label, position, and the number of contacts using it. The built-in defaults are created the first time this is read.",
      middleware: access({ workspace: ["read"] }),
      request: { params: workspaceParam },
      responses: {
        200: jsonResponse("Contact options", contactOptionsSchema),
        403: errorResponse("Missing workspace:read permission"),
        404: errorResponse("Workspace not found"),
      },
    }),
    async (c) => c.json(await listOptions(c.get("workspaceId")), 200),
  )
  .openapi(
    createRoute({
      method: "post",
      operationId: "createContactOptions",
      path: "/workspace/{workspaceId}/options",
      tags: ["Contacts"],
      summary: "Add contact types or locations",
      description:
        "Add one name (`label`) or many (`labels`, up to 500, for pasting a list of islands or atolls) to the end of a list. Names are trimmed, blanks are dropped, and repeats or names that already exist (ignoring case) are skipped and reported. A list holds at most 2000 options.",
      middleware: access({ workspace: ["manage_settings"] }),
      request: {
        params: workspaceParam,
        body: {
          required: true,
          content: { "application/json": { schema: createOptionsBody } },
        },
      },
      responses: {
        201: jsonResponse(
          "What was added and skipped",
          createOptionsResultSchema,
        ),
        400: errorResponse("Invalid request or the list would be too long"),
        403: errorResponse("Missing workspace:manage_settings permission"),
        404: errorResponse("Workspace not found"),
      },
    }),
    async (c) =>
      c.json(
        await createOptions({
          workspaceId: c.get("workspaceId"),
          ...c.req.valid("json"),
        }),
        201,
      ),
  )
  .openapi(
    createRoute({
      method: "put",
      operationId: "reorderContactOptions",
      path: "/workspace/{workspaceId}/options/{kind}/order",
      tags: ["Contacts"],
      summary: "Reorder contact types or locations",
      description:
        "Set the display order of one list. Send the option keys in the new order; options left out keep their relative order after the listed ones. Returns all options.",
      middleware: access({ workspace: ["manage_settings"] }),
      request: {
        params: workspaceParam.extend(kindParam.shape),
        body: {
          required: true,
          content: { "application/json": { schema: reorderOptionsBody } },
        },
      },
      responses: {
        200: jsonResponse("Contact options", contactOptionsSchema),
        400: errorResponse("Unknown or repeated key"),
        403: errorResponse("Missing workspace:manage_settings permission"),
        404: errorResponse("Workspace not found"),
      },
    }),
    async (c) => {
      const { kind } = c.req.valid("param");
      return c.json(
        await reorderOptions(
          c.get("workspaceId"),
          kind,
          c.req.valid("json").keys,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "patch",
      operationId: "renameContactOption",
      path: "/workspace/{workspaceId}/options/{kind}/{key}",
      tags: ["Contacts"],
      summary: "Rename a contact type or location",
      description:
        "Change an option's label. Its key stays the same, so contacts using it stay linked.",
      middleware: access({ workspace: ["manage_settings"] }),
      request: {
        params: workspaceParam.extend(optionParam.shape),
        body: {
          required: true,
          content: { "application/json": { schema: renameOptionBody } },
        },
      },
      responses: {
        200: jsonResponse("Option renamed", contactOptionSchema),
        400: errorResponse("Invalid label"),
        403: errorResponse("Missing workspace:manage_settings permission"),
        404: errorResponse("Workspace or option not found"),
        409: errorResponse("Another option already has this label"),
      },
    }),
    async (c) => {
      const { kind, key } = c.req.valid("param");
      return c.json(
        await renameOption(
          c.get("workspaceId"),
          kind,
          key,
          c.req.valid("json").label,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "delete",
      operationId: "deleteContactOption",
      path: "/workspace/{workspaceId}/options/{kind}/{key}",
      tags: ["Contacts"],
      summary: "Delete a contact type or location",
      description:
        "Remove an option. Contacts that used it become not set; the response says how many. The last option of a list cannot be deleted.",
      middleware: access({ workspace: ["manage_settings"] }),
      request: { params: workspaceParam.extend(optionParam.shape) },
      responses: {
        200: jsonResponse("Option deleted", deleteOptionResultSchema),
        400: errorResponse("This is the last option of its list"),
        403: errorResponse("Missing workspace:manage_settings permission"),
        404: errorResponse("Workspace or option not found"),
      },
    }),
    async (c) => {
      const { kind, key } = c.req.valid("param");
      return c.json(await deleteOption(c.get("workspaceId"), kind, key), 200);
    },
  );

export default contact;
