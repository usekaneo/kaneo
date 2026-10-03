import type { AgentAttachment } from "./types";

function escapeName(name: string) {
  return name.replace(/["<>\n]/g, "_");
}

export function withAttachmentContents(
  prompt: string,
  attachments: AgentAttachment[],
) {
  if (attachments.length === 0) return prompt;
  const files = attachments
    .map(
      (file) =>
        `<attached_file name="${escapeName(file.name)}">\n${file.content.replaceAll("</attached_file>", "</attached_file_>")}\n</attached_file>`,
    )
    .join("\n\n");
  return `${prompt}\n\n${files}`;
}

export function withAttachmentNames(
  prompt: string,
  attachments: AgentAttachment[],
) {
  if (attachments.length === 0) return prompt;
  return `${prompt}\n\n[Attached earlier: ${attachments.map((file) => escapeName(file.name)).join(", ")}]`;
}
