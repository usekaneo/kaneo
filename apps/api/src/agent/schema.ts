import { calendarDay } from "../company/calendar-day";
import { z } from "../openapi";
import { timestamp } from "../time-entry/schema";

export const workspaceQuery = z.object({ workspaceId: z.string() });

export const pairingCodeBody = z.object({ workspaceId: z.string() });

export const pairBody = z.object({
  code: z.string().min(8).max(16).openapi({ example: "K7QM-2XPA" }),
  deviceName: z.string().trim().min(1).max(80),
  platform: z.enum(["windows", "macos", "linux"]),
  agentVersion: z.string().max(40).optional(),
});

export const agentState = z.enum(["active", "idle", "paused"]);

export const heartbeatBody = z.object({
  state: agentState,
  agentVersion: z.string().max(40).optional(),
});

// Only the host of a URL, never a path or query.
const hostname = z
  .string()
  .max(253)
  .regex(/^[a-z0-9.-]+$/i, "Domain only, no path")
  .transform((d) => d.toLowerCase().replace(/^www\./, ""));

export const activitySpan = z
  .object({
    id: z.string().min(8).max(64).openapi({
      description: "Chosen by the agent; a retried batch is stored once.",
    }),
    start: timestamp,
    end: timestamp,
    state: z.enum(["active", "idle"]),
    app: z.string().trim().max(120).optional(),
    domain: hostname.optional(),
  })
  .refine((s) => Date.parse(s.end) > Date.parse(s.start), {
    message: "A span must end after it starts",
  })
  .refine((s) => Date.parse(s.end) - Date.parse(s.start) <= 15 * 60_000, {
    message: "A span can be at most 15 minutes",
  });

export const activityBody = z.object({
  spans: z.array(activitySpan).max(500),
});

export const deviceParam = z.object({ id: z.string() });

export const devicesQuery = z.object({
  workspaceId: z.string(),
  userId: z.string().optional().openapi({
    description: "Defaults to you. Others need people:manage.",
  }),
});

export const summaryQuery = z
  .object({
    workspaceId: z.string(),
    userId: z.string().optional().openapi({
      description: "Defaults to you. Others need activity:read_all.",
    }),
    from: calendarDay,
    to: calendarDay,
  })
  .refine((q) => q.to >= q.from, { message: "`to` must not be before `from`" })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 < 92, {
    message: "At most 92 days at a time",
  });

export const spansQuery = z.object({
  workspaceId: z.string(),
  userId: z.string().optional(),
  day: calendarDay,
});
