import { HTTPException } from "hono/http-exception";
import type { ResumeProviderSnapshot } from "./resume-provider-snapshot";
import type { IssueValues } from "../../plugins/sync/provider-issue";

export async function verifyResumeProvider(
  snapshot: ResumeProviderSnapshot,
  expected: IssueValues,
) {
  let current: ResumeProviderSnapshot["remoteIssue"];
  try {
    current = await snapshot.access.read();
  } catch {
    throw new HTTPException(502, {
      message: "External issue could not be verified; sync remains paused",
    });
  }
  const initialLabels = [...new Set(snapshot.remoteIssue.labels ?? [])].sort();
  const currentLabels = [...new Set(current.labels ?? [])].sort();
  if (
    current.title !== expected.title ||
    current.description !== expected.description ||
    current.state !== expected.state ||
    initialLabels.length !== currentLabels.length ||
    initialLabels.some((label, index) => label !== currentLabels[index])
  )
    throw new HTTPException(409, {
      message:
        "External issue changed while resuming; review the comparison again",
    });
}
