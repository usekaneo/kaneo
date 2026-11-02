import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useUploadAgentAttachment from "@/hooks/mutations/agent/use-upload-agent-attachment";
import { toast } from "@/lib/toast";
import {
  type AgentAttachmentDraft,
  toRunAttachmentInput,
} from "./agent-attachment-draft";
import { getAgentUploadErrorKey } from "./get-agent-upload-error-key";
import { mergeAgentAttachment } from "./merge-agent-attachment";
import {
  agentAttachmentLimits,
  readAgentAttachments,
  type AgentAttachmentError,
} from "./read-agent-attachments";

export function useAgentAttachments(workspaceId: string) {
  const { t } = useTranslation();
  const [items, setItems] = useState<AgentAttachmentDraft[]>([]);
  const [reading, setReading] = useState(0);
  // Uploads finish after renders, so updates go through the latest list.
  const itemsRef = useRef(items);
  const generation = useRef(0);
  const readQueue = useRef<Promise<void>>(Promise.resolve());
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
      const started = generation.current;
      const pending: Promise<void>[] = [];
      const reportError = (error: AgentAttachmentError) =>
        toast.error(
          t(`agent:composer.attachmentErrors.${error}`, {
            count: agentAttachmentLimits.files,
            size: agentAttachmentLimits.bytesPerUpload / (1024 * 1024),
          }),
        );
      setReading((count) => count + 1);
      const read = async () => {
        if (generation.current !== started) return;
        try {
          for (const file of files) {
            const result = await readAgentAttachments([file], []);
            if (generation.current !== started) break;
            if (result.error) {
              reportError(result.error);
              break;
            }
            const draft = result.attachments[0];
            if (!draft) continue;
            let error: AgentAttachmentError | undefined;
            update((current) => {
              const merged = mergeAgentAttachment(current, draft);
              error = merged.error;
              return merged.attachments;
            });
            if (error) {
              reportError(error);
              break;
            }
            if (draft.kind !== "file") continue;
            pending.push(
              (async () => {
                try {
                  const stored = await upload({
                    name: draft.name,
                    mediaType: draft.mediaType,
                    file: draft.file,
                  });
                  if (generation.current !== started) return;
                  update((current) =>
                    current.map((item) =>
                      item.key === draft.key && item.kind === "file"
                        ? { ...item, id: stored.id }
                        : item,
                    ),
                  );
                } catch (failure) {
                  if (
                    generation.current !== started ||
                    !itemsRef.current.some((item) => item.key === draft.key)
                  )
                    return;
                  update((current) =>
                    current.filter((item) => item.key !== draft.key),
                  );
                  toast.error(
                    t(getAgentUploadErrorKey(failure), {
                      name: draft.name,
                      size:
                        agentAttachmentLimits.bytesPerUpload / (1024 * 1024),
                    }),
                  );
                }
              })(),
            );
          }
        } catch {
          if (generation.current === started)
            toast.error(t("agent:composer.attachmentErrors.unreadable"));
        } finally {
          if (generation.current === started) setReading((count) => count - 1);
        }
      };
      // Keep replacements in selection order, while uploads remain concurrent.
      const readingDone = readQueue.current.then(read);
      readQueue.current = readingDone.catch(() => {});
      await readingDone;
      await Promise.all(pending);
    },
    [t, update, upload],
  );

  const remove = useCallback(
    (key: string) =>
      update((current) => current.filter((item) => item.key !== key)),
    [update],
  );
  const cancelPending = useCallback(() => {
    generation.current++;
    readQueue.current = Promise.resolve();
  }, []);
  const clear = useCallback(() => {
    cancelPending();
    setReading(0);
    update(() => []);
  }, [cancelPending, update]);

  useEffect(() => {
    clear();
    return cancelPending;
  }, [workspaceId, clear, cancelPending]);

  return useMemo(
    () => ({
      items,
      add,
      remove,
      clear,
      uploading:
        reading > 0 || items.some((item) => item.kind === "file" && !item.id),
      toRunInput: () => toRunAttachmentInput(items),
    }),
    [items, reading, add, remove, clear],
  );
}

export type AgentAttachments = ReturnType<typeof useAgentAttachments>;
