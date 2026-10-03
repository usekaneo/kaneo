import type { AgentAttachment } from "./types";

// Run responses list attachment names and sizes, never their contents.
export function summarizeAttachments(attachments: AgentAttachment[]) {
  return attachments.map((file) => ({
    name: file.name,
    size: file.content.length,
  }));
}
