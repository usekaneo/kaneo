import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createClientPartner,
  deleteClientPartner,
  listClientPartners,
  updateClientPartner,
} from "./controllers/client-partners";
import createClientCtrl from "./controllers/create-client";
import ensureDefaultClientCtrl from "./controllers/ensure-default-client";
import getClientCtrl from "./controllers/get-client";
import getClientsCtrl from "./controllers/get-clients";
import lookupCnpjCtrl from "./controllers/lookup-cnpj";
import updateClientCtrl from "./controllers/update-client";

const addressFields = {
  street: v.optional(v.nullable(v.string())),
  number: v.optional(v.nullable(v.string())),
  complement: v.optional(v.nullable(v.string())),
  neighborhood: v.optional(v.nullable(v.string())),
  city: v.optional(v.nullable(v.string())),
  state: v.optional(v.nullable(v.string())),
  zipCode: v.optional(v.nullable(v.string())),
  country: v.optional(v.nullable(v.string())),
};

const partnerInputSchema = v.object({
  name: v.string(),
  cpf: v.optional(v.nullable(v.string())),
  role: v.optional(v.nullable(v.string())),
  ownershipPercent: v.optional(v.nullable(v.number())),
  email: v.optional(v.nullable(v.string())),
  phone: v.optional(v.nullable(v.string())),
  sortOrder: v.optional(v.number()),
});

const partnerSchema = v.object({
  id: v.string(),
  clientId: v.string(),
  name: v.string(),
  cpf: v.nullable(v.string()),
  role: v.nullable(v.string()),
  ownershipPercent: v.nullable(v.number()),
  email: v.nullable(v.string()),
  phone: v.nullable(v.string()),
  sortOrder: v.number(),
  createdAt: v.date(),
  updatedAt: v.date(),
});

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

const clientDetailSchema = v.object({
  ...clientItemSchema.entries,
  partners: v.array(partnerSchema),
});

const cnpjLookupSchema = v.object({
  cnpj: v.string(),
  name: v.string(),
  tradeName: v.nullable(v.string()),
  email: v.nullable(v.string()),
  phone: v.nullable(v.string()),
  street: v.nullable(v.string()),
  number: v.nullable(v.string()),
  complement: v.nullable(v.string()),
  neighborhood: v.nullable(v.string()),
  city: v.nullable(v.string()),
  state: v.nullable(v.string()),
  zipCode: v.nullable(v.string()),
  country: v.string(),
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
    "/lookup-cnpj",
    describeRoute({
      operationId: "lookupCnpj",
      tags: ["Clients"],
      description: "Lookup company data by CNPJ via public Brazilian APIs",
      responses: {
        200: {
          description: "Company data",
          content: {
            "application/json": { schema: resolver(cnpjLookupSchema) },
          },
        },
      },
    }),
    validator(
      "query",
      v.object({
        workspaceId: v.string(),
        cnpj: v.string(),
      }),
    ),
    workspaceAccess.fromQuery(),
    async (c) => {
      const { cnpj } = c.req.valid("query");
      const result = await lookupCnpjCtrl(cnpj);
      return c.json(result);
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
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getClient",
      tags: ["Clients"],
      description: "Get a client by ID (includes partners)",
      responses: {
        200: {
          description: "Client details",
          content: {
            "application/json": { schema: resolver(clientDetailSchema) },
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
        ...addressFields,
        partners: v.optional(v.array(partnerInputSchema)),
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
        street: body.street,
        number: body.number,
        complement: body.complement,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        country: body.country,
        partners: body.partners,
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
        ...addressFields,
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
        street: body.street,
        number: body.number,
        complement: body.complement,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        country: body.country,
      });
      return c.json(updated);
    },
  )
  .get(
    "/:id/partners",
    describeRoute({
      operationId: "listClientPartners",
      tags: ["Clients"],
      description: "List partners for a client",
      responses: {
        200: {
          description: "Partners",
          content: {
            "application/json": {
              schema: resolver(v.array(partnerSchema)),
            },
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
      const partners = await listClientPartners(id, workspaceId);
      return c.json(partners);
    },
  )
  .post(
    "/:id/partners",
    describeRoute({
      operationId: "createClientPartner",
      tags: ["Clients"],
      description: "Add a partner to a client",
      responses: {
        200: {
          description: "Created partner",
          content: {
            "application/json": { schema: resolver(partnerSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        ...partnerInputSchema.entries,
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const body = c.req.valid("json");
      const created = await createClientPartner({
        clientId: id,
        workspaceId,
        partner: {
          name: body.name,
          cpf: body.cpf,
          role: body.role,
          ownershipPercent: body.ownershipPercent,
          email: body.email,
          phone: body.phone,
          sortOrder: body.sortOrder,
        },
      });
      return c.json(created);
    },
  )
  .patch(
    "/:id/partners/:partnerId",
    describeRoute({
      operationId: "updateClientPartner",
      tags: ["Clients"],
      description: "Update a client partner",
      responses: {
        200: {
          description: "Updated partner",
          content: {
            "application/json": { schema: resolver(partnerSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string(), partnerId: v.string() })),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        name: v.optional(v.string()),
        cpf: v.optional(v.nullable(v.string())),
        role: v.optional(v.nullable(v.string())),
        ownershipPercent: v.optional(v.nullable(v.number())),
        email: v.optional(v.nullable(v.string())),
        phone: v.optional(v.nullable(v.string())),
        sortOrder: v.optional(v.number()),
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const { id, partnerId } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const body = c.req.valid("json");
      const updated = await updateClientPartner({
        partnerId,
        clientId: id,
        workspaceId,
        partner: {
          name: body.name,
          cpf: body.cpf,
          role: body.role,
          ownershipPercent: body.ownershipPercent,
          email: body.email,
          phone: body.phone,
          sortOrder: body.sortOrder,
        },
      });
      return c.json(updated);
    },
  )
  .delete(
    "/:id/partners/:partnerId",
    describeRoute({
      operationId: "deleteClientPartner",
      tags: ["Clients"],
      description: "Delete a client partner",
      responses: {
        200: {
          description: "Deleted",
          content: {
            "application/json": {
              schema: resolver(v.object({ success: v.boolean() })),
            },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string(), partnerId: v.string() })),
    validator("query", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromQuery(),
    async (c) => {
      const { id, partnerId } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const result = await deleteClientPartner({
        partnerId,
        clientId: id,
        workspaceId,
      });
      return c.json(result);
    },
  );

export default client;
