import type { AgentRunAttachmentInput } from "@/types/agent";

export type AgentTextDraft = {
  kind: "text";
  key: string;
  name: string;
  content: string;
};
// Images and PDFs upload as soon as they are added; id is set once stored.
export type AgentFileDraft = {
  kind: "file";
  key: string;
  name: string;
  mediaType: string;
  file: File;
  id: string | null;
};
export type AgentAttachmentDraft = AgentTextDraft | AgentFileDraft;

export function toRunAttachmentInput(
  drafts: AgentAttachmentDraft[],
): AgentRunAttachmentInput[] {
  return drafts.flatMap((draft): AgentRunAttachmentInput[] => {
    if (draft.kind === "text")
      return [{ name: draft.name, content: draft.content }];
    return draft.id ? [{ id: draft.id }] : [];
  });
}
