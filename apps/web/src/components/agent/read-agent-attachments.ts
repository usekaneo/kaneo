import type {
  AgentAttachmentDraft,
  AgentFileDraft,
} from "./agent-attachment-draft";

// Mirrors AGENT_ATTACHMENT_LIMITS in the API so most problems surface before
// sending; the API still enforces them.
export const agentAttachmentLimits = {
  files: 5,
  charactersPerFile: 50_000,
  totalCharacters: 100_000,
  bytesPerUpload: 5 * 1024 * 1024,
};

export const agentUploadMediaTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export const agentAttachmentAccept = [
  ...agentUploadMediaTypes,
  ".md,.markdown,.txt,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.log,text/*",
].join(",");

export type AgentAttachmentError =
  | "tooMany"
  | "tooLarge"
  | "fileTooLarge"
  | "unsupported"
  | "empty";

const binaryTypes =
  /^(image|audio|video|font)\/|^application\/(pdf|zip|octet-stream)/;

export async function readAgentAttachments(
  files: File[],
  current: AgentAttachmentDraft[],
  makeKey: () => string = () => crypto.randomUUID(),
): Promise<{
  attachments: AgentAttachmentDraft[];
  uploads: AgentFileDraft[];
  error?: AgentAttachmentError;
}> {
  const attachments = [...current];
  const uploads: AgentFileDraft[] = [];
  const done = (error?: AgentAttachmentError) => ({
    attachments,
    uploads,
    ...(error ? { error } : {}),
  });
  const textLength = (item: AgentAttachmentDraft) =>
    item.kind === "text" ? item.content.length : 0;
  let total = current.reduce((sum, item) => sum + textLength(item), 0);

  for (const file of files) {
    const name = file.name.slice(0, 200) || "file";
    if (agentUploadMediaTypes.includes(file.type)) {
      if (attachments.length >= agentAttachmentLimits.files)
        return done("tooMany");
      if (file.size > agentAttachmentLimits.bytesPerUpload)
        return done("fileTooLarge");
      if (file.size === 0) return done("empty");
      // Pasted screenshots share names, so uploads are never replaced by name.
      const upload: AgentFileDraft = {
        kind: "file",
        key: makeKey(),
        name,
        mediaType: file.type,
        file,
        id: null,
      };
      attachments.push(upload);
      uploads.push(upload);
      continue;
    }
    // Re-attaching a text file with the same name replaces the earlier copy.
    const existing = attachments.findIndex(
      (item) => item.kind === "text" && item.name === name,
    );
    if (existing !== -1) {
      total -= textLength(attachments[existing]);
      attachments.splice(existing, 1);
    }
    if (attachments.length >= agentAttachmentLimits.files)
      return done("tooMany");
    if (binaryTypes.test(file.type)) return done("unsupported");
    // UTF-8 never needs fewer bytes than characters, so this avoids reading
    // files that cannot fit.
    if (file.size > agentAttachmentLimits.charactersPerFile * 4)
      return done("tooLarge");
    const content = await file.text();
    if (content.includes("\u0000")) return done("unsupported");
    if (!content.trim()) return done("empty");
    if (
      content.length > agentAttachmentLimits.charactersPerFile ||
      total + content.length > agentAttachmentLimits.totalCharacters
    )
      return done("tooLarge");
    total += content.length;
    attachments.push({ kind: "text", key: makeKey(), name, content });
  }

  return done();
}
