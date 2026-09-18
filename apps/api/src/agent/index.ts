import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import {
  assertPermission,
  assertSelfOrPermission,
} from "../utils/assert-self-or-permission";
import { limitBody } from "../utils/limit-body";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  activitySpans,
  activitySummary,
  createPairingCode,
  findDevice,
  goOffline,
  heartbeat,
  ingestActivity,
  listDevices,
  pairDevice,
  revokeDevice,
} from "./controllers";
import { type AuthenticatedDevice, authenticateDevice } from "./device-auth";
import { allowPairingAttempt } from "./pairing-rate-limit";
import {
  activityResultSchema,
  activitySpanListSchema,
  activitySummarySchema,
  deviceListSchema,
  deviceSchema,
  heartbeatResultSchema,
  offlineResultSchema,
  pairingCodeSchema,
  pairResultSchema,
} from "./response";
import {
  activityBody,
  deviceParam,
  devicesQuery,
  heartbeatBody,
  pairBody,
  pairingCodeBody,
  spansQuery,
  summaryQuery,
  workspaceQuery,
} from "./schema";

const tags = ["Desktop agent"];
const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

// --- Called by the desktop app (device token, not a login session) -------

const pairRoute = createRoute({
  method: "post",
  operationId: "pairAgentDevice",
  path: "/device/pair",
  tags,
  summary: "Pair a desktop app",
  description:
    "Exchange a one-time pairing code (created in Kaneo by the employee) for a device token. The token only works for the desktop agent endpoints.",
  middleware: [limitBody(4 * 1024)] as const,
  request: { body: json(pairBody) },
  responses: {
    200: jsonResponse("Paired", pairResultSchema),
    400: errorResponse("Invalid or expired code"),
    429: errorResponse("Too many attempts"),
  },
});

const heartbeatRoute = createRoute({
  method: "post",
  operationId: "agentHeartbeat",
  path: "/device/heartbeat",
  tags,
  summary: "Heartbeat",
  description:
    "Report that the app is running and whether the person is active, idle or has paused tracking.",
  middleware: [limitBody(4 * 1024), authenticateDevice] as const,
  request: { body: json(heartbeatBody) },
  responses: {
    200: jsonResponse("Current settings", heartbeatResultSchema),
    401: errorResponse("Device not paired or revoked"),
  },
});

const offlineRoute = createRoute({
  method: "post",
  operationId: "agentOffline",
  path: "/device/offline",
  tags,
  summary: "Going offline",
  description:
    "Sent when the app quits. With automatic clocking on, the person is clocked out right away (at their last activity) unless another of their devices is still running.",
  middleware: [limitBody(1024), authenticateDevice] as const,
  responses: {
    200: jsonResponse("Attendance after going offline", offlineResultSchema),
    401: errorResponse("Device not paired or revoked"),
  },
});

const activityRoute = createRoute({
  method: "post",
  operationId: "agentActivity",
  path: "/device/activity",
  tags,
  summary: "Send activity",
  description:
    "Upload activity spans (app name, and domain where enabled). Spans with an id already received are ignored, so batches can be retried safely.",
  // 500 spans is well under 1 MB.
  middleware: [limitBody(1024 * 1024), authenticateDevice] as const,
  request: { body: json(activityBody) },
  responses: {
    200: jsonResponse("What was stored", activityResultSchema),
    401: errorResponse("Device not paired or revoked"),
  },
});

// --- Called from Kaneo by people (login session) -------------------------

const pairingCodeRoute = createRoute({
  method: "post",
  operationId: "createAgentPairingCode",
  path: "/pairing-code",
  tags,
  summary: "Create a pairing code",
  description:
    "A one-time code, valid for 10 minutes, to connect your desktop app to this workspace.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { body: json(pairingCodeBody) },
  responses: {
    200: jsonResponse("The code", pairingCodeSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const devicesRoute = createRoute({
  method: "get",
  operationId: "listAgentDevices",
  path: "/devices",
  tags,
  summary: "List desktop apps",
  description: "Paired desktop apps. Yours, or anyone's with people:manage.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: devicesQuery },
  responses: {
    200: jsonResponse("Devices", deviceListSchema),
    403: errorResponse("Not you, and missing people:manage"),
  },
});

const revokeRoute = createRoute({
  method: "delete",
  operationId: "revokeAgentDevice",
  path: "/devices/{id}",
  tags,
  summary: "Disconnect a desktop app",
  description:
    "Revoke a device so its token stops working. Your own, or anyone's with people:manage. Audit logged.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: deviceParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("The revoked device", deviceSchema),
    403: errorResponse("Not your device, and missing people:manage"),
    404: errorResponse("Device not found"),
  },
});

const summaryRoute = createRoute({
  method: "get",
  operationId: "getActivitySummary",
  path: "/activity/summary",
  tags,
  summary: "Activity summary",
  description:
    "Active and idle time with totals per app and per domain. Yours, or anyone's with activity:read_all.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: summaryQuery },
  responses: {
    200: jsonResponse("Summary", activitySummarySchema),
    403: errorResponse("Not you, and missing activity:read_all"),
  },
});

const spansRoute = createRoute({
  method: "get",
  operationId: "getActivitySpans",
  path: "/activity/spans",
  tags,
  summary: "Activity details for a day",
  description:
    "The individual spans behind a day's totals (details view). Kept for the company's detail retention period.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: spansQuery },
  responses: {
    200: jsonResponse("Spans", activitySpanListSchema),
    403: errorResponse("Not you, and missing activity:read_all"),
  },
});

const agent = apiRouter<BaseVariables & { device: AuthenticatedDevice }>()
  .openapi(pairRoute, async (c) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    if (!allowPairingAttempt(ip)) {
      throw new HTTPException(429, {
        message: "Too many attempts. Try again in a few minutes.",
      });
    }
    return c.json(await pairDevice(c.req.valid("json")), 200);
  })
  .openapi(heartbeatRoute, async (c) => {
    const { state, agentVersion } = c.req.valid("json");
    return c.json(await heartbeat(c.get("device"), state, agentVersion), 200);
  })
  .openapi(offlineRoute, async (c) =>
    c.json(await goOffline(c.get("device")), 200),
  )
  .openapi(activityRoute, async (c) =>
    c.json(
      await ingestActivity(c.get("device"), c.req.valid("json").spans),
      200,
    ),
  )
  .openapi(pairingCodeRoute, async (c) =>
    c.json(
      await createPairingCode(c.req.valid("json").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(devicesRoute, async (c) => {
    const { workspaceId, userId } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { people: ["manage"] });
    return c.json(await listDevices(workspaceId, target), 200);
  })
  .openapi(revokeRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { workspaceId } = c.req.valid("query");
    const device = await findDevice(workspaceId, id);
    if (device.userId !== c.get("userId")) {
      await assertPermission(c, { people: ["manage"] });
    }
    return c.json(await revokeDevice(workspaceId, c.get("userId"), id), 200);
  })
  .openapi(summaryRoute, async (c) => {
    const { workspaceId, userId, from, to } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { activity: ["read_all"] });
    return c.json(await activitySummary(workspaceId, target, from, to), 200);
  })
  .openapi(spansRoute, async (c) => {
    const { workspaceId, userId, day } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { activity: ["read_all"] });
    return c.json(await activitySpans(workspaceId, target, day), 200);
  });

export default agent;
