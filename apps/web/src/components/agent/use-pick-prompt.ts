import { useCallback, useRef } from "react";
import type { AgentPromptEditorHandle } from "./mention/agent-prompt-editor";

// Fills the composer with a suggested prompt and hands focus back to it, so
// Enter sends without another click.
export function usePickPrompt(setDraft: (value: string) => void) {
  const inputRef = useRef<AgentPromptEditorHandle>(null);
  const pick = useCallback(
    (prompt: string) => {
      setDraft(prompt);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [setDraft],
  );
  return { inputRef, pick };
}
