import { useEffect } from "react";

const TYPING = "input, textarea, [contenteditable='true'], .ProseMirror";
const POPUP =
  "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";

export function isInsidePopup(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(POPUP));
}

type Selection = {
  selectAll: () => void;
  clearSelection: () => void;
};

export function useBulkSelectionKeys({ selectAll, clearSelection }: Selection) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key === "a"
      ) {
        if (target instanceof Element && target.closest(TYPING)) return;
        event.preventDefault();
        selectAll();
      }

      if (event.key === "Escape") {
        if (event.defaultPrevented || isInsidePopup(target)) return;
        event.preventDefault();
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectAll, clearSelection]);
}
