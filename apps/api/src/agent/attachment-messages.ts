import type { UserContent } from "ai";
import { isTextAttachment } from "./is-text-attachment";
import type {
  AgentAttachment,
  AgentFileAttachment,
  AgentTextAttachment,
} from "./types";

function escapeName(name: string) {
  return name.replace(/["<>\n]/g, "_");
}

export function withAttachmentContents(
  prompt: string,
  attachments: AgentTextAttachment[],
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

// Text files are inlined; images and PDFs become file parts whose bytes were
// loaded server-side for this turn only.
export function buildUserContent(
  prompt: string,
  attachments: AgentAttachment[],
  uploads: ReadonlyMap<string, Uint8Array>,
): UserContent {
  const text = withAttachmentContents(
    prompt,
    attachments.filter(isTextAttachment),
  );
  const files = attachments.filter(
    (file): file is AgentFileAttachment => !isTextAttachment(file),
  );
  if (files.length === 0) return text;
  return [
    { type: "text", text },
    ...files.flatMap((file) => {
      const data = uploads.get(file.id);
      if (!data) throw new Error("Attachment data is missing");
      return [
        {
          type: "text" as const,
          text: `[Attached file: ${escapeName(file.name)}]`,
        },
        {
          type: "file" as const,
          mediaType: file.mediaType,
          filename: file.name,
          data: { type: "data" as const, data },
        },
      ];
    }),
  ];
}
