import { z } from "../openapi";

const isoTimestamp = z.string().openapi({ format: "date-time" });

export const activeSessionSchema = z
  .object({
    id: z.string().openapi({
      description: "Session id. Session tokens are never returned.",
    }),
    browser: z.string().nullable().openapi({
      description: "Browser read from the session's user agent, if known.",
    }),
    os: z.string().nullable().openapi({
      description: "Operating system or device read from the user agent.",
    }),
    ipAddress: z.string().nullable(),
    createdAt: isoTimestamp,
    lastActiveAt: isoTimestamp.openapi({
      description:
        "When the session was last refreshed. Sessions refresh about once a day while in use.",
    }),
    expiresAt: isoTimestamp,
    current: z.boolean().openapi({
      description: "True for the session making this request.",
    }),
  })
  .openapi("ActiveSession");

export const activeSessionListSchema = z
  .object({ sessions: z.array(activeSessionSchema) })
  .openapi("ActiveSessionList");

export const revokedSessionsSchema = z
  .object({
    revoked: z.number().int().openapi({
      description: "Number of sessions that were signed out.",
    }),
  })
  .openapi("RevokedSessions");
