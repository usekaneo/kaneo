import { z } from "zod";
export const claimSchema = z.object({
  credential: z.string().min(32).max(128),
  spec: z.object({
    jobId: z.string(),
    instructions: z.string().max(8000),
    context: z.string().max(32000).optional(),
    baseSha: z.string().regex(/^[a-f0-9]{40}$/),
    baseRef: z.string(),
    branch: z.string(),
    repository: z.string(),
    model: z.string().max(200),
    deadline: z.string().datetime(),
  }),
});
export type JobSpec = z.infer<typeof claimSchema>["spec"];
export type ChangedFile =
  | { action: "delete"; path: string }
  | {
      action: "upsert";
      path: string;
      mode: "100644" | "100755";
      content: string;
    };
