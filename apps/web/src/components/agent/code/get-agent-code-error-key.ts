import { HttpError } from "@/lib/http-error";
import { getAgentErrorKey } from "../get-agent-error-key";

// Starting and cancelling jobs share the agent copy except for the two
// statuses that mean something specific to coding jobs.
export function getAgentCodeErrorKey(error: unknown) {
  const status = error instanceof HttpError ? error.status : undefined;
  if (status === 429) return "agent:code.errors.limit";
  if (status === 409) return "agent:code.errors.committing";
  return getAgentErrorKey(error);
}
