import { HttpError } from "@/lib/http-error";
import { getAgentErrorKey } from "./get-agent-error-key";

export function getAgentUploadErrorKey(error: unknown) {
  const status = error instanceof HttpError ? error.status : undefined;
  if (status === 413) return "agent:composer.attachmentErrors.fileTooLarge";
  if (status === 400) return "agent:composer.attachmentErrors.unreadable";
  if (status === 429) return "agent:composer.attachmentErrors.tooManyPending";
  if (status === 402 || status === 403 || status === 404 || status === 503)
    return getAgentErrorKey(error);
  return "agent:composer.attachmentErrors.uploadFailed";
}
