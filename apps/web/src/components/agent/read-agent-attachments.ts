// Mirrors AGENT_ATTACHMENT_LIMITS in the API so most problems surface before
// sending; the API still enforces them.
export const agentAttachmentLimits = {
  files: 3,
  charactersPerFile: 50_000,
  totalCharacters: 100_000,
};

export const agentAttachmentAccept =
  ".md,.markdown,.txt,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.log,text/*";

export type AgentAttachmentDraft = { name: string; content: string };
export type AgentAttachmentError = "tooMany" | "tooLarge" | "notText" | "empty";

const binaryTypes =
  /^(image|audio|video|font)\/|^application\/(pdf|zip|octet-stream)/;

export async function readAgentAttachments(
  files: File[],
  current: AgentAttachmentDraft[],
): Promise<{
  attachments: AgentAttachmentDraft[];
  error?: AgentAttachmentError;
}> {
  const attachments = [...current];
  let total = current.reduce((sum, file) => sum + file.content.length, 0);

  for (const file of files) {
    const name = file.name.slice(0, 200);
    // Re-attaching a file with the same name replaces the earlier copy.
    const existing = attachments.findIndex((item) => item.name === name);
    if (existing !== -1) {
      total -= attachments[existing].content.length;
      attachments.splice(existing, 1);
    }
    if (attachments.length >= agentAttachmentLimits.files)
      return { attachments, error: "tooMany" };
    if (binaryTypes.test(file.type)) return { attachments, error: "notText" };
    // UTF-8 never needs fewer bytes than characters, so this avoids reading
    // files that cannot fit.
    if (file.size > agentAttachmentLimits.charactersPerFile * 4)
      return { attachments, error: "tooLarge" };
    const content = await file.text();
    if (content.includes("\u0000")) return { attachments, error: "notText" };
    if (!content.trim()) return { attachments, error: "empty" };
    if (
      content.length > agentAttachmentLimits.charactersPerFile ||
      total + content.length > agentAttachmentLimits.totalCharacters
    )
      return { attachments, error: "tooLarge" };
    total += content.length;
    attachments.push({ name, content });
  }

  return { attachments };
}
