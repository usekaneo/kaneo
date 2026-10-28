import { z } from "../../openapi";
import { serviceStatusSchema } from "./service-status";

const errorCode = z.string().nullable().openapi({
  description:
    "Short failure category such as TIMEOUT, ECONNREFUSED or HTTP_403. Never contains hosts, credentials or server messages.",
});

export const adminSystemStatusSchema = z
  .object({
    checkedAt: z.string().openapi({ format: "date-time" }),
    version: z.string().nullable().openapi({
      description: "Kaneo release version of this API instance.",
    }),
    api: z.object({
      status: serviceStatusSchema,
      uptimeSeconds: z.number().int(),
      nodeVersion: z.string(),
    }),
    database: z.object({
      status: serviceStatusSchema,
      serverVersion: z.string().nullable(),
      latencyMs: z.number().int().nullable(),
      migrationsApplied: z.number().int().nullable(),
      errorCode,
    }),
    realtime: z.object({
      status: serviceStatusSchema,
      adapter: z.enum(["in-memory", "redis"]).nullable().openapi({
        description:
          "How events reach WebSocket clients: in-memory for a single instance, redis to fan out across instances. Null before WebSockets start.",
      }),
      connections: z.number().int().openapi({
        description: "Open WebSocket connections on this API instance.",
      }),
      connectedUsers: z.number().int().openapi({
        description:
          "Distinct people with an open connection to this instance.",
      }),
    }),
    redis: z.object({
      status: serviceStatusSchema,
      mode: z.enum(["standalone", "sentinel", "cluster"]).nullable(),
      errorCode,
    }),
    email: z.object({
      status: serviceStatusSchema,
      configured: z.boolean(),
      errorCode,
    }),
    storage: z.object({
      status: serviceStatusSchema,
      configured: z.boolean(),
      errorCode,
    }),
    auth: z.object({
      passwordSignIn: z.boolean(),
      emailOtpSignIn: z.boolean(),
      registration: z.boolean(),
      passwordRegistration: z.boolean(),
      guestAccess: z.boolean(),
      workspaceCreation: z.boolean(),
      providers: z.array(
        z.object({
          id: z.enum(["github", "google", "discord", "custom"]),
          name: z.string(),
          status: serviceStatusSchema,
        }),
      ),
    }),
    integrations: z.array(
      z.object({
        type: z.string(),
        name: z.string(),
        status: serviceStatusSchema,
        requiresInstanceSetup: z.boolean().openapi({
          description:
            "Whether the provider needs instance settings. Others are connected per project.",
        }),
        connectedProjects: z.number().int().nullable().openapi({
          description:
            "Projects with an active connection to this provider. Null when the database could not be read.",
        }),
      }),
    ),
  })
  .openapi("AdminSystemStatus");

export const adminTestEmailResultSchema = z
  .object({
    sent: z.literal(true),
    to: z.string().openapi({
      description: "The administrator's own address, the only recipient.",
    }),
  })
  .openapi("AdminTestEmailResult");
