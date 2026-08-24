import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import ensureDefaultClientCtrl from "./controllers/ensure-default-client";
import getClientsCtrl from "./controllers/get-clients";

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
