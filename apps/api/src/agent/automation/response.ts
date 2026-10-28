import { nullableResponseTimestamp, responseTimestamp, z } from "../../openapi";
import { runStatusSchema } from "../schema";
import { automationTriggerSchema } from "./schema";
import {
  AUTOMATION_EVENTS,
  AUTOMATION_OUTPUTS,
  AUTOMATION_PAUSE_REASONS,
  AUTOMATION_SKIP_REASONS,
} from "./types";

const person = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});
const projectRef = z.object({ id: z.string(), name: z.string() });

export const automationEventRefResponse = z.object({
  event: z.enum(AUTOMATION_EVENTS),
  taskId: z.string(),
  projectId: z.string(),
  occurredAt: z.string(),
  actorName: z.string().nullable(),
  columnName: z.string().nullable(),
  pullRequest: z
    .object({ number: z.number(), title: z.string(), url: z.string() })
    .nullable(),
  commentPreview: z.string().nullable(),
});

export const runTriggerResponse = z
  .object({
    automationId: z.string(),
    source: z.enum(["schedule", "event", "manual"]),
    output: z.enum(AUTOMATION_OUTPUTS),
    scheduledFor: z.string().nullable(),
    events: z.array(automationEventRefResponse),
    moreEvents: z.number(),
  })
  .nullable()
  .describe(
    "What started an automation run; null for runs typed by a user. Event text is untrusted workspace content.",
  );

const lastRun = z
  .object({
    id: z.string(),
    status: runStatusSchema,
    pendingProposals: z.number(),
    createdAt: responseTimestamp,
  })
  .nullable()
  .describe("Latest run you can see");

export const automationListItemResponse = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("agent"),
    id: z.string(),
    name: z.string(),
    trigger: automationTriggerSchema,
    project: projectRef.nullable(),
    output: z.enum(AUTOMATION_OUTPUTS),
    model: z.string(),
    enabled: z.boolean(),
    pausedReason: z.enum(AUTOMATION_PAUSE_REASONS).nullable(),
    lastSkipReason: z.enum(AUTOMATION_SKIP_REASONS).nullable(),
    lastSkippedAt: nullableResponseTimestamp,
    owner: person,
    nextRunAt: nullableResponseTimestamp,
    lastRun,
    createdAt: responseTimestamp,
  }),
  z.object({
    kind: z.literal("rule"),
    id: z.string(),
    project: projectRef,
    integrationType: z.string(),
    eventType: z.string(),
    columnName: z.string().nullable(),
    createdAt: responseTimestamp,
  }),
]);

export const automationListResponse = z.object({
  items: z.array(automationListItemResponse),
  total: z.number().describe("Items matching the selected kind and filters"),
  counts: z
    .object({ all: z.number(), agent: z.number(), rules: z.number() })
    .describe("Totals per kind for the same project and owner filters"),
});

export const automationResponse = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  prompt: z
    .string()
    .nullable()
    .describe(
      "Null for workspace admins who can see the automation only to take it over",
    ),
  trigger: automationTriggerSchema,
  projectId: z.string().nullable(),
  project: projectRef.nullable(),
  output: z.enum(AUTOMATION_OUTPUTS),
  model: z.string(),
  enabled: z.boolean(),
  pausedReason: z.enum(AUTOMATION_PAUSE_REASONS).nullable(),
  consecutiveFailures: z.number(),
  dailyRunLimit: z.number(),
  lastSkipReason: z.enum(AUTOMATION_SKIP_REASONS).nullable(),
  lastSkippedAt: nullableResponseTimestamp,
  nextRunAt: nullableResponseTimestamp,
  owner: person,
  conversationId: z
    .string()
    .nullable()
    .describe(
      "The owner's automation conversation; share or unshare it with the conversation endpoints",
    ),
  sharedAt: nullableResponseTimestamp,
  monthCostUsd: z
    .string()
    .describe(
      "Provider cost of visible runs in the current automation conversation this UTC month",
    ),
  viewer: z.object({
    isOwner: z.boolean(),
    canTakeOver: z.boolean(),
  }),
  createdAt: responseTimestamp,
  updatedAt: responseTimestamp,
});

export const automationRunResponse = z.object({
  id: z.string(),
  conversationId: z.string(),
  status: runStatusSchema,
  error: z.string().nullable(),
  model: z.string(),
  pendingProposals: z.number(),
  appliedProposals: z.number(),
  costUsd: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  trigger: runTriggerResponse,
  owner: person,
  createdAt: responseTimestamp,
  finishedAt: nullableResponseTimestamp,
});

export const deletedAutomationResponse = z.object({ id: z.string() });
