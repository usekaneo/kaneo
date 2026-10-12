import { useShortcut } from "@/lib/shortcuts/use-shortcut";

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
  useShortcut("copyTaskUrl", onCopyLink, { enabled });
  useShortcut("copyBranchName", onCopyBranch, { enabled });
}
