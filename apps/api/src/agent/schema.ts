import { z, pagingNumber } from "../openapi";

const id = z.string().trim().min(1).max(128);
const priority = z.enum(["no-priority", "low", "medium", "high", "urgent"]);
const dueDate = z.string().datetime({ offset: true }).nullable();
export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    priority: priority.optional(),
    userId: id.nullable().optional(),
    dueDate: dueDate.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export const agentActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("task.update"),
      taskId: id,
      patch: taskPatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("task.create"),
      projectId: id,
      title: z.string().trim().min(1).max(500),
      description: z.string().max(16000).default(""),
      status: id.default("to-do"),
      priority: priority.default("no-priority"),
      userId: id.nullable().default(null),
      dueDate: dueDate.default(null),
    })
    .strict(),
]);

export const createProposalSchema = z
  .object({
    action: agentActionSchema,
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

export const createConversationSchema = z
  .object({
    projectId: id.optional(),
    title: z.string().trim().min(1).max(200).default("New conversation"),
  })
  .strict();
export const AGENT_ATTACHMENT_LIMITS = {
  // Text files and uploads together.
  files: 5,
  charactersPerFile: 50000,
  totalCharacters: 100000,
  bytesPerUpload: 5 * 1024 * 1024,
  // Uploads not yet sent with a run, per user.
  pendingUploads: 20,
} as const;
export const AGENT_UPLOAD_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;
export const AGENT_UPLOAD_BASE64_CHARS =
  Math.ceil(AGENT_ATTACHMENT_LIMITS.bytesPerUpload / 3) * 4;
export const AGENT_UPLOAD_REQUEST_BYTES = AGENT_UPLOAD_BASE64_CHARS + 4096;
export const uploadAttachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    mediaType: z.enum(AGENT_UPLOAD_MEDIA_TYPES),
    data: z
      .string()
      .min(1)
      .max(AGENT_UPLOAD_BASE64_CHARS)
      .openapi({
        description: `Base64 file bytes, at most ${AGENT_ATTACHMENT_LIMITS.bytesPerUpload / (1024 * 1024)} MB decoded. Must match mediaType.`,
      }),
  })
  .strict();
const textAttachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    content: z.string().min(1).max(AGENT_ATTACHMENT_LIMITS.charactersPerFile),
  })
  .strict()
  .openapi({ description: "Text file read by the client" });
const fileAttachmentSchema = z.object({ id }).strict().openapi({
  description:
    "Your pending upload from POST /attachments. Each upload can be sent with one run.",
});
export const createRunSchema = z
  .object({
    requestId: z.string().uuid(),
    prompt: z.string().trim().min(1).max(16000),
    attachments: z
      .array(z.union([textAttachmentSchema, fileAttachmentSchema]))
      .max(AGENT_ATTACHMENT_LIMITS.files)
      .refine(
        (files) =>
          files.reduce(
            (total, file) =>
              total + ("content" in file ? file.content.length : 0),
            0,
          ) <= AGENT_ATTACHMENT_LIMITS.totalCharacters,
        "Attachments are too large",
      )
      .refine((files) => {
        const ids = files.flatMap((file) => ("id" in file ? [file.id] : []));
        return new Set(ids).size === ids.length;
      }, "Duplicate attachment IDs")
      .default([])
      .openapi({
        description:
          "Up to five text files or uploaded images and PDFs. Contents are given to the model as untrusted data and are not returned by run endpoints.",
      }),
    model: z.string().trim().min(1).max(200).optional().openapi({
      description:
        "OpenRouter model ID from the config endpoint's models. Omit to use the instance default; other models are rejected.",
    }),
  })
  .strict();
export const workspaceParams = z.object({ workspaceId: id });
export const conversationParams = workspaceParams.extend({
  conversationId: id,
});
export const runParams = workspaceParams.extend({ runId: id });
export const attachmentParams = workspaceParams.extend({ attachmentId: id });
export const proposalParams = workspaceParams.extend({ proposalId: id });
export const listQuery = z.object({
  limit: pagingNumber(1, 50, 20),
  offset: pagingNumber(0, 10000, 0),
});
export const listConversationsQuery = listQuery.extend({
  projectId: id.optional(),
});
export const selectProposalsSchema = z
  .object({
    proposalIds: z
      .array(id)
      .min(1)
      .max(20)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate proposal IDs",
      ),
  })
  .strict();

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
]);
export const proposalStatusSchema = z.enum([
  "pending",
  "applied",
  "discarded",
  "undone",
]);
