import { useMemo } from "react";
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
  const copyShortcuts = useMemo(
    () =>
      enabled
        ? {
            modifierShortcuts: {
              [shortcuts.copyTask.prefix]: {
                [shortcuts.copyTask.link]: onCopyLink,
                [shortcuts.copyTask.branch]: onCopyBranch,
              },
            },
          }
        : {},
    [enabled, onCopyLink, onCopyBranch],
  );
  useRegisterShortcuts(copyShortcuts);
}
