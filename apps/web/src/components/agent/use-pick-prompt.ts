import { useCallback, useRef } from "react";

// Fills the composer with a suggested prompt and hands focus back to it, so
// Enter sends without another click.
export function usePickPrompt(setDraft: (value: string) => void) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pick = useCallback(
    (prompt: string) => {
      setDraft(prompt);
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    },
    [setDraft],
  );
  return { inputRef, pick };
}
