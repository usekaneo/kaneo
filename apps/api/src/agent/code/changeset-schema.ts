import { z } from "../../openapi";

export const CHANGESET_LIMITS = {
  files: 300,
  // Decoded file bytes across the whole changeset.
  bytes: 10 * 1024 * 1024,
  path: 1024,
  title: 200,
  body: 20000,
  commitMessage: 5000,
  summary: 4000,
} as const;

// Base64 inflates by 4/3; leave room for paths and text fields.
export const CHANGESET_REQUEST_BYTES =
  Math.ceil(CHANGESET_LIMITS.bytes / 3) * 4 + 2 * 1024 * 1024;

const path = z.string().min(1).max(CHANGESET_LIMITS.path);
const summary = z.string().trim().max(CHANGESET_LIMITS.summary);

const fileSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("upsert"),
      path,
      mode: z.enum(["100644", "100755", "120000"]).openapi({
        description:
          "Git file mode; phase 1 policy rejects all new symlinks, including replacements",
      }),
      content: z.string().openapi({ description: "Base64 file bytes" }),
    })
    .strict(),
  z.object({ action: z.literal("delete"), path }).strict(),
]);

export const changesetSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      outcome: z.literal("changes"),
      baseSha: z.string().regex(/^[0-9a-f]{40}$/),
      title: z.string().trim().min(1).max(CHANGESET_LIMITS.title),
      body: z.string().max(CHANGESET_LIMITS.body).default(""),
      commitMessage: z
        .string()
        .trim()
        .min(1)
        .max(CHANGESET_LIMITS.commitMessage),
      summary: summary.optional(),
      files: z.array(fileSchema).min(1).max(CHANGESET_LIMITS.files),
    })
    .strict(),
  z.object({ outcome: z.literal("no_changes"), summary }).strict(),
]);

export type Changeset = z.infer<typeof changesetSchema>;
export type ChangesWithFiles = Extract<Changeset, { outcome: "changes" }>;
