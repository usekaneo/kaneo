import { useLayoutEffect, useMemo, useRef } from "react";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";

type TaskCopyShortcutsOptions = {
  enabled: boolean;
  onCopyLink: () => void;
  onCopyBranch: () => void;
};

export function useTaskCopyShortcuts({
  enabled,
  onCopyLink,
  onCopyBranch,
}: TaskCopyShortcutsOptions) {
  const handlers = useRef({ onCopyLink, onCopyBranch });
  useLayoutEffect(() => {
    handlers.current = { onCopyLink, onCopyBranch };
  });

  const copyShortcuts = useMemo(
    () =>
      enabled
        ? {
            modifierShortcuts: {
              [shortcuts.copyTask.prefix]: {
                [shortcuts.copyTask.link]: () => handlers.current.onCopyLink(),
                [shortcuts.copyTask.branch]: () =>
                  handlers.current.onCopyBranch(),
              },
            },
          }
        : {},
    [enabled],
  );
  useRegisterShortcuts(copyShortcuts);
}
