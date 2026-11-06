import { useCallback, useMemo, useRef, useState } from "react";

import type { EditorCommand, EditorFormatState } from "./editor-commands";
import { createFormatStore } from "./format-store";
import type { RichEditorHandle } from "./rich-editor-dom";
import { useDescriptionAutosave } from "./use-description-autosave";

export function useRichDescription(taskId: string, description: string) {
  const ref = useRef<RichEditorHandle>(null);
  const formats = useRef(createFormatStore()).current;
  const [focused, setFocused] = useState(false);
  const { change, flush } = useDescriptionAutosave(taskId, description);

  const onChange = useCallback(
    async (markdown: string) => change(markdown),
    [change],
  );
  const onFormatChange = useCallback(
    async (state: EditorFormatState) => formats.set(state),
    [formats],
  );
  const onFocusChange = useCallback(
    async (next: boolean) => {
      setFocused(next);
      if (!next) await flush();
    },
    [flush],
  );
  const run = useCallback(
    (command: EditorCommand) => ref.current?.run(command),
    [],
  );
  const blur = useCallback(() => ref.current?.blur(), []);

  return useMemo(
    () => ({
      ref,
      formats,
      focused,
      onChange,
      onFormatChange,
      onFocusChange,
      run,
      blur,
    }),
    [formats, focused, onChange, onFormatChange, onFocusChange, run, blur],
  );
}

export type RichDescription = ReturnType<typeof useRichDescription>;
