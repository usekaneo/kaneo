import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createClientCtrl from "./controllers/create-client";
import ensureDefaultClientCtrl from "./controllers/ensure-default-client";
import getClientCtrl from "./controllers/get-client";
import getClientsCtrl from "./controllers/get-clients";
import updateClientCtrl from "./controllers/update-client";

const clientItemSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  tradeName: v.nullable(v.string()),
  cnpj: v.string(),
  email: v.nullable(v.string()),
  phone: v.nullable(v.string()),
  notes: v.nullable(v.string()),
  street: v.nullable(v.string()),
  number: v.nullable(v.string()),
  complement: v.nullable(v.string()),
  neighborhood: v.nullable(v.string()),
  city: v.nullable(v.string()),
  state: v.nullable(v.string()),
  zipCode: v.nullable(v.string()),
  country: v.nullable(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const client = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listClients",
      tags: ["Clients"],
      description: "List clients in a workspace",
      responses: {
        200: {
          description: "List of clients",
          content: {
            "application/json": {
              schema: resolver(v.array(clientItemSchema)),
            },
          },
        },
      },
    }),
    validator(
      "query",
      v.object({
        workspaceId: v.string(),
      }),
    ),
    workspaceAccess.fromQuery(),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const clients = await getClientsCtrl(workspaceId);
      return c.json(clients);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getClient",
      tags: ["Clients"],
      description: "Get a client by ID",
      responses: {
        200: {
          description: "Client details",
          content: {
            "application/json": { schema: resolver(clientItemSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("query", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromQuery(),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const clientRecord = await getClientCtrl(id, workspaceId);
      return c.json(clientRecord);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createClient",
      tags: ["Clients"],
      description: "Create a client in a workspace",
      responses: {
        200: {
          description: "Created client",
          content: {
            "application/json": { schema: resolver(clientItemSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        name: v.string(),
        tradeName: v.optional(v.nullable(v.string())),
        cnpj: v.string(),
        email: v.optional(v.nullable(v.string())),
        phone: v.optional(v.nullable(v.string())),
        notes: v.optional(v.nullable(v.string())),
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const body = c.req.valid("json");
      const created = await createClientCtrl({
        workspaceId,
        name: body.name,
        tradeName: body.tradeName,
        cnpj: body.cnpj,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
      });
      return c.json(created);
    },
  )
  .patch(
    "/:id",
    describeRoute({
      operationId: "updateClient",
      tags: ["Clients"],
      description: "Update a client",
      responses: {
        200: {
          description: "Updated client",
          content: {
            "application/json": { schema: resolver(clientItemSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        name: v.optional(v.string()),
        tradeName: v.optional(v.nullable(v.string())),
        cnpj: v.optional(v.string()),
        email: v.optional(v.nullable(v.string())),
        phone: v.optional(v.nullable(v.string())),
        notes: v.optional(v.nullable(v.string())),
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const body = c.req.valid("json");
      const updated = await updateClientCtrl({
        id,
        workspaceId,
        name: body.name,
        tradeName: body.tradeName,
        cnpj: body.cnpj,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
      });
      return c.json(updated);
    },
  )
  .post(
    "/ensure-default",
    describeRoute({
      operationId: "ensureDefaultClient",
      tags: ["Clients"],
      description: "Ensure the workspace has a default client",
      responses: {
        200: {
          description: "Default client",
          content: {
            "application/json": { schema: resolver(clientItemSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const defaultClient = await ensureDefaultClientCtrl(workspaceId);
      return c.json(defaultClient);
    },
  );

export default client;
