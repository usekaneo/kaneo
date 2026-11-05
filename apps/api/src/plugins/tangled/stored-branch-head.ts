import { z } from "zod";
import { tangledRefSchema } from "./api-contract";

const metadataSchema = z.object({
  lastCommit: z.object({ sha: tangledRefSchema.shape.oid }),
});

export function storedBranchHead(metadata: string | null): string | null {
  if (!metadata) return null;
  try {
    const result = metadataSchema.safeParse(JSON.parse(metadata) as unknown);
    return result.success ? result.data.lastCommit.sha : null;
  } catch {
    return null;
  }
}
