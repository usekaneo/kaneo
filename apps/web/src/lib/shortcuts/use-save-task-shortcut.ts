import { useEffect, useLayoutEffect, useRef } from "react";
import { useShortcut } from "./use-shortcut";

const savers = new Set<() => void>();
const saveAll = () => {
  for (const save of savers) save();
};

/**
 * Saves pending task edits on the "saveTask" shortcut. The registry runs only
 * the best-ranked binding for a key, so whichever binding wins saves every
 * mounted part of the task (title, description), not just its own.
 */
export function useSaveTaskShortcut(save: () => void) {
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const run = () => saveRef.current();
    savers.add(run);
    return () => {
      savers.delete(run);
    };
  }, []);

  useShortcut("saveTask", saveAll, { scope: "task" });
}
