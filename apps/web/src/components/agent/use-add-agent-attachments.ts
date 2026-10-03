import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import {
  type AgentAttachmentDraft,
  agentAttachmentLimits,
  readAgentAttachments,
} from "./read-agent-attachments";

export function useAddAgentAttachments(
  attachments: AgentAttachmentDraft[],
  onChange: (attachments: AgentAttachmentDraft[]) => void,
) {
  const { t } = useTranslation();

  return useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const result = await readAgentAttachments(files, attachments);
      onChange(result.attachments);
      if (result.error)
        toast.error(
          t(`agent:composer.attachmentErrors.${result.error}`, {
            count: agentAttachmentLimits.files,
          }),
        );
    },
    [attachments, onChange, t],
  );
}
