import { isTextAttachment } from "./is-text-attachment";
import type { AgentAttachment } from "./types";

// Run responses list attachment metadata, never contents.
export function summarizeAttachments(attachments: AgentAttachment[]) {
  return attachments.map((file) =>
    isTextAttachment(file)
      ? { type: "text" as const, name: file.name, size: file.content.length }
      : {
          type: "file" as const,
          id: file.id,
          name: file.name,
          mediaType: file.mediaType,
          size: file.size,
        },
  );
}
