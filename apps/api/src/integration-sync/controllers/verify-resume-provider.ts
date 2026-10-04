import { HTTPException } from "hono/http-exception";
import type { ResumeProviderSnapshot } from "./resume-provider-snapshot";

export async function verifyResumeProvider(snapshot: ResumeProviderSnapshot) {
  let current: ResumeProviderSnapshot["remoteIssue"];
  try {
    current = await snapshot.access.read();
  } catch {
    throw new HTTPException(502, {
      message: "External issue could not be verified; sync remains paused",
    });
  }
  if (
    current.title !== snapshot.remoteIssue.title ||
    current.description !== snapshot.remoteIssue.description ||
    current.state !== snapshot.remoteIssue.state
  )
    throw new HTTPException(409, {
      message:
        "External issue changed while resuming; review the comparison again",
    });
}
