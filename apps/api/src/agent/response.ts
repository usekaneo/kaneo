import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const pairingCodeSchema = z
  .object({ code: z.string(), expiresAt: responseTimestamp })
  .openapi("AgentPairingCode");

export const agentSettingsSchema = z
  .object({
    trackDomains: z.boolean(),
    heartbeatSeconds: z.number(),
    syncSeconds: z.number(),
    idleAfterSeconds: z.number(),
  })
  .openapi("AgentSettings");

export const pairResultSchema = z
  .object({
    deviceId: z.string(),
    token: z.string().openapi({
      description: "Shown once. Store it in the OS keychain.",
    }),
    workspaceId: z.string(),
    workspaceName: z.string(),
    userName: z.string(),
    settings: agentSettingsSchema,
  })
  .openapi("AgentPairResult");

export const agentAttendanceSchema = z
  .object({
    autoClock: z.boolean().openapi({
      description: "Whether the company clocks people in and out from the app.",
    }),
    clockedIn: z.boolean(),
    since: nullableResponseTimestamp,
    automatic: z.boolean().openapi({
      description: "The open session was started by the app, not by hand.",
    }),
  })
  .openapi("AgentAttendance");

export const heartbeatResultSchema = z
  .object({
    settings: agentSettingsSchema,
    serverTime: responseTimestamp,
    attendance: agentAttendanceSchema,
  })
  .openapi("AgentHeartbeatResult");

export const offlineResultSchema = z
  .object({ attendance: agentAttendanceSchema })
  .openapi("AgentOfflineResult");

export const activityResultSchema = z
  .object({ accepted: z.number(), duplicates: z.number() })
  .openapi("AgentActivityResult");

export const deviceSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    platform: z.string(),
    agentVersion: z.string().nullable(),
    lastSeenAt: nullableResponseTimestamp,
    lastState: z.string().nullable(),
    online: z.boolean(),
    revokedAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
  })
  .openapi("AgentDevice");

export const deviceListSchema = z.array(deviceSchema);

const usageSchema = z.object({ name: z.string(), seconds: z.number() });

export const activitySummarySchema = z
  .object({
    timeZone: z.string(),
    activeSeconds: z.number(),
    idleSeconds: z.number(),
    apps: z.array(usageSchema),
    domains: z.array(usageSchema),
    days: z.array(
      z.object({
        day: z.string(),
        activeSeconds: z.number(),
        idleSeconds: z.number(),
      }),
    ),
  })
  .openapi("ActivitySummary");

export const activitySpanListSchema = z
  .array(
    z.object({
      startedAt: responseTimestamp,
      endedAt: responseTimestamp,
      state: z.string(),
      app: z.string().nullable(),
      domain: z.string().nullable(),
    }),
  )
  .openapi("ActivitySpans");
