import { HttpError } from "@/lib/http-error";

// Map agent API failures to copy; response bodies are not shown verbatim.
export function getAgentErrorKey(error: unknown) {
  const status = error instanceof HttpError ? error.status : undefined;
  if (status === 429) return "agent:errors.rateLimited";
  if (status === 409) return "agent:errors.conflict";
  if (status === 503) return "agent:errors.unavailable";
  if (status === 402) return "agent:errors.entitlement";
  if (status === 403 || status === 404) return "agent:errors.forbidden";
  return "agent:errors.generic";
}
