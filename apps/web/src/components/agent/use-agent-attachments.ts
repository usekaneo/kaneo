import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useUploadAgentAttachment from "@/hooks/mutations/agent/use-upload-agent-attachment";
import { toast } from "@/lib/toast";
import {
  type AgentAttachmentDraft,
  toRunAttachmentInput,
} from "./agent-attachment-draft";
import { getAgentUploadErrorKey } from "./get-agent-upload-error-key";
import {
  agentAttachmentLimits,
  readAgentAttachments,
} from "./read-agent-attachments";

export function useAgentAttachments(workspaceId: string) {
  const { t } = useTranslation();
  const [items, setItems] = useState<AgentAttachmentDraft[]>([]);
  // Uploads finish after renders, so updates go through the latest list.
  const itemsRef = useRef(items);
  const { mutateAsync: upload } = useUploadAgentAttachment(workspaceId);

  const update = useCallback(
    (next: (current: AgentAttachmentDraft[]) => AgentAttachmentDraft[]) => {
      itemsRef.current = next(itemsRef.current);
      setItems(itemsRef.current);
    },
    [],
  );

  const add = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const result = await readAgentAttachments(files, itemsRef.current);
      update(() => result.attachments);
      if (result.error)
        toast.error(
          t(`agent:composer.attachmentErrors.${result.error}`, {
            count: agentAttachmentLimits.files,
            size: agentAttachmentLimits.bytesPerUpload / (1024 * 1024),
          }),
        );
      await Promise.all(
        result.uploads.map(async (draft) => {
          try {
            const stored = await upload({
              name: draft.name,
              mediaType: draft.mediaType,
              file: draft.file,
            });
            update((current) =>
              current.map((item) =>
                item.key === draft.key ? { ...draft, id: stored.id } : item,
              ),
            );
          } catch (error) {
            update((current) =>
              current.filter((item) => item.key !== draft.key),
            );
            toast.error(
              t(getAgentUploadErrorKey(error), {
                name: draft.name,
                size: agentAttachmentLimits.bytesPerUpload / (1024 * 1024),
              }),
            );
          }
        }),
      );
    },
    [t, update, upload],
  );

  const remove = useCallback(
    (key: string) =>
      update((current) => current.filter((item) => item.key !== key)),
    [update],
  );
  const clear = useCallback(() => update(() => []), [update]);

  return useMemo(
    () => ({
      items,
      add,
      remove,
      clear,
      uploading: items.some((item) => item.kind === "file" && !item.id),
      toRunInput: () => toRunAttachmentInput(items),
    }),
    [items, add, remove, clear],
  );
}

export type AgentAttachments = ReturnType<typeof useAgentAttachments>;
