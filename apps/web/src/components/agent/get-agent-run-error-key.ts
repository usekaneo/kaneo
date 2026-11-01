// Matches UNSUPPORTED_ATTACHMENTS_ERROR in apps/api/src/agent; other run
// errors are shown as stored.
const unsupportedAttachments =
  "The model cannot read these attachments; remove them or use a model with image input";

export function getAgentRunErrorKey(error: string | null | undefined) {
  if (error === "AI credit required") return "agent:errors.aiCredit";
  if (error === unsupportedAttachments)
    return "agent:errors.unsupportedAttachments";
  return null;
}
