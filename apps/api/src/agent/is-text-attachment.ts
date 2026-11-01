import type { AgentAttachment, AgentTextAttachment } from "./types";

// Runs created before file uploads only hold text attachments without an id.
export function isTextAttachment(
  attachment: AgentAttachment,
): attachment is AgentTextAttachment {
  return "content" in attachment;
}
