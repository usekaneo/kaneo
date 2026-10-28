import { z, responseTimestamp, nullableResponseTimestamp } from "../openapi";
import {
  agentActionSchema,
  proposalStatusSchema,
  runStatusSchema,
} from "./schema";

const snapshot = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string(),
  userId: z.string().nullable(),
  dueDate: z.string().nullable(),
  commentId: z
    .string()
    .optional()
    .describe("Comment posted by an applied comment proposal"),
});
export const conversationResponse = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  createdAt: responseTimestamp,
  updatedAt: responseTimestamp,
});
export const attachmentResponse = z.object({
  id: z.string(),
  name: z.string(),
  mediaType: z.string(),
  size: z.number().describe("Bytes"),
});
const runAttachmentResponse = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    name: z.string(),
    size: z.number().describe("Characters of text content"),
  }),
  attachmentResponse.extend({ type: z.literal("file") }),
]);
export const runResponse = z.object({
  id: z.string(),
  conversationId: z.string(),
  requestId: z.string(),
  prompt: z.string(),
  attachments: z.array(runAttachmentResponse),
  response: z.string(),
  status: runStatusSchema,
  model: z.string(),
  error: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  costUsd: z.string().nullable(),
  createdAt: responseTimestamp,
  finishedAt: nullableResponseTimestamp,
});
export const recentRunResponse = z.object({
  id: z.string(),
  conversationId: z.string(),
  projectId: z.string().nullable(),
  prompt: z.string(),
  status: runStatusSchema,
  pendingProposals: z.number(),
  appliedProposals: z.number(),
  createdAt: responseTimestamp,
  finishedAt: nullableResponseTimestamp,
});
export const proposalResponse = z.object({
  id: z.string(),
  runId: z.string(),
  action: agentActionSchema,
  before: snapshot.nullable(),
  after: snapshot.nullable(),
  reason: z.string(),
  status: proposalStatusSchema,
  createdAt: responseTimestamp,
  appliedAt: nullableResponseTimestamp,
  undoneAt: nullableResponseTimestamp,
});
export const stepResponse = z.object({
  id: z.string(),
  runId: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.unknown(),
  summary: z.string().nullable(),
  status: z.enum(["running", "completed", "failed"]),
  createdAt: responseTimestamp,
  finishedAt: nullableResponseTimestamp,
});
export const runDetailResponse = runResponse.extend({
  steps: z.array(stepResponse),
  proposals: z.array(proposalResponse),
});
export const runStateResponse = z.object({
  id: z.string(),
  status: runStatusSchema,
});
export const applyResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["applied", "failed"]),
      error: z.string().nullable(),
      code: z.number().nullable(),
    }),
  ),
});
export const configResponse = z.object({
  enabled: z.boolean(),
  model: z.string().nullable().describe("Default model for new runs"),
  models: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .describe(
      "Models a run may request, including the default; empty when disabled",
    ),
  maxSteps: z.number().nullable(),
  maxOutputTokens: z.number().nullable(),
});
