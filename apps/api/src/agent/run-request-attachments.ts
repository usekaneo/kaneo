import { isTextAttachment } from "./is-text-attachment";
import type { AgentAttachment, AgentTextAttachment } from "./types";

export type AgentRunAttachmentInput = AgentTextAttachment | { id: string };

// Reduces stored attachments to the request shape so a repeated request can
// be matched to the run it created.
export function toRunAttachmentInput(
  attachments: AgentAttachment[],
): AgentRunAttachmentInput[] {
  return attachments.map((file) =>
    isTextAttachment(file)
      ? { name: file.name, content: file.content }
      : { id: file.id },
  );
}

export function uploadIds(attachments: AgentRunAttachmentInput[]) {
  return attachments.flatMap((file) => ("id" in file ? [file.id] : []));
}
