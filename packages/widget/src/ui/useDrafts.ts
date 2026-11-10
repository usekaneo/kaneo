import { useEffect, useRef, useState } from "react";
import type { SubmissionOptions } from "./types.js";

export interface Draft {
  body: string;
  files: readonly File[];
  pending: boolean;
  error: string;
  requestId?: string;
}
export const emptyDraft: Draft = {
  body: "",
  files: [],
  pending: false,
  error: "",
};

/** Session-owned drafts survive view changes; the host remounts on identity changes. */
export function useDrafts() {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const current = useRef(drafts);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const update = (key: string, draft: Draft) => {
    current.current = { ...current.current, [key]: draft };
    setDrafts(current.current);
  };
  return {
    drafts,
    change(key: string, body: string) {
      const draft = current.current[key] ?? emptyDraft;
      if (!draft.pending)
        update(key, {
          ...draft,
          body,
          error: "",
          requestId:
            body.trim() === draft.body.trim() ? draft.requestId : undefined,
        });
    },
    changeFiles(key: string, files: readonly File[]) {
      const draft = current.current[key] ?? emptyDraft;
      if (
        !draft.pending &&
        (files.length !== draft.files.length ||
          files.some((file, index) => file !== draft.files[index]))
      )
        update(key, { ...draft, files, error: "", requestId: undefined });
    },
    async submit(
      key: string,
      action: (body: string, options: SubmissionOptions) => Promise<unknown>,
      onSuccess: () => void,
    ) {
      const draft = current.current[key] ?? emptyDraft;
      if (draft.pending || (!draft.body.trim() && !draft.files.length)) return;
      // getRandomValues also works on self-hosted HTTP origins, unlike randomUUID.
      const requestId =
        draft.requestId ??
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
      const token = generation.current;
      update(key, { ...draft, pending: true, error: "", requestId });
      try {
        await action(draft.body.trim(), {
          idempotencyKey: requestId,
          ...(draft.files.length ? { attachments: draft.files } : {}),
        });
        if (generation.current === token) {
          update(key, emptyDraft);
          onSuccess();
        }
      } catch {
        if (generation.current === token)
          update(key, {
            ...draft,
            requestId,
            pending: false,
            error:
              "Could not send. Your draft is still here. Please try again.",
          });
      }
    },
  };
}
